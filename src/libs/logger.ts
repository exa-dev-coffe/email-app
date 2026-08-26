import winston from "winston";
import * as path from "node:path";
import * as fs from "node:fs";

// Log formatting for files (JSON format)
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Log formatting for console (Readable colorized format)
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.colorize(),
    winston.format.printf(
        (info) => `[${info.timestamp}] [${info.level}]: ${info.message}`
    )
);

const transports: winston.transport[] = [
    // Always print to console
    new winston.transports.Console({
        format: consoleFormat,
    })
];

// Only write to files in production to avoid cluttering local dev workspaces
if (process.env.NODE_ENV === "production") {
    const logDirectory = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logDirectory)) {
        fs.mkdirSync(logDirectory, { recursive: true });
    }

    transports.push(
        // Write all logs with level 'error' to error.log
        new winston.transports.File({ 
            filename: path.join(logDirectory, "error.log"), 
            level: "error",
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // Write all logs (info and below) to combined.log
        new winston.transports.File({ 
            filename: path.join(logDirectory, "combined.log"),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        })
    );
}

const logger = winston.createLogger({
    level: "info",
    format: logFormat,
    defaultMeta: { service: "email-service" },
    transports: transports,
});

export default logger;

