import rateLimit from 'express-rate-limit';

const buildRateLimitHandler = (label) => (req, res) => {
  console.warn(
    `[rate-limit] ${label} exceeded for ip=${req.ip} path=${req.originalUrl} method=${req.method} at=${new Date().toISOString()}`
  );

  res.status(429).json({
    message: `Too many ${label} requests. Please try again shortly.`,
  });
};

export const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: buildRateLimitHandler('login'),
});

export const refreshTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildRateLimitHandler('refresh-token'),
});

export const passwordRecoveryLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildRateLimitHandler('password-recovery'),
});
