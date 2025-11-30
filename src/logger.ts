/**
 * Structured logging service with log levels and sanitization
 * Never logs API keys, raw prompts, or sensitive data
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: Record<string, unknown>;
}

// Patterns to detect and redact sensitive data
const SENSITIVE_PATTERNS: RegExp[] = [
  /sk-[a-zA-Z0-9]{20,}/g,           // OpenAI API keys
  /Bearer\s+[a-zA-Z0-9._-]+/gi,     // Bearer tokens
  /api[_-]?key["\s:=]+[^\s"',}]+/gi, // Generic API key patterns
  /password["\s:=]+[^\s"',}]+/gi,    // Passwords
];

const PLUGIN_PREFIX = "[GPT Task Manager]";

class Logger {
  private logLevel: LogLevel = LogLevel.INFO;
  private logHistory: LogEntry[] = [];
  private maxHistorySize: number = 100;
  private listeners: ((entry: LogEntry) => void)[] = [];

  /**
   * Set the current log level
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Get current log level
   */
  getLogLevel(): LogLevel {
    return this.logLevel;
  }

  /**
   * Add a listener for log entries (for telemetry/UI)
   */
  addListener(listener: (entry: LogEntry) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(listenerItem => listenerItem !== listener);
    };
  }

  /**
   * Get recent log history
   */
  getHistory(limit?: number): LogEntry[] {
    const historyLimit = limit || this.maxHistorySize;
    return this.logHistory.slice(-historyLimit);
  }

  /**
   * Clear log history
   */
  clearHistory(): void {
    this.logHistory = [];
  }

  /**
   * Sanitize text to remove sensitive information
   */
  sanitize(text: string): string {
    let sanitized = text;
    for (const pattern of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, "[REDACTED]");
    }
    return sanitized;
  }

  /**
   * Sanitize an object recursively
   */
  sanitizeObject(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === "string") {
      return this.sanitize(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    if (typeof obj === "object") {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        // Skip known sensitive keys entirely
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes("apikey") || lowerKey.includes("api_key") || 
            lowerKey.includes("password") || lowerKey.includes("secret") ||
            lowerKey.includes("token") || lowerKey.includes("authorization")) {
          sanitized[key] = "[REDACTED]";
        } else {
          sanitized[key] = this.sanitizeObject(value);
        }
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Create a log entry
   */
  private log(level: LogLevel, category: string, message: string, data?: Record<string, unknown>): void {
    if (level < this.logLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message: this.sanitize(message),
      data: data ? this.sanitizeObject(data) as Record<string, unknown> : undefined,
    };

    // Add to history
    this.logHistory.push(entry);
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.shift();
    }

    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(entry);
      } catch {
        // Ignore listener errors
      }
    }

    // Output to console
    const prefix = `${PLUGIN_PREFIX} [${category}]`;
    const dataStr = data ? ` ${JSON.stringify(this.sanitizeObject(data))}` : "";

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(`${prefix} ${message}${dataStr}`);
        break;
      case LogLevel.INFO:
        console.log(`${prefix} ${message}${dataStr}`);
        break;
      case LogLevel.WARN:
        console.warn(`${prefix} ${message}${dataStr}`);
        break;
      case LogLevel.ERROR:
        console.error(`${prefix} ${message}${dataStr}`);
        break;
    }
  }

  debug(category: string, message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, category, message, data);
  }

  info(category: string, message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, category, message, data);
  }

  warn(category: string, message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, category, message, data);
  }

  error(category: string, message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, category, message, data);
  }
}

// Singleton instance
export const logger = new Logger();

/**
 * Scope text for API submission - truncate and sanitize
 */
export function scopeTextForApi(text: string, maxLength: number = 4000): string {
  const sanitized = logger.sanitize(text);
  if (sanitized.length <= maxLength) {
    return sanitized;
  }
  return sanitized.substring(0, maxLength - 3) + "...";
}

