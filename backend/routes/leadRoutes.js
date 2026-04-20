import express from 'express';
import {
  assignLeadsToAgent,
  deleteAnalystBatch,
  deleteSavedReport,
  exportAnalystLeads,
  exportAdvancedReportDetail,
  getAnalystBatches,
  getAnalystLeadSelection,
  getAnalystPerformanceOverview,
  getAdvancedReportData,
  getSavedReports,
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
  unassignLeadAssignments,
  upsertRemarkConfig,
  saveReport,
} from '../controllers/leadController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';
import { ROLES } from '../constants/roles.js';

const router = express.Router();

router.use(protect);

router.get('/metadata', authorizeRoles(ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN, ROLES.MANAGER), getLeadMetadata);
router.get('/analyst/batches', authorizeRoles(ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN), getAnalystBatches);
router.get('/analyst/overview', authorizeRoles(ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN), getAnalystPerformanceOverview);
router.get('/analyst/reports', authorizeRoles(ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN, ROLES.MANAGER), getAdvancedReportData);
router.get('/analyst/reports/export', authorizeRoles(ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN, ROLES.MANAGER), exportAdvancedReportDetail);
router.get('/analyst/export', authorizeRoles(ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN), exportAnalystLeads);
router.get('/analyst/selection', authorizeRoles(ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN), getAnalystLeadSelection);
router.get('/analyst', authorizeRoles(ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN), getAnalystLeads);
router.get('/reports/saved', authorizeRoles(ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN, ROLES.MANAGER), getSavedReports);
router.get(
  '/team-view/agents/:agentId/dashboard',
  authorizeRoles(ROLES.TEAM_LEAD, ROLES.SUPER_ADMIN, ROLES.DATA_ANALYST, ROLES.MANAGER),
  getManagedAgentDashboardView
);
router.get(
  '/team-view/agents/:agentId/pipeline',
  authorizeRoles(ROLES.TEAM_LEAD, ROLES.SUPER_ADMIN, ROLES.DATA_ANALYST, ROLES.MANAGER),
  getManagedAgentPipelineView
);
router.get(
  '/team-view/agents/:agentId/queue',
  authorizeRoles(ROLES.TEAM_LEAD, ROLES.SUPER_ADMIN, ROLES.DATA_ANALYST, ROLES.MANAGER),
  getManagedAgentQueueView
);
router.get(
  '/team-view/agents/:agentId/batches/:batchId',
  authorizeRoles(ROLES.TEAM_LEAD, ROLES.SUPER_ADMIN, ROLES.DATA_ANALYST, ROLES.MANAGER),
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
router.post(
  '/unassign',
  authorizeRoles(ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN),
  unassignLeadAssignments
);
router.post(
  '/reports/saved',
  authorizeRoles(ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN, ROLES.MANAGER),
  saveReport
);
router.delete(
  '/analyst/batches/:importBatchId',
  authorizeRoles(ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN),
  deleteAnalystBatch
);
router.delete(
  '/reports/saved/:id',
  authorizeRoles(ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN, ROLES.MANAGER),
  deleteSavedReport
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
