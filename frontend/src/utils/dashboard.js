export const DASHBOARD_RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'custom', label: 'Custom Date Range' },
];

const formatDateInputValue = (date) => date.toISOString().slice(0, 10);

export const getDefaultDashboardFilter = () => {
  const today = new Date();
  const todayValue = formatDateInputValue(today);

  return {
    range: 'today',
    from: todayValue,
    to: todayValue,
  };
};

export const buildDashboardParams = (filter) => {
  const params = { range: filter.range };

  if (filter.range === 'custom') {
    params.from = filter.from;
    params.to = filter.to;
  }

  return params;
};

export const formatMetricValue = (value) => {
  const numericValue = Number(value || 0);
  return new Intl.NumberFormat('en-US').format(numericValue);
};

export const formatLastActivity = (value) => {
  if (!value) {
    return 'No activity yet';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'No activity yet';
  }

  return date.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

export const getFilterBadgeLabel = (filterInfo) => filterInfo?.displayLabel || 'Today';
