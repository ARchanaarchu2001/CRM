import express from 'express';
import {
  assignLeadsToAgent,
  getAnalystLeads,
  getLeadMetadata,
  getMyAssignments,
  getUploadMiddleware,
  importLeads,
  updateAssignmentOutcome,
  upsertRemarkConfig,
} from '../controllers/leadController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';
import { ROLES } from '../constants/roles.js';

const router = express.Router();

router.use(protect);

router.get('/metadata', authorizeRoles(ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN), getLeadMetadata);
router.get('/analyst', authorizeRoles(ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN), getAnalystLeads);
router.post(
  '/import',
  authorizeRoles(ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN),
  getUploadMiddleware(),
  importLeads
);
router.post(
  '/assign',
  authorizeRoles(ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN),
  assignLeadsToAgent
);
router.put(
  '/remarks/:product',
  authorizeRoles(ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN),
  upsertRemarkConfig
);
router.get(
  '/assignments/mine',
  authorizeRoles(ROLES.AGENT, ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN),
  getMyAssignments
);
router.put(
  '/assignments/:assignmentId',
  authorizeRoles(ROLES.AGENT, ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN),
  updateAssignmentOutcome
);

export default router;
