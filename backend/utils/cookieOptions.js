/**
 * Utility to get secure HTTP-Only cookie options for Refresh Tokens
 * @returns {Object} Cookie options object
 */
export const getRefreshTokenCookieOptions = () => {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Use 'none' for cross-site cross-origin requests in production, 'lax' for local dev
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  };
};

/**
 * Utility to clear the refresh token cookie securely
 * @returns {Object} Cookie options object for clearing
 */
export const getClearCookieOptions = () => {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  };
};
