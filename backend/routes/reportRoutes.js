import express from 'express';
import { protect, authorizeRoles, authorizeMinimumRole } from '../middleware/authMiddleware.js';
import {
  getLeadReport,
  getAgentPerformanceReport,
  getDailyReport,  getWeeklyReport,  getMonthlyReport,
  saveReport,
  getAllReports,
  getReportById,
  deleteReport,
} from '../controllers/reportController.js';
import { ROLES } from '../constants/roles.js';

const router = express.Router();

// All routes are protected and require DATA_ANALYST or SUPER_ADMIN role
router.use(protect);
router.use(authorizeRoles(ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN));

/**
 * Report Generation Routes
 */

// Get report for a specific lead
router.get('/lead/:leadId', getLeadReport);

// Get agent performance report
router.get('/agent-performance', getAgentPerformanceReport);

// Get daily report
router.get('/daily', getDailyReport);

// Get weekly report
router.get('/weekly', getWeeklyReport);

// Get monthly report
router.get('/monthly', getMonthlyReport);

/**
 * Report Management Routes
 */

// Get all saved reports
router.get('/', getAllReports);

// Get specific report by ID
router.get('/saved/:reportId', getReportById);

// Save a generated report
router.post('/save', saveReport);

// Delete a saved report
router.delete('/:reportId', deleteReport);

export default router;
