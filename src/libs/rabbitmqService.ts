import amqp, { type Channel, type ChannelModel, type ConsumeMessage } from "amqplib";
import Config from "../config/config";
import Logger from "./logger";

interface ConsumerConfig {
    exchangeName: string;
    routingKey: string;
    queueName: string;
    type: "topic" | "direct" | "fanout";
    durable: boolean;
    onMessage: (msg: ConsumeMessage, channel: Channel) => Promise<void>;
}

class RabbitmqService {
    private connection: ChannelModel | null = null;
    private channel: Channel | null = null;
    private isReconnecting = false;
    private consumers: ConsumerConfig[] = [];

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private async connectWithRetry(retryIntervalMs: number = 3000): Promise<void> {
        let attempt = 0;
        while (true) {
            attempt++;
            try {
                Logger.info(`[RabbitMQ] Connecting to broker at ${Config.RABBITMQ_BROKER_URL} (Attempt ${attempt})...`);
                const conn = await amqp.connect(Config.RABBITMQ_BROKER_URL);
                const ch = await conn.createChannel();
                await ch.prefetch(5);

                this.connection = conn;
                this.channel = ch;

                conn.on("error", (err) => {
                    Logger.error("[RabbitMQ] Connection error: %O", err);
                    this.handleDisconnect();
                });

                conn.on("close", () => {
                    Logger.warn("[RabbitMQ] Connection closed");
                    this.handleDisconnect();
                });

                ch.on("error", (err) => {
                    Logger.error("[RabbitMQ] Channel error: %O", err);
                    this.handleDisconnect();
                });

                ch.on("close", () => {
                    Logger.warn("[RabbitMQ] Channel closed");
                    this.handleDisconnect();
                });

                Logger.info("[RabbitMQ] ✅ Successfully connected to RabbitMQ");
                return;
            } catch (err: any) {
                Logger.warn(`[RabbitMQ] ⚠️ Connection failed: ${err.message}. Retrying in ${retryIntervalMs / 1000}s...`);
                await this.sleep(retryIntervalMs);
            }
        }
    }

    private async handleDisconnect() {
        if (this.isReconnecting) return;
        this.isReconnecting = true;
        this.connection = null;
        this.channel = null;

        Logger.warn("[RabbitMQ] Connection lost. Starting reconnect loop...");
        await this.connectWithRetry();
        this.isReconnecting = false;

        // Re-subscribe all existing consumers upon successful reconnection
        await this.rebindConsumers();
    }

    private async rebindConsumers() {
        if (this.consumers.length === 0) return;
        Logger.info(`[RabbitMQ] Re-registering ${this.consumers.length} consumer(s)...`);
        for (const consumer of this.consumers) {
            try {
                await this.setupConsumer(consumer);
            } catch (err: any) {
                Logger.error(`[RabbitMQ] Failed to rebind consumer '${consumer.queueName}':`, err);
            }
        }
    }

    private async setupConsumer(consumer: ConsumerConfig): Promise<void> {
        if (!this.channel) {
            throw new Error("RabbitMQ channel is not initialized");
        }

        const { exchangeName, routingKey, queueName, type, durable, onMessage } = consumer;

        // 1. Assert exchange
        await this.channel.assertExchange(exchangeName, type, { durable });

        // 2. Assert queue
        await this.channel.assertQueue(queueName, { durable });

        // 3. Bind queue to exchange
        await this.channel.bindQueue(queueName, exchangeName, routingKey);

        Logger.info(
            `[RabbitMQ] Consumer active → Queue '${queueName}' bound to Exchange '${exchangeName}' with Key '${routingKey}'`
        );

        // 4. Start consuming
        await this.channel.consume(queueName, async (msg) => {
            if (msg && this.channel) {
                await onMessage(msg, this.channel);
            }
        });
    }

    async init() {
        if (!this.connection) {
            await this.connectWithRetry();
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
        const consumerConfig: ConsumerConfig = {
            exchangeName,
            routingKey,
            queueName,
            type,
            durable,
            onMessage,
        };

        // Save to active consumers list for automatic recovery
        const existingIdx = this.consumers.findIndex((c) => c.queueName === queueName);
        if (existingIdx >= 0) {
            this.consumers[existingIdx] = consumerConfig;
        } else {
            this.consumers.push(consumerConfig);
        }

        await this.setupConsumer(consumerConfig);
    }

    async healthCheck(): Promise<{ status: string; connected: boolean; activeConsumers: number }> {
        const isConnected = !!this.connection && !!this.channel;
        return {
            status: isConnected ? "ok" : "unhealthy",
            connected: isConnected,
            activeConsumers: this.consumers.length,
        };
    }
}

export default new RabbitmqService();