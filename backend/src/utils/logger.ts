import winston from 'winston';

// Create a no-op logger for production
const noopLogger = {
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
  log: () => {}
};

// Custom format to minimize log output
const minimalFormat = winston.format.printf(({ level, message, timestamp }) => {
  return `${timestamp} ${level}: ${message}`;
});

// Use no-op logger in production, real logger in development
export const logger = process.env.NODE_ENV === 'production' 
  ? noopLogger
  : winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        minimalFormat
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            minimalFormat
          )
        })
      ]
    }); 