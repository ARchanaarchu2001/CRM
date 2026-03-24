import asyncHandler from '../utils/asyncHandler.js';

// @desc    Get Admin only resource
// @route   GET /api/users/admin-only
// @access  Private/Admin
export const getAdminOnly = asyncHandler(async (req, res) => {
  res.status(200).json({
    message: 'Success: You have accessed the Super Admin area',
    user: req.user.email,
    role: req.user.role,
  });
});

// @desc    Get Manager area resource
// @route   GET /api/users/manager-area
// @access  Private/Manager
export const getManagerArea = asyncHandler(async (req, res) => {
  res.status(200).json({
    message: 'Success: You have accessed the Manager area',
    user: req.user.email,
    role: req.user.role,
  });
});

// @desc    Get Team Lead area resource
// @route   GET /api/users/team-lead-area
// @access  Private/TeamLead
export const getTeamLeadArea = asyncHandler(async (req, res) => {
  res.status(200).json({
    message: 'Success: You have accessed the Team Lead area',
    user: req.user.email,
    role: req.user.role,
  });
});

// @desc    Get Agent area resource
// @route   GET /api/users/agent-area
// @access  Private/Agent & above
export const getAgentArea = asyncHandler(async (req, res) => {
  res.status(200).json({
    message: 'Success: You have accessed the Agent (all valid roles) area',
    user: req.user.email,
    role: req.user.role,
  });
});

// @desc    Get Profile
// @route   GET /api/users/profile
// @access  Private/All
export const getUserProfile = asyncHandler(async (req, res) => {
  res.status(200).json({
    message: 'Success: Accessed generic user profile',
    user: req.user.email,
    role: req.user.role,
  });
});
