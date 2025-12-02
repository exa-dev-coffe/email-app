import Config from "../config/config";
import {Resend} from "resend";


class MailService {
    private client: Resend;

    constructor() {
        // Initialize Resend client with API key from config
        if (!Config.RESEND_API_KEY) {
            console.warn('RESEND_API_KEY is not set. Emails will fail until the key is provided.');
        }
        // @ts-ignore - Resend exports a default function/class
        this.client = new Resend(Config.RESEND_API_KEY);
    }

    async sendMail({to, subject, html}: { to: string; subject: string; html: string; }): Promise<boolean> {
        try {
            // Using Resend to send an email. Adjust from address as needed.
            await this.client.emails.send({
                from: `Coffe <${Config.SMTP_USER}>`,
                to,
                subject,
                html
            });
            return true;
        } catch (e) {
            console.error(`Failed to send email to ${to}: ${JSON.stringify(e)}`);
            return false;
        }
    }
}

export default new MailService();