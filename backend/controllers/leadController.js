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
      { upsert: true, new: true }
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

  return XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
    raw: false,
  });
};

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
      callingRemarks: sanitizeList(req.body.callingRemarks),
      interestedRemarks: sanitizeList(req.body.interestedRemarks),
      notInterestedRemarks: sanitizeList(req.body.notInterestedRemarks),
      updatedBy: req.user._id,
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  res.status(200).json({
    message: 'Remark options updated successfully',
    remarkConfig,
  });
});

export const importLeads = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('Please upload a CSV or Excel file');
  }

  const product = String(req.body.product || '').trim().toLowerCase();
  if (!DEFAULT_PRODUCTS.includes(product)) {
    res.status(400);
    throw new Error('Please choose a valid product');
  }

  const rows = parseWorkbookRows(req.file.buffer, req.file.originalname).filter((row) =>
    Object.values(row).some((value) => String(value || '').trim() !== '')
  );

  if (!rows.length) {
    res.status(400);
    throw new Error('The uploaded file has no lead rows');
  }

  const headers = Object.keys(rows[0] || {});
  const contactColumn = inferContactColumn(headers, req.body.contactColumn);

  if (!contactColumn) {
    res.status(400);
    throw new Error(`Could not detect the contact number column. Available headers: ${headers.join(', ')}`);
  }

  const normalizedContacts = rows
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
    sourceFileName: req.file.originalname,
    uploadedBy: req.user._id,
    contactColumn,
    headers,
  });

  let duplicateInFileCount = 0;
  let duplicateInSystemCount = 0;

  const leadDocs = rows.reduce((accumulator, row, index) => {
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
    detectedHeaders: headers,
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
  const { product, duplicateStatus, search, assignmentStatus } = req.query;

  const filters = {};
  if (product) {
    filters.product = String(product).toLowerCase();
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

  res.status(200).json({
    leads,
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
  const { product, status, search } = req.query;

  const filters = {
    agent: req.user._id,
  };

  if (product) {
    filters.product = String(product).toLowerCase();
  }
  if (status) {
    filters.status = status;
  }

  const assignments = await LeadAssignment.find(filters)
    .sort({ createdAt: -1 })
    .limit(200)
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
  } = req.body;

  assignment.status = status || assignment.status;
  assignment.contactabilityStatus = contactabilityStatus ?? assignment.contactabilityStatus;
  assignment.callAttempt1Date = callAttempt1Date ?? assignment.callAttempt1Date;
  assignment.callAttempt2Date = callAttempt2Date ?? assignment.callAttempt2Date;
  assignment.callingRemark = callingRemark ?? assignment.callingRemark;
  assignment.interestedRemark = interestedRemark ?? assignment.interestedRemark;
  assignment.notInterestedRemark = notInterestedRemark ?? assignment.notInterestedRemark;
  assignment.agentNotes = agentNotes ?? assignment.agentNotes;

  await assignment.save();

  res.status(200).json({
    message: 'Assigned lead updated successfully',
    assignment,
  });
});
