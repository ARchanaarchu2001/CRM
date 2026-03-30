import asyncHandler from '../utils/asyncHandler.js';
import User from '../models/User.js';
import Team from '../models/Team.js';
import TeamTransfer from '../models/TeamTransfer.js';
import LeadAssignment from '../models/LeadAssignment.js';
import { ROLES } from '../constants/roles.js';
import { canCreateUser, canModifyOrDeleteUser } from '../constants/rolePermissions.js';
import {
  buildAgentDetailAnalytics,
  buildDashboardAnalytics,
  resolveDateRange,
} from '../utils/dashboardAnalytics.js';
import { getCurrentDateString } from '../utils/leadMetrics.js';

const normalizeTeamName = (value = '') => String(value).trim().replace(/\s+/g, ' ').toLowerCase();

const sanitizeTeamName = (value = '') => String(value).trim().replace(/\s+/g, ' ');

const TEAM_POPULATE = [
  { path: 'teamLead', select: 'fullName assignedTeam' },
  { path: 'team', select: 'name lead', populate: { path: 'lead', select: 'fullName assignedTeam' } },
];
const DEFAULT_PRODUCTS = ['mnp', 'p2p', 'fne', 'plus', 'general'];

const getCurrentTeamName = (user) => {
  if (!user) return '';
  return user.assignedTeam || user.team?.name || user.teamLead?.assignedTeam || '';
};

const formatTeamPayload = (teamDoc) => ({
  _id: teamDoc._id,
  name: teamDoc.name,
  teamLeadId: teamDoc.lead?._id ? String(teamDoc.lead._id) : String(teamDoc.lead || ''),
  teamLeadName: teamDoc.lead?.fullName || '',
});

const ensureTeamForLeadUser = async (leadUser, actorId = null) => {
  if (!leadUser || leadUser.role !== ROLES.TEAM_LEAD) {
    return null;
  }

  const cleanTeamName = sanitizeTeamName(leadUser.assignedTeam);
  if (!cleanTeamName) {
    return null;
  }

  let teamDoc = null;

  if (leadUser.team) {
    teamDoc = await Team.findById(leadUser.team);
  }

  if (!teamDoc) {
    teamDoc = await Team.findOne({
      $or: [
        { lead: leadUser._id },
        { normalizedName: normalizeTeamName(cleanTeamName) },
      ],
    });
  }

  if (!teamDoc) {
    teamDoc = await Team.create({
      name: cleanTeamName,
      normalizedName: normalizeTeamName(cleanTeamName),
      lead: leadUser._id,
      createdBy: actorId,
      updatedBy: actorId,
    });
  } else {
    let shouldSaveTeam = false;
    if (teamDoc.name !== cleanTeamName) {
      teamDoc.name = cleanTeamName;
      teamDoc.normalizedName = normalizeTeamName(cleanTeamName);
      shouldSaveTeam = true;
    }
    if (String(teamDoc.lead) !== String(leadUser._id)) {
      teamDoc.lead = leadUser._id;
      shouldSaveTeam = true;
    }
    if (actorId) {
      teamDoc.updatedBy = actorId;
      shouldSaveTeam = true;
    }
    if (shouldSaveTeam) {
      await teamDoc.save({ validateBeforeSave: false });
    }
  }

  const shouldSyncLead =
    String(leadUser.team || '') !== String(teamDoc._id) || leadUser.assignedTeam !== cleanTeamName;

  if (shouldSyncLead) {
    leadUser.team = teamDoc._id;
    leadUser.assignedTeam = cleanTeamName;
    if (actorId) {
      leadUser.updatedBy = actorId;
    }
    await leadUser.save({ validateBeforeSave: false });
  }

  return teamDoc;
};

/**
 * @desc    Super Admin creates any role user
 * @route   POST /api/user-management/admin/create
 * @access  Private/SuperAdmin
 */
export const createUserByAdmin = asyncHandler(async (req, res) => {
  const { fullName, email, password, role, phoneNumber, employeeId, assignedTeam, teamId, teamName } = req.body;
  
  if (req.user.role !== ROLES.SUPER_ADMIN) {
    return res.status(403).json({ success: false, message: 'Forbidden: Super Admins only' });
  }

  if (!canCreateUser(req.user.role, role)) {
    return res.status(403).json({ success: false, message: 'You do not have permission to create this role' });
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    return res.status(400).json({ success: false, message: 'User with this email already exists' });
  }

  if (role === ROLES.TEAM_LEAD) {
    const cleanTeamName = sanitizeTeamName(teamName);
    const normalizedTeamName = normalizeTeamName(cleanTeamName);

    if (!cleanTeamName) {
      return res.status(400).json({ success: false, message: 'Team Name is required when creating a Team Lead' });
    }

    const existingTeam = await Team.findOne({ normalizedName: normalizedTeamName });
    if (existingTeam) {
      return res.status(400).json({ success: false, message: 'A team with this name already exists' });
    }
  }

  let selectedTeam = null;
  if (role === ROLES.AGENT && teamId) {
    selectedTeam = await Team.findById(teamId);
    if (!selectedTeam) {
      return res.status(404).json({ success: false, message: 'Selected team was not found' });
    }
  }

  let newUser;

  try {
    newUser = await User.create({
      fullName,
      email,
      password,
      role,
      phoneNumber,
      employeeId,
      assignedTeam:
        role === ROLES.TEAM_LEAD
          ? sanitizeTeamName(teamName)
          : role === ROLES.AGENT && selectedTeam
            ? selectedTeam.name
            : assignedTeam || null,
      team: role === ROLES.AGENT && selectedTeam ? selectedTeam._id : null,
      teamLead: role === ROLES.AGENT && selectedTeam ? selectedTeam.lead : null,
      createdBy: req.user._id,
      updatedBy: req.user._id,
      profilePhoto: req.file ? req.file.filename : null,
    });

    if (role === ROLES.TEAM_LEAD) {
      const cleanTeamName = sanitizeTeamName(teamName);
      const createdTeam = await Team.create({
        name: cleanTeamName,
        normalizedName: normalizeTeamName(cleanTeamName),
        lead: newUser._id,
        createdBy: req.user._id,
        updatedBy: req.user._id,
      });

      newUser.team = createdTeam._id;
      await newUser.save({ validateBeforeSave: false });
    }
  } catch (error) {
    if (newUser?._id) {
      await User.findByIdAndDelete(newUser._id);
    }
    return res.status(400).json({ success: false, message: error.message || 'Failed to create user' });
  }

  const safeUser = await User.findById(newUser._id)
    .select('-password -refreshToken')
    .populate(TEAM_POPULATE)
    .lean();

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

  const currentLead = await User.findById(req.user._id).select('assignedTeam team role');
  const currentLeadTeam = await ensureTeamForLeadUser(currentLead, req.user._id);

  if (!currentLead?.assignedTeam || !currentLeadTeam?._id) {
    return res.status(400).json({ success: false, message: 'Your team is not configured yet. Please contact Super Admin.' });
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
    team: currentLeadTeam._id,
    assignedTeam: currentLead.assignedTeam,
    teamLead: req.user._id,
    createdBy: req.user._id,
    updatedBy: req.user._id,
    phoneNumber,
    employeeId,
    profilePhoto: req.file ? req.file.filename : null,
  });

  const safeUser = await User.findById(newUser._id)
    .select('-password -refreshToken')
    .populate(TEAM_POPULATE)
    .lean();

  res.status(201).json({ success: true, data: safeUser });
});

const getManageableAgent = async ({ requester, targetUserId, allowUnassigned = false }) => {
  const targetUser = await User.findById(targetUserId);

  if (!targetUser || targetUser.role !== ROLES.AGENT) {
    return null;
  }

  if (requester.role === ROLES.SUPER_ADMIN) {
    return targetUser;
  }

  if (requester.role === ROLES.TEAM_LEAD) {
    const belongsToRequester = String(targetUser.teamLead || '') === String(requester._id);
    if (!belongsToRequester && !(allowUnassigned && !targetUser.teamLead)) {
      return null;
    }
    return targetUser;
  }

  return null;
};

const getScopedAgentQuery = (currentUser) => {
  if (currentUser.role === ROLES.TEAM_LEAD) {
    return {
      role: ROLES.AGENT,
      teamLead: currentUser._id,
      isDeleted: false,
    };
  }

  if (currentUser.role === ROLES.SUPER_ADMIN) {
    return {
      role: ROLES.AGENT,
      isDeleted: false,
    };
  }

  return null;
};

const getScopedAgentsForDashboard = async (currentUser) => {
  const query = getScopedAgentQuery(currentUser);
  if (!query) {
    return [];
  }

  return User.find(query)
    .select('fullName email role profilePhoto assignedTeam team teamLead isActive isDeleted createdAt')
    .populate(TEAM_POPULATE)
    .sort({ fullName: 1 })
    .lean();
};

const getAssignmentsForAgents = async (agentIds) => {
  if (!agentIds.length) {
    return [];
  }

  return LeadAssignment.find({ agent: { $in: agentIds } })
    .select(
      [
        'agent',
        'product',
        'status',
        'submittedAt',
        'activatedAt',
        'inPipeline',
        'pipelineFollowUpDate',
        'workedDates',
        'createdAt',
        'updatedAt',
      ].join(' ')
    )
    .lean();
};

const getResolvedRangeInfo = (query, res) => {
  try {
    return resolveDateRange(query);
  } catch (error) {
    res.status(400);
    throw error;
  }
};

const buildProductConversionOverview = ({ analytics, assignments, rangeInfo }) => {
  const isInRange = (dateValue) => {
    if (!dateValue) return false;
    const parsed = new Date(dateValue);
    return !Number.isNaN(parsed.getTime()) && parsed >= rangeInfo.fromDate && parsed <= rangeInfo.toDate;
  };

  const agentConversionMap = new Map(
    (analytics.agentTable || []).map((agent) => [
      agent.agentId,
      {
        agentId: agent.agentId,
        agentName: agent.agentName,
        teamId: agent.teamId || '',
        teamName: agent.teamName || 'Unassigned Team',
        totalAssignedLeads: 0,
        totalSubmissions: 0,
        products: Object.fromEntries(
          DEFAULT_PRODUCTS.map((product) => [
            product,
            {
              product,
              label: product.toUpperCase(),
              totalLeads: 0,
              submissions: 0,
            },
          ])
        ),
      },
    ])
  );

  for (const assignment of assignments || []) {
    const agentId = String(assignment.agent);
    const row = agentConversionMap.get(agentId);
    if (!row) {
      continue;
    }

    const productKey = DEFAULT_PRODUCTS.includes(String(assignment.product || '').toLowerCase())
      ? String(assignment.product || '').toLowerCase()
      : 'general';

    if (isInRange(assignment.createdAt)) {
      row.totalAssignedLeads += 1;
      row.products[productKey].totalLeads += 1;
    }

    const isSubmittedInRange =
      String(assignment.status || '').toLowerCase() === 'submitted' &&
      isInRange(assignment.submittedAt || assignment.createdAt);

    if (isSubmittedInRange) {
      row.totalSubmissions += 1;
      row.products[productKey].submissions += 1;
    }
  }

  const agentConversions = Array.from(agentConversionMap.values()).map((row) => ({
    ...row,
    products: DEFAULT_PRODUCTS.map((product) => row.products[product]),
  }));

  const products = DEFAULT_PRODUCTS.map((product) => ({
    product,
    label: product.toUpperCase(),
    totalLeads: agentConversions.reduce(
      (sum, row) => sum + (row.products.find((item) => item.product === product)?.totalLeads || 0),
      0
    ),
    submissions: agentConversions.reduce(
      (sum, row) => sum + (row.products.find((item) => item.product === product)?.submissions || 0),
      0
    ),
  }));

  return {
    products,
    agentConversions,
  };
};

/**
 * Helper to fetch and attach metrics for a list of agents
 */
const attachMetricsToAgents = async (agents) => {
  if (!agents || agents.length === 0) return [];
  
  const agentIds = agents.map((a) => a._id);
  const today = getCurrentDateString();

  // Aggregate metrics for these specific agents
  const metrics = await LeadAssignment.aggregate([
    {
      $match: { agent: { $in: agentIds } }
    },
    {
      $group: {
        _id: '$agent',
        dailyDialsCount: {
          $sum: {
            $cond: [{ $in: [today, { $ifNull: ['$workedDates', []] }] }, 1, 0]
          }
        },
        pendingLeadsCount: {
          $sum: {
            $cond: [
              { $eq: [{ $size: { $ifNull: ['$workedDates', []] } }, 0] },
              1, 
              0
            ]
          }
        }
      }
    }
  ]);

  const metricsMap = Object.fromEntries(
    metrics.map(m => [m._id.toString(), {
      dailyDialsCount: m.dailyDialsCount || 0,
      pendingLeadsCount: m.pendingLeadsCount || 0
    }])
  );

  return agents.map((agent) => {
    const agentObj = agent.toObject ? agent.toObject() : agent;
    const m = metricsMap[agentObj._id.toString()] || { dailyDialsCount: 0, pendingLeadsCount: 0 };
    return { ...agentObj, ...m };
  });
};

/**
 * @desc    Get all active users globally (Admin only)
 * @route   GET /api/user-management/admin/all
 * @access  Private/SuperAdmin
 */
export const getAllUsersForAdmin = asyncHandler(async (req, res) => {
  if (req.user.role !== ROLES.SUPER_ADMIN) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  
  const users = await User.find({ isDeleted: false })
    .select('-password -refreshToken')
    .populate(TEAM_POPULATE)
    .sort({ createdAt: -1 });
  
  const enrichedUsers = await attachMetricsToAgents(users);

  res.status(200).json({ success: true, count: enrichedUsers.length, data: enrichedUsers });
});

export const getTeamLeadDashboard = asyncHandler(async (req, res) => {
  if (req.user.role !== ROLES.TEAM_LEAD) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const rangeInfo = getResolvedRangeInfo(req.query, res);
  const agents = await getScopedAgentsForDashboard(req.user);
  const assignments = await getAssignmentsForAgents(agents.map((agent) => agent._id));
  const analytics = buildDashboardAnalytics({
    agents,
    assignments,
    rangeInfo,
    includeTeamComparison: false,
  });

  res.status(200).json({
    success: true,
    scope: 'team_lead',
    dashboard: analytics,
  });
});

export const getAgentSelfDashboard = asyncHandler(async (req, res) => {
  if (req.user.role !== ROLES.AGENT) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const agent = await User.findOne({
    _id: req.user._id,
    role: ROLES.AGENT,
    isDeleted: false,
  })
    .select('fullName email role profilePhoto assignedTeam team teamLead isActive createdAt')
    .populate(TEAM_POPULATE)
    .lean();

  if (!agent) {
    return res.status(404).json({ success: false, message: 'Agent not found' });
  }

  const rangeInfo = getResolvedRangeInfo(req.query, res);
  const assignments = await getAssignmentsForAgents([agent._id]);
  const analytics = buildAgentDetailAnalytics({
    agent,
    assignments,
    rangeInfo,
  });

  res.status(200).json({
    success: true,
    scope: 'agent',
    dashboard: analytics,
  });
});

export const getSuperAdminDashboard = asyncHandler(async (req, res) => {
  if (req.user.role !== ROLES.SUPER_ADMIN) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const rangeInfo = getResolvedRangeInfo(req.query, res);
  const agents = await getScopedAgentsForDashboard(req.user);
  const assignments = await getAssignmentsForAgents(agents.map((agent) => agent._id));
  const analytics = buildDashboardAnalytics({
    agents,
    assignments,
    rangeInfo,
    includeTeamComparison: true,
  });
  const conversionOverview = buildProductConversionOverview({
    analytics,
    assignments,
    rangeInfo,
  });

  res.status(200).json({
    success: true,
    scope: 'super_admin',
    dashboard: {
      ...analytics,
      ...conversionOverview,
    },
  });
});

export const getAgentPerformanceDetail = asyncHandler(async (req, res) => {
  if (![ROLES.TEAM_LEAD, ROLES.SUPER_ADMIN, ROLES.DATA_ANALYST].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const agent = await User.findOne({
    _id: req.params.agentId,
    role: ROLES.AGENT,
    isDeleted: false,
  })
    .select('fullName email role profilePhoto assignedTeam team teamLead isActive createdAt')
    .populate(TEAM_POPULATE)
    .lean();

  if (!agent) {
    return res.status(404).json({ success: false, message: 'Agent not found' });
  }

  if (req.user.role === ROLES.TEAM_LEAD && String(agent.teamLead?._id || '') !== String(req.user._id)) {
    return res.status(403).json({ success: false, message: 'Forbidden: Agent does not belong to your team' });
  }

  const rangeInfo = getResolvedRangeInfo(req.query, res);
  const assignments = await getAssignmentsForAgents([agent._id]);
  const detail = buildAgentDetailAnalytics({
    agent,
    assignments,
    rangeInfo,
  });

  res.status(200).json({
    success: true,
    detail,
  });
});

export const reactivateUser = asyncHandler(async (req, res) => {
  const targetUser = await getManageableAgent({
    requester: req.user,
    targetUserId: req.params.id,
  });

  if (!targetUser) {
    return res.status(404).json({ success: false, message: 'Agent not found' });
  }

  targetUser.isActive = true;
  targetUser.isBlocked = false;
  targetUser.isDeleted = false;
  targetUser.deletedAt = null;
  targetUser.deletedBy = null;
  targetUser.updatedBy = req.user._id;
  targetUser.refreshToken = null;

  await targetUser.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: 'Agent activated successfully',
    data: {
      _id: targetUser._id,
      isActive: targetUser.isActive,
    },
  });
});

export const removeAgentFromTeam = asyncHandler(async (req, res) => {
  const targetUser = await getManageableAgent({
    requester: req.user,
    targetUserId: req.params.id,
  });

  if (!targetUser) {
    return res.status(404).json({ success: false, message: 'Agent not found' });
  }

  targetUser.team = null;
  targetUser.teamLead = null;
  targetUser.assignedTeam = null;
  targetUser.updatedBy = req.user._id;

  await targetUser.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: 'Agent removed from the team successfully',
  });
});

export const removeUserFromSystem = asyncHandler(async (req, res) => {
  const targetUser = await User.findById(req.params.id);

  if (!targetUser || targetUser.isDeleted) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  if (!canModifyOrDeleteUser(req.user, targetUser)) {
    return res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to remove this user' });
  }

  if (targetUser.role === ROLES.SUPER_ADMIN) {
    return res.status(403).json({ success: false, message: 'Super Admin accounts cannot be removed from this workspace' });
  }

  if (targetUser.role === ROLES.TEAM_LEAD) {
    const linkedTeam = await Team.findOne({ lead: targetUser._id });

    if (linkedTeam) {
      await User.updateMany(
        { role: ROLES.AGENT, teamLead: targetUser._id, isDeleted: false },
        {
          $set: {
            team: null,
            teamLead: null,
            assignedTeam: null,
            updatedBy: req.user._id,
          },
        }
      );

      await Team.deleteOne({ _id: linkedTeam._id });
    }
  }

  if (targetUser.role === ROLES.AGENT) {
    targetUser.team = null;
    targetUser.teamLead = null;
    targetUser.assignedTeam = null;
  }

  targetUser.isActive = false;
  targetUser.isBlocked = true;
  targetUser.isDeleted = true;
  targetUser.deletedAt = new Date();
  targetUser.deletedBy = req.user._id;
  targetUser.updatedBy = req.user._id;
  targetUser.refreshToken = null;

  await targetUser.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: `${targetUser.fullName} was removed from the system successfully`,
  });
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
  })
    .select('-password -refreshToken')
    .populate(TEAM_POPULATE)
    .sort({ createdAt: -1 });

  const enrichedAgents = await attachMetricsToAgents(agents);

  res.status(200).json({ success: true, count: enrichedAgents.length, data: enrichedAgents });
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
    delete req.body.team;
    delete req.body.teamLead;
    delete req.body.assignedTeam;
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
 * @desc    Deactivate a user without deleting their account
 * @route   PATCH /api/user-management/:id/deactivate
 * @access  Private
 */
export const deactivateUser = asyncHandler(async (req, res) => {
  const targetUser = await User.findById(req.params.id);

  if (!targetUser) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  // Uses external business logic permission check!
  if (!canModifyOrDeleteUser(req.user, targetUser)) {
     return res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to delete this user' });
  }

  targetUser.isActive = false;
  targetUser.updatedBy = req.user._id;
  targetUser.refreshToken = null;

  await targetUser.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: 'User deactivated successfully',
    data: {
      _id: targetUser._id,
      isActive: targetUser.isActive,
    },
  });
});


/**
 * @desc    Restore or reactivate an agent
 * @route   PATCH /api/user-management/:id/reactivate
 * @access  Private
 */
export const restoreUser = reactivateUser;

export const getTeams = asyncHandler(async (req, res) => {
  if (req.user.role !== ROLES.SUPER_ADMIN) {
    return res.status(403).json({ success: false, message: 'Forbidden: Super Admins only' });
  }

  const legacyTeamLeads = await User.find({
    role: ROLES.TEAM_LEAD,
    isDeleted: false,
    assignedTeam: { $nin: [null, ''] },
  }).select('assignedTeam team role updatedBy');

  for (const legacyTeamLead of legacyTeamLeads) {
    await ensureTeamForLeadUser(legacyTeamLead, req.user._id);
  }

  const teams = await Team.find({})
    .populate('lead', 'fullName assignedTeam')
    .sort({ name: 1 })
    .lean();

  res.status(200).json({
    success: true,
    data: teams.map(formatTeamPayload),
  });
});

export const moveAgentToTeam = asyncHandler(async (req, res) => {
  if (req.user.role !== ROLES.SUPER_ADMIN) {
    return res.status(403).json({ success: false, message: 'Forbidden: Super Admins only' });
  }

  const { teamId } = req.body;

  if (!teamId) {
    return res.status(400).json({ success: false, message: 'New team is required' });
  }

  const agent = await User.findOne({
    _id: req.params.id,
    role: ROLES.AGENT,
    isDeleted: false,
  });

  if (!agent) {
    return res.status(404).json({ success: false, message: 'Agent not found' });
  }

  const newTeam = await Team.findById(teamId).populate('lead', 'fullName assignedTeam role');
  if (!newTeam) {
    return res.status(404).json({ success: false, message: 'Selected team not found' });
  }

  if (!newTeam.lead || newTeam.lead.role === ROLES.AGENT) {
    return res.status(400).json({ success: false, message: 'Selected team does not have a valid Team Lead' });
  }

  const oldTeamId = agent.team ? String(agent.team) : '';
  if (oldTeamId && oldTeamId === String(newTeam._id)) {
    return res.status(400).json({ success: false, message: 'Agent is already assigned to this team' });
  }

  const oldTeam = agent.team ? await Team.findById(agent.team).select('name') : null;

  agent.team = newTeam._id;
  agent.assignedTeam = newTeam.name;
  agent.teamLead = newTeam.lead._id;
  agent.updatedBy = req.user._id;
  await agent.save({ validateBeforeSave: false });

  await TeamTransfer.create({
    agent: agent._id,
    oldTeam: oldTeam?._id || null,
    newTeam: newTeam._id,
    movedBy: req.user._id,
  });

  const updatedAgent = await User.findById(agent._id)
    .select('-password -refreshToken')
    .populate(TEAM_POPULATE)
    .lean();

  res.status(200).json({
    success: true,
    message: `Agent moved from ${oldTeam?.name || 'Unassigned'} to ${newTeam.name}`,
    data: {
      agent: updatedAgent,
      previousTeamName: oldTeam?.name || '',
      currentTeamName: getCurrentTeamName(updatedAgent),
    },
  });
});
