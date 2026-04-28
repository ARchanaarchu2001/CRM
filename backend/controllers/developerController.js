import XLSX from 'xlsx';
import asyncHandler from '../utils/asyncHandler.js';
import { ROLES } from '../constants/roles.js';
import User from '../models/User.js';
import Lead from '../models/Lead.js';
import LeadAssignment from '../models/LeadAssignment.js';
import LeadImport from '../models/LeadImport.js';
import Team from '../models/Team.js';
import SavedReport from '../models/SavedReport.js';
import ProductRemarkConfig from '../models/ProductRemarkConfig.js';

const DEFAULT_DEVELOPER_PATH = 'ops-vault-9f3c7a-monitor';
const RESOLVED_STATUSES = new Set(['submitted', 'activated', 'completed']);

const collectionMap = {
  users: User,
  leads: Lead,
  assignments: LeadAssignment,
  imports: LeadImport,
  teams: Team,
  savedReports: SavedReport,
  remarkConfigs: ProductRemarkConfig,
};

const parseLimit = (value, fallback = 2000) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), 10000);
};

const getDeveloperPath = () =>
  String(process.env.DEVELOPER_DASHBOARD_PATH || DEFAULT_DEVELOPER_PATH).trim();

const assertDeveloperAccess = (req, res) => {
  if (req.params.accessPath !== getDeveloperPath()) {
    res.status(404);
    throw new Error('Not found');
  }

  if (req.user.role !== ROLES.DEVELOPER) {
    res.status(404);
    throw new Error('Not found');
  }
};

const toPlain = (doc) => {
  const value = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return JSON.parse(JSON.stringify(value));
};

const flattenObject = (value, prefix = '', output = {}) => {
  if (Array.isArray(value)) {
    output[prefix || 'items'] = JSON.stringify(value);
    return output;
  }

  if (value && typeof value === 'object') {
    for (const [key, nestedValue] of Object.entries(value)) {
      flattenObject(nestedValue, prefix ? `${prefix}.${key}` : key, output);
    }
    return output;
  }

  output[prefix] = value ?? '';
  return output;
};

const getCollectionRows = async (collectionKey, limit = 2000) => {
  const Model = collectionMap[collectionKey];
  if (!Model) return [];

  const query = Model.find({}).sort({ createdAt: -1 }).limit(limit);

  if (collectionKey === 'assignments') {
    query
      .populate('agent', 'fullName email role assignedTeam')
      .populate('assignedBy', 'fullName email role')
      .populate('lead')
      .populate('importBatch', 'batchName product sourceFileName');
  } else if (collectionKey === 'leads') {
    query.populate('uploadedBy', 'fullName email role').populate('importBatch', 'batchName product sourceFileName');
  } else if (collectionKey === 'imports') {
    query.populate('uploadedBy', 'fullName email role');
  } else if (collectionKey === 'teams') {
    query.populate('lead', 'fullName email role');
  } else if (collectionKey === 'savedReports') {
    query.populate('createdBy', 'fullName email role');
  }

  const docs = await query.lean();
  return docs.map((doc) => flattenObject(toPlain(doc)));
};

const getDailyActivity = async () =>
  LeadAssignment.aggregate([
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$updatedAt',
          },
        },
        interactions: { $sum: 1 },
        submitted: {
          $sum: {
            $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0],
          },
        },
        activated: {
          $sum: {
            $cond: [{ $eq: ['$status', 'activated'] }, 1, 0],
          },
        },
        reachable: {
          $sum: {
            $cond: [{ $eq: ['$contactabilityStatus', 'Reachable'] }, 1, 0],
          },
        },
      },
    },
    { $sort: { _id: -1 } },
    { $limit: 14 },
  ]);

const getAgentAssignmentRows = async () =>
  LeadAssignment.aggregate([
    {
      $group: {
        _id: '$agent',
        assigned: { $sum: 1 },
        submitted: {
          $sum: {
            $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0],
          },
        },
        activated: {
          $sum: {
            $cond: [{ $eq: ['$status', 'activated'] }, 1, 0],
          },
        },
        openPipeline: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$inPipeline', true] },
                  { $not: [{ $in: ['$status', Array.from(RESOLVED_STATUSES)] }] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'agent',
      },
    },
    { $unwind: { path: '$agent', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        agentId: '$_id',
        agentName: { $ifNull: ['$agent.fullName', 'Unassigned'] },
        email: '$agent.email',
        team: '$agent.assignedTeam',
        assigned: 1,
        submitted: 1,
        activated: 1,
        openPipeline: 1,
      },
    },
    { $sort: { assigned: -1 } },
    { $limit: 50 },
  ]);

const getBatchRows = async () =>
  Lead.aggregate([
    {
      $group: {
        _id: '$importBatch',
        batchName: { $first: '$batchName' },
        product: { $first: '$product' },
        totalLeads: { $sum: 1 },
        assignedAgentCount: { $sum: '$assignedAgentCount' },
        duplicateInFile: {
          $sum: {
            $cond: [{ $in: ['$duplicateStatus', ['duplicate_in_file', 'duplicate_in_file_and_system']] }, 1, 0],
          },
        },
        duplicateInSystem: {
          $sum: {
            $cond: [{ $in: ['$duplicateStatus', ['duplicate_in_system', 'duplicate_in_file_and_system']] }, 1, 0],
          },
        },
      },
    },
    { $sort: { totalLeads: -1 } },
    { $limit: 50 },
  ]);

export const getDeveloperDashboard = asyncHandler(async (req, res) => {
  assertDeveloperAccess(req, res);

  const [
    totalUsers,
    activeUsers,
    blockedUsers,
    totalLeads,
    totalAssignments,
    totalImports,
    totalTeams,
    pipelineOpen,
    unassignedLeads,
    submittedAssignments,
    activatedAssignments,
    usersByRole,
    leadsByProduct,
    assignmentsByStatus,
    dailyActivity,
    agentAssignments,
    batchStats,
    recentUsers,
    recentImports,
    recentAssignments,
  ] = await Promise.all([
    User.countDocuments({ isDeleted: false }),
    User.countDocuments({ isActive: true, isBlocked: false, isDeleted: false }),
    User.countDocuments({ isBlocked: true, isDeleted: false }),
    Lead.countDocuments({}),
    LeadAssignment.countDocuments({}),
    LeadImport.countDocuments({}),
    Team.countDocuments({}),
    LeadAssignment.countDocuments({ inPipeline: true, status: { $nin: Array.from(RESOLVED_STATUSES) } }),
    Lead.countDocuments({ assignedAgentCount: 0 }),
    LeadAssignment.countDocuments({ status: 'submitted' }),
    LeadAssignment.countDocuments({ status: 'activated' }),
    User.aggregate([{ $match: { isDeleted: false } }, { $group: { _id: '$role', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Lead.aggregate([{ $group: { _id: '$product', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    LeadAssignment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    getDailyActivity(),
    getAgentAssignmentRows(),
    getBatchRows(),
    User.find({ isDeleted: false }).sort({ createdAt: -1 }).limit(8).select('fullName email role assignedTeam isActive isBlocked lastLogin createdAt').lean(),
    LeadImport.find({}).sort({ createdAt: -1 }).limit(8).populate('uploadedBy', 'fullName email').lean(),
    LeadAssignment.find({})
      .sort({ updatedAt: -1 })
      .limit(8)
      .populate('agent', 'fullName email assignedTeam')
      .populate('lead', 'contactNumber rawData')
      .select('agent lead batchName product status contactabilityStatus inPipeline updatedAt createdAt')
      .lean(),
  ]);

  res.status(200).json({
    success: true,
    dashboard: {
      generatedAt: new Date().toISOString(),
      kpis: {
        totalUsers,
        activeUsers,
        blockedUsers,
        totalLeads,
        totalAssignments,
        totalImports,
        totalTeams,
        pipelineOpen,
        unassignedLeads,
        submittedAssignments,
        activatedAssignments,
      },
      charts: {
        usersByRole: usersByRole.map((row) => ({ label: row._id || 'unknown', value: row.count })),
        leadsByProduct: leadsByProduct.map((row) => ({ label: row._id || 'unknown', value: row.count })),
        assignmentsByStatus: assignmentsByStatus.map((row) => ({ label: row._id || 'blank', value: row.count })),
        dailyActivity: dailyActivity.reverse().map((row) => ({
          date: row._id,
          interactions: row.interactions,
          submitted: row.submitted,
          activated: row.activated,
          reachable: row.reachable,
        })),
      },
      tables: {
        agentAssignments,
        batchStats,
        recentUsers,
        recentImports,
        recentAssignments,
      },
      exports: Object.keys(collectionMap).concat('all'),
    },
  });
});

export const exportDeveloperData = asyncHandler(async (req, res) => {
  assertDeveloperAccess(req, res);

  const collectionKey = req.params.collectionKey;
  const limit = parseLimit(req.query.limit);
  const exportKeys = collectionKey === 'all' ? Object.keys(collectionMap) : [collectionKey];

  if (!exportKeys.every((key) => collectionMap[key])) {
    res.status(400);
    throw new Error('Unknown export collection');
  }

  const workbook = XLSX.utils.book_new();

  for (const key of exportKeys) {
    const rows = await getCollectionRows(key, limit);
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), key.slice(0, 31));
  }

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', `attachment; filename="developer-${collectionKey}-${Date.now()}.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.status(200).send(buffer);
});
