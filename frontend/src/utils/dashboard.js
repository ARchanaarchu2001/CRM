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

  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const [year, month, day] = String(value).split('-').map(Number);
    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString('en-US', {
      dateStyle: 'medium',
    });
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

export const isLastActivityStale = (value, staleAfterMinutes = 60) => {
  if (!value) {
    return true;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    return true;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return true;
  }

  return Date.now() - date.getTime() > staleAfterMinutes * 60 * 1000;
};

export const getFilterBadgeLabel = (filterInfo) => filterInfo?.displayLabel || 'Today';
