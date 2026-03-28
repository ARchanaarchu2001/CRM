import asyncHandler from '../utils/asyncHandler.js';
import User from '../models/User.js';
import { ROLES } from '../constants/roles.js';
import { canCreateUser, canModifyOrDeleteUser, getSafeUserFetchScope } from '../constants/rolePermissions.js';

/**
 * @desc    Super Admin creates any role user
 * @route   POST /api/user-management/admin/create
 * @access  Private/SuperAdmin
 */
export const createUserByAdmin = asyncHandler(async (req, res) => {
  const { fullName, email, password, role, phoneNumber, employeeId, assignedTeam } = req.body;
  
  if (req.user.role !== ROLES.SUPER_ADMIN) {
    return res.status(403).json({ success: false, message: 'Forbidden: Super Admins only' });
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    return res.status(400).json({ success: false, message: 'User with this email already exists' });
  }

  const newUser = await User.create({
    fullName,
    email,
    password,
    role,
    phoneNumber,
    employeeId,
    assignedTeam,
    createdBy: req.user._id,
    profilePhoto: req.file ? req.file.filename : null, // Handle optionally based on your upload middleware
  });

  const safeUser = newUser.toObject();
  delete safeUser.password;
  delete safeUser.refreshToken;

  res.status(201).json({ success: true, data: safeUser });
});


/**
 * @desc    Team Lead creates an agent
 * @route   POST /api/user-management/team-lead/create-agent
 * @access  Private/TeamLead
 */
export const createAgentByTeamLead = asyncHandler(async (req, res) => {
  const { fullName, email, password, phoneNumber, employeeId } = req.body;
  
  if (req.user.role !== ROLES.TEAM_LEAD) {
    return res.status(403).json({ success: false, message: 'Forbidden: Team Leads only' });
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    return res.status(400).json({ success: false, message: 'User with this email already exists' });
  }

  // Force role to agent, bind to current team lead
  const newUser = await User.create({
    fullName,
    email,
    password,
    role: ROLES.AGENT,
    teamLead: req.user._id,
    createdBy: req.user._id,
    phoneNumber,
    employeeId,
    profilePhoto: req.file ? req.file.filename : null,
  });

  const safeUser = newUser.toObject();
  delete safeUser.password;
  delete safeUser.refreshToken;

  res.status(201).json({ success: true, data: safeUser });
});


/**
 * @desc    Get all active users globally (Admin only)
 * @route   GET /api/user-management/admin/all
 * @access  Private/SuperAdmin
 */
export const getAllUsersForAdmin = asyncHandler(async (req, res) => {
  if (req.user.role !== ROLES.SUPER_ADMIN) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  
  const users = await User.find({ isDeleted: false }).select('-password -refreshToken').sort({ createdAt: -1 });

  res.status(200).json({ success: true, count: users.length, data: users });
});


/**
 * @desc    Get all agents managed by the current Team Lead
 * @route   GET /api/user-management/team-lead/agents
 * @access  Private/TeamLead
 */
export const getTeamLeadAgents = asyncHandler(async (req, res) => {
  if (req.user.role !== ROLES.TEAM_LEAD) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const agents = await User.find({ 
    teamLead: req.user._id, 
    role: ROLES.AGENT,
    isDeleted: false 
  }).select('-password -refreshToken').sort({ createdAt: -1 });

  res.status(200).json({ success: true, count: agents.length, data: agents });
});

/**
 * @desc    Get all agents for reports (Data Analyst can view)
 * @route   GET /api/user-management/agents-list
 * @access  Private/DataAnalyst
 */
export const getAllAgents = asyncHandler(async (req, res) => {
  const agents = await User.find({ 
    role: ROLES.AGENT,
    isDeleted: false,
    isActive: true
  }).select('-password -refreshToken').sort({ fullName: 1 });

  res.status(200).json({ success: true, count: agents.length, data: agents });
});


/**
 * @desc    Get single user strictly respecting scopes
 * @route   GET /api/user-management/:id
 * @access  Private
 */
export const getUserById = asyncHandler(async (req, res) => {
  const targetUser = await User.findOne({ _id: req.params.id, isDeleted: false }).select('-password -refreshToken');

  if (!targetUser) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  if (req.user.role === ROLES.TEAM_LEAD) {
    // Only see their agents
    if (targetUser.role !== ROLES.AGENT || targetUser.teamLead?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden: Agent does not belong to your team' });
    }
  } else if (req.user.role !== ROLES.SUPER_ADMIN) {
    // Other roles not implemented strictly for this lookup feature
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  res.status(200).json({ success: true, data: targetUser });
});


/**
 * @desc    Update a user
 * @route   PUT /api/user-management/:id
 * @access  Private
 */
export const updateUser = asyncHandler(async (req, res) => {
  let targetUser = await User.findById(req.params.id);

  if (!targetUser || targetUser.isDeleted) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  if (req.user.role === ROLES.TEAM_LEAD) {
    if (targetUser.role !== ROLES.AGENT || targetUser.teamLead?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden to edit this user' });
    }
    // Prevent Team Leads from elevating agent to super_admin or stealing ownership
    delete req.body.role;
    delete req.body.teamLead;
  } else if (req.user.role !== ROLES.SUPER_ADMIN) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  req.body.updatedBy = req.user._id;

  // Handle password explicitly if they change it
  if (req.body.password) {
    targetUser.password = req.body.password;
    delete req.body.password; // Don't allow findByIdAndUpdate to blindly overwrite unhashed pass if they mix methods
    await targetUser.save(); 
  }

  targetUser = await User.findByIdAndUpdate(req.params.id, req.body, {
    returnDocument: 'after',
    runValidators: true,
  }).select('-password -refreshToken');

  res.status(200).json({ success: true, data: targetUser });
});


/**
 * @desc    Deactivate (soft delete) a user
 * @route   DELETE /api/user-management/:id
 * @access  Private
 */
export const deactivateUser = asyncHandler(async (req, res) => {
  const targetUser = await User.findById(req.params.id);

  if (!targetUser || targetUser.isDeleted) {
    return res.status(404).json({ success: false, message: 'User not found or already deleted' });
  }

  // Uses external business logic permission check!
  if (!canModifyOrDeleteUser(req.user, targetUser)) {
     return res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to delete this user' });
  }

  targetUser.isDeleted = true;
  targetUser.deletedAt = new Date();
  targetUser.deletedBy = req.user._id;
  targetUser.isActive = false; // also toggle active flag for local auth checks

  await targetUser.save();

  res.status(200).json({ success: true, message: 'User deactivated successfully' });
});


/**
 * @desc    Restore a soft-deleted user (Admin only)
 * @route   PUT /api/user-management/:id/restore
 * @access  Private/SuperAdmin
 */
export const restoreUser = asyncHandler(async (req, res) => {
  if (req.user.role !== ROLES.SUPER_ADMIN) {
    return res.status(403).json({ success: false, message: 'Forbidden: Super Admins only' });
  }

  const targetUser = await User.findById(req.params.id);

  if (!targetUser) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  targetUser.isDeleted = false;
  targetUser.deletedAt = null;
  targetUser.deletedBy = null;
  targetUser.isActive = true;

  await targetUser.save();

  res.status(200).json({ success: true, message: 'User successfully restored' });
});
