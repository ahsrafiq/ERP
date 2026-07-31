/**
 * Lightweight renderer-safe logger.
 *
 * Winston cannot run in the Electron renderer because its dependency chain
 * (`logform` → `@colors/colors`) accesses the Node `process` global, which
 * is unavailable when `nodeIntegration` is disabled.
 *
 * This module provides an identical plain-text format
 *   YYYY-MM-DD HH:mm:ss.SSS [LEVEL] message
 * using only browser-safe APIs.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function timestamp(): string {
  const now = new Date();
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const pad3 = (n: number) => String(n).padStart(3, '0');
  return (
    `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ` +
    `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}.${pad3(now.getMilliseconds())}`
  );
}

function formatMessage(level: LogLevel, message: string, ...args: any[]): string {
  const extra = args.length
    ? ' ' + args.map(a => (a instanceof Error ? a.stack || a.message : typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
    : '';
  return `${timestamp()} [${level.toUpperCase()}] ${message}${extra}`;
}

const logger = {
  debug(message: string, ...args: any[]) {
    const formatted = formatMessage('debug', message, ...args);
    console.debug(formatted);
    (window as any).electronAPI?.log?.('debug', formatted);
  },
  info(message: string, ...args: any[]) {
    const formatted = formatMessage('info', message, ...args);
    console.info(formatted);
    (window as any).electronAPI?.log?.('info', formatted);
  },
  warn(message: string, ...args: any[]) {
    const formatted = formatMessage('warn', message, ...args);
    console.warn(formatted);
    (window as any).electronAPI?.log?.('warn', formatted);
  },
  error(message: string, ...args: any[]) {
    const formatted = formatMessage('error', message, ...args);
    console.error(formatted);
    (window as any).electronAPI?.log?.('error', formatted);
  },
};

export default logger;
