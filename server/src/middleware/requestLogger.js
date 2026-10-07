import morgan from 'morgan';
import logger from '../utils/logger.js';
import config from '../config/env.js';

// Custom morgan stream redirecting HTTP access logs through our centralized logger
const stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

// Skip request logging in test environment to keep test output clean
const skip = () => config.isTest;

const format = config.isProduction
  ? ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms'
  : ':method :url :status :response-time ms - :res[content-length]';

export const requestLogger = morgan(format, { stream, skip });
export default requestLogger;
