import express from 'express';
import {
  assignLeadsToAgent,
  deleteAnalystBatch,
  getAnalystBatches,
  getAnalystLeadSelection,
  getAnalystPerformanceOverview,
  getManagedAgentBatchView,
  getManagedAgentDashboardView,
  getManagedAgentPipelineView,
  getManagedAgentQueueView,
  getMyAssignmentBatches,
  getMyPipelineAssignments,
  getMyPipelineSummary,
  getAnalystLeads,
  getLeadMetadata,
  getTeamLeadConversionOverview,
  getMyAssignments,
  getUploadMiddleware,
  hideAssignmentBatch,
  importLeads,
  previewLeadImport,
  restoreAssignmentBatch,
  updateAssignmentOutcome,
  upsertRemarkConfig,
} from '../controllers/leadController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';
import { ROLES } from '../constants/roles.js';

const router = express.Router();

router.use(protect);

router.get('/metadata', authorizeRoles(ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN), getLeadMetadata);
router.get('/analyst/batches', authorizeRoles(ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN), getAnalystBatches);
router.get('/analyst/overview', authorizeRoles(ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN), getAnalystPerformanceOverview);
router.get('/analyst/selection', authorizeRoles(ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN), getAnalystLeadSelection);
router.get('/analyst', authorizeRoles(ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN), getAnalystLeads);
router.get(
  '/team-view/agents/:agentId/dashboard',
  authorizeRoles(ROLES.TEAM_LEAD, ROLES.SUPER_ADMIN, ROLES.DATA_ANALYST),
  getManagedAgentDashboardView
);
router.get(
  '/team-view/agents/:agentId/pipeline',
  authorizeRoles(ROLES.TEAM_LEAD, ROLES.SUPER_ADMIN, ROLES.DATA_ANALYST),
  getManagedAgentPipelineView
);
router.get(
  '/team-view/agents/:agentId/queue',
  authorizeRoles(ROLES.TEAM_LEAD, ROLES.SUPER_ADMIN, ROLES.DATA_ANALYST),
  getManagedAgentQueueView
);
router.get(
  '/team-view/agents/:agentId/batches/:batchId',
  authorizeRoles(ROLES.TEAM_LEAD, ROLES.SUPER_ADMIN, ROLES.DATA_ANALYST),
  getManagedAgentBatchView
);
router.get(
  '/team-lead/conversion',
  authorizeRoles(ROLES.TEAM_LEAD, ROLES.SUPER_ADMIN),
  getTeamLeadConversionOverview
);
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
router.delete(
  '/analyst/batches/:importBatchId',
  authorizeRoles(ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN),
  deleteAnalystBatch
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
  '/assignments/batches/:importBatchId/restore',
  authorizeRoles(ROLES.AGENT, ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN),
  restoreAssignmentBatch
);
router.put(
  '/assignments/:assignmentId',
  authorizeRoles(ROLES.AGENT, ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN),
  updateAssignmentOutcome
);

export default router;
