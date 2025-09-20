import amqp, {Channel, ChannelModel, ConsumeMessage} from "amqplib";
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

    async consume(channelName: string, onMessage: (msg: ConsumeMessage, channel: Channel) => Promise<void>): Promise<void> {
        if (!this.channel) {
            throw new Error("RabbitMQ channel is not initialized");
        }

        await this.channel.assertQueue(channelName, {durable: true});

        this.channel.consume(channelName, (msg) => {
            if (msg && this.channel) {
                onMessage(msg, this.channel);
                // this.channel.ack(msg);
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