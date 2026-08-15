# Email Service (email-service)

Email Service is a lightweight microservice responsible for handling asynchronous email delivery across the platform.

## 🚀 Technologies

*   **Runtime**: Node.js / Bun
*   **Language**: TypeScript
*   **Messaging**: RabbitMQ (Consumer)
*   **Email Client**: Nodemailer (or similar)

## 📦 Features

*   **Asynchronous Processing**: Listens to RabbitMQ queues for email tasks.
*   **Templating**: Sends dynamically formatted HTML emails.
*   **Reliability**: Handles email retries and failures gracefully.

## ⚙️ Environment Variables

Copy `.env.example` to `.env` and fill in your SMTP credentials:

```bash
cp .env.example .env
```

## 🚀 How to Run

1.  **Install Dependencies:**
    ```bash
    bun install
    # or npm install
    ```

2.  **Run Development Server:**
    ```bash
    bun run dev
    # or npm run dev
    ```