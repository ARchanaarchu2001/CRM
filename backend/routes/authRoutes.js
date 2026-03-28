import express from 'express';
import {
  loginUser,
  logoutUser,
  refreshAccessToken,
  getMe,
  changePassword,
  forgotPassword,
  resetPassword,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import {
  loginLimiter,
  passwordRecoveryLimiter,
  refreshTokenLimiter,
} from '../middleware/rateLimiters.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  loginValidation,
  changePasswordValidation,
  refreshTokenValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
} from '../validations/authValidation.js';

const router = express.Router();

// Public Routes
router.post('/login', loginLimiter, loginValidation, validate, loginUser);
router.post('/refresh-token', refreshTokenLimiter, refreshTokenValidation, validate, refreshAccessToken);
router.post('/forgot-password', passwordRecoveryLimiter, forgotPasswordValidation, validate, forgotPassword);
router.post('/reset-password', passwordRecoveryLimiter, resetPasswordValidation, validate, resetPassword);

// Protected Routes
router.post('/logout', protect, logoutUser);
router.get('/me', protect, getMe);
router.put('/change-password', protect, changePasswordValidation, validate, changePassword);

export default router;
