import Config from "./config/config";
import RabbitmqService from "./libs/rabbitmqService";
import EmailService from "./libs/emailService";
import Logger from "./libs/logger";
import * as path from "node:path";

import * as fs from "node:fs";
import type {Channel, ConsumeMessage} from "amqplib";
import express from 'express';

(async () => {
    await RabbitmqService.init();

    const templatePathResetPassword = path.join(__dirname, "templates", "content_reset_password.html");
    const templateHtmlResetPassword = fs.readFileSync(templatePathResetPassword, "utf-8");
    const templatePathSuccessResetPassword = path.join(__dirname, "templates", "content_success_reset_password.html");
    const templateHtmlSuccessResetPassword = fs.readFileSync(templatePathSuccessResetPassword, "utf-8");
    const templatePathTopupReceipt = path.join(__dirname, "templates", "content_topup_receipt.html");
    const templateHtmlTopupReceipt = fs.readFileSync(templatePathTopupReceipt, "utf-8");
    const templatePathOrderReceipt = path.join(__dirname, "templates", "content_order_receipt.html");
    const templateHtmlOrderReceipt = fs.readFileSync(templatePathOrderReceipt, "utf-8");

    const callBackResetPassword = async (msg: ConsumeMessage, channel: Channel) => {
        Logger.info(`[RabbitMQ] 📥 Received message for: Email Reset Password`);
        const content = msg.content.toString();
        const data: { subject: string, link: string, to: string } = JSON.parse(content);

        const html = templateHtmlResetPassword
            .replace("{{link}}", data.link)
            .replace('{{year}}', new Date().getFullYear().toString())
            .replace('{{email}}', data.to)
        ;

        const success = await EmailService.sendMail({
            to: data.to,
            subject: data.subject,
            html: html
        })

        if (success) {
            Logger.info(`[RabbitMQ] ✅ Reset password email sent to ${data.to}`);
            channel.ack(msg);
        } else {
            Logger.error(`[RabbitMQ] ❌ Failed to send reset password email to ${data.to}, requeueing...`);
            channel.nack(msg, false, true); // requeue
        }
    }
    const callBackSuccessResetPassword = async (msg: ConsumeMessage, channel: Channel) => {
        Logger.info(`[RabbitMQ] 📥 Received message for: Email Reset Password Success`);
        const content = msg.content.toString();
        const data: { subject: string, to: string } = JSON.parse(content);
        const html = templateHtmlSuccessResetPassword
            .replace('{{year}}', new Date().getFullYear().toString())
            .replace('{{email}}', data.to)
        ;

        const success = await EmailService.sendMail({
            to: data.to,
            subject: data.subject,
            html: html
        })

        if (success) {
            Logger.info(`[RabbitMQ] ✅ Success reset password notification email sent to ${data.to}`);
            channel.ack(msg);
        } else {
            Logger.error(`[RabbitMQ] ❌ Failed to send success reset password notification email to ${data.to}, requeueing...`);
            channel.nack(msg, false, true); // requeue
        }

    }

    const callBackTopupReceipt = async (msg: ConsumeMessage, channel: Channel) => {
        Logger.info(`[RabbitMQ] 📥 Received message for: Email Topup Receipt`);
        const content = msg.content.toString();
        const data: {
            to: string,
            subject: string,
            userName: string,
            amount: number,
            paymentType: string,
            bank: string,
            transactionId: string,
            date: string
        } = JSON.parse(content);

        // Format amount as Indonesian Rupiah (IDR)
        const formattedAmount = new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0
        }).format(data.amount);

        const html = templateHtmlTopupReceipt
            .replace("{{userName}}", data.userName)
            .replace("{{transactionId}}", data.transactionId)
            .replace("{{date}}", data.date)
            .replace("{{paymentType}}", (data.paymentType || "Core API").toUpperCase())
            .replace("{{bank}}", (data.bank || "-").toUpperCase())
            .replace("{{amount}}", formattedAmount)
            .replace("{{email}}", data.to)
            .replace("{{year}}", new Date().getFullYear().toString());

        const success = await EmailService.sendMail({
            to: data.to,
            subject: data.subject,
            html: html
        })

        if (success) {
            Logger.info(`[RabbitMQ] ✅ Top-up receipt email successfully sent to ${data.to} for amount ${formattedAmount}`);
            channel.ack(msg);
        } else {
            Logger.error(`[RabbitMQ] ❌ Failed to send top-up receipt email to ${data.to}, requeueing...`);
            channel.nack(msg, false, true); // requeue
        }
    }

    const callBackOrderReceipt = async (msg: ConsumeMessage, channel: Channel) => {
        Logger.info(`[RabbitMQ] 📥 Received message for: Email Order Receipt`);
        const content = msg.content.toString();
        const data: {
            to: string,
            subject: string,
            userName: string,
            orderId: string | number,
            orderFor: string,
            amount: number,
            date: string
        } = JSON.parse(content);

        // Format amount as Indonesian Rupiah (IDR)
        const formattedAmount = new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0
        }).format(data.amount);

        const html = templateHtmlOrderReceipt
            .replace("{{userName}}", data.userName)
            .replace("{{orderId}}", String(data.orderId))
            .replace("{{date}}", data.date)
            .replace("{{orderFor}}", data.orderFor || "-")
            .replace("{{amount}}", formattedAmount)
            .replace("{{email}}", data.to)
            .replace("{{year}}", new Date().getFullYear().toString());

        const success = await EmailService.sendMail({
            to: data.to,
            subject: data.subject,
            html: html
        })

        if (success) {
            Logger.info(`[RabbitMQ] ✅ Order receipt email successfully sent to ${data.to} for amount ${formattedAmount}`);
            channel.ack(msg);
        } else {
            Logger.error(`[RabbitMQ] ❌ Failed to send order receipt email to ${data.to}, requeueing...`);
            channel.nack(msg, false, true); // requeue
        }
    }


    // Consumer
    await Promise.all([
        RabbitmqService.consume("email.queue", "emailQueue.resetPassword", "Email Reset Password", 'direct', true, callBackResetPassword),
        RabbitmqService.consume("email.queue", 'emailQueue.resetPasswordSuccess', 'Email Reset Password Success', 'direct', true, callBackSuccessResetPassword),
        RabbitmqService.consume("email.queue", 'emailQueue.topupReceipt', 'Email Topup Receipt', 'direct', true, callBackTopupReceipt),
        RabbitmqService.consume("email.queue", 'emailQueue.orderReceipt', 'Email Order Receipt', 'direct', true, callBackOrderReceipt)
    ]);


})();

const app = express();

// Simple request logger similar to previous onRequest
app.use((req, _res, next) => {
    try {
        Logger.info(`${req.method} /${req.url.split('/').slice(3).join('/')}`);
    } catch (e) {
        Logger.info(`${req.method} ${req.url}`);
    }
    next();
});

app.get('/health', async (_req, res) => {
    try {
        const result = await RabbitmqService.healthCheck();
        res.json(result);
    } catch (err) {
        res.status(500).json({ok: false, error: (err as Error).message});
    }
});

app.use((_, res) => {
    res.status(404).json({message: 'Resource not found'});
});


app.listen(Config.PORT, () => {
    Logger.info(`🚀 Express is running at http://localhost:${Config.PORT}`);
});

Logger.info('Server initialization complete.');

