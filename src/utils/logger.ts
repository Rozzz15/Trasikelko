// Production Logger Utility
// Automatically disables console logs in production builds
// Usage: Replace console.log with Logger.log, console.error with Logger.error, etc.

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_DEV = __DEV__;

class Logger {
  /**
   * Log informational messages
   * Disabled in production
   */
  static log(...args: any[]) {
    if (!IS_PRODUCTION && IS_DEV) {
      console.log(...args);
    }
  }

  /**
   * Log warning messages
   * Enabled in production (helps with debugging)
   */
  static warn(...args: any[]) {
    if (!IS_PRODUCTION || IS_DEV) {
      console.warn(...args);
    }
  }

  /**
   * Log error messages
   * Always enabled (critical for error tracking)
   */
  static error(...args: any[]) {
    console.error(...args);
    // TODO: Send to error monitoring service (Sentry, Bugsnag, etc.)
    // if (IS_PRODUCTION) {
    //   ErrorMonitoring.captureException(args);
    // }
  }

  /**
   * Log debug messages
   * Only in development
   */
  static debug(...args: any[]) {
    if (IS_DEV) {
      console.debug(...args);
    }
  }

  /**
   * Log info with prefix
   * Disabled in production
   */
  static info(message: string, ...args: any[]) {
    if (!IS_PRODUCTION && IS_DEV) {
      console.log(`ℹ️ [INFO]`, message, ...args);
    }
  }

  /**
   * Log success messages
   * Disabled in production
   */
  static success(message: string, ...args: any[]) {
    if (!IS_PRODUCTION && IS_DEV) {
      console.log(`✅ [SUCCESS]`, message, ...args);
    }
  }

  /**
   * Performance timing
   * Disabled in production
   */
  static time(label: string) {
    if (!IS_PRODUCTION && IS_DEV) {
      console.time(label);
    }
  }

  static timeEnd(label: string) {
    if (!IS_PRODUCTION && IS_DEV) {
      console.timeEnd(label);
    }
  }

  /**
   * Table display (for arrays/objects)
   * Disabled in production
   */
  static table(data: any) {
    if (!IS_PRODUCTION && IS_DEV) {
      console.table(data);
    }
  }

  /**
   * Group logs
   * Disabled in production
   */
  static group(label: string) {
    if (!IS_PRODUCTION && IS_DEV) {
      console.group(label);
    }
  }

  static groupEnd() {
    if (!IS_PRODUCTION && IS_DEV) {
      console.groupEnd();
    }
  }
}

export default Logger;

// Convenience exports
export const { log, warn, error, debug, info, success, time, timeEnd, table, group, groupEnd } = Logger;
