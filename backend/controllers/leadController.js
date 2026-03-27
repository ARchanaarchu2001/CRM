import multer from 'multer';
import XLSX from 'xlsx';
import asyncHandler from '../utils/asyncHandler.js';
import Lead from '../models/Lead.js';
import LeadAssignment from '../models/LeadAssignment.js';
import LeadImport from '../models/LeadImport.js';
import ProductRemarkConfig from '../models/ProductRemarkConfig.js';
import User from '../models/User.js';
import { ROLES } from '../constants/roles.js';

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

  const [remarkConfigs, agents, recentImports] = await Promise.all([
    ProductRemarkConfig.find().sort({ product: 1 }),
    User.find({
      role: ROLES.AGENT,
      isActive: true,
      isBlocked: false,
    })
      .select('fullName email role')
      .sort({ fullName: 1 }),
    LeadImport.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('uploadedBy', 'fullName email'),
  ]);

  res.status(200).json({
    products: DEFAULT_PRODUCTS,
    remarkConfigs,
    agents,
    recentImports,
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
  if (search) {
    const safeSearch = String(search).trim();
    filters.$or = [
      { contactNumber: { $regex: safeSearch, $options: 'i' } },
      { 'rawData.NAME': { $regex: safeSearch, $options: 'i' } },
      { 'rawData.Name': { $regex: safeSearch, $options: 'i' } },
    ];
  }
  if (assignmentStatus === 'unassigned') {
    filters.assignedAgentCount = 0;
  }
  if (assignmentStatus === 'assigned') {
    filters.assignedAgentCount = { $gt: 0 };
  }

  const leads = await Lead.find(filters)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('importBatch', 'sourceFileName')
    .lean();

  const leadIds = leads.map((lead) => lead._id);
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
    leads: leads.map((lead) => ({
      ...lead,
      assignments: assignmentsByLeadId[String(lead._id)] || [],
    })),
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

  res.status(201).json({
    message: `Assigned ${leadIds.length} leads to ${agent.fullName}`,
  });
});

export const getMyAssignments = asyncHandler(async (req, res) => {
  const { product, status, search, batchName, importBatchId, pipeline } = req.query;

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

  const assignments = await LeadAssignment.find(filters)
    .sort({ createdAt: -1 })
    .populate('lead')
    .lean();

  const filteredAssignments = search
    ? assignments.filter((assignment) => {
        const contactNumber = assignment.lead?.contactNumber || '';
        const name =
          assignment.lead?.rawData?.NAME ||
          assignment.lead?.rawData?.Name ||
          assignment.lead?.rawData?.name ||
          '';
        return (
          contactNumber.toLowerCase().includes(String(search).toLowerCase()) ||
          String(name).toLowerCase().includes(String(search).toLowerCase())
        );
      })
    : assignments;

  const remarkConfigMap = Object.fromEntries(
    (await ProductRemarkConfig.find()).map((config) => [config.product, config])
  );

  res.status(200).json({
    assignments: filteredAssignments.map((assignment) => ({
      ...assignment,
      remarkConfig: remarkConfigMap[assignment.product] || null,
    })),
  });
});

export const getMyAssignmentBatches = asyncHandler(async (req, res) => {
  const batches = await LeadAssignment.aggregate([
    {
      $match: {
        agent: req.user._id,
        hiddenByAgent: { $ne: true },
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
        newCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'new'] }, 1, 0],
          },
        },
        followUpCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'follow_up'] }, 1, 0],
          },
        },
        completedCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'completed'] }, 1, 0],
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

  res.status(200).json({
    batches,
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
    message: 'Batch hidden from dashboard',
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
    pipelineNotes,
  } = req.body;

  assignment.status = status || assignment.status;
  assignment.contactabilityStatus = contactabilityStatus ?? assignment.contactabilityStatus;
  assignment.callAttempt1Date = callAttempt1Date ?? assignment.callAttempt1Date;
  assignment.callAttempt2Date = callAttempt2Date ?? assignment.callAttempt2Date;
  assignment.callingRemark = callingRemark ?? assignment.callingRemark;
  assignment.interestedRemark = interestedRemark ?? assignment.interestedRemark;
  assignment.notInterestedRemark = notInterestedRemark ?? assignment.notInterestedRemark;
  assignment.agentNotes = agentNotes ?? assignment.agentNotes;
  assignment.inPipeline = inPipeline ?? assignment.inPipeline;
  assignment.pipelineFollowUpDate = pipelineFollowUpDate ?? assignment.pipelineFollowUpDate;
  assignment.pipelineNotes = pipelineNotes ?? assignment.pipelineNotes;

  await assignment.save();

  res.status(200).json({
    message: 'Assigned lead updated successfully',
    assignment,
  });
});
