import express from 'express';
import { getDeveloperDashboard, exportDeveloperData } from '../controllers/developerController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/:accessPath/monitor', getDeveloperDashboard);
router.get('/:accessPath/export/:collectionKey', exportDeveloperData);

export default router;
