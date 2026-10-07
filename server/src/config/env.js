import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server root (two levels up from src/config)
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

/**
 * Validates and sanitizes environment configuration at startup.
 * Fails fast with clear actionable messages if any required variable is invalid.
 */
function validateAndLoadConfig() {
  const errors = [];

  const rawEnv = process.env.NODE_ENV || 'development';
  const allowedEnvs = ['development', 'test', 'production', 'staging'];
  if (!allowedEnvs.includes(rawEnv)) {
    errors.push(`NODE_ENV must be one of: ${allowedEnvs.join(', ')}. Received: "${rawEnv}"`);
  }

  const rawPort = process.env.PORT || '5000';
  const port = parseInt(rawPort, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    errors.push(`PORT must be a valid integer between 1 and 65535. Received: "${rawPort}"`);
  }

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  try {
    const parsed = new URL(clientUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      errors.push(`CLIENT_URL must use http or https protocol. Received: "${clientUrl}"`);
    }
  } catch {
    errors.push(`CLIENT_URL must be a valid absolute URL. Received: "${clientUrl}"`);
  }

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ricozdata';
  if (!mongoUri.startsWith('mongodb://') && !mongoUri.startsWith('mongodb+srv://')) {
    errors.push(`MONGO_URI must be a valid MongoDB connection string starting with 'mongodb://' or 'mongodb+srv://'.`);
  }

  const jwtSecret = process.env.JWT_SECRET || 'ricoz_enterprise_dev_jwt_secret_key_32_characters_minimum_2026';
  if (rawEnv === 'production' && (!jwtSecret || jwtSecret.length < 32)) {
    errors.push(`JWT_SECRET must be defined and at least 32 characters long in production.`);
  }

  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'ricoz_enterprise_dev_jwt_refresh_secret_key_32_characters_2026';
  if (rawEnv === 'production' && (!jwtRefreshSecret || jwtRefreshSecret.length < 32)) {
    errors.push(`JWT_REFRESH_SECRET must be defined and at least 32 characters long in production.`);
  }

  const currentKeyId = process.env.CURRENT_ENCRYPTION_KEY_ID || 'KEY_V1';
  const encryptionKeyV1 = process.env.ENCRYPTION_KEY_V1 || process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const encryptionKeyV2 = process.env.ENCRYPTION_KEY_V2 || '';

  if (rawEnv === 'production') {
    if (!process.env.ENCRYPTION_KEY && !process.env.ENCRYPTION_KEY_V1) {
      errors.push('ENCRYPTION_KEY or ENCRYPTION_KEY_V1 must be explicitly configured in production.');
    }
    if (encryptionKeyV1 === '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef') {
      errors.push('Default sample ENCRYPTION_KEY is forbidden in production environments.');
    }
  }

  if (errors.length > 0) {
    const message = `[Configuration Error] Invalid environment configuration detected:\n` +
      errors.map(err => `  - ${err}`).join('\n') +
      `\nPlease verify your .env file or environment variables.`;
    throw new Error(message);
  }

  const config = {
    env: rawEnv,
    isProduction: rawEnv === 'production',
    isDevelopment: rawEnv === 'development',
    isTest: rawEnv === 'test',
    port,
    clientUrl,
    requireDb: process.env.REQUIRE_DB !== 'false',
    mongo: {
      uri: mongoUri,
      options: {
        serverSelectionTimeoutMS: 5000,
        autoIndex: rawEnv !== 'production' // Don't build indexes in production runtime
      }
    },
    jwt: {
      secret: jwtSecret,
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      refreshSecret: jwtRefreshSecret,
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
      issuer: process.env.JWT_ISSUER || 'ricozdata',
      audience: process.env.JWT_AUDIENCE || 'ricozdata-api'
    },
    security: {
      currentKeyId,
      encryptionKey: encryptionKeyV1,
      keys: {
        KEY_V1: encryptionKeyV1,
        KEY_V2: encryptionKeyV2
      }
    },
    oauth: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        callbackUrl: process.env.GOOGLE_REDIRECT_URI || process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback'
      }
    },
    email: {
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      from: process.env.SMTP_FROM || process.env.EMAIL_FROM || 'RicozData Platform <no-reply@ricozdata.io>'
    },
    logging: {
      level: process.env.LOG_LEVEL || (rawEnv === 'development' ? 'debug' : 'info')
    },
    tenant: {
      baseDomain: (process.env.BASE_DOMAIN || 'localhost').toLowerCase(),
      trustedInternalSecret: process.env.TRUSTED_INTERNAL_SECRET || 'ricoz_internal_gateway_secret_2026',
      allowTrustedHeader: process.env.ALLOW_TRUSTED_HEADER !== 'false'
    }
  };

  return Object.freeze(config);
}

export const config = validateAndLoadConfig();
export default config;
