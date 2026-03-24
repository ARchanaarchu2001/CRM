import jwt from 'jsonwebtoken';

/**
 * Generate a short-lived Access Token
 * @param {string} userId - User's MongoDB ObjectId
 * @param {string} role - User's role
 * @returns {string} - JWT Access Token
 */
export const generateAccessToken = (userId, role) => {
  return jwt.sign(
    {
      id: userId,
      role: role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    }
  );
};

/**
 * Generate a long-lived Refresh Token
 * @param {string} userId - User's MongoDB ObjectId
 * @returns {string} - JWT Refresh Token
 */
export const generateRefreshToken = (userId) => {
  return jwt.sign(
    {
      id: userId,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    }
  );
};
