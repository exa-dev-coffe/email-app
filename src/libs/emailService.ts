import Config from "../config/config";
import {Resend} from "resend";
import Logger from "./logger";

class MailService {
    private client: Resend;

    constructor() {
        // Initialize Resend client with API key from config
        if (!Config.RESEND_API_KEY) {
            Logger.warn('RESEND_API_KEY is not set. Emails will fail until the key is provided.');
        }
        // @ts-ignore - Resend exports a default function/class
        this.client = new Resend(Config.RESEND_API_KEY);
    }

    async sendMail({to, subject, html}: { to: string; subject: string; html: string; }): Promise<boolean> {
        try {
            // Using Resend to send an email. Adjust from address as needed.
            const result = await this.client.emails.send({
                from: `Coffe <${Config.SMTP_USER}>`,
                to,
                subject,
                html
            });

            if (result.error) {
                Logger.error(`Resend API Error while sending email to ${to}: %O`, result.error);
                return false;
            }

            return true;
        } catch (e) {
            Logger.error(`Failed to send email to ${to}: %O`, e);
            return false;
        }
    }
}

export default new MailService();