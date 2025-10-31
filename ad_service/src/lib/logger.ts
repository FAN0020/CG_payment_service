import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';
const logPretty = process.env.LOG_PRETTY === 'true' || isDevelopment;

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: logPretty
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
});

export default logger;
