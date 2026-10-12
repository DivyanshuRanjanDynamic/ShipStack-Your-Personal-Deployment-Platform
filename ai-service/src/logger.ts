export interface LogContext {
  [key: string]: unknown;
}

export const logger = {
  info(message: string, context?: LogContext): void {
    if (context) {
      console.log(`[INFO] ${message}`, JSON.stringify(context));
    } else {
      console.log(`[INFO] ${message}`);
    }
  },
  warn(message: string, context?: LogContext): void {
    if (context) {
      console.warn(`[WARN] ${message}`, JSON.stringify(context));
    } else {
      console.warn(`[WARN] ${message}`);
    }
  },
  error(message: string, error?: unknown, context?: LogContext): void {
    const errorMsg = error instanceof Error ? error.stack || error.message : String(error || "");
    const fullContext = context ? { ...context, error: errorMsg } : { error: errorMsg };
    console.error(`[ERROR] ${message}`, JSON.stringify(fullContext));
  },
  debug(message: string, context?: LogContext): void {
    if (process.env.DEBUG) {
      if (context) {
        console.debug(`[DEBUG] ${message}`, JSON.stringify(context));
      } else {
        console.debug(`[DEBUG] ${message}`);
      }
    }
  },
};
