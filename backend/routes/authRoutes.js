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
router.post('/login', loginValidation, validate, loginUser);
router.post('/refresh-token', refreshTokenValidation, validate, refreshAccessToken);
router.post('/forgot-password', forgotPasswordValidation, validate, forgotPassword);
router.post('/reset-password', resetPasswordValidation, validate, resetPassword);

// Protected Routes
router.post('/logout', protect, logoutUser);
router.get('/me', protect, getMe);
router.put('/change-password', protect, changePasswordValidation, validate, changePassword);

export default router;
