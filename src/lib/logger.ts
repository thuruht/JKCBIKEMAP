/**
 * Structured JSON logger for Cloudflare Workers.
 */

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogPayload {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string | undefined;
  data?: any;
  error?: { message: string; stack?: string | undefined; name?: string | undefined } | undefined;
}

function log(level: LogLevel, message: string, data?: any, context?: string) {
  const payload: LogPayload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
  };

  if (data instanceof Error) {
    payload.error = {
      message: data.message,
      stack: data.stack,
      name: data.name,
    };
  } else if (data !== undefined) {
    payload.data = data;
  }

  console.log(JSON.stringify(payload));
}

export const logger = {
  info: (msg: string, data?: any, ctx?: string) => log("info", msg, data, ctx),
  warn: (msg: string, data?: any, ctx?: string) => log("warn", msg, data, ctx),
  error: (msg: string, data?: any, ctx?: string) => log("error", msg, data, ctx),
  debug: (msg: string, data?: any, ctx?: string) => log("debug", msg, data, ctx),
};
