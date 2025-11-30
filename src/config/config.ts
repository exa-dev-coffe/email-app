import dotenv from 'dotenv';

dotenv.config();


class Config {
    static PORT = process.env.PORT || 3000;
    static RABBITMQ_BROKER_URL = process.env.RABBITMQ_BROKER_URL || 'amqp://localhost:5672';
    static readonly SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
    static readonly SMTP_PORT = process.env.SMTP_PORT || '587';
    static readonly SMTP_USER = process.env.SMTP_USER || 'testuser'
    static readonly SMTP_PASS = process.env.SMTP_PASS || 'testpass';
}

export default Config;