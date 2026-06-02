/**
 * Structured JSON logger.
 *
 * Emits one JSON object per line so logs are queryable in Vercel / any log
 * drain. Use `logger.child({ ... })` to attach request- or tenant-scoped
 * context (e.g. `{ clubId, userId, requestId }`) that every downstream line
 * inherits. Never log raw PII (child names, contact details, secrets) — log
 * identifiers instead. See @docs/BUILD_PLAN.md §5 (Observability).
 */

type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveMinLevel(): LogLevel {
  const fromEnv = process.env.LOG_LEVEL as LogLevel | undefined;
  if (fromEnv && fromEnv in LEVEL_ORDER) return fromEnv;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

const MIN_LEVEL = resolveMinLevel();

function serializeError(value: unknown) {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

function write(level: LogLevel, base: LogContext, message: string, context?: LogContext) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;

  const entry: LogContext = {
    level,
    time: new Date().toISOString(),
    message,
    ...base,
    ...context,
  };

  if (entry.error !== undefined) entry.error = serializeError(entry.error);

  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  /** Returns a logger that prepends `bindings` to every line. */
  child(bindings: LogContext): Logger;
}

function createLogger(base: LogContext): Logger {
  return {
    debug: (message, context) => write("debug", base, message, context),
    info: (message, context) => write("info", base, message, context),
    warn: (message, context) => write("warn", base, message, context),
    error: (message, context) => write("error", base, message, context),
    child: (bindings) => createLogger({ ...base, ...bindings }),
  };
}

export const logger = createLogger({});
