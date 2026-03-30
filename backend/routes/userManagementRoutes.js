import express from 'express';
import {
  getAgentSelfDashboard,
  createUserByAdmin,
  createAgentByTeamLead,
  getAllUsersForAdmin,
  getAgentPerformanceDetail,
  getTeams,
  getSuperAdminDashboard,
  getTeamLeadDashboard,
  getTeamLeadAgents,
  moveAgentToTeam,
  reactivateUser,
  removeAgentFromTeam,
  removeUserFromSystem,
  getUserById,
  updateUser,
  deactivateUser
} from '../controllers/userManagementController.js';

import { protect, authorizeRoles } from '../middleware/authMiddleware.js';
import { uploadProfilePhoto } from '../middleware/uploadMiddleware.js';
import { ROLES } from '../constants/roles.js';

const router = express.Router();

// Apply protect middleware to all routes in this file
router.use(protect);

// =========================================================
// SUPER ADMIN ROUTES
// =========================================================
router.post(
  '/create',
  authorizeRoles(ROLES.SUPER_ADMIN),
  uploadProfilePhoto.single('profilePhoto'),
  createUserByAdmin
);

router.get(
  '/',
  authorizeRoles(ROLES.SUPER_ADMIN),
  getAllUsersForAdmin
);

router.get(
  '/teams',
  authorizeRoles(ROLES.SUPER_ADMIN),
  getTeams
);

router.get(
  '/dashboard/super-admin',
  authorizeRoles(ROLES.SUPER_ADMIN),
  getSuperAdminDashboard
);


// =========================================================
// TEAM LEAD ROUTES
// =========================================================
router.post(
  '/team-lead/create-agent',
  authorizeRoles(ROLES.TEAM_LEAD),
  uploadProfilePhoto.single('profilePhoto'),
  createAgentByTeamLead
);

router.get(
  '/team-lead/agents',
  authorizeRoles(ROLES.TEAM_LEAD),
  getTeamLeadAgents
);

router.get(
  '/dashboard/team-lead',
  authorizeRoles(ROLES.TEAM_LEAD),
  getTeamLeadDashboard
);

router.get(
  '/dashboard/agent-self',
  authorizeRoles(ROLES.AGENT),
  getAgentSelfDashboard
);

router.get(
  '/dashboard/agents/:agentId',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.TEAM_LEAD, ROLES.DATA_ANALYST),
  getAgentPerformanceDetail
);


// =========================================================
// MIXED / DYNAMIC SCOPE ROUTES (Controller manages granular)
// =========================================================
router.get(
  '/:id',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.TEAM_LEAD),
  getUserById
);

router.put(
  '/:id',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.TEAM_LEAD),
  uploadProfilePhoto.single('profilePhoto'), // Keep to allow updating photo
  updateUser
);

router.patch(
  '/:id/deactivate',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.TEAM_LEAD),
  deactivateUser
);

router.patch(
  '/:id/reactivate',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.TEAM_LEAD),
  reactivateUser
);

router.patch(
  '/:id/move-team',
  authorizeRoles(ROLES.SUPER_ADMIN),
  moveAgentToTeam
);

router.patch(
  '/:id/remove-from-team',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.TEAM_LEAD),
  removeAgentFromTeam
);

router.delete(
  '/:id',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.TEAM_LEAD),
  removeUserFromSystem
);

export default router;
