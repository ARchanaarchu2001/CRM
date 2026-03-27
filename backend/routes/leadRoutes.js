import express from 'express';
import {
  assignLeadsToAgent,
  getAnalystBatches,
  getMyAssignmentBatches,
  getMyPipelineAssignments,
  getMyPipelineSummary,
  getAnalystLeads,
  getLeadMetadata,
  getMyAssignments,
  getUploadMiddleware,
  hideAssignmentBatch,
  importLeads,
  previewLeadImport,
  updateAssignmentOutcome,
  upsertRemarkConfig,
} from '../controllers/leadController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';
import { ROLES } from '../constants/roles.js';

const router = express.Router();

router.use(protect);

router.get('/metadata', authorizeRoles(ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN), getLeadMetadata);
router.get('/analyst/batches', authorizeRoles(ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN), getAnalystBatches);
router.get('/analyst', authorizeRoles(ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN), getAnalystLeads);
router.post(
  '/preview',
  authorizeRoles(ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN),
  getUploadMiddleware(),
  previewLeadImport
);
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
  '/assignments/batches',
  authorizeRoles(ROLES.AGENT, ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN),
  getMyAssignmentBatches
);
router.get(
  '/assignments/pipeline',
  authorizeRoles(ROLES.AGENT, ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN),
  getMyPipelineAssignments
);
router.get(
  '/assignments/pipeline/summary',
  authorizeRoles(ROLES.AGENT, ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN),
  getMyPipelineSummary
);
router.get(
  '/assignments/mine',
  authorizeRoles(ROLES.AGENT, ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN),
  getMyAssignments
);
router.put(
  '/assignments/batches/:importBatchId/hide',
  authorizeRoles(ROLES.AGENT, ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN),
  hideAssignmentBatch
);
router.put(
  '/assignments/:assignmentId',
  authorizeRoles(ROLES.AGENT, ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN),
  updateAssignmentOutcome
);

export default router;
