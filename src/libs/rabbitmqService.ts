import amqp, {type Channel, type ChannelModel, type ConsumeMessage} from "amqplib";
import Config from "../config/config";

class RabbitmqService {

    private connection: ChannelModel | null = null;
    private channel: Channel | null = null

    async init() {
        if (!this.connection) {
            this.connection = await amqp.connect(Config.RABBITMQ_BROKER_URL)
            this.channel = await this.connection.createChannel()
            await this.channel.prefetch(5); // atau sesuai kapasitas server
            this.channel.on("error", (err) => {
                console.error("RabbitMQ channel error:", err);
                this.connection = null;
                this.channel = null;
            })
            this.channel.on("close", () => {
                console.warn("RabbitMQ channel closed");
                this.connection = null;
                this.channel = null;
            })

            console.log("Connected to RabbitMQ");
        }
    }

    async consume(
        exchangeName: string,
        routingKey: string,
        queueName: string,
        type: "topic" | "direct" | "fanout" = "topic",
        durable: boolean = true,
        onMessage: (msg: ConsumeMessage, channel: Channel) => Promise<void>
    ): Promise<void> {

        if (!this.channel) {
            throw new Error("RabbitMQ channel is not initialized");
        }

        // 1. Pastikan exchangenya ada
        await this.channel.assertExchange(exchangeName, type, {durable: durable,});

        // 2. Pastikan queue ada
        await this.channel.assertQueue(queueName, {durable: durable,});

        // 3. Binding queue ke exchange dengan routing key
        await this.channel.bindQueue(queueName, exchangeName, routingKey);

        console.log(
            `Consumer ready → queue '${queueName}' bound to exchange '${exchangeName}' with routing key '${routingKey}'`
        );
        // 4. Consume
        await this.channel.consume(queueName, async (msg) => {
            if (msg && this.channel) {
                await onMessage(msg, this.channel);
            }
        });

    }

    // ✅ Health check
    async healthCheck(): Promise<{ status: string; connected: boolean }> {
        const isConnected = !!this.connection && !!this.channel;
        return {
            status: isConnected ? "ok" : "unhealthy",
            connected: isConnected,
        };
    }
}

export default new RabbitmqService();