import {Elysia} from "elysia";
import Config from "./config/config";
import RabbitmqService from "./libs/rabbitmqService";
import EmailService from "./libs/emailService";
import * as path from "node:path";
import * as fs from "node:fs";
import {Channel, ConsumeMessage} from "amqplib";

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

const app = new Elysia()
    .onRequest((ctx) => {
        console.log(`${ctx.request.method} /${ctx.request.url.split('/').slice(3).join('/')}`);
    })
    .get("/health", () => {
        return RabbitmqService.healthCheck()
    })
    .all(
        '*',
        (ctx) => {
            ctx.set.status = 404;
            return {message: 'Resource not found'};
        },
    )
    .listen(Config.PORT);

console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
