type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  metadata?: Record<string, unknown>
}

/**
 * Simple logger utility
 */
export class Logger {
  private formatMessage(level: LogLevel, message: string, metadata?: Record<string, unknown>): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      metadata,
    }
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    const entry = this.formatMessage('info', message, metadata)
    console.log(`[${entry.timestamp}] [INFO] ${entry.message}`, entry.metadata || '')
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    const entry = this.formatMessage('warn', message, metadata)
    console.warn(`[${entry.timestamp}] [WARN] ${entry.message}`, entry.metadata || '')
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    const entry = this.formatMessage('error', message, metadata)
    console.error(`[${entry.timestamp}] [ERROR] ${entry.message}`, entry.metadata || '')
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    if (process.env.NODE_ENV === 'development') {
      const entry = this.formatMessage('debug', message, metadata)
      console.debug(`[${entry.timestamp}] [DEBUG] ${entry.message}`, entry.metadata || '')
    }
  }
}

export const logger = new Logger()
