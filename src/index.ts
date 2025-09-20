import {Elysia} from "elysia";
import Config from "./config/config";
import RabbitmqService from "./libs/rabbitmqService";
import EmailService from "./libs/emailService";
import * as path from "node:path";
import * as fs from "node:fs";

(async () => {
    await RabbitmqService.init();

    const templatePath = path.join(__dirname, "templates", "content_reset_password.html");
    const templateHtml = fs.readFileSync(templatePath, "utf-8");
    // Consumer
    await RabbitmqService.consume("emailQueue", async (msg, channel) => {
        const content = msg.content.toString();
        const data: { subject: string, link: string, to: string } = JSON.parse(content);

        const html = templateHtml
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
        }
    });
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
