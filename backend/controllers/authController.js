import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';
import { getRefreshTokenCookieOptions, getClearCookieOptions } from '../utils/cookieOptions.js';

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Check for user email and explicitly select password
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  // Check if active and not blocked
  if (!user.isActive) {
    res.status(403);
    throw new Error('Your account is deactivated. Please contact support.');
  }
  
  if (user.isBlocked) {
    res.status(403);
    throw new Error('Your account currently blocked.');
  }

  // Verify password
  const isMatch = await user.comparePassword(password);
  
  if (!isMatch) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  // Generate tokens
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  // Update user in DB
  user.lastLogin = new Date();
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false }); // skip full validation for login info update

  // Remove password before sending to client
  const userObject = user.toObject();
  delete userObject.password;
  delete userObject.refreshToken; // don't send refresh token in payload either

  // Send securely in cookie
  res.cookie('refreshToken', refreshToken, getRefreshTokenCookieOptions());

  res.status(200).json({
    message: 'Login successful',
    user: userObject,
    accessToken,
  });
});

// @desc    Logout user / clear cookie / clear DB token
// @route   POST /api/auth/logout
// @access  Private
export const logoutUser = asyncHandler(async (req, res) => {
  const cookies = req.cookies;
  if (!cookies?.refreshToken) {
    // No content
    return res.sendStatus(204); 
  }

  const refreshToken = cookies.refreshToken;

  // Clear refresh token from DB
  const user = await User.findOne({ refreshToken });
  if (user) {
    user.refreshToken = null;
    await user.save({ validateBeforeSave: false });
  }

  res.clearCookie('refreshToken', getClearCookieOptions());
  res.status(200).json({ message: 'User logged out successfully' });
});

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public (Requires valid refresh token cookie)
export const refreshAccessToken = asyncHandler(async (req, res) => {
  const cookies = req.cookies;
  const refreshToken = cookies?.refreshToken;

  if (!refreshToken) {
    res.status(401);
    throw new Error('Unauthorized - No refresh token provided');
  }

  // Verify token natively
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
  } catch (error) {
    res.status(403);
    throw new Error('Forbidden - Refresh token expired or invalid');
  }

  // Find user based on token + DB presence
  const user = await User.findOne({ _id: decoded.id, refreshToken });

  if (!user || !user.isActive || user.isBlocked) {
    res.status(403);
    throw new Error('Forbidden - Invalid or deactivated user');
  }

  // Keep the same refresh token during normal refreshes.
  // Rotating it on every request can cause accidental logouts when multiple
  // refresh requests overlap or the app is open in more than one tab.
  const newAccessToken = user.generateAccessToken();
  res.cookie('refreshToken', refreshToken, getRefreshTokenCookieOptions());

  res.status(200).json({
    accessToken: newAccessToken,
  });
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = asyncHandler(async (req, res) => {
  // `req.user` will be populated by the protect middleware
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  const userObject = user.toObject();
  delete userObject.refreshToken; // keep secure

  res.status(200).json({
    user: userObject,
  });
});

// @desc    Change Password
// @route   PUT /api/auth/change-password
// @access  Private
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Find user and explicitly select password
  const user = await User.findById(req.user._id).select('+password');

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Compare passwords
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    res.status(401);
    throw new Error('Incorrect current password');
  }

  // Update password and clear refresh token to force re-login globally
  user.password = newPassword;
  user.passwordChangedAt = Date.now() - 1000; // slightly in the past to ensure valid token checking if needed
  user.refreshToken = null; 
  
  await user.save(); // full validation triggered (password length, etc)

  res.clearCookie('refreshToken', getClearCookieOptions());

  res.status(200).json({
    message: 'Password changed successfully. Please log in again.',
  });
});

// @desc    Forgot Password (Placeholder)
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  
  res.status(200).json({
    message: `Password reset instructions sent to ${email} (Placeholder)`,
  });
});

// @desc    Reset Password (Placeholder)
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  
  res.status(200).json({
    message: 'Password reset successful (Placeholder)',
  });
});
