import express from 'express';
import {
  createUserByAdmin,
  createAgentByTeamLead,
  getAllUsersForAdmin,
  getTeamLeadAgents,
  getAllAgents,
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

// =========================================================
// DATA ANALYST ROUTES
// =========================================================
router.get(
  '/agents-list',
  authorizeRoles(ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN),
  getAllAgents
);
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

export default router;
