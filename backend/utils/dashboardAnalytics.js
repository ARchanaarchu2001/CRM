const PRODUCT_ORDER = ['p2p', 'mnp', 'fne', 'plus', 'general'];
const RESOLVED_STATUSES = new Set(['submitted', 'activated', 'completed']);

const toLocalStartOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);

const toLocalEndOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateInput = (value) => {
  if (!value) return null;

  const asString = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(asString)) {
    const [year, month, day] = asString.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }

  const parsed = new Date(asString);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const createTrendBucket = (date) => ({
  date: formatDateKey(date),
  label: date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  }),
  dials: 0,
  connectCallCount: 0,
  reachableCount: 0,
  submissions: 0,
  activations: 0,
});

export const getTodayDateString = () => formatDateKey(new Date());

export const resolveDateRange = ({ range = 'today', from, to }) => {
  const now = new Date();
  const today = toLocalStartOfDay(now);
  let normalizedRange = String(range || 'today').toLowerCase();
  let startDate = today;
  let endDate = today;

  if (normalizedRange === 'yesterday') {
    startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 1);
    endDate = new Date(startDate);
  } else if (normalizedRange === 'week') {
    const dayOfWeek = today.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDate = new Date(today);
    startDate.setDate(startDate.getDate() - diffToMonday);
    endDate = today;
  } else if (normalizedRange === 'month') {
    startDate = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
    endDate = today;
  } else if (normalizedRange === 'year') {
    startDate = new Date(today.getFullYear(), 0, 1, 0, 0, 0, 0);
    endDate = today;
  } else if (normalizedRange === 'last_year') {
    startDate = new Date(today.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
    endDate = new Date(today.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
  } else if (normalizedRange === 'custom') {
    const parsedFrom = parseDateInput(from);
    const parsedTo = parseDateInput(to);

    if (!parsedFrom || !parsedTo) {
      throw new Error('Custom range requires valid from and to dates');
    }

    startDate = toLocalStartOfDay(parsedFrom);
    endDate = toLocalStartOfDay(parsedTo);

    if (startDate > endDate) {
      throw new Error('The from date must be earlier than or equal to the to date');
    }
  } else {
    normalizedRange = 'today';
  }

  return {
    range: normalizedRange,
    from: formatDateKey(startDate),
    to: formatDateKey(endDate),
    fromDate: startDate,
    toDate: toLocalEndOfDay(endDate),
    displayLabel:
      normalizedRange === 'today'
        ? 'Today'
        : normalizedRange === 'yesterday'
          ? 'Yesterday'
          : normalizedRange === 'week'
            ? 'This Week'
            : normalizedRange === 'month'
              ? 'This Month'
              : normalizedRange === 'year'
                ? 'This Year'
                : normalizedRange === 'last_year'
                  ? 'Last Year'
                  : `${formatDateKey(startDate)} to ${formatDateKey(endDate)}`,
  };
};

export const getDynamicKpiTitles = (rangeInfo) => {
  const prefix =
    rangeInfo.range === 'today'
      ? "Today's"
      : rangeInfo.range === 'yesterday'
        ? "Yesterday's"
        : rangeInfo.range === 'week'
          ? 'Weekly'
          : rangeInfo.range === 'month'
            ? 'Monthly'
            : 'Date Range';

  return {
    dials: `${prefix} Dials`,
    connectCallCount: `${prefix} Connect Calls`,
    reachableCount: `${prefix} Reachable`,
    submissions: `${prefix} Submissions`,
    activations: `${prefix} Activations`,
    pipelineCount: 'Active Pipeline Count',
    overduePipelineCount: 'Overdue Pipeline',
    pendingLeads: `${prefix} Pending Leads`,
  };
};

const buildProductMetricTemplate = () =>
  PRODUCT_ORDER.map((product) => ({
    product,
    label: product.toUpperCase(),
    dials: 0,
    submissions: 0,
    activations: 0,
  }));

const buildTrendSeries = (rangeInfo) => {
  const series = [];
  const pointer = new Date(rangeInfo.fromDate);
  const diffDays = Math.ceil((rangeInfo.toDate - rangeInfo.fromDate) / (1000 * 60 * 60 * 24));

  // Determine interval based on range length
  let interval = 'day';
  if (diffDays > 366) interval = 'month';
  else if (diffDays > 62) interval = 'week';

  while (pointer <= rangeInfo.toDate) {
    const bucket = createTrendBucket(pointer);
    
    if (interval === 'month') {
      bucket.date = `${pointer.getUTCFullYear()}-${String(pointer.getUTCMonth() + 1).padStart(2, '0')}`;
      bucket.label = pointer.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } else if (interval === 'week') {
      // Find Monday as the week key
      const temp = new Date(pointer);
      const day = temp.getDay();
      const diff = day === 0 ? 6 : day - 1;
      temp.setDate(temp.getDate() - diff);
      bucket.date = formatDateKey(temp);
      bucket.label = `Week of ${temp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }

    series.push(bucket);

    if (interval === 'month') {
      pointer.setMonth(pointer.getMonth() + 1);
      pointer.setDate(1);
    } else if (interval === 'week') {
      pointer.setDate(pointer.getDate() + 7);
    } else {
      pointer.setDate(pointer.getDate() + 1);
    }
  }

  return series;
};

const isDateWithinRange = (dateValue, rangeInfo) => {
  const parsed = parseDateInput(dateValue);
  if (!parsed) return false;
  return parsed >= rangeInfo.fromDate && parsed <= rangeInfo.toDate;
};

const getDateKeyWithinRange = (dateValue, rangeInfo) => {
  const parsed = parseDateInput(dateValue);
  if (!parsed) return null;
  if (parsed < rangeInfo.fromDate || parsed > rangeInfo.toDate) return null;

  const diffDays = Math.ceil((rangeInfo.toDate - rangeInfo.fromDate) / (1000 * 60 * 60 * 24));
  if (diffDays > 366) {
    // Return month key
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
  } 
  if (diffDays > 62) {
    // Return week key (Monday)
    const temp = new Date(parsed);
    const day = temp.getDay();
    const diff = day === 0 ? 6 : day - 1;
    temp.setDate(temp.getDate() - diff);
    return formatDateKey(temp);
  }

  return formatDateKey(parsed);
};

const getWorkedDateHits = (assignment, rangeInfo) =>
  (assignment.workedDates || []).filter((dateValue) => {
    const parsed = parseDateInput(dateValue);
    return parsed && parsed >= rangeInfo.fromDate && parsed <= rangeInfo.toDate;
  });

const hasMeaningfulInteraction = (assignment) =>
  Boolean(
    assignment.contactabilityStatus ||
      assignment.callingRemark ||
      assignment.interestedRemark ||
      assignment.notInterestedRemark ||
      assignment.agentNotes ||
      assignment.callAttempt1Date ||
      assignment.callAttempt2Date ||
      assignment.status
  );

const getDialDateHits = (assignment, rangeInfo) => {
  const workedDateHits = getWorkedDateHits(assignment, rangeInfo);
  if (workedDateHits.length > 0) {
    return workedDateHits;
  }

  if (!hasMeaningfulInteraction(assignment)) {
    return [];
  }

  const updatedDateKey = getDateKeyWithinRange(assignment.updatedAt, rangeInfo);
  return updatedDateKey ? [updatedDateKey] : [];
};

const isAssignedInRange = (assignment, rangeInfo) => isDateWithinRange(assignment.createdAt, rangeInfo);

const isPipelineActiveAssignment = (assignment) =>
  assignment.inPipeline === true && !RESOLVED_STATUSES.has(String(assignment.status || '').toLowerCase());

const isPipelineAssignmentInRange = (assignment, rangeInfo) => {
  if (!isPipelineActiveAssignment(assignment)) {
    return false;
  }

  if (assignment.pipelineFollowUpDate) {
    return isDateWithinRange(assignment.pipelineFollowUpDate, rangeInfo);
  }

  return isDateWithinRange(assignment.updatedAt, rangeInfo);
};

const isOverduePipelineAssignment = (assignment, rangeInfo) => {
  if (!isPipelineActiveAssignment(assignment) || !assignment.pipelineFollowUpDate) {
    return false;
  }

  return assignment.pipelineFollowUpDate < getTodayDateString();
};

const getSubmissionDate = (assignment) => {
  if (String(assignment.status || '').toLowerCase() !== 'submitted') {
    return null;
  }

  return assignment.submittedAt || assignment.updatedAt || null;
};

const getActivationDate = (assignment) => {
  if (String(assignment.status || '').toLowerCase() !== 'activated') {
    return null;
  }

  return assignment.activatedAt || assignment.updatedAt || null;
};

const buildAgentBase = (agent) => ({
  agentId: String(agent._id),
  agentName: agent.fullName,
  email: agent.email,
  role: agent.role || 'agent',
  profilePhoto: agent.profilePhoto || null,
  isActive: agent.isActive !== false,
  isOnline: false,
  assignedTeam: agent.assignedTeam || agent.team?.name || '',
  teamName: agent.assignedTeam || agent.team?.name || 'Unassigned Team',
  teamId: agent.team?._id ? String(agent.team._id) : '',
  teamLeadId: agent.teamLead?._id ? String(agent.teamLead._id) : agent.team?.lead?._id ? String(agent.team.lead._id) : '',
  teamLeadName: agent.teamLead?.fullName || agent.team?.lead?.fullName || 'Unassigned Team',
  totalAssignedLeads: 0,
  dials: 0,
  connectCallCount: 0,
  reachableCount: 0,
  submissions: 0,
  activations: 0,
  pipelineCount: 0,
  overduePipelineCount: 0,
  pendingLeads: 0,
  lastActivity: null,
});

const updateLastActivity = (metricRow, dateValue) => {
  if (!dateValue) return;
  const parsed = parseDateInput(dateValue);
  if (!parsed) return;

  if (!metricRow.lastActivity || parsed > new Date(metricRow.lastActivity)) {
    metricRow.lastActivity =
      typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
        ? dateValue
        : parsed.toISOString();
  }
};

const getProductBucket = (collection, product) => {
  const normalizedProduct = PRODUCT_ORDER.includes(product) ? product : 'general';
  return collection.find((item) => item.product === normalizedProduct);
};

const sortAgentsByMetric = (rows, primaryMetric) =>
  [...rows].sort((left, right) => {
    if ((right[primaryMetric] || 0) !== (left[primaryMetric] || 0)) {
      return (right[primaryMetric] || 0) - (left[primaryMetric] || 0);
    }
    if ((right.activations || 0) !== (left.activations || 0)) {
      return (right.activations || 0) - (left.activations || 0);
    }
    if ((right.submissions || 0) !== (left.submissions || 0)) {
      return (right.submissions || 0) - (left.submissions || 0);
    }
    return (right.dials || 0) - (left.dials || 0);
  });

export const buildDashboardAnalytics = ({ agents, assignments, rangeInfo, includeTeamComparison = false, onlineUserIds = new Set() }) => {
  const kpiTitles = getDynamicKpiTitles(rangeInfo);
  const summary = {
    dials: 0,
    connectCallCount: 0,
    reachableCount: 0,
    submissions: 0,
    activations: 0,
    pipelineCount: 0,
    overduePipelineCount: 0,
    pendingLeads: 0,
  };

  const agentMap = new Map(
    agents.map((agent) => {
      const metricRow = buildAgentBase(agent);
      metricRow.isOnline = onlineUserIds.has(String(agent._id));
      return [String(agent._id), metricRow];
    })
  );
  const trend = buildTrendSeries(rangeInfo);
  const trendMap = new Map(trend.map((bucket) => [bucket.date, bucket]));
  const productPerformance = buildProductMetricTemplate();
  const perAgentProductPerformance = new Map(
    agents.map((agent) => [String(agent._id), buildProductMetricTemplate()])
  );
  const teamComparison = new Map();

  for (const assignment of assignments) {
    const agentId = String(assignment.agent?._id || assignment.agent);
    const agentMetrics = agentMap.get(agentId);
    if (!agentMetrics) continue;

    const productKey = String(assignment.product || 'general').toLowerCase();
    const globalProductBucket = getProductBucket(productPerformance, productKey);
    const agentProductBucket = getProductBucket(perAgentProductPerformance.get(agentId), productKey);

    const workedDateHits = getDialDateHits(assignment, rangeInfo);
    const assignedInRange = isAssignedInRange(assignment, rangeInfo);
    const dialedInRange = workedDateHits.length > 0;

    if (assignedInRange) {
      agentMetrics.totalAssignedLeads += 1;
    }

    for (const workedDate of workedDateHits) {
      const dayKey = formatDateKey(parseDateInput(workedDate));
      const dayBucket = trendMap.get(dayKey);
      if (dayBucket) {
        dayBucket.dials += 1;
      }

      updateLastActivity(agentMetrics, assignment.updatedAt || workedDate);
    }

    if (dialedInRange) {
      summary.dials += 1;
      agentMetrics.dials += 1;
      if (globalProductBucket) globalProductBucket.dials += 1;
      if (agentProductBucket) agentProductBucket.dials += 1;
    }

    // Count connect calls (assignments with call attempt dates within range)
    const hasCallAttempt1 = assignment.callAttempt1Date && isDateWithinRange(assignment.callAttempt1Date, rangeInfo);
    const hasCallAttempt2 = assignment.callAttempt2Date && isDateWithinRange(assignment.callAttempt2Date, rangeInfo);
    const hasConnectCall = hasCallAttempt1 || hasCallAttempt2;
    
    if (hasConnectCall) {
      summary.connectCallCount += 1;
      agentMetrics.connectCallCount += 1;

      const connectDateKey = getDateKeyWithinRange(
        hasCallAttempt1 ? assignment.callAttempt1Date : assignment.callAttempt2Date,
        rangeInfo
      );
      const dayBucket = trendMap.get(connectDateKey);
      if (dayBucket) {
        dayBucket.connectCallCount += 1;
      }
    }

    // Count reachable leads (contactabilityStatus = 'Reachable' within range)
    const isReachable = assignment.contactabilityStatus === 'Reachable';
    const reachableInRange = isReachable && (
      assignment.updatedAt && isDateWithinRange(assignment.updatedAt, rangeInfo)
    );
    
    if (reachableInRange) {
      summary.reachableCount += 1;
      agentMetrics.reachableCount += 1;

      const reachableDateKey = getDateKeyWithinRange(assignment.updatedAt, rangeInfo);
      const dayBucket = trendMap.get(reachableDateKey);
      if (dayBucket) {
        dayBucket.reachableCount += 1;
      }
    }

    const submissionDate = getSubmissionDate(assignment);
    const submissionDateKey = getDateKeyWithinRange(submissionDate, rangeInfo);
    if (submissionDateKey) {
      summary.submissions += 1;
      agentMetrics.submissions += 1;
      if (globalProductBucket) globalProductBucket.submissions += 1;
      if (agentProductBucket) agentProductBucket.submissions += 1;

      const dayBucket = trendMap.get(submissionDateKey);
      if (dayBucket) {
        dayBucket.submissions += 1;
      }

      updateLastActivity(agentMetrics, submissionDate);
    }

    const activationDate = getActivationDate(assignment);
    const activationDateKey = getDateKeyWithinRange(activationDate, rangeInfo);
    if (activationDateKey) {
      summary.activations += 1;
      agentMetrics.activations += 1;
      if (globalProductBucket) globalProductBucket.activations += 1;
      if (agentProductBucket) agentProductBucket.activations += 1;

      const dayBucket = trendMap.get(activationDateKey);
      if (dayBucket) {
        dayBucket.activations += 1;
      }

      updateLastActivity(agentMetrics, activationDate);
    }

    if (isPipelineActiveAssignment(assignment)) {
      summary.pipelineCount += 1;
      agentMetrics.pipelineCount += 1;
      updateLastActivity(agentMetrics, assignment.updatedAt || assignment.pipelineFollowUpDate);
    }

    if (isOverduePipelineAssignment(assignment, rangeInfo)) {
      summary.overduePipelineCount += 1;
      agentMetrics.overduePipelineCount += 1;
      updateLastActivity(agentMetrics, assignment.updatedAt || assignment.pipelineFollowUpDate);
    }

  }

  for (const agentMetrics of agentMap.values()) {
    agentMetrics.pendingLeads = Math.max((agentMetrics.totalAssignedLeads || 0) - (agentMetrics.dials || 0), 0);
    summary.pendingLeads += agentMetrics.pendingLeads;
  }

  if (includeTeamComparison) {
    for (const agentMetrics of agentMap.values()) {
      const teamKey = agentMetrics.teamId || agentMetrics.teamLeadId || agentMetrics.assignedTeam || agentMetrics.teamLeadName;
      if (!teamComparison.has(teamKey)) {
        teamComparison.set(teamKey, {
          team: agentMetrics.teamName,
          dials: 0,
          submissions: 0,
          activations: 0,
          pipelineCount: 0,
          overduePipelineCount: 0,
          pendingLeads: 0,
        });
      }

      const teamRow = teamComparison.get(teamKey);
      teamRow.dials += agentMetrics.dials;
      teamRow.submissions += agentMetrics.submissions;
      teamRow.activations += agentMetrics.activations;
      teamRow.pipelineCount += agentMetrics.pipelineCount;
      teamRow.overduePipelineCount += agentMetrics.overduePipelineCount;
      teamRow.pendingLeads += agentMetrics.pendingLeads;
    }
  }

  const agentTable = Array.from(agentMap.values()).sort((left, right) => {
    if (right.activations !== left.activations) return right.activations - left.activations;
    if (right.submissions !== left.submissions) return right.submissions - left.submissions;
    return right.dials - left.dials;
  });

  const teamComparisonRows = includeTeamComparison
    ? Array.from(teamComparison.values()).sort((left, right) => {
        if (right.activations !== left.activations) return right.activations - left.activations;
        if (right.submissions !== left.submissions) return right.submissions - left.submissions;
        if (right.dials !== left.dials) return right.dials - left.dials;
        return right.pendingLeads - left.pendingLeads;
      })
    : [];

  const agentDials = sortAgentsByMetric(agentTable, 'dials').map((agent) => ({
    agentId: agent.agentId,
    agentName: agent.agentName,
    profilePhoto: agent.profilePhoto,
    teamName: agent.teamName,
    dials: agent.dials,
  }));

  const agentSubmissions = sortAgentsByMetric(agentTable, 'submissions').map((agent) => ({
    agentId: agent.agentId,
    agentName: agent.agentName,
    profilePhoto: agent.profilePhoto,
    teamName: agent.teamName,
    submissions: agent.submissions,
    activations: agent.activations,
    dials: agent.dials,
  }));

  const kpis = [
    { key: 'dials', title: kpiTitles.dials, value: summary.dials },
    { key: 'connectCallCount', title: kpiTitles.connectCallCount, value: summary.connectCallCount },
    { key: 'reachableCount', title: kpiTitles.reachableCount, value: summary.reachableCount },
    { key: 'submissions', title: kpiTitles.submissions, value: summary.submissions },
    { key: 'activations', title: kpiTitles.activations, value: summary.activations },
    { key: 'pipelineCount', title: kpiTitles.pipelineCount, value: summary.pipelineCount },
    { key: 'overduePipelineCount', title: kpiTitles.overduePipelineCount, value: summary.overduePipelineCount },
    { key: 'pendingLeads', title: kpiTitles.pendingLeads, value: summary.pendingLeads },
  ];

  return {
    filter: {
      ...rangeInfo,
    },
    onlineAgentCount: agentTable.filter((agent) => agent.isOnline).length,
    kpiTitles,
    kpis,
    summary,
    agentTable,
    charts: {
      trend,
      productPerformance,
      agentDials,
      agentSubmissions,
      teamComparison: teamComparisonRows,
    },
    agentProductPerformance: Object.fromEntries(
      Array.from(perAgentProductPerformance.entries()).map(([agentId, rows]) => [agentId, rows])
    ),
  };
};

export const buildAgentDetailAnalytics = ({ agent, assignments, rangeInfo }) => {
  const analytics = buildDashboardAnalytics({
    agents: [agent],
    assignments,
    rangeInfo,
    includeTeamComparison: false,
  });

  const agentRow = analytics.agentTable[0] || buildAgentBase(agent);

  return {
    filter: analytics.filter,
    kpiTitles: analytics.kpiTitles,
    agent: {
      ...agentRow,
      profilePhoto: agent.profilePhoto || null,
    },
    kpis: analytics.kpis,
    summary: analytics.summary,
    trend: analytics.charts.trend,
    productPerformance: analytics.agentProductPerformance[String(agent._id)] || buildProductMetricTemplate(),
  };
};
