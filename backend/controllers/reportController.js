import asyncHandler from '../utils/asyncHandler.js';
import Lead from '../models/Lead.js';
import LeadAssignment from '../models/LeadAssignment.js';
import User from '../models/User.js';
import Report from '../models/Report.js';
import { ROLES } from '../constants/roles.js';

/**
 * @desc Get report for a specific lead
 * @route GET /api/reports/lead/:leadId
 */
export const getLeadReport = asyncHandler(async (req, res) => {
  const { leadId } = req.params;

  // Get lead data
  const lead = await Lead.findById(leadId).populate('uploadedBy');
  if (!lead) {
    return res.status(404).json({ success: false, message: 'Lead not found' });
  }

  // Get all assignments for this lead
  const assignments = await LeadAssignment.find({ lead: leadId })
    .populate('agent', 'fullName email role')
    .populate('assignedBy', 'fullName');

  // Calculate statistics
  const totalAssignments = assignments.length;
  const statusBreakdown = {};
  const contactabilityBreakdown = {};

  assignments.forEach((assignment) => {
    // Status breakdown
    statusBreakdown[assignment.status] =
      (statusBreakdown[assignment.status] || 0) + 1;

    // Contactability breakdown
    contactabilityBreakdown[assignment.contactabilityStatus] =
      (contactabilityBreakdown[assignment.contactabilityStatus] || 0) + 1;
  });

  const reportData = {
    lead: {
      _id: lead._id,
      contactNumber: lead.contactNumber,
      product: lead.product,
      batchName: lead.batchName,
      uploadedBy: lead.uploadedBy?.fullName,
      uploadedAt: lead.createdAt,
      duplicateStatus: lead.duplicateStatus,
    },
    assignments,
    statistics: {
      totalAssignments,
      statusBreakdown,
      contactabilityBreakdown,
    },
  };

  res.status(200).json({
    success: true,
    message: 'Lead report generated successfully',
    data: reportData,
  });
});

/**
 * @desc Get agent performance report
 * @route GET /api/reports/agent-performance
 * @query startDate, endDate, agentId (optional)
 */
export const getAgentPerformanceReport = asyncHandler(async (req, res) => {
  const { startDate, endDate, agentId, dataset } = req.query;

  const query = {};
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  if (agentId) {
    query.agent = agentId;
  }

  if (dataset && dataset !== 'all') {
    query.batchName = dataset;
  }

  // Get assignments with filters
  const assignments = await LeadAssignment.find(query)
    .populate('agent', 'fullName email')
    .populate('lead', 'product batchName contactNumber');

  // Group assignments by agent
  const agentStats = {};

  assignments.forEach((assignment) => {
    const agentId = assignment.agent._id.toString();
    if (!agentStats[agentId]) {
      agentStats[agentId] = {
        agentId: assignment.agent._id,
        agentName: assignment.agent.fullName,
        agentEmail: assignment.agent.email,
        totalAssignments: 0,
        statusBreakdown: {},
        contactabilityBreakdown: {},
        conversionRate: 0,
        averageCallAttempts: 0,
      };
    }

    const stats = agentStats[agentId];
    stats.totalAssignments += 1;
    stats.statusBreakdown[assignment.status] =
      (stats.statusBreakdown[assignment.status] || 0) + 1;
    stats.contactabilityBreakdown[assignment.contactabilityStatus] =
      (stats.contactabilityBreakdown[assignment.contactabilityStatus] || 0) + 1;

    // Calculate conversion rate (completed assignments)
    if (assignment.status === 'completed') {
      stats.conversionRate = ((stats.statusBreakdown['completed'] || 0) / stats.totalAssignments) * 100;
    }

    // Count call attempts
    let callAttempts = 0;
    if (assignment.callAttempt1Date) callAttempts += 1;
    if (assignment.callAttempt2Date) callAttempts += 1;
    stats.averageCallAttempts = (stats.averageCallAttempts * (stats.totalAssignments - 1) + callAttempts) / stats.totalAssignments;
  });

  const reportData = {
    dateRange: {
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    },
    agentPerformance: Object.values(agentStats),
    summary: {
      totalAgents: Object.keys(agentStats).length,
      totalAssignments: assignments.length,
      averageAssignmentsPerAgent: assignments.length / Object.keys(agentStats).length || 0,
    },
  };

  res.status(200).json({
    success: true,
    message: 'Agent performance report generated successfully',
    data: reportData,
  });
});

/**
 * @desc Get daily report
 * @route GET /api/reports/daily
 * @query date (optional, defaults to today)
 */
export const getDailyReport = asyncHandler(async (req, res) => {
  let { date, agentId, dataset } = req.query;
  
  // Use provided date or today
  const reportDate = date ? new Date(date) : new Date();
  const startOfDay = new Date(reportDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(reportDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Build filter
  const filter = {
    createdAt: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
  };

  // If agentId provided, filter by that agent
  if (agentId) {
    filter.agent = agentId;
  }

  if (dataset && dataset !== 'all') {
    filter.batchName = dataset;
  }

  // Get assignments
  const todayAssignments = await LeadAssignment.find(filter)
    .populate('agent', 'fullName email')
    .populate('lead', 'product batchName contactNumber contactColumn rawData')
    .sort({ createdAt: -1 });

  // Get agent info if specific agent is selected
  const agentInfo = agentId ? await User.findById(agentId).select('fullName email') : null;

  // Calculate detailed metrics per agent
  const agentMetrics = {};
  
  todayAssignments.forEach((assignment) => {
    const agentName = assignment.agent.fullName;
    
    if (!agentMetrics[agentName]) {
      agentMetrics[agentName] = {
        agentName: agentName,
        numbersGiven: 0,
        numbersDialed: 0,
        reachable: 0,
        callback: 0,
        disconnectingCall: 0,
        dndo: 0,
        followUp: 0,
        invalidNumber: 0,
        noAnswer: 0,
        notInterested: 0,
        notReachable: 0,
        volTheOwner: 0,
        outOfCountry: 0,
        switchedOff: 0,
        tookService: 0,
      };
    }
    
    // Numbers Given (total assignments)
    agentMetrics[agentName].numbersGiven += 1;
    
    // Numbers Dialed
    if (assignment.dialCounted) {
      agentMetrics[agentName].numbersDialed += 1;
    }
    
    // Reachable
    if (assignment.contactabilityStatus === 'Reachable') {
      agentMetrics[agentName].reachable += 1;
    }
    
    // Call back / Follow up
    if (assignment.status === 'follow_up') {
      agentMetrics[agentName].callback += 1;
      agentMetrics[agentName].followUp += 1;
    }
    
    // Outcome categories
    switch (assignment.outcomeCategory) {
      case 'disconnecting_call':
        agentMetrics[agentName].disconnectingCall += 1;
        break;
      case 'dndo':
        agentMetrics[agentName].dndo += 1;
        break;
      case 'invalid_number':
        agentMetrics[agentName].invalidNumber += 1;
        break;
      case 'no_answer':
        agentMetrics[agentName].noAnswer += 1;
        break;
      case 'not_interested':
        agentMetrics[agentName].notInterested += 1;
        break;
      case 'not_reachable':
        agentMetrics[agentName].notReachable += 1;
        break;
      case 'out_of_country':
        agentMetrics[agentName].outOfCountry += 1;
        break;
      case 'switched_off':
        agentMetrics[agentName].switchedOff += 1;
        break;
      case 'took_service':
        agentMetrics[agentName].tookService += 1;
        agentMetrics[agentName].volTheOwner += 1;
        break;
    }
  });

  // Calculate reachable connectivity % for each agent
  Object.keys(agentMetrics).forEach(agentName => {
    const metrics = agentMetrics[agentName];
    if (metrics.numbersDialed > 0) {
      metrics.reachableConnectivityPercent = Math.round((metrics.reachable / metrics.numbersDialed) * 100);
    } else {
      metrics.reachableConnectivityPercent = 0;
    }
  });

  const reportData = {
    reportDate: reportDate.toLocaleDateString(),
    agentInfo: agentInfo ? { id: agentInfo._id, name: agentInfo.fullName, email: agentInfo.email } : null,
    totalAssignments: todayAssignments.length,
    agentMetrics: Object.values(agentMetrics),
    rawAssignments: todayAssignments.map(a => ({
      _id: a._id,
      contact: a.lead?.contactNumber,
      product: a.product,
      batchName: a.batchName,
      status: a.status,
      contactabilityStatus: a.contactabilityStatus,
      callAttempt1Date: a.callAttempt1Date,
      callAttempt2Date: a.callAttempt2Date,
      callingRemark: a.callingRemark,
      interestedRemark: a.interestedRemark,
      notInterestedRemark: a.notInterestedRemark,
      agentNotes: a.agentNotes,
      assignedAgentName: a.assignedAgentName,
      dialCounted: a.dialCounted,
      outcomeCategory: a.outcomeCategory,
    })),
  };

  res.status(200).json({
    success: true,
    message: 'Daily report generated successfully',
    data: reportData,
  });
});

/**
 * @desc Get weekly report
 * @route GET /api/reports/weekly
 * @query week, year (optional, defaults to current week)
 */
export const getWeeklyReport = asyncHandler(async (req, res) => {
  let { week, year, agentId, dataset } = req.query;
  
  const now = new Date();
  const reportYear = year ? parseInt(year) : now.getFullYear();
  
  // Calculate week number (1-53)
  let reportWeek = week ? parseInt(week) : getWeekNumber(now);

  // Calculate start and end of the week (Monday - Sunday)
  const startDate = getMonday(new Date(reportYear, 0, 1));
  startDate.setDate(startDate.getDate() + (reportWeek - 1) * 7);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);

  // Build filter
  const filter = {
    createdAt: {
      $gte: startDate,
      $lte: endDate,
    },
  };

  // If agentId provided, filter by that agent
  if (agentId) {
    filter.agent = agentId;
  }

  if (dataset && dataset !== 'all') {
    filter.batchName = dataset;
  }

  // Get assignments for the week
  const weeklyAssignments = await LeadAssignment.find(filter)
    .populate('agent', 'fullName email')
    .populate('lead', 'product batchName contactNumber')
    .sort({ createdAt: -1 });

  // Get agent info if specific agent is selected
  const agentInfo = agentId ? await User.findById(agentId).select('fullName email') : null;

  // Calculate detailed metrics per agent
  const agentMetrics = {};
  
  weeklyAssignments.forEach((assignment) => {
    const agentName = assignment.agent.fullName;
    
    if (!agentMetrics[agentName]) {
      agentMetrics[agentName] = {
        agentName: agentName,
        numbersGiven: 0,
        numbersDialed: 0,
        reachable: 0,
        callback: 0,
        disconnectingCall: 0,
        dndo: 0,
        followUp: 0,
        invalidNumber: 0,
        noAnswer: 0,
        notInterested: 0,
        notReachable: 0,
        volTheOwner: 0,
        outOfCountry: 0,
        switchedOff: 0,
        tookService: 0,
      };
    }
    
    // Numbers Given (total assignments)
    agentMetrics[agentName].numbersGiven += 1;
    
    // Numbers Dialed
    if (assignment.dialCounted) {
      agentMetrics[agentName].numbersDialed += 1;
    }
    
    // Reachable
    if (assignment.contactabilityStatus === 'Reachable') {
      agentMetrics[agentName].reachable += 1;
    }
    
    // Call back / Follow up
    if (assignment.status === 'follow_up') {
      agentMetrics[agentName].callback += 1;
      agentMetrics[agentName].followUp += 1;
    }
    
    // Outcome categories
    switch (assignment.outcomeCategory) {
      case 'disconnecting_call':
        agentMetrics[agentName].disconnectingCall += 1;
        break;
      case 'dndo':
        agentMetrics[agentName].dndo += 1;
        break;
      case 'invalid_number':
        agentMetrics[agentName].invalidNumber += 1;
        break;
      case 'no_answer':
        agentMetrics[agentName].noAnswer += 1;
        break;
      case 'not_interested':
        agentMetrics[agentName].notInterested += 1;
        break;
      case 'not_reachable':
        agentMetrics[agentName].notReachable += 1;
        break;
      case 'out_of_country':
        agentMetrics[agentName].outOfCountry += 1;
        break;
      case 'switched_off':
        agentMetrics[agentName].switchedOff += 1;
        break;
      case 'took_service':
        agentMetrics[agentName].tookService += 1;
        agentMetrics[agentName].volTheOwner += 1;
        break;
    }
  });

  // Calculate reachable connectivity % for each agent
  Object.keys(agentMetrics).forEach(agentName => {
    const metrics = agentMetrics[agentName];
    if (metrics.numbersDialed > 0) {
      metrics.reachableConnectivityPercent = Math.round((metrics.reachable / metrics.numbersDialed) * 100);
    } else {
      metrics.reachableConnectivityPercent = 0;
    }
  });

  const reportData = {
    period: `Week ${reportWeek} of ${reportYear}`,
    agentInfo: agentInfo ? { id: agentInfo._id, name: agentInfo.fullName, email: agentInfo.email } : null,
    dateRange: {
      startDate: startDate.toLocaleDateString(),
      endDate: endDate.toLocaleDateString(),
    },
    totalAssignments: weeklyAssignments.length,
    agentMetrics: Object.values(agentMetrics),
    rawAssignments: weeklyAssignments.map(a => ({
      _id: a._id,
      contact: a.lead?.contactNumber,
      product: a.product,
      batchName: a.batchName,
      status: a.status,
      contactabilityStatus: a.contactabilityStatus,
      callAttempt1Date: a.callAttempt1Date,
      callAttempt2Date: a.callAttempt2Date,
      callingRemark: a.callingRemark,
      interestedRemark: a.interestedRemark,
      notInterestedRemark: a.notInterestedRemark,
      agentNotes: a.agentNotes,
      assignedAgentName: a.assignedAgentName,
      createdAt: a.createdAt,
      dialCounted: a.dialCounted,
      outcomeCategory: a.outcomeCategory,
    })),
  };

  res.status(200).json({
    success: true,
    message: 'Weekly report generated successfully',
    data: reportData,
  });
});

// Helper function to get week number
function getWeekNumber(date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// Helper function to get Monday of the first week
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

/**
 * @desc Get monthly report
 * @route GET /api/reports/monthly
 * @query month, year, agentId
 */
export const getMonthlyReport = asyncHandler(async (req, res) => {
  let { month, year, agentId, dataset } = req.query;

  // Use current month/year if not provided
  const now = new Date();
  const reportMonth = month ? parseInt(month) : now.getMonth() + 1;
  const reportYear = year ? parseInt(year) : now.getFullYear();

  // Create date range for the month
  const startDate = new Date(reportYear, reportMonth - 1, 1);
  const endDate = new Date(reportYear, reportMonth, 0, 23, 59, 59, 999);

  // Build filter
  const filter = {
    createdAt: {
      $gte: startDate,
      $lte: endDate,
    },
  };

  // If agentId provided, filter by that agent
  if (agentId) {
    filter.agent = agentId;
  }

  if (dataset && dataset !== 'all') {
    filter.batchName = dataset;
  }

  // Get assignments for the month
  const monthlyAssignments = await LeadAssignment.find(filter)
    .populate('agent', 'fullName email role')
    .populate('lead', 'product batchName contactNumber');

  // Get agent info if specific agent is selected
  const agentInfo = agentId ? await User.findById(agentId).select('fullName email') : null;

  // Calculate detailed metrics per agent
  const agentMetrics = {};
  
  monthlyAssignments.forEach((assignment) => {
    const agentName = assignment.agent.fullName;
    
    if (!agentMetrics[agentName]) {
      agentMetrics[agentName] = {
        agentName: agentName,
        numbersGiven: 0,
        numbersDialed: 0,
        reachable: 0,
        callback: 0,
        disconnectingCall: 0,
        dndo: 0,
        followUp: 0,
        invalidNumber: 0,
        noAnswer: 0,
        notInterested: 0,
        notReachable: 0,
        volTheOwner: 0,
        outOfCountry: 0,
        switchedOff: 0,
        tookService: 0,
      };
    }
    
    // Numbers Given (total assignments)
    agentMetrics[agentName].numbersGiven += 1;
    
    // Numbers Dialed
    if (assignment.dialCounted) {
      agentMetrics[agentName].numbersDialed += 1;
    }
    
    // Reachable
    if (assignment.contactabilityStatus === 'Reachable') {
      agentMetrics[agentName].reachable += 1;
    }
    
    // Call back / Follow up
    if (assignment.status === 'follow_up') {
      agentMetrics[agentName].callback += 1;
      agentMetrics[agentName].followUp += 1;
    }
    
    // Outcome categories
    switch (assignment.outcomeCategory) {
      case 'disconnecting_call':
        agentMetrics[agentName].disconnectingCall += 1;
        break;
      case 'dndo':
        agentMetrics[agentName].dndo += 1;
        break;
      case 'invalid_number':
        agentMetrics[agentName].invalidNumber += 1;
        break;
      case 'no_answer':
        agentMetrics[agentName].noAnswer += 1;
        break;
      case 'not_interested':
        agentMetrics[agentName].notInterested += 1;
        break;
      case 'not_reachable':
        agentMetrics[agentName].notReachable += 1;
        break;
      case 'out_of_country':
        agentMetrics[agentName].outOfCountry += 1;
        break;
      case 'switched_off':
        agentMetrics[agentName].switchedOff += 1;
        break;
      case 'took_service':
        agentMetrics[agentName].tookService += 1;
        agentMetrics[agentName].volTheOwner += 1;
        break;
    }
  });

  // Calculate reachable connectivity % for each agent
  Object.keys(agentMetrics).forEach(agentName => {
    const metrics = agentMetrics[agentName];
    if (metrics.numbersDialed > 0) {
      metrics.reachableConnectivityPercent = Math.round((metrics.reachable / metrics.numbersDialed) * 100);
    } else {
      metrics.reachableConnectivityPercent = 0;
    }
  });

  const reportData = {
    period: `${reportMonth}/${reportYear}`,
    agentInfo: agentInfo ? { id: agentInfo._id, name: agentInfo.fullName, email: agentInfo.email } : null,
    dateRange: {
      startDate: startDate.toLocaleDateString(),
      endDate: endDate.toLocaleDateString(),
    },
    totalAssignments: monthlyAssignments.length,
    agentMetrics: Object.values(agentMetrics),
    rawAssignments: monthlyAssignments.map(a => ({
      _id: a._id,
      contact: a.lead?.contactNumber,
      product: a.product,
      batchName: a.batchName,
      status: a.status,
      contactabilityStatus: a.contactabilityStatus,
      callAttempt1Date: a.callAttempt1Date,
      callAttempt2Date: a.callAttempt2Date,
      callingRemark: a.callingRemark,
      interestedRemark: a.interestedRemark,
      notInterestedRemark: a.notInterestedRemark,
      agentNotes: a.agentNotes,
      assignedAgentName: a.assignedAgentName,
      createdAt: a.createdAt,
      dialCounted: a.dialCounted,
      outcomeCategory: a.outcomeCategory,
    })),
  };

  res.status(200).json({
    success: true,
    message: 'Monthly report generated successfully',
    data: reportData,
  });
});

/**
 * @desc Save report to database
 * @route POST /api/reports/save
 */
export const saveReport = asyncHandler(async (req, res) => {
  const { reportType, reportName, dateRange, reportData, summary, filters } =
    req.body;
  const userId = req.user._id;

  // Validate required fields
  if (!reportType || !reportName || !reportData) {
    return res.status(400).json({
      success: false,
      message: 'reportType, reportName, and reportData are required',
    });
  }

  const report = new Report({
    reportType,
    reportName,
    generatedBy: userId,
    dateRange: dateRange || {
      startDate: new Date(),
      endDate: new Date(),
    },
    reportData,
    summary: summary || {},
    filters: filters || {},
  });

  await report.save();
  await report.populate('generatedBy', 'fullName email');

  res.status(201).json({
    success: true,
    message: 'Report saved successfully',
    data: report,
  });
});

/**
 * @desc Get all saved reports
 * @route GET /api/reports
 * @query reportType, page, limit
 */
export const getAllReports = asyncHandler(async (req, res) => {
  const { reportType, page = 1, limit = 10 } = req.query;
  const query = {};

  if (reportType) {
    query.reportType = reportType;
  }

  const skip = (page - 1) * limit;
  const reports = await Report.find(query)
    .populate('generatedBy', 'fullName email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Report.countDocuments(query);

  res.status(200).json({
    success: true,
    message: 'Reports retrieved successfully',
    data: reports,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit),
    },
  });
});

/**
 * @desc Get report by ID
 * @route GET /api/reports/:reportId
 */
export const getReportById = asyncHandler(async (req, res) => {
  const { reportId } = req.params;

  const report = await Report.findById(reportId).populate(
    'generatedBy',
    'fullName email'
  );

  if (!report) {
    return res
      .status(404)
      .json({ success: false, message: 'Report not found' });
  }

  res.status(200).json({
    success: true,
    message: 'Report retrieved successfully',
    data: report,
  });
});

/**
 * @desc Delete report
 * @route DELETE /api/reports/:reportId
 */
export const deleteReport = asyncHandler(async (req, res) => {
  const { reportId } = req.params;

  const report = await Report.findByIdAndDelete(reportId);

  if (!report) {
    return res
      .status(404)
      .json({ success: false, message: 'Report not found' });
  }

  res.status(200).json({
    success: true,
    message: 'Report deleted successfully',
  });
});
