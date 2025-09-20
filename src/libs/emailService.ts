import nodemailer from 'nodemailer';
import Config from "../config/config";
import SMTPTransport from "nodemailer/lib/smtp-transport";


class MailService {
    private transporter: nodemailer.Transporter<SMTPTransport.SentMessageInfo, SMTPTransport.Options>;

    constructor() {
        // Initialize your mail transporter here (e.g., using nodemailer)
        this.transporter = nodemailer.createTransport(
            {
                host: Config.SMTP_HOST,
                port: Number(Config.SMTP_PORT),
                secure: process.env.NODE_ENV === 'production',
                auth: {
                    user: Config.SMTP_USER,
                    pass: Config.SMTP_PASS,
                }
            }
        )
    }

    async sendMail({to, subject, html}: { to: string, subject: string, html: string }): Promise<boolean> {
        try {
            await this.transporter.sendMail({
                from: `"Coffe" ${Config.SMTP_USER}`,
                to,
                subject,
                html: html
            })
            return true
        } catch (e) {
            console.error(`Failed to send email to ${to}: ${JSON.stringify(e)}`);
            return false;
        }
    }
}

export default new MailService();