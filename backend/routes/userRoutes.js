import express from 'express';
import {
  getAdminOnly,
  getManagerArea,
  getTeamLeadArea,
  getAgentArea,
  getUserProfile,
} from '../controllers/userController.js';
import { protect, authorizeRoles, authorizeMinimumRole } from '../middleware/authMiddleware.js';
import { ROLES } from '../constants/roles.js';

const router = express.Router();

// Apply protect to all routes below
router.use(protect);

router.get('/profile', getUserProfile);

// Using exact role matching for specific restrictions or 'authorizeMinimumRole' for hierarchy grouping
router.get(
  '/admin-only',
  authorizeRoles(ROLES.SUPER_ADMIN),
  getAdminOnly
);

router.get(
  '/manager-area',
  authorizeMinimumRole(ROLES.MANAGER),
  getManagerArea
);

router.get(
  '/team-lead-area',
  authorizeMinimumRole(ROLES.TEAM_LEAD),
  getTeamLeadArea
);

router.get(
  '/agent-area',
  authorizeMinimumRole(ROLES.AGENT),
  getAgentArea
);

export default router;
