import multer from 'multer';
import path from 'path';
import XLSX from 'xlsx';
import asyncHandler from '../utils/asyncHandler.js';
import Lead from '../models/Lead.js';
import LeadAssignment from '../models/LeadAssignment.js';
import LeadImport from '../models/LeadImport.js';
import SavedReport from '../models/SavedReport.js';
import ProductRemarkConfig from '../models/ProductRemarkConfig.js';
import User from '../models/User.js';
import Team from '../models/Team.js';
import { ROLES } from '../constants/roles.js';
import { checkLeadWorkedActivity, checkIsLeadCleared, getCurrentDateString, calculateSingleAgentMetrics } from '../utils/leadMetrics.js';
import { getIO } from '../utils/socket.js';
import { buildDashboardAnalytics, resolveDateRange } from '../utils/dashboardAnalytics.js';

const DEFAULT_PRODUCTS = ['mnp', 'p2p', 'fne', 'plus', 'general'];
const DEFAULT_REMARKS = {
  contactabilityStatuses: ['Reachable', 'Not Reachable'],
  callAttempt1Label: 'Call Attempt 1 - Date',
  callAttempt2Label: 'Call Attempt 2 - Date',
  callingRemarkLabel: 'Calling Remarks',
  interestedRemarkLabel: 'Interested Remarks',
  notInterestedRemarkLabel: 'Not Interested Remarks',
  callingRemarks: [
    'Interested',
    'Follow up',
    'Call back',
    'No Answer',
    'Not Interested',
    'Line Busy',
    'Call Disconnected',
    'DND',
    'Switch Off',
    'Invalid Number',
    'Not Reachable',
    'Not the owner',
    'Order Submitted',
    'Activated',
    'Rejected',
    'DNCR',
    'Inactive MSISDN',
  ],
  interestedRemarks: [
    'Dunning',
    'EID Expired',
    'CAP Limit',
    'Black Listed',
    'Under Passport',
    'Out of Country',
    'Ownership Transfer',
    'IT Error',
  ],
  notInterestedRemarks: ['Bad Experience'],
};

const buildAnalystLeadFilters = ({ product, duplicateStatus, assignmentStatus, batchName, importBatchId }) => {
  const filters = {};

  if (product) {
    filters.product = String(product).toLowerCase();
  }
  if (batchName) {
    filters.batchName = String(batchName).trim();
  }
  if (importBatchId) {
    filters.importBatch = importBatchId;
  }
  if (duplicateStatus) {
    filters.duplicateStatus = duplicateStatus;
  }
  if (assignmentStatus === 'unassigned') {
    filters.assignedAgentCount = 0;
  }
  if (assignmentStatus === 'assigned') {
    filters.assignedAgentCount = { $gt: 0 };
  }

  return filters;
};

const leadMatchesSearch = (lead, query) => {
  const safeSearch = String(query || '').trim().toLowerCase();
  if (!safeSearch) {
    return true;
  }

  const valuesToSearch = [
    lead.contactNumber,
    lead.batchName,
    lead.product,
    ...Object.values(lead.rawData || {}),
  ];

  return valuesToSearch.some((value) => String(value || '').toLowerCase().includes(safeSearch));
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const CONTACT_COLUMN_ALIASES = [
  'msisdn',
  'mobile',
  'mobile no',
  'mobile number',
  'contact',
  'contact no',
  'contact number',
  'phone',
  'phone number',
  'telephone',
  'tel',
];

const normalizeHeader = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const normalizeContactNumber = (value) =>
  String(value || '')
    .replace(/[^\d+]/g, '')
    .trim();

const convertScientificToPlainString = (value) => {
  const input = String(value ?? '').trim();

  if (!input || !/[eE]/.test(input)) {
    return input;
  }

  const match = input.match(/^([+-]?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
  if (!match) {
    return input;
  }

  const [, sign, integerPart, fractionalPart = '', exponentString] = match;
  const digits = `${integerPart}${fractionalPart}`;
  const exponent = Number(exponentString);
  const decimalIndex = integerPart.length + exponent;

  if (decimalIndex <= 0) {
    return `${sign}0.${'0'.repeat(Math.abs(decimalIndex))}${digits}`.replace(/\.$/, '');
  }

  if (decimalIndex >= digits.length) {
    return `${sign}${digits}${'0'.repeat(decimalIndex - digits.length)}`;
  }

  return `${sign}${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`.replace(/\.$/, '');
};

const toPlainCellString = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toFixed(0) : String(value);
  }

  return convertScientificToPlainString(value);
};

const buildDuplicateStatus = ({ seenInFile, existsInSystem }) => {
  if (seenInFile && existsInSystem) {
    return 'duplicate_in_file_and_system';
  }

  if (seenInFile) {
    return 'duplicate_in_file';
  }

  if (existsInSystem) {
    return 'duplicate_in_system';
  }

  return 'unique';
};

const getTodayDateString = () => new Date().toISOString().slice(0, 10);

const ANALYTICS_TEAM_POPULATE = [
  { path: 'teamLead', select: 'fullName assignedTeam' },
  { path: 'team', select: 'name lead', populate: { path: 'lead', select: 'fullName assignedTeam' } },
];

const TRACKED_ASSIGNMENT_FIELDS = [
  ['contactabilityStatus', 'Contactability Status'],
  ['callAttempt1Date', 'Call Attempt 1 - Date'],
  ['callAttempt2Date', 'Call Attempt 2 - Date'],
  ['callingRemark', 'Calling Remarks'],
  ['interestedRemark', 'Interested Remarks'],
  ['notInterestedRemark', 'Not Interested Remarks'],
  ['agentNotes', 'Agent Notes'],
  ['status', 'Status'],
];

const buildPipelineHistoryValue = ({ inPipeline, pipelineFollowUpDate }) => {
  if (!inPipeline && !pipelineFollowUpDate) {
    return '';
  }

  if (!inPipeline) {
    return `Pipeline date removed (${pipelineFollowUpDate || 'no follow-up date'})`;
  }

  return pipelineFollowUpDate ? `In Pipeline - Follow-up ${pipelineFollowUpDate}` : 'In Pipeline';
};

const getViewableAgentForLead = async (requester, agentId) => {
  const agent = await User.findOne({ _id: agentId, role: ROLES.AGENT, isDeleted: false })
    .select('fullName teamLead')
    .lean();

  if (!agent) {
    return null;
  }

  if ([ROLES.SUPER_ADMIN, ROLES.DATA_ANALYST].includes(requester.role)) {
    return agent;
  }

  if (requester.role === ROLES.TEAM_LEAD && String(agent.teamLead || '') === String(requester._id)) {
    return agent;
  }

  return null;
};

const ensureDefaultRemarkConfigs = async () => {
  for (const product of DEFAULT_PRODUCTS) {
    await ProductRemarkConfig.findOneAndUpdate(
      { product },
      {
        $setOnInsert: {
          product,
          ...DEFAULT_REMARKS,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );
  }
};

const inferContactColumn = (headers, explicitColumn) => {
  if (explicitColumn) {
    const match = headers.find((header) => header === explicitColumn);
    if (match) {
      return match;
    }
  }

  const normalizedToOriginal = new Map(headers.map((header) => [normalizeHeader(header), header]));

  for (const alias of CONTACT_COLUMN_ALIASES) {
    const match = normalizedToOriginal.get(alias);
    if (match) {
      return match;
    }
  }

  return null;
};

const parseWorkbookRows = (fileBuffer, originalName) => {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  if (!worksheet) {
    throw new Error(`Could not read worksheet from ${originalName}`);
  }

  const formattedRows = XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
    raw: false,
  });

  const rawRows = XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
    raw: true,
  });

  return {
    formattedRows,
    rawRows,
  };
};

const inferBatchNameFromFileName = (fileName) =>
  String(fileName || '')
    .replace(/\.[^.]+$/, '')
    .trim();

const parseJsonArrayField = (value, fallback = []) => {
  if (!value) {
    return fallback;
  }

  if (Array.isArray(value)) {
    return value;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    return fallback;
  }
};

const formatSearchableValue = (value) => String(value || '').trim().toLowerCase();

const sanitizeAddedColumns = (value) =>
  parseJsonArrayField(value).reduce((accumulator, item) => {
    const name = String(item?.name || '').trim();
    if (!name) {
      return accumulator;
    }

    accumulator.push({
      name,
      defaultValue: String(item?.defaultValue || ''),
    });
    return accumulator;
  }, []);

const applyColumnEditsToRow = ({ row, removedColumns, addedColumns }) => {
  const nextRow = Object.fromEntries(
    Object.entries(row).filter(([key]) => !removedColumns.includes(key))
  );

  for (const column of addedColumns) {
    nextRow[column.name] = column.defaultValue;
  }

  return nextRow;
};

const getTransformedHeaders = ({ headers, removedColumns, addedColumns }) => [
  ...headers.filter((header) => !removedColumns.includes(header)),
  ...addedColumns
    .map((column) => column.name)
    .filter((name) => !headers.includes(name)),
];

const normalizeContactColumnValues = (formattedRows, rawRows, contactColumn) =>
  formattedRows.map((row, index) => ({
    ...row,
    [contactColumn]: toPlainCellString(rawRows[index]?.[contactColumn] ?? row[contactColumn]),
  }));

export const getUploadMiddleware = () => upload.single('file');

export const getLeadMetadata = asyncHandler(async (req, res) => {
  await ensureDefaultRemarkConfigs();

  const [remarkConfigs, agents, recentImports, teams] = await Promise.all([
    ProductRemarkConfig.find().sort({ product: 1 }),
    User.find({
      role: ROLES.AGENT,
      isActive: true,
      isBlocked: false,
    })
      .select('fullName email role team assignedTeam')
      .populate('team', 'name')
      .sort({ fullName: 1 }),
    LeadImport.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('uploadedBy', 'fullName email'),
    Team.find().select('name lead').sort({ name: 1 }),
  ]);

  res.status(200).json({
    products: DEFAULT_PRODUCTS,
    remarkConfigs,
    agents,
    recentImports,
    teams,
  });
});

export const upsertRemarkConfig = asyncHandler(async (req, res) => {
  const { product } = req.params;
  const sanitizeList = (value) =>
    Array.isArray(value)
      ? [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))]
      : [];

  const remarkConfig = await ProductRemarkConfig.findOneAndUpdate(
    { product: product.toLowerCase() },
    {
      product: product.toLowerCase(),
      contactabilityStatuses: sanitizeList(req.body.contactabilityStatuses),
      callAttempt1Label: String(req.body.callAttempt1Label || DEFAULT_REMARKS.callAttempt1Label).trim(),
      callAttempt2Label: String(req.body.callAttempt2Label || DEFAULT_REMARKS.callAttempt2Label).trim(),
      callingRemarkLabel: String(req.body.callingRemarkLabel || DEFAULT_REMARKS.callingRemarkLabel).trim(),
      interestedRemarkLabel: String(req.body.interestedRemarkLabel || DEFAULT_REMARKS.interestedRemarkLabel).trim(),
      notInterestedRemarkLabel: String(
        req.body.notInterestedRemarkLabel || DEFAULT_REMARKS.notInterestedRemarkLabel
      ).trim(),
      callingRemarks: sanitizeList(req.body.callingRemarks),
      interestedRemarks: sanitizeList(req.body.interestedRemarks),
      notInterestedRemarks: sanitizeList(req.body.notInterestedRemarks),
      updatedBy: req.user._id,
    },
    {
      upsert: true,
      returnDocument: 'after',
      setDefaultsOnInsert: true,
    }
  );

  res.status(200).json({
    message: 'Remark options updated successfully',
    remarkConfig,
  });
});

export const previewLeadImport = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('Please upload a CSV or Excel file');
  }

  const { formattedRows, rawRows } = parseWorkbookRows(req.file.buffer, req.file.originalname);
  const rows = formattedRows.filter((row) =>
    Object.values(row).some((value) => String(value || '').trim() !== '')
  );
  const filteredRawRows = rawRows.filter((row) => Object.values(row).some((value) => String(value || '').trim() !== ''));

  if (!rows.length) {
    res.status(400);
    throw new Error('The uploaded file has no lead rows');
  }

  const headers = Object.keys(rows[0] || {});
  const detectedContactColumn = inferContactColumn(headers, req.body.contactColumn);
  const normalizedRows = detectedContactColumn
    ? normalizeContactColumnValues(rows, filteredRawRows, detectedContactColumn)
    : rows;

  res.status(200).json({
    suggestedBatchName: inferBatchNameFromFileName(req.file.originalname),
    fileName: req.file.originalname,
    totalRows: rows.length,
    headers,
    detectedContactColumn,
    sampleRows: normalizedRows.slice(0, 5),
  });
});

export const importLeads = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('Please upload a CSV or Excel file');
  }

  const product = String(req.body.product || '').trim().toLowerCase();
  const batchName = String(req.body.batchName || '').trim();
  if (!DEFAULT_PRODUCTS.includes(product)) {
    res.status(400);
    throw new Error('Please choose a valid product');
  }
  if (!batchName) {
    res.status(400);
    throw new Error('Please enter an import name for this batch');
  }

  const workbookRows = parseWorkbookRows(req.file.buffer, req.file.originalname);
  const rawRows = workbookRows.formattedRows.filter((row) =>
    Object.values(row).some((value) => String(value || '').trim() !== '')
  );
  const rawCellRows = workbookRows.rawRows.filter((row) =>
    Object.values(row).some((value) => String(value || '').trim() !== '')
  );

  if (!rawRows.length) {
    res.status(400);
    throw new Error('The uploaded file has no lead rows');
  }

  const headers = Object.keys(rawRows[0] || {});
  const contactColumn = inferContactColumn(headers, req.body.contactColumn);
  const removedColumns = parseJsonArrayField(req.body.removedColumns).map((item) => String(item));
  const addedColumns = sanitizeAddedColumns(req.body.addedColumns);

  if (!contactColumn) {
    res.status(400);
    throw new Error(`Could not detect the contact number column. Available headers: ${headers.join(', ')}`);
  }

  if (removedColumns.includes(contactColumn)) {
    res.status(400);
    throw new Error('The contact number column cannot be removed');
  }

  const transformedRows = normalizeContactColumnValues(
    rawRows.map((row) =>
      applyColumnEditsToRow({
        row,
        removedColumns,
        addedColumns,
      })
    ),
    rawCellRows.map((row) =>
      applyColumnEditsToRow({
        row,
        removedColumns,
        addedColumns,
      })
    ),
    contactColumn
  );

  const transformedHeaders = getTransformedHeaders({
    headers,
    removedColumns,
    addedColumns,
  });

  const normalizedContacts = transformedRows
    .map((row) => normalizeContactNumber(row[contactColumn]))
    .filter(Boolean);

  if (!normalizedContacts.length) {
    res.status(400);
    throw new Error(`No contact numbers were found in the selected column: ${contactColumn}`);
  }

  const existingLeads = await Lead.find({
    product,
    contactNumber: { $in: normalizedContacts },
  }).select('contactNumber');
  const existingNumbers = new Set(existingLeads.map((lead) => lead.contactNumber));
  const seenInFile = new Set();

  const importBatch = await LeadImport.create({
    product,
    batchName,
    sourceFileName: req.file.originalname,
    uploadedBy: req.user._id,
    contactColumn,
    headers: transformedHeaders,
  });

  let duplicateInFileCount = 0;
  let duplicateInSystemCount = 0;

  const leadDocs = transformedRows.reduce((accumulator, row, index) => {
    const contactNumber = normalizeContactNumber(row[contactColumn]);
    if (!contactNumber) {
      return accumulator;
    }

    const alreadySeenInFile = seenInFile.has(contactNumber);
    const existsInSystem = existingNumbers.has(contactNumber);

    if (alreadySeenInFile) {
      duplicateInFileCount += 1;
    }
    if (existsInSystem) {
      duplicateInSystemCount += 1;
    }

    seenInFile.add(contactNumber);

    accumulator.push({
      importBatch: importBatch._id,
      batchName,
      product,
      uploadedBy: req.user._id,
      rowIndex: index + 1,
      contactNumber,
      contactColumn,
      rawData: row,
      duplicateStatus: buildDuplicateStatus({
        seenInFile: alreadySeenInFile,
        existsInSystem,
      }),
    });

    return accumulator;
  }, []);

  if (!leadDocs.length) {
    await LeadImport.findByIdAndDelete(importBatch._id);
    res.status(400);
    throw new Error('No usable lead rows were found after reading the file');
  }

  await Lead.insertMany(leadDocs);

  importBatch.totalRows = leadDocs.length;
  importBatch.duplicateInFileCount = duplicateInFileCount;
  importBatch.duplicateInSystemCount = duplicateInSystemCount;
  await importBatch.save();

  res.status(201).json({
    message: 'Leads imported successfully',
    importBatch,
    detectedHeaders: transformedHeaders,
    detectedContactColumn: contactColumn,
    summary: {
      totalRows: leadDocs.length,
      duplicateInFileCount,
      duplicateInSystemCount,
      uniqueCount: leadDocs.filter((lead) => lead.duplicateStatus === 'unique').length,
    },
  });
});

export const getAnalystLeads = asyncHandler(async (req, res) => {
  const { product, duplicateStatus, search, assignmentStatus, batchName, importBatchId } = req.query;
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize, 10) || 100, 1), 200);

  const filters = buildAnalystLeadFilters({
    product,
    duplicateStatus,
    assignmentStatus,
    batchName,
    importBatchId,
  });

  const leads = await Lead.find(filters)
    .sort({ createdAt: -1 })
    .populate('importBatch', 'sourceFileName')
    .lean();

  const filteredLeads = search ? leads.filter((lead) => leadMatchesSearch(lead, search)) : leads;

  const totalCount = filteredLeads.length;
  const totalPages = Math.max(Math.ceil(totalCount / pageSize), 1);
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedLeads = filteredLeads.slice(startIndex, startIndex + pageSize);

  const leadIds = paginatedLeads.map((lead) => lead._id);
  const assignments = leadIds.length
    ? await LeadAssignment.find({ lead: { $in: leadIds } })
      .select(
        'lead assignedAgentName status contactabilityStatus callAttempt1Date callAttempt2Date callingRemark interestedRemark notInterestedRemark agentNotes updatedAt'
      )
      .sort({ updatedAt: -1 })
      .lean()
    : [];

  const assignmentsByLeadId = assignments.reduce((accumulator, assignment) => {
    const key = String(assignment.lead);
    if (!accumulator[key]) {
      accumulator[key] = [];
    }
    accumulator[key].push(assignment);
    return accumulator;
  }, {});

  res.status(200).json({
    totalCount,
    page: safePage,
    pageSize,
    totalPages,
    leads: paginatedLeads.map((lead) => ({
      ...lead,
      assignments: assignmentsByLeadId[String(lead._id)] || [],
    })),
  });
});

export const getAnalystLeadSelection = asyncHandler(async (req, res) => {
  const { product, duplicateStatus, search, assignmentStatus, batchName, importBatchId } = req.query;
  const count = Math.min(Math.max(Number.parseInt(req.query.count, 10) || 0, 0), 5000);
  const filters = buildAnalystLeadFilters({
    product,
    duplicateStatus,
    assignmentStatus,
    batchName,
    importBatchId,
  });

  if (!count) {
    res.status(200).json({
      count: 0,
      leadIds: [],
    });
    return;
  }

  if (!search) {
    const leads = await Lead.find(filters)
      .sort({ createdAt: -1 })
      .limit(count)
      .select('_id')
      .lean();

    res.status(200).json({
      count: leads.length,
      leadIds: leads.map((lead) => String(lead._id)),
    });
    return;
  }

  const leads = await Lead.find(filters)
    .sort({ createdAt: -1 })
    .select('_id contactNumber batchName product rawData')
    .lean();

  const leadIds = [];
  for (const lead of leads) {
    if (leadMatchesSearch(lead, search)) {
      leadIds.push(String(lead._id));
      if (leadIds.length >= count) {
        break;
      }
    }
  }

  res.status(200).json({
    count: leadIds.length,
    leadIds,
  });
});

export const getAnalystBatches = asyncHandler(async (req, res) => {
  const { product } = req.query;

  const matchStage = {};
  if (product) {
    matchStage.product = String(product).toLowerCase();
  }

  const batches = await Lead.aggregate([
    {
      $match: matchStage,
    },
    {
      $group: {
        _id: '$importBatch',
        importBatchId: { $first: '$importBatch' },
        batchName: { $first: '$batchName' },
        product: { $first: '$product' },
        totalRows: { $sum: 1 },
        assignedRows: {
          $sum: {
            $cond: [{ $gt: ['$assignedAgentCount', 0] }, 1, 0],
          },
        },
        unassignedRows: {
          $sum: {
            $cond: [{ $eq: ['$assignedAgentCount', 0] }, 1, 0],
          },
        },
        duplicateRows: {
          $sum: {
            $cond: [{ $ne: ['$duplicateStatus', 'unique'] }, 1, 0],
          },
        },
        createdAt: { $max: '$createdAt' },
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
  ]);

  res.status(200).json({
    batches,
  });
});

export const assignLeadsToAgent = asyncHandler(async (req, res) => {
  const { leadIds, agentId } = req.body;

  if (!Array.isArray(leadIds) || !leadIds.length) {
    res.status(400);
    throw new Error('Please choose at least one lead to assign');
  }

  const agent = await User.findOne({
    _id: agentId,
    role: ROLES.AGENT,
    isActive: true,
    isBlocked: false,
  }).select('fullName email');

  if (!agent) {
    res.status(404);
    throw new Error('Selected agent was not found or is unavailable');
  }

  const leads = await Lead.find({ _id: { $in: leadIds } });

  if (leads.length !== leadIds.length) {
    res.status(404);
    throw new Error('Some selected leads could not be found');
  }

  const assignments = leads.map((lead) => ({
    lead: lead._id,
    importBatch: lead.importBatch,
    batchName: lead.batchName,
    product: lead.product,
    agent: agent._id,
    assignedBy: req.user._id,
    assignedAgentName: agent.fullName,
  }));

  await LeadAssignment.insertMany(assignments);
  await Lead.updateMany({ _id: { $in: leadIds } }, { $inc: { assignedAgentCount: 1 } });

  const productList = [...new Set(leads.map((lead) => String(lead.product || 'general').toLowerCase()))];
  const batchNameList = [...new Set(leads.map((lead) => String(lead.batchName || '').trim()).filter(Boolean))];
  const productLabel =
    productList.length === 1
      ? productList[0].toUpperCase()
      : `${productList.length} products`;

  try {
    getIO().emit('assignmentCreated', {
      agentId: agent._id.toString(),
      assignedBy: req.user._id.toString(),
      leadCount: leadIds.length,
      products: productList,
      productLabel,
      batchNames: batchNameList,
      message: `You received ${leadIds.length} new lead${leadIds.length === 1 ? '' : 's'} for ${productLabel}.`,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to emit assignmentCreated', error);
  }

  res.status(201).json({
    message: `Assigned ${leadIds.length} leads to ${agent.fullName}`,
  });
});

export const deleteAnalystBatch = asyncHandler(async (req, res) => {
  const { importBatchId } = req.params;

  const importBatch = await LeadImport.findById(importBatchId);
  if (!importBatch) {
    res.status(404);
    throw new Error('Dataset not found');
  }

  await Promise.all([
    LeadAssignment.deleteMany({ importBatch: importBatchId }),
    Lead.deleteMany({ importBatch: importBatchId }),
    LeadImport.findByIdAndDelete(importBatchId),
  ]);

  res.status(200).json({
    message: `Deleted dataset ${importBatch.batchName}`,
  });
});

export const getMyAssignments = asyncHandler(async (req, res) => {
  const { product, status, search, batchName, importBatchId, pipeline } = req.query;
  const page = Number.parseInt(req.query.page, 10);
  const pageSize = Number.parseInt(req.query.pageSize, 10);
  const shouldPaginate = Number.isFinite(page) || Number.isFinite(pageSize);
  const normalizedPageSize = Math.min(Math.max(pageSize || 100, 1), 200);
  const normalizedPage = Math.max(page || 1, 1);

  const filters = {
    agent: req.user._id,
    hiddenByAgent: { $ne: true },
  };

  if (pipeline === 'true') {
    filters.inPipeline = true;
  } else if (pipeline === 'false') {
    filters.inPipeline = { $ne: true };
  }

  if (product) {
    filters.product = String(product).toLowerCase();
  }
  if (status) {
    filters.status = status;
  }
  if (batchName) {
    filters.batchName = String(batchName).trim();
  }
  if (importBatchId) {
    filters.importBatch = importBatchId;
  }

  const contactFilter = String(req.query.contact || '').trim().toLowerCase();
  const contactabilityStatusFilter = String(req.query.contactabilityStatus || '').trim().toLowerCase();
  const callingRemarkFilter = String(req.query.callingRemark || '').trim().toLowerCase();
  const interestedRemarkFilter = String(req.query.interestedRemark || '').trim().toLowerCase();
  const notInterestedRemarkFilter = String(req.query.notInterestedRemark || '').trim().toLowerCase();
  let rawFilters = {};
  try {
    rawFilters = req.query.rawFilters ? JSON.parse(req.query.rawFilters) : {};
  } catch {
    rawFilters = {};
  }

  const assignments = await LeadAssignment.find(filters)
    .sort({ createdAt: -1 })
    .populate('lead')
    .lean();

  const safeSearch = String(search || '').trim().toLowerCase();

  const filteredAssignments = assignments.filter((assignment) => {
    const lead = assignment.lead || {};
    const contactNumber = formatSearchableValue(lead.contactNumber);
    const productValue = formatSearchableValue(assignment.product);
    const contactabilityStatusValue = formatSearchableValue(assignment.contactabilityStatus);
    const callingRemarkValue = formatSearchableValue(assignment.callingRemark);
    const interestedRemarkValue = formatSearchableValue(assignment.interestedRemark);
    const notInterestedRemarkValue = formatSearchableValue(assignment.notInterestedRemark);
    const statusValue = formatSearchableValue(assignment.status);
    const rawData = lead.rawData || {};

    if (contactFilter && !contactNumber.includes(contactFilter)) {
      return false;
    }
    if (contactabilityStatusFilter && !contactabilityStatusValue.includes(contactabilityStatusFilter)) {
      return false;
    }
    if (callingRemarkFilter && !callingRemarkValue.includes(callingRemarkFilter)) {
      return false;
    }
    if (interestedRemarkFilter && !interestedRemarkValue.includes(interestedRemarkFilter)) {
      return false;
    }
    if (notInterestedRemarkFilter && !notInterestedRemarkValue.includes(notInterestedRemarkFilter)) {
      return false;
    }

    const rawFilterEntries = Object.entries(rawFilters || {});
    for (const [rawKey, rawValue] of rawFilterEntries) {
      const normalizedRawFilter = String(rawValue || '').trim().toLowerCase();
      if (!normalizedRawFilter) {
        continue;
      }

      if (!formatSearchableValue(rawData?.[rawKey]).includes(normalizedRawFilter)) {
        return false;
      }
    }

    if (safeSearch) {
      const valuesToSearch = [
        lead.contactNumber,
        assignment.batchName,
        assignment.product,
        assignment.contactabilityStatus,
        assignment.callingRemark,
        assignment.interestedRemark,
        assignment.notInterestedRemark,
        assignment.status,
        ...Object.values(rawData),
      ];

      const found = valuesToSearch.some((value) =>
        formatSearchableValue(value).includes(safeSearch)
      );

      if (!found) {
        return false;
      }
    }

    return true;
  });

  const remarkConfigMap = Object.fromEntries(
    (await ProductRemarkConfig.find()).map((config) => [config.product, config])
  );

  const totalCount = filteredAssignments.length;
  const totalPages = shouldPaginate ? Math.max(Math.ceil(totalCount / normalizedPageSize), 1) : 1;
  const safePage = shouldPaginate ? Math.min(normalizedPage, totalPages) : 1;
  const startIndex = shouldPaginate ? (safePage - 1) * normalizedPageSize : 0;
  const visibleAssignments = shouldPaginate
    ? filteredAssignments.slice(startIndex, startIndex + normalizedPageSize)
    : filteredAssignments;

  res.status(200).json({
    totalCount,
    page: safePage,
    pageSize: shouldPaginate ? normalizedPageSize : totalCount,
    totalPages,
    assignments: visibleAssignments.map((assignment) => ({
      ...assignment,
      remarkConfig: remarkConfigMap[assignment.product] || null,
    })),
  });
});

export const getMyAssignmentBatches = asyncHandler(async (req, res) => {
  const buildBatchAggregation = (isCompleted) => ([
    {
      $match: {
        agent: req.user._id,
        hiddenByAgent: isCompleted ? true : { $ne: true },
        inPipeline: { $ne: true },
      },
    },
    {
      $group: {
        _id: '$importBatch',
        importBatchId: { $first: '$importBatch' },
        batchName: { $first: '$batchName' },
        product: { $first: '$product' },
        totalRows: { $sum: 1 },
        pipelineCount: {
          $sum: {
            $cond: [{ $eq: ['$inPipeline', true] }, 1, 0],
          },
        },
        notDialedCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: [{ $ifNull: ['$contactabilityStatus', ''] }, ''] },
                  { $eq: [{ $ifNull: ['$callingRemark', ''] }, ''] },
                  { $eq: [{ $ifNull: ['$interestedRemark', ''] }, ''] },
                  { $eq: [{ $ifNull: ['$notInterestedRemark', ''] }, ''] },
                  { $eq: [{ $ifNull: ['$callAttempt1Date', ''] }, ''] },
                  { $eq: [{ $ifNull: ['$callAttempt2Date', ''] }, ''] },
                ],
              },
              1,
              0,
            ],
          },
        },
        dialedCount: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $ne: [{ $ifNull: ['$contactabilityStatus', ''] }, ''] },
                  { $ne: [{ $ifNull: ['$callingRemark', ''] }, ''] },
                  { $ne: [{ $ifNull: ['$interestedRemark', ''] }, ''] },
                  { $ne: [{ $ifNull: ['$notInterestedRemark', ''] }, ''] },
                  { $ne: [{ $ifNull: ['$callAttempt1Date', ''] }, ''] },
                  { $ne: [{ $ifNull: ['$callAttempt2Date', ''] }, ''] },
                ],
              },
              1,
              0,
            ],
          },
        },
        followUpCount: {
          $sum: {
            $cond: [{ $eq: ['$callingRemark', 'Follow up'] }, 1, 0],
          },
        },
        callbackCount: {
          $sum: {
            $cond: [{ $eq: ['$callingRemark', 'Call back'] }, 1, 0],
          },
        },
        interestedCount: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ['$callingRemark', 'Interested'] },
                  { $ne: [{ $ifNull: ['$interestedRemark', ''] }, ''] },
                ],
              },
              1,
              0,
            ],
          },
        },
        submittedCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0],
          },
        },
        activatedCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'activated'] }, 1, 0],
          },
        },
        updatedAt: { $max: '$updatedAt' },
      },
    },
    {
      $sort: {
        updatedAt: -1,
      },
    },
  ]);

  const [batches, completedBatches] = await Promise.all([
    LeadAssignment.aggregate(buildBatchAggregation(false)),
    LeadAssignment.aggregate(buildBatchAggregation(true)),
  ]);

  res.status(200).json({
    batches,
    completedBatches,
  });
});

export const getMyPipelineSummary = asyncHandler(async (req, res) => {
  const today = getTodayDateString();

  const [summary] = await LeadAssignment.aggregate([
    {
      $match: {
        agent: req.user._id,
        hiddenByAgent: { $ne: true },
        inPipeline: true,
      },
    },
    {
      $group: {
        _id: null,
        totalPipelineRows: { $sum: 1 },
        dueTodayCount: {
          $sum: {
            $cond: [{ $eq: ['$pipelineFollowUpDate', today] }, 1, 0],
          },
        },
        overdueCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$pipelineFollowUpDate', ''] },
                  { $lt: ['$pipelineFollowUpDate', today] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  res.status(200).json({
    totalPipelineRows: summary?.totalPipelineRows || 0,
    dueTodayCount: summary?.dueTodayCount || 0,
    overdueCount: summary?.overdueCount || 0,
  });
});

export const getMyPipelineAssignments = asyncHandler(async (req, res) => {
  const today = getTodayDateString();

  const assignments = await LeadAssignment.find({
    agent: req.user._id,
    hiddenByAgent: { $ne: true },
    inPipeline: true,
  })
    .sort({ pipelineFollowUpDate: 1, updatedAt: -1 })
    .populate('lead')
    .lean();

  const remarkConfigMap = Object.fromEntries(
    (await ProductRemarkConfig.find()).map((config) => [config.product, config])
  );

  res.status(200).json({
    dueTodayCount: assignments.filter((assignment) => assignment.pipelineFollowUpDate === today).length,
    overdueCount: assignments.filter(
      (assignment) => assignment.pipelineFollowUpDate && assignment.pipelineFollowUpDate < today
    ).length,
    assignments: assignments.map((assignment) => ({
      ...assignment,
      isDueToday: assignment.pipelineFollowUpDate === today,
      isOverdue: Boolean(assignment.pipelineFollowUpDate && assignment.pipelineFollowUpDate < today),
      remarkConfig: remarkConfigMap[assignment.product] || null,
    })),
  });
});

export const hideAssignmentBatch = asyncHandler(async (req, res) => {
  const { importBatchId } = req.params;

  const result = await LeadAssignment.updateMany(
    {
      agent: req.user._id,
      importBatch: importBatchId,
    },
    {
      $set: {
        hiddenByAgent: true,
      },
    }
  );

  if (!result.matchedCount) {
    res.status(404);
    throw new Error('Batch not found for this agent');
  }

  res.status(200).json({
    message: 'Batch marked as completed',
  });
});

export const restoreAssignmentBatch = asyncHandler(async (req, res) => {
  const { importBatchId } = req.params;

  const result = await LeadAssignment.updateMany(
    {
      agent: req.user._id,
      importBatch: importBatchId,
    },
    {
      $set: {
        hiddenByAgent: false,
      },
    }
  );

  if (!result.matchedCount) {
    res.status(404);
    throw new Error('Batch not found for this agent');
  }

  res.status(200).json({
    message: 'Batch moved back to active dashboard',
  });
});

export const updateAssignmentOutcome = asyncHandler(async (req, res) => {
  const assignment = await LeadAssignment.findById(req.params.assignmentId);

  if (!assignment) {
    res.status(404);
    throw new Error('Assigned lead not found');
  }

  const isOwnerAgent = assignment.agent.toString() === req.user._id.toString();
  const isAnalystOverride = [ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN].includes(req.user.role);

  if (!isOwnerAgent && !isAnalystOverride) {
    res.status(403);
    throw new Error('You are not allowed to update this assigned lead');
  }

  const {
    status,
    contactabilityStatus,
    callAttempt1Date,
    callAttempt2Date,
    callingRemark,
    interestedRemark,
    notInterestedRemark,
    agentNotes,
    inPipeline,
    pipelineFollowUpDate,
    pipelineNameColumn,
    pipelineContactColumn,
    pipelineDisplayName,
    pipelineDisplayContact,
    pipelineNotes,
  } = req.body;

  const updates = {
    status,
    contactabilityStatus,
    callAttempt1Date,
    callAttempt2Date,
    callingRemark,
    interestedRemark,
    notInterestedRemark,
    agentNotes,
  };

  const isWorked = checkLeadWorkedActivity(assignment, updates);
  const nextStatus = status ?? assignment.status;
  const previousStatus = assignment.status;
  const historyEntries = [];

  for (const [fieldKey, fieldLabel] of TRACKED_ASSIGNMENT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(req.body, fieldKey)) {
      continue;
    }

    const previousValue = String(assignment[fieldKey] ?? '');
    const nextValue = String(req.body[fieldKey] ?? '');

    if (previousValue !== nextValue) {
      historyEntries.push({
        fieldKey,
        fieldLabel,
        oldValue: previousValue,
        newValue: nextValue,
        changedAt: new Date(),
        changedBy: req.user._id,
        changedByRole: req.user.role,
      });
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(req.body, 'inPipeline') ||
    Object.prototype.hasOwnProperty.call(req.body, 'pipelineFollowUpDate')
  ) {
    const previousPipelineValue = buildPipelineHistoryValue({
      inPipeline: assignment.inPipeline,
      pipelineFollowUpDate: assignment.pipelineFollowUpDate,
    });
    const nextPipelineValue = buildPipelineHistoryValue({
      inPipeline: inPipeline ?? assignment.inPipeline,
      pipelineFollowUpDate: pipelineFollowUpDate ?? assignment.pipelineFollowUpDate,
    });

    if (previousPipelineValue !== nextPipelineValue) {
      historyEntries.push({
        fieldKey: 'pipeline',
        fieldLabel: 'Pipeline',
        oldValue: previousPipelineValue,
        newValue: nextPipelineValue,
        changedAt: new Date(),
        changedBy: req.user._id,
        changedByRole: req.user.role,
      });
    }
  }

  assignment.status = nextStatus || assignment.status;
  assignment.contactabilityStatus = contactabilityStatus ?? assignment.contactabilityStatus;
  assignment.callAttempt1Date = callAttempt1Date ?? assignment.callAttempt1Date;
  assignment.callAttempt2Date = callAttempt2Date ?? assignment.callAttempt2Date;
  assignment.callingRemark = callingRemark ?? assignment.callingRemark;
  assignment.interestedRemark = interestedRemark ?? assignment.interestedRemark;
  assignment.notInterestedRemark = notInterestedRemark ?? assignment.notInterestedRemark;
  assignment.agentNotes = agentNotes ?? assignment.agentNotes;
  assignment.inPipeline = inPipeline ?? assignment.inPipeline;
  assignment.pipelineFollowUpDate = pipelineFollowUpDate ?? assignment.pipelineFollowUpDate;
  assignment.pipelineNameColumn = pipelineNameColumn ?? assignment.pipelineNameColumn;
  assignment.pipelineContactColumn = pipelineContactColumn ?? assignment.pipelineContactColumn;
  assignment.pipelineDisplayName = pipelineDisplayName ?? assignment.pipelineDisplayName;
  assignment.pipelineDisplayContact = pipelineDisplayContact ?? assignment.pipelineDisplayContact;
  assignment.pipelineNotes = pipelineNotes ?? assignment.pipelineNotes;

  if (nextStatus === 'submitted' && previousStatus !== 'submitted') {
    assignment.submittedAt = assignment.submittedAt || new Date();
  }

  if (nextStatus === 'activated' && previousStatus !== 'activated') {
    assignment.activatedAt = new Date();
    assignment.submittedAt = assignment.submittedAt || new Date();
  }

  if (checkIsLeadCleared(assignment)) {
    assignment.workedDates = [];
  } else if (isWorked) {
    const today = getCurrentDateString();
    if (!assignment.workedDates) {
      assignment.workedDates = [];
    }
    if (!assignment.workedDates.includes(today)) {
      assignment.workedDates.push(today);
    }
  }

  if (historyEntries.length) {
    assignment.fieldChangeHistory = [...(assignment.fieldChangeHistory || []), ...historyEntries];
  }

  await assignment.save();

  try {
    getIO().emit('assignmentUpdated', {
      assignmentId: assignment._id.toString(),
      agentId: assignment.agent.toString(),
      batchId: assignment.importBatch?.toString() || '',
      updatedAt: assignment.updatedAt,
    });
  } catch (error) {
    console.error('Failed to emit assignmentUpdated', error);
  }

  try {
    const updatedMetrics = await calculateSingleAgentMetrics(assignment.agent);
    getIO().emit('agentMetricsUpdated', {
      agentId: assignment.agent.toString(),
      dailyDialsCount: updatedMetrics.dailyDialsCount,
      pendingLeadsCount: updatedMetrics.pendingLeadsCount,
    });
  } catch (error) {
    console.error("Failed to emit agentMetricsUpdated", error);
  }

  res.status(200).json({
    message: 'Assigned lead updated successfully',
    assignment,
  });
});

export const getTeamLeadConversionOverview = asyncHandler(async (req, res) => {
  if (![ROLES.TEAM_LEAD, ROLES.SUPER_ADMIN].includes(req.user.role)) {
    res.status(403);
    throw new Error('Forbidden');
  }

  let rangeInfo;
  try {
    rangeInfo = resolveDateRange(req.query);
  } catch (error) {
    res.status(400);
    throw error;
  }

  const agentFilters =
    req.user.role === ROLES.TEAM_LEAD
      ? { role: ROLES.AGENT, teamLead: req.user._id, isDeleted: false }
      : { role: ROLES.AGENT, isDeleted: false };

  const agents = await User.find(agentFilters)
    .select('fullName profilePhoto assignedTeam')
    .sort({ fullName: 1 })
    .lean();

  const agentIds = agents.map((agent) => agent._id);

  if (!agentIds.length) {
    return res.status(200).json({
      success: true,
      overview: {
        filter: rangeInfo,
        products: [],
        agents: [],
      },
    });
  }

  const assignments = await LeadAssignment.find({ agent: { $in: agentIds } })
    .select('agent product status createdAt submittedAt')
    .lean();

  const agentMap = new Map(
    agents.map((agent) => [
      String(agent._id),
      {
        agentId: String(agent._id),
        agentName: agent.fullName,
        profilePhoto: agent.profilePhoto || null,
        teamName: agent.assignedTeam || 'Unassigned Team',
        totalAssignedLeads: 0,
        totalSubmissions: 0,
        products: {},
      },
    ])
  );

  const productMap = new Map();

  const isAssignmentInRange = (dateValue) => {
    if (!dateValue) return false;
    const parsed = new Date(dateValue);
    return !Number.isNaN(parsed.getTime()) && parsed >= rangeInfo.fromDate && parsed <= rangeInfo.toDate;
  };

  for (const assignment of assignments) {
    const agentId = String(assignment.agent);
    const productKey = String(assignment.product || 'general').toLowerCase();
    const agentRow = agentMap.get(agentId);

    if (!agentRow) {
      continue;
    }

    if (!productMap.has(productKey)) {
      productMap.set(productKey, {
        product: productKey,
        label: productKey.toUpperCase(),
        totalLeads: 0,
        submissions: 0,
      });
    }

    if (!agentRow.products[productKey]) {
      agentRow.products[productKey] = {
        totalLeads: 0,
        submissions: 0,
      };
    }

    if (isAssignmentInRange(assignment.createdAt)) {
      agentRow.totalAssignedLeads += 1;
      agentRow.products[productKey].totalLeads += 1;
      productMap.get(productKey).totalLeads += 1;
    }

    const isSubmittedInRange =
      String(assignment.status || '').toLowerCase() === 'submitted' && isAssignmentInRange(assignment.submittedAt || assignment.createdAt);

    if (isSubmittedInRange) {
      agentRow.totalSubmissions += 1;
      agentRow.products[productKey].submissions += 1;
      productMap.get(productKey).submissions += 1;
    }
  }

  const productKeys = Array.from(productMap.keys()).sort();

  const agentsOverview = Array.from(agentMap.values())
    .map((agent) => ({
      ...agent,
      products: productKeys.map((productKey) => ({
        product: productKey,
        label: productKey.toUpperCase(),
        totalLeads: agent.products[productKey]?.totalLeads || 0,
        submissions: agent.products[productKey]?.submissions || 0,
      })),
    }))
    .sort((left, right) => {
      if (right.totalSubmissions !== left.totalSubmissions) {
        return right.totalSubmissions - left.totalSubmissions;
      }
      return right.totalAssignedLeads - left.totalAssignedLeads;
    });

  const productsOverview = productKeys.map((productKey) => productMap.get(productKey));

  res.status(200).json({
    success: true,
    overview: {
      filter: rangeInfo,
      products: productsOverview,
      agents: agentsOverview,
    },
  });
});

export const getAnalystPerformanceOverview = asyncHandler(async (req, res) => {
  if (![ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN].includes(req.user.role)) {
    res.status(403);
    throw new Error('Forbidden');
  }

  let rangeInfo;
  try {
    rangeInfo = resolveDateRange(req.query);
  } catch (error) {
    res.status(400);
    throw error;
  }

  const agents = await User.find({ role: ROLES.AGENT, isDeleted: false })
    .select('fullName email profilePhoto assignedTeam team teamLead isActive')
    .populate(ANALYTICS_TEAM_POPULATE)
    .sort({ fullName: 1 })
    .lean();

  const agentIds = agents.map((agent) => agent._id);

  if (!agentIds.length) {
    return res.status(200).json({
      success: true,
      dashboard: {
        filter: rangeInfo,
        kpis: [],
        kpiTitles: {},
        summary: {},
        agentTable: [],
        charts: {
          agentDials: [],
          agentSubmissions: [],
          teamComparison: [],
        },
        products: [],
        agentConversions: [],
      },
    });
  }

  const assignments = await LeadAssignment.find({ agent: { $in: agentIds } })
    .select('agent product status createdAt submittedAt activatedAt workedDates inPipeline pipelineFollowUpDate updatedAt')
    .lean();

  const analytics = buildDashboardAnalytics({
    agents,
    assignments,
    rangeInfo,
    includeTeamComparison: true,
  });

  const isInRange = (dateValue) => {
    if (!dateValue) return false;
    const parsed = new Date(dateValue);
    return !Number.isNaN(parsed.getTime()) && parsed >= rangeInfo.fromDate && parsed <= rangeInfo.toDate;
  };

  const agentConversionMap = new Map(
    analytics.agentTable.map((agent) => [
      agent.agentId,
      {
        agentId: agent.agentId,
        agentName: agent.agentName,
        teamId: agent.teamId || '',
        teamName: agent.teamName || 'Unassigned Team',
        totalAssignedLeads: 0,
        totalSubmissions: 0,
        products: Object.fromEntries(
          DEFAULT_PRODUCTS.map((product) => [
            product,
            {
              product,
              label: product.toUpperCase(),
              totalLeads: 0,
              submissions: 0,
            },
          ])
        ),
      },
    ])
  );

  for (const assignment of assignments) {
    const agentId = String(assignment.agent);
    const row = agentConversionMap.get(agentId);
    if (!row) {
      continue;
    }

    const productKey = DEFAULT_PRODUCTS.includes(String(assignment.product || '').toLowerCase())
      ? String(assignment.product || '').toLowerCase()
      : 'general';

    if (isInRange(assignment.createdAt)) {
      row.totalAssignedLeads += 1;
      row.products[productKey].totalLeads += 1;
    }

    const isSubmittedInRange =
      String(assignment.status || '').toLowerCase() === 'submitted' &&
      isInRange(assignment.submittedAt || assignment.createdAt);

    if (isSubmittedInRange) {
      row.totalSubmissions += 1;
      row.products[productKey].submissions += 1;
    }
  }

  const agentConversions = Array.from(agentConversionMap.values()).map((row) => ({
    ...row,
    products: DEFAULT_PRODUCTS.map((product) => row.products[product]),
  }));

  const products = DEFAULT_PRODUCTS.map((product) => ({
    product,
    label: product.toUpperCase(),
    totalLeads: agentConversions.reduce((sum, row) => sum + (row.products.find((item) => item.product === product)?.totalLeads || 0), 0),
    submissions: agentConversions.reduce((sum, row) => sum + (row.products.find((item) => item.product === product)?.submissions || 0), 0),
  }));

  res.status(200).json({
    success: true,
    dashboard: {
      ...analytics,
      products,
      agentConversions,
    },
  });
});

export const getManagedAgentDashboardView = asyncHandler(async (req, res) => {
  if (![ROLES.TEAM_LEAD, ROLES.SUPER_ADMIN, ROLES.DATA_ANALYST].includes(req.user.role)) {
    res.status(403);
    throw new Error('Forbidden');
  }

  const agent = await getViewableAgentForLead(req.user, req.params.agentId);
  if (!agent) {
    res.status(404);
    throw new Error('Agent not found');
  }

  const [batches, assignments, summary] = await Promise.all([
    LeadAssignment.aggregate([
      {
        $match: {
          agent: agent._id,
        },
      },
      {
        $group: {
          _id: '$importBatch',
          importBatchId: { $first: '$importBatch' },
          batchName: { $first: '$batchName' },
          product: { $first: '$product' },
          totalRows: { $sum: 1 },
          pipelineCount: { $sum: { $cond: [{ $eq: ['$inPipeline', true] }, 1, 0] } },
          notDialedCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: [{ $ifNull: ['$contactabilityStatus', ''] }, ''] },
                    { $eq: [{ $ifNull: ['$callingRemark', ''] }, ''] },
                    { $eq: [{ $ifNull: ['$interestedRemark', ''] }, ''] },
                    { $eq: [{ $ifNull: ['$notInterestedRemark', ''] }, ''] },
                    { $eq: [{ $ifNull: ['$callAttempt1Date', ''] }, ''] },
                    { $eq: [{ $ifNull: ['$callAttempt2Date', ''] }, ''] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          dialedCount: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $ne: [{ $ifNull: ['$contactabilityStatus', ''] }, ''] },
                    { $ne: [{ $ifNull: ['$callingRemark', ''] }, ''] },
                    { $ne: [{ $ifNull: ['$interestedRemark', ''] }, ''] },
                    { $ne: [{ $ifNull: ['$notInterestedRemark', ''] }, ''] },
                    { $ne: [{ $ifNull: ['$callAttempt1Date', ''] }, ''] },
                    { $ne: [{ $ifNull: ['$callAttempt2Date', ''] }, ''] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          followUpCount: { $sum: { $cond: [{ $eq: ['$callingRemark', 'Follow up'] }, 1, 0] } },
          callbackCount: { $sum: { $cond: [{ $eq: ['$callingRemark', 'Call back'] }, 1, 0] } },
          interestedCount: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$callingRemark', 'Interested'] },
                    { $ne: [{ $ifNull: ['$interestedRemark', ''] }, ''] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          submittedCount: { $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] } },
          activatedCount: { $sum: { $cond: [{ $eq: ['$status', 'activated'] }, 1, 0] } },
          updatedAt: { $max: '$updatedAt' },
        },
      },
      { $sort: { updatedAt: -1 } },
    ]),
    LeadAssignment.find({
      agent: agent._id,
    }).select('contactabilityStatus callingRemark interestedRemark notInterestedRemark callAttempt1Date callAttempt2Date').lean(),
    LeadAssignment.aggregate([
      {
        $match: {
          agent: agent._id,
          inPipeline: true,
        },
      },
      {
        $group: {
          _id: null,
          totalPipelineRows: { $sum: 1 },
          dueTodayCount: {
            $sum: {
              $cond: [{ $eq: ['$pipelineFollowUpDate', getTodayDateString()] }, 1, 0],
            },
          },
          overdueCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$pipelineFollowUpDate', ''] },
                    { $lt: ['$pipelineFollowUpDate', getTodayDateString()] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
  ]);

  const isNotDialed = (assignment) =>
    !assignment.contactabilityStatus &&
    !assignment.callingRemark &&
    !assignment.interestedRemark &&
    !assignment.notInterestedRemark &&
    !assignment.callAttempt1Date &&
    !assignment.callAttempt2Date;

  res.status(200).json({
    success: true,
    view: {
      agent: {
        _id: agent._id,
        fullName: agent.fullName,
      },
      batches,
      queueSummary: {
        pending: assignments.filter(isNotDialed).length,
        followUp: assignments.filter((assignment) => assignment.callingRemark === 'Follow up').length,
        callback: assignments.filter((assignment) => assignment.callingRemark === 'Call back').length,
        interested: assignments.filter(
          (assignment) => assignment.callingRemark === 'Interested' || Boolean(assignment.interestedRemark)
        ).length,
      },
      pipelineSummary: {
        totalPipelineRows: summary?.[0]?.totalPipelineRows || 0,
        dueTodayCount: summary?.[0]?.dueTodayCount || 0,
        overdueCount: summary?.[0]?.overdueCount || 0,
      },
    },
  });
});

export const getManagedAgentPipelineView = asyncHandler(async (req, res) => {
  if (![ROLES.TEAM_LEAD, ROLES.SUPER_ADMIN, ROLES.DATA_ANALYST].includes(req.user.role)) {
    res.status(403);
    throw new Error('Forbidden');
  }

  const agent = await getViewableAgentForLead(req.user, req.params.agentId);
  if (!agent) {
    res.status(404);
    throw new Error('Agent not found');
  }

  const today = getTodayDateString();
  const assignments = await LeadAssignment.find({
    agent: agent._id,
    inPipeline: true,
  })
    .sort({ pipelineFollowUpDate: 1, updatedAt: -1 })
    .populate('lead')
    .lean();

  res.status(200).json({
    success: true,
    view: {
      agent: {
        _id: agent._id,
        fullName: agent.fullName,
      },
      dueTodayCount: assignments.filter((assignment) => assignment.pipelineFollowUpDate === today).length,
      overdueCount: assignments.filter(
        (assignment) => assignment.pipelineFollowUpDate && assignment.pipelineFollowUpDate < today
      ).length,
      assignments: assignments.map((assignment) => ({
        ...assignment,
        isDueToday: assignment.pipelineFollowUpDate === today,
        isOverdue: Boolean(assignment.pipelineFollowUpDate && assignment.pipelineFollowUpDate < today),
      })),
    },
  });
});

export const getManagedAgentQueueView = asyncHandler(async (req, res) => {
  if (![ROLES.TEAM_LEAD, ROLES.SUPER_ADMIN, ROLES.DATA_ANALYST].includes(req.user.role)) {
    res.status(403);
    throw new Error('Forbidden');
  }

  const agent = await getViewableAgentForLead(req.user, req.params.agentId);
  if (!agent) {
    res.status(404);
    throw new Error('Agent not found');
  }

  const assignments = await LeadAssignment.find({
    agent: agent._id,
  })
    .sort({ createdAt: -1 })
    .populate('lead')
    .lean();

  const remarkConfigMap = Object.fromEntries(
    (await ProductRemarkConfig.find()).map((config) => [config.product, config])
  );

  res.status(200).json({
    success: true,
    view: {
      agent: {
        _id: agent._id,
        fullName: agent.fullName,
      },
      assignments: assignments.map((assignment) => ({
        ...assignment,
        remarkConfig: remarkConfigMap[assignment.product] || null,
      })),
    },
  });
});

export const getManagedAgentBatchView = asyncHandler(async (req, res) => {
  if (![ROLES.TEAM_LEAD, ROLES.SUPER_ADMIN, ROLES.DATA_ANALYST].includes(req.user.role)) {
    res.status(403);
    throw new Error('Forbidden');
  }

  const agent = await getViewableAgentForLead(req.user, req.params.agentId);
  if (!agent) {
    res.status(404);
    throw new Error('Agent not found');
  }

  const assignments = await LeadAssignment.find({
    agent: agent._id,
    importBatch: req.params.batchId,
  })
    .sort({ createdAt: -1 })
    .populate('lead')
    .lean();

  const remarkConfigMap = Object.fromEntries(
    (await ProductRemarkConfig.find()).map((config) => [config.product, config])
  );

  const [batch] = await LeadAssignment.aggregate([
    {
      $match: {
        agent: agent._id,
        importBatch: req.params.batchId,
      },
    },
    {
      $group: {
        _id: '$importBatch',
        importBatchId: { $first: '$importBatch' },
        batchName: { $first: '$batchName' },
        product: { $first: '$product' },
        totalRows: { $sum: 1 },
        pipelineCount: { $sum: { $cond: [{ $eq: ['$inPipeline', true] }, 1, 0] } },
        notDialedCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: [{ $ifNull: ['$contactabilityStatus', ''] }, ''] },
                  { $eq: [{ $ifNull: ['$callingRemark', ''] }, ''] },
                  { $eq: [{ $ifNull: ['$interestedRemark', ''] }, ''] },
                  { $eq: [{ $ifNull: ['$notInterestedRemark', ''] }, ''] },
                  { $eq: [{ $ifNull: ['$callAttempt1Date', ''] }, ''] },
                  { $eq: [{ $ifNull: ['$callAttempt2Date', ''] }, ''] },
                ],
              },
              1,
              0,
            ],
          },
        },
        dialedCount: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $ne: [{ $ifNull: ['$contactabilityStatus', ''] }, ''] },
                  { $ne: [{ $ifNull: ['$callingRemark', ''] }, ''] },
                  { $ne: [{ $ifNull: ['$interestedRemark', ''] }, ''] },
                  { $ne: [{ $ifNull: ['$notInterestedRemark', ''] }, ''] },
                  { $ne: [{ $ifNull: ['$callAttempt1Date', ''] }, ''] },
                  { $ne: [{ $ifNull: ['$callAttempt2Date', ''] }, ''] },
                ],
              },
              1,
              0,
            ],
          },
        },
        followUpCount: { $sum: { $cond: [{ $eq: ['$callingRemark', 'Follow up'] }, 1, 0] } },
        callbackCount: { $sum: { $cond: [{ $eq: ['$callingRemark', 'Call back'] }, 1, 0] } },
        interestedCount: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ['$callingRemark', 'Interested'] },
                  { $ne: [{ $ifNull: ['$interestedRemark', ''] }, ''] },
                ],
              },
              1,
              0,
            ],
          },
        },
        submittedCount: { $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] } },
        activatedCount: { $sum: { $cond: [{ $eq: ['$status', 'activated'] }, 1, 0] } },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    view: {
      agent: {
        _id: agent._id,
        fullName: agent.fullName,
      },
      batch: batch || null,
      assignments: assignments.map((assignment) => ({
        ...assignment,
        remarkConfig: remarkConfigMap[assignment.product] || null,
      })),
    },
  });
});

export const getAdvancedReportData = asyncHandler(async (req, res) => {
  if (![ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN].includes(req.user.role)) {
    res.status(403);
    throw new Error('Forbidden');
  }

  const { teamId, agentId, importBatchId, product } = req.query;

  let rangeInfo;
  try {
    rangeInfo = resolveDateRange(req.query);
  } catch (error) {
    res.status(400);
    throw error;
  }

  // 1. Resolve Agents to include
  const agentQuery = { role: ROLES.AGENT, isDeleted: false };
  if (agentId && agentId !== 'all') {
    agentQuery._id = agentId;
  } else if (teamId && teamId !== 'all') {
    // Handle both real team IDs and the fallback "team:Name" label
    if (String(teamId).startsWith('team:')) {
      const teamName = teamId.replace('team:', '');
      agentQuery.$or = [{ assignedTeam: teamName }, { 'team.name': teamName }];
    } else {
      agentQuery.team = teamId;
    }
  }

  const agents = await User.find(agentQuery)
    .select('fullName email profilePhoto assignedTeam team teamLead isActive')
    .populate(ANALYTICS_TEAM_POPULATE)
    .sort({ fullName: 1 })
    .lean();

  const activeAgentIds = agents.map((agent) => agent._id);

  if (!activeAgentIds.length) {
    return res.status(200).json({
      success: true,
      report: {
        filter: rangeInfo,
        kpis: [],
        charts: { trend: [], productPerformance: [], agentDials: [], agentSubmissions: [], teamComparison: [] },
        agentTable: [],
      },
    });
  }

  // 2. Resolve Assignments filters
  const assignmentQuery = { agent: { $in: activeAgentIds } };
  if (importBatchId) assignmentQuery.importBatch = importBatchId;
  if (product) assignmentQuery.product = String(product).toLowerCase();

  const assignments = await LeadAssignment.find(assignmentQuery)
    .select('agent product status createdAt submittedAt activatedAt workedDates inPipeline pipelineFollowUpDate updatedAt contactabilityStatus callingRemark interestedRemark notInterestedRemark agentNotes')
    .lean();

  const detailedLogs = await LeadAssignment.find(assignmentQuery)
    .populate('lead')
    .populate('agent', 'fullName team assignedTeam')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  // 3. Build Analytics
  const analytics = buildDashboardAnalytics({
    agents,
    assignments,
    rangeInfo,
    includeTeamComparison: true,
  });

  res.status(200).json({
    success: true,
    report: {
      ...analytics,
      detailedLogs,
    },
  });
});

export const exportAdvancedReportDetail = asyncHandler(async (req, res) => {
  if (![ROLES.DATA_ANALYST, ROLES.SUPER_ADMIN].includes(req.user.role)) {
    res.status(403);
    throw new Error('Forbidden');
  }

  const { teamId, agentId, importBatchId, product } = req.query;

  let rangeInfo;
  try {
    rangeInfo = resolveDateRange(req.query);
  } catch (error) {
    res.status(400);
    throw error;
  }

  // 1. Resolve Agents
  const agentQuery = { role: ROLES.AGENT, isDeleted: false };
  if (agentId && agentId !== 'all') {
    agentQuery._id = agentId;
  } else if (teamId && teamId !== 'all') {
    if (String(teamId).startsWith('team:')) {
      const teamName = teamId.replace('team:', '');
      agentQuery.$or = [{ assignedTeam: teamName }, { 'team.name': teamName }];
    } else {
      agentQuery.team = teamId;
    }
  }

  const agents = await User.find(agentQuery)
    .select('fullName email profilePhoto assignedTeam team isActive')
    .populate(ANALYTICS_TEAM_POPULATE)
    .lean();
    
  const agentIds = agents.map(a => a._id);
  const agentMap = new Map(agents.map(a => [String(a._id), a]));

  if (!agentIds.length) {
    res.status(400);
    throw new Error('No agents found for the selected scope.');
  }

  // 2. Fetch Assignments for Analytics
  const assignmentQuery = { 
    agent: { $in: agentIds },
    createdAt: { $gte: rangeInfo.fromDate, $lte: rangeInfo.toDate } 
  };
  if (importBatchId) assignmentQuery.importBatch = importBatchId;
  if (product) assignmentQuery.product = String(product).toLowerCase();

  const assignments = await LeadAssignment.find(assignmentQuery)
    .populate('lead')
    .sort({ createdAt: -1 })
    .lean();

  // 3. Build Analytics for Summary Sheets
  const analytics = buildDashboardAnalytics({
    agents,
    assignments,
    rangeInfo,
    includeTeamComparison: true,
  });

  // 4. Create Workbook
  const wb = XLSX.utils.book_new();

  // --- SHEET 1: PERFORMANCE SUMMARY ---
  const summaryData = analytics.kpis.map(k => ({
    'Metric': k.label,
    'Value': k.value,
    'Context': k.subLabel || ''
  }));
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Performance Summary');

  // --- SHEET 2: AGENT LEADERBOARD ---
  const leaderboardData = analytics.charts.agentSubmissions
    .sort((a, b) => b.submissions - a.submissions)
    .map((item, index) => {
        const agent = agents.find(ag => ag.fullName === item.agent);
        return {
          'Rank': index + 1,
          'Agent Name': item.agent,
          'Team': agent?.team?.name || agent?.assignedTeam || 'Unassigned',
          'Total Dials': item.dials || 0,
          'Submissions': item.submissions || 0,
          'Efficiency (%)': item.efficiency ? `${item.efficiency}%` : '0%',
          'Conversion Rate (%)': item.dials > 0 ? `${((item.submissions / item.dials) * 100).toFixed(1)}%` : '0%'
        };
    });
  const wsLeaderboard = XLSX.utils.json_to_sheet(leaderboardData);
  XLSX.utils.book_append_sheet(wb, wsLeaderboard, 'Agent Rankings');

  // --- SHEET 3: TREND ANALYSIS DATA ---
  const trendData = analytics.charts.trend.map(t => ({
    'Period': t.name,
    'Dials': t.dials,
    'Submissions': t.submissions,
    'Activations': t.activations || 0
  }));
  const wsTrend = XLSX.utils.json_to_sheet(trendData);
  XLSX.utils.book_append_sheet(wb, wsTrend, 'Trend Analysis');

  // --- SHEET 4: DETAILED INTERACTION LOGS ---
  const logData = assignments.map((assignment) => {
    const agent = agentMap.get(String(assignment.agent));
    const lead = assignment.lead || {};
    const rawData = lead.rawData || {};

    const companyName = rawData.Company || rawData.company || rawData['Company Name'] || rawData['COMPANY'] || '';
    const customerName = rawData.Name || rawData.name || rawData['Customer Name'] || '';

    return {
      'Date': new Date(assignment.createdAt).toLocaleDateString(),
      'Agent': agent?.fullName || 'Unknown',
      'Team': agent?.team?.name || agent?.assignedTeam || 'Unassigned',
      'Product': assignment.product?.toUpperCase() || '',
      'Status': (assignment.status || 'NEW').toUpperCase(),
      'Label/Name': customerName || (assignment.pipelineDisplayName || ''),
      'Mobile Number': lead.contactNumber || assignment.pipelineDisplayContact || '',
      'Company': companyName || '',
      'Contactability': assignment.contactabilityStatus || '',
      'Calling Remark': assignment.callingRemark || '',
      'Interested Remark': assignment.interestedRemark || '',
      'Not Interested Remark': assignment.notInterestedRemark || '',
      'Agent Notes': assignment.agentNotes || '',
      'Batch': assignment.batchName || '',
    };
  });
  const wsLogs = XLSX.utils.json_to_sheet(logData);
  
  // Set column widths for Logs
  wsLogs['!cols'] = [
    { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, 
    { wch: 25 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 20 }, 
    { wch: 30 }, { wch: 30 }, { wch: 40 }, { wch: 20 }
  ];
  XLSX.utils.book_append_sheet(wb, wsLogs, 'Detailed Interaction Logs');

  // 5. Finalize and Send
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const fileName = `Analysis_${rangeInfo.range}_${new Date().getTime()}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  
  return res.send(buf);
});

export const saveReport = asyncHandler(async (req, res) => {
  const { name, description, filters } = req.body;

  if (!name) {
    res.status(400);
    throw new Error('Report name is required');
  }

  const savedReport = await SavedReport.create({
    name,
    description,
    filters,
    createdBy: req.user._id,
  });

  res.status(201).json({
    success: true,
    report: savedReport,
  });
});

export const getSavedReports = asyncHandler(async (req, res) => {
  const reports = await SavedReport.find({ createdBy: req.user._id })
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({
    success: true,
    reports,
  });
});

export const deleteSavedReport = asyncHandler(async (req, res) => {
  const report = await SavedReport.findOne({ _id: req.params.id, createdBy: req.user._id });

  if (!report) {
    res.status(404);
    throw new Error('Report not found');
  }

  await report.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Report deleted successfully',
  });
});
