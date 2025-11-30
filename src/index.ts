import Config from "./config/config";
import RabbitmqService from "./libs/rabbitmqService";
import EmailService from "./libs/emailService";
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

    const callBackResetPassword = async (msg: ConsumeMessage, channel: Channel) => {
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
            channel.ack(msg);
        } else {
            channel.nack(msg, false, true); // requeue
        }
    }
    const callBackSuccessResetPassword = async (msg: ConsumeMessage, channel: Channel) => {
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
            channel.ack(msg);
        } else {
            channel.nack(msg, false, true); // requeue
        }

    }

    // Consumer
    await Promise.all([
        RabbitmqService.consume("emailQueue.resetPassword", callBackResetPassword),
        RabbitmqService.consume("emailQueue.resetPasswordSuccess", callBackSuccessResetPassword)
    ]);

})();

const app = express();

// Simple request logger similar to previous onRequest
app.use((req, _res, next) => {
    try {
        console.log(`${req.method} /${req.url.split('/').slice(3).join('/')}`);
    } catch (e) {
        console.log(`${req.method} ${req.url}`);
    }
    next();
});

app.get('/health', async (_req, res) => {
    try {
        const result = await RabbitmqService.healthCheck();
        // If healthCheck returns a boolean or object, just send it back
        res.json(result);
    } catch (err) {
        res.status(500).json({ok: false, error: (err as Error).message});
    }
});

app.all('(.*)', (_req, res) => {
    res.status(404).json({message: 'Resource not found'});
});


const server = app.listen(Config.PORT, () => {
    console.log(`🚀 Express is running at http://localhost:${Config.PORT}`);
});

console.log('Server initialization complete.');
