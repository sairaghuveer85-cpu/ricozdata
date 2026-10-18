const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt');

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function createAccessToken(user, { role = user.role, isMainAdmin = user.isMainAdmin } = {}) {
  return jwt.sign(
    {
      id: user._id,
      role,
      email: user.email,
      isMainAdmin: !!isMainAdmin,
      organizationId: user.organizationId,
      tokenVersion: user.tokenVersion || 0,
      tokenType: 'access'
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL, algorithm: 'HS256' }
  );
}

function createRefreshToken(user) {
  return jwt.sign(
    {
      id: user._id,
      tokenVersion: user.tokenVersion || 0,
      tokenType: 'refresh'
    },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL, algorithm: 'HS256' }
  );
}

function getRefreshCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    maxAge: REFRESH_COOKIE_MAX_AGE
  };
}

module.exports = {
  createAccessToken,
  createRefreshToken,
  getRefreshCookieOptions
};
