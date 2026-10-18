const crypto = require('crypto');

const isDevelopment = (process.env.NODE_ENV || 'development') === 'development';
const JWT_SECRET = process.env.JWT_SECRET || (isDevelopment ? crypto.randomBytes(32).toString('hex') : null);

function assertJwtSecretConfigured() {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET must be configured outside development.');
  }
}

module.exports = { JWT_SECRET, assertJwtSecretConfigured };
