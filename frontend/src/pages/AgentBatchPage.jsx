import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchManagedAgentBatchView,
  fetchMyAssignmentBatches,
  fetchMyAssignments,
  hideAssignmentBatch,
  updateAssignment,
} from '../api/leads.js';
import { formatContactDisplay } from '../utils/contactNumber.js';
import { connectSocket, socket } from '../utils/socketClient.js';

const AUTOSAVE_DELAY_MS = 700;
const DEFAULT_REMARK_CONFIG = {
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
const PAGE_SIZE = 100;

const splitAttemptValue = (value) => {
  const normalizedValue = String(value || '').trim();
  const match = normalizedValue.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?$/);

  if (!match) {
    return {
      date: '',
      time: '',
    };
  }

  return {
    date: match[1] || '',
    time: match[2] || '',
  };
};

const buildAttemptValue = (dateValue, timeValue) => {
  const date = String(dateValue || '').trim();
  const time = String(timeValue || '').trim();

  if (!date) {
    return '';
  }

  return time ? `${date} ${time}` : date;
};

const findDefaultNameColumn = (headers = []) =>
  headers.find((header) => /^(name|customer name|lead name|full name)$/i.test(header)) ||
  headers.find((header) => /name/i.test(header)) ||
  '';

const normalizeSortValue = (value) => String(value || '').toLowerCase();
const HEADER_ROW_STICKY_CLASS = 'sticky top-0 z-20 bg-slate-100';
const FILTER_ROW_STICKY_CLASS = 'sticky top-[36px] z-20 bg-white';
const STICKY_HEADER_CLASS =
  'sticky left-0 z-50 border-r border-black bg-slate-100 px-2 py-2 text-left text-[12px] font-semibold text-slate-700 shadow-[8px_0_12px_-10px_rgba(15,23,42,0.38)]';
const STICKY_FILTER_CLASS =
  'sticky left-0 z-40 h-9 border-r border-black bg-white px-2 py-1 align-middle shadow-[8px_0_12px_-10px_rgba(15,23,42,0.3)]';
const STICKY_CELL_CLASS =
  'sticky left-0 z-30 border-r border-black bg-white shadow-[8px_0_12px_-10px_rgba(15,23,42,0.34)]';
const DEFAULT_FIXED_COLUMN_KEYS = ['contact'];
const DEFAULT_COLUMN_COLORS = {
  callingRemark: 'amber',
  interestedRemark: 'emerald',
  notInterestedRemark: 'rose',
};
const COLOR_OPTIONS = [
  { key: 'slate', label: 'Slate', header: 'bg-slate-100 text-slate-700', filter: 'bg-slate-50', cell: 'bg-slate-50/80' },
  { key: 'amber', label: 'Amber', header: 'bg-amber-100 text-amber-900', filter: 'bg-amber-50', cell: 'bg-amber-50/85' },
  { key: 'emerald', label: 'Green', header: 'bg-emerald-100 text-emerald-900', filter: 'bg-emerald-50', cell: 'bg-emerald-50/85' },
  { key: 'sky', label: 'Blue', header: 'bg-sky-100 text-sky-900', filter: 'bg-sky-50', cell: 'bg-sky-50/85' },
  { key: 'rose', label: 'Rose', header: 'bg-rose-100 text-rose-900', filter: 'bg-rose-50', cell: 'bg-rose-50/85' },
];
const MIN_COLUMN_WIDTH = 28;
const DEFAULT_COLUMN_WIDTHS = {
  contact: 220,
  product: 120,
  contactabilityStatus: 180,
  callAttempt1Date: 220,
  callAttempt2Date: 220,
  callingRemark: 180,
  interestedRemark: 180,
  notInterestedRemark: 190,
  agentNotes: 200,
  status: 130,
  pipeline: 215,
  saveState: 120,
};

const getRemarkValueClasses = (columnKey, value) => {
  const normalizedValue = String(value || '').trim().toLowerCase();

  if (!normalizedValue) {
    return 'bg-white text-slate-700';
  }

  if (columnKey === 'callingRemark') {
    if (normalizedValue === 'interested') return 'bg-emerald-500 text-white border-emerald-600';
    if (normalizedValue === 'not interested' || normalizedValue === 'dncr') return 'bg-rose-500 text-white border-rose-600';
    if (normalizedValue === 'follow up') return 'bg-amber-300 text-amber-950 border-amber-400';
    if (normalizedValue === 'call back') return 'bg-sky-400 text-sky-950 border-sky-500';
    if (normalizedValue === 'order submitted' || normalizedValue === 'activated') return 'bg-violet-400 text-violet-950 border-violet-500';
    return 'bg-slate-100 text-slate-800 border-slate-300';
  }

  if (columnKey === 'interestedRemark') {
    return 'bg-emerald-100 text-emerald-950 border-emerald-200';
  }

  if (columnKey === 'notInterestedRemark') {
    return 'bg-rose-100 text-rose-950 border-rose-200';
  }

  return 'bg-white text-slate-700';
};

const getRemarkRowBackground = (assignment) => {
  const callingRemark = String(assignment.callingRemark || '').trim().toLowerCase();

  if (callingRemark === 'interested') {
    return 'bg-emerald-200';
  }

  if (callingRemark === 'not interested' || callingRemark === 'dncr') {
    return 'bg-rose-200';
  }

  if (callingRemark === 'call back') {
    return 'bg-sky-200';
  }

  if (callingRemark === 'follow up') {
    return 'bg-amber-200';
  }

  if (callingRemark === 'order submitted' || callingRemark === 'activated') {
    return 'bg-violet-200';
  }

  if (assignment.interestedRemark) {
    return 'bg-emerald-200';
  }

  if (assignment.notInterestedRemark) {
    return 'bg-rose-200';
  }

  return '';
};

const AgentBatchPage = () => {
  const { batchId, agentId } = useParams();
  const isManagedView = Boolean(agentId);
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [message, setMessage] = useState('');
  const [saveState, setSaveState] = useState({});
  const [copiedRowId, setCopiedRowId] = useState('');
  const [pipelineDraft, setPipelineDraft] = useState(null);
  const [columnFilters, setColumnFilters] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: 'updatedAt', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [fixedColumnKeys, setFixedColumnKeys] = useState(DEFAULT_FIXED_COLUMN_KEYS);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);
  const [persistedHeaders, setPersistedHeaders] = useState([]);
  const [persistedContactHeader, setPersistedContactHeader] = useState('Contact');
  const [persistedRemarkConfig, setPersistedRemarkConfig] = useState(DEFAULT_REMARK_CONFIG);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isFixedColumnEditMode, setIsFixedColumnEditMode] = useState(false);
  const [columnColors, setColumnColors] = useState(DEFAULT_COLUMN_COLORS);
  const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS);
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState([]);
  const [canUndoLayout, setCanUndoLayout] = useState(false);
  const [headerTooltip, setHeaderTooltip] = useState(null);
  const tableContainerRef = useRef(null);
  const bottomScrollbarRef = useRef(null);
  const tableElementRef = useRef(null);
  const isSyncingScrollRef = useRef(false);
  const resizeStateRef = useRef(null);
  const timersRef = useRef(new Map());
  const skipNextColumnWidthSaveRef = useRef(false);
  const layoutHistoryRef = useRef([]);
  const editSessionSnapshotRef = useRef(null);
  const serializedColumnFilters = JSON.stringify(columnFilters);
  const fixedColumnStorageKey = useMemo(
    () => `agent-batch-fixed-columns:${isManagedView ? agentId || 'managed' : 'self'}:${batchId || 'default'}`,
    [agentId, batchId, isManagedView]
  );
  const columnColorStorageKey = useMemo(
    () => `agent-batch-column-colors:${isManagedView ? agentId || 'managed' : 'self'}:${batchId || 'default'}`,
    [agentId, batchId, isManagedView]
  );
  const columnWidthStorageKey = useMemo(
    () => `agent-batch-column-widths:${isManagedView ? agentId || 'managed' : 'self'}:${batchId || 'default'}`,
    [agentId, batchId, isManagedView]
  );
  const hiddenColumnStorageKey = useMemo(
    () => `agent-batch-hidden-columns:${isManagedView ? agentId || 'managed' : 'self'}:${batchId || 'default'}`,
    [agentId, batchId, isManagedView]
  );

  const loadBatches = async () => {
    if (isManagedView) {
      return;
    }

    const data = await fetchMyAssignmentBatches();
    setBatches(data.batches || []);
  };

  const loadAssignments = async () => {
    if (!batchId) {
      setAssignments([]);
      setTotalCount(0);
      setCurrentPage(1);
      setTotalPages(1);
      return;
    }

    if (isManagedView) {
      const data = await fetchManagedAgentBatchView(agentId, batchId);
      setBatches(data.view?.batch ? [data.view.batch] : []);
      setAssignments(data.view?.assignments || []);
      setTotalCount((data.view?.assignments || []).length);
      setCurrentPage(1);
      setTotalPages(1);
      return;
    }

    const requestParams = {
      importBatchId: batchId,
      page: currentPage,
      pageSize: PAGE_SIZE,
    };

    if (columnFilters.contact) requestParams.contact = columnFilters.contact;
    if (columnFilters.product) requestParams.product = columnFilters.product;
    if (columnFilters.contactabilityStatus) requestParams.contactabilityStatus = columnFilters.contactabilityStatus;
    if (columnFilters.callingRemark) requestParams.callingRemark = columnFilters.callingRemark;
    if (columnFilters.interestedRemark) requestParams.interestedRemark = columnFilters.interestedRemark;
    if (columnFilters.notInterestedRemark) requestParams.notInterestedRemark = columnFilters.notInterestedRemark;
    if (columnFilters.status) requestParams.status = columnFilters.status;

    const rawFilters = Object.fromEntries(
      Object.entries(columnFilters)
        .filter(([key, value]) => key.startsWith('raw:') && String(value || '').trim())
        .map(([key, value]) => [key.replace('raw:', ''), value])
    );

    if (Object.keys(rawFilters).length) {
      requestParams.rawFilters = JSON.stringify(rawFilters);
    }

    const data = await fetchMyAssignments(requestParams);
    setAssignments(data.assignments || []);
    setTotalCount(data.totalCount || 0);
    setCurrentPage(data.page || 1);
    setTotalPages(data.totalPages || 1);
  };

  useEffect(() => {
    loadBatches();
  }, [batchId, agentId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [batchId, agentId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [serializedColumnFilters]);

  useEffect(() => {
    loadAssignments();
  }, [batchId, agentId, currentPage, serializedColumnFilters]);

  useEffect(() => {
    connectSocket();

    const handleAssignmentUpdated = (payload) => {
      if (String(payload?.batchId || '') !== String(batchId || '')) {
        return;
      }

      if (isManagedView && String(payload?.agentId || '') !== String(agentId || '')) {
        return;
      }

      loadAssignments();
    };

    socket.on('assignmentUpdated', handleAssignmentUpdated);

    return () => {
      socket.off('assignmentUpdated', handleAssignmentUpdated);
    };
  }, [batchId, agentId, isManagedView]);

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  const selectedBatch = batches.find((batch) => String(batch.importBatchId) === String(batchId));
  const activeRemarkConfig = assignments[0]?.remarkConfig || persistedRemarkConfig || DEFAULT_REMARK_CONFIG;

  const readOnlyHeaders = useMemo(() => {
    const keys = new Set();
    assignments.forEach((assignment) => {
      Object.keys(assignment.lead?.rawData || {}).forEach((key) => keys.add(key));
    });
    return Array.from(keys);
  }, [assignments]);

  useEffect(() => {
    if (readOnlyHeaders.length) {
      setPersistedHeaders(readOnlyHeaders);
    }
  }, [readOnlyHeaders]);

  useEffect(() => {
    const nextContactHeader = assignments[0]?.lead?.contactColumn;
    if (nextContactHeader) {
      setPersistedContactHeader(nextContactHeader);
    }
  }, [assignments]);

  useEffect(() => {
    const nextRemarkConfig = assignments[0]?.remarkConfig;
    if (nextRemarkConfig) {
      setPersistedRemarkConfig(nextRemarkConfig);
    }
  }, [assignments]);

  const activeHeaders = readOnlyHeaders.length ? readOnlyHeaders : persistedHeaders;
  const contactHeader = assignments[0]?.lead?.contactColumn || persistedContactHeader;
  const visibleReadOnlyHeaders = activeHeaders.filter((header) => header !== contactHeader);
  const fixedColumnOptions = useMemo(
    () => [
      { key: 'contact', label: contactHeader },
      { key: 'product', label: 'Product' },
      ...visibleReadOnlyHeaders.map((header) => ({
        key: `raw:${header}`,
        label: header,
      })),
      { key: 'contactabilityStatus', label: 'Contactability Status' },
      { key: 'callAttempt1Date', label: activeRemarkConfig.callAttempt1Label },
      { key: 'callAttempt2Date', label: activeRemarkConfig.callAttempt2Label },
      { key: 'callingRemark', label: activeRemarkConfig.callingRemarkLabel },
      { key: 'interestedRemark', label: activeRemarkConfig.interestedRemarkLabel },
      { key: 'notInterestedRemark', label: activeRemarkConfig.notInterestedRemarkLabel },
      { key: 'status', label: 'Status' },
    ],
    [
      activeRemarkConfig.callAttempt1Label,
      activeRemarkConfig.callAttempt2Label,
      activeRemarkConfig.callingRemarkLabel,
      activeRemarkConfig.interestedRemarkLabel,
      activeRemarkConfig.notInterestedRemarkLabel,
      contactHeader,
      visibleReadOnlyHeaders,
    ]
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedValue = window.localStorage.getItem(fixedColumnStorageKey);
    if (!storedValue) {
      setFixedColumnKeys(DEFAULT_FIXED_COLUMN_KEYS);
      return;
    }

    try {
      const parsed = JSON.parse(storedValue);
      setFixedColumnKeys(Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_FIXED_COLUMN_KEYS);
    } catch {
      setFixedColumnKeys(DEFAULT_FIXED_COLUMN_KEYS);
    }
  }, [fixedColumnStorageKey]);

  useEffect(() => {
    const availableKeys = new Set(fixedColumnOptions.map((option) => option.key));
    setFixedColumnKeys((current) => {
      const filtered = current.filter((key) => availableKeys.has(key));
      return filtered.length ? filtered : DEFAULT_FIXED_COLUMN_KEYS.filter((key) => availableKeys.has(key));
    });
  }, [fixedColumnOptions]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(fixedColumnStorageKey, JSON.stringify(fixedColumnKeys));
  }, [fixedColumnKeys, fixedColumnStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedValue = window.localStorage.getItem(columnColorStorageKey);
    if (!storedValue) {
      setColumnColors(DEFAULT_COLUMN_COLORS);
      return;
    }

    try {
      const parsed = JSON.parse(storedValue);
      setColumnColors({
        ...DEFAULT_COLUMN_COLORS,
        ...(parsed || {}),
      });
    } catch {
      setColumnColors(DEFAULT_COLUMN_COLORS);
    }
  }, [columnColorStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(columnColorStorageKey, JSON.stringify(columnColors));
  }, [columnColorStorageKey, columnColors]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    skipNextColumnWidthSaveRef.current = true;
    const storedValue = window.localStorage.getItem(columnWidthStorageKey);
    if (!storedValue) {
      setColumnWidths(DEFAULT_COLUMN_WIDTHS);
      return;
    }

    try {
      const parsed = JSON.parse(storedValue);
      setColumnWidths({
        ...DEFAULT_COLUMN_WIDTHS,
        ...(parsed || {}),
      });
    } catch {
      setColumnWidths(DEFAULT_COLUMN_WIDTHS);
    }
  }, [columnWidthStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (skipNextColumnWidthSaveRef.current) {
      skipNextColumnWidthSaveRef.current = false;
      return;
    }

    window.localStorage.setItem(columnWidthStorageKey, JSON.stringify(columnWidths));
  }, [columnWidthStorageKey, columnWidths]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedValue = window.localStorage.getItem(hiddenColumnStorageKey);
    if (!storedValue) {
      setHiddenColumnKeys([]);
      return;
    }

    try {
      const parsed = JSON.parse(storedValue);
      setHiddenColumnKeys(Array.isArray(parsed) ? parsed : []);
    } catch {
      setHiddenColumnKeys([]);
    }
  }, [hiddenColumnStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(hiddenColumnStorageKey, JSON.stringify(hiddenColumnKeys));
  }, [hiddenColumnKeys, hiddenColumnStorageKey]);

  const captureLayoutSnapshot = () => ({
    fixedColumnKeys: [...fixedColumnKeys],
    hiddenColumnKeys: [...hiddenColumnKeys],
    columnColors: { ...columnColors },
    columnWidths: { ...columnWidths },
  });

  const areLayoutSnapshotsEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);

  const applyLayoutSnapshot = (snapshot) => {
    if (!snapshot) {
      return;
    }

    setFixedColumnKeys(snapshot.fixedColumnKeys || DEFAULT_FIXED_COLUMN_KEYS);
    setHiddenColumnKeys(snapshot.hiddenColumnKeys || []);
    setColumnColors(snapshot.columnColors || DEFAULT_COLUMN_COLORS);
    setColumnWidths(snapshot.columnWidths || DEFAULT_COLUMN_WIDTHS);
  };

  const pushLayoutHistory = (snapshot = captureLayoutSnapshot()) => {
    const currentStack = layoutHistoryRef.current;
    const lastSnapshot = currentStack[currentStack.length - 1];

    if (lastSnapshot && areLayoutSnapshotsEqual(lastSnapshot, snapshot)) {
      return;
    }

    layoutHistoryRef.current = [...currentStack, snapshot];
    setCanUndoLayout(layoutHistoryRef.current.length > 0);
  };

  const undoLayoutChange = () => {
    if (!layoutHistoryRef.current.length) {
      return;
    }

    const nextStack = [...layoutHistoryRef.current];
    const previousSnapshot = nextStack.pop();
    layoutHistoryRef.current = nextStack;
    setCanUndoLayout(nextStack.length > 0);
    applyLayoutSnapshot(previousSnapshot);
  };

  const cancelEditTableSession = () => {
    if (editSessionSnapshotRef.current) {
      applyLayoutSnapshot(editSessionSnapshotRef.current);
      pushLayoutHistory(editSessionSnapshotRef.current);
    }
    setIsFixedColumnEditMode(false);
    editSessionSnapshotRef.current = null;
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      const isUndo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey;
      if (!isUndo) {
        return;
      }

      const target = event.target;
      const isFormTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;

      if (isFormTarget) {
        return;
      }

      if (!canUndoLayout) {
        return;
      }

      event.preventDefault();
      undoLayoutChange();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndoLayout]);
  const filteredAssignments = useMemo(() => {
    const matchesFilterValue = (sourceValue, filterValue) =>
      String(sourceValue || '').toLowerCase().includes(String(filterValue || '').trim().toLowerCase());

    const filteredEntries = isManagedView
      ? assignments.filter((assignment) => {
          const lead = assignment.lead || {};
          const rawData = lead.rawData || {};

          if (columnFilters.contact && !matchesFilterValue(rawData[contactHeader] || lead.contactNumber, columnFilters.contact)) {
            return false;
          }

          if (columnFilters.product && !matchesFilterValue(assignment.product, columnFilters.product)) {
            return false;
          }

          if (
            columnFilters.contactabilityStatus &&
            String(assignment.contactabilityStatus || '') !== String(columnFilters.contactabilityStatus || '')
          ) {
            return false;
          }

          if (
            columnFilters.callingRemark &&
            String(assignment.callingRemark || '') !== String(columnFilters.callingRemark || '')
          ) {
            return false;
          }

          if (
            columnFilters.interestedRemark &&
            String(assignment.interestedRemark || '') !== String(columnFilters.interestedRemark || '')
          ) {
            return false;
          }

          if (
            columnFilters.notInterestedRemark &&
            String(assignment.notInterestedRemark || '') !== String(columnFilters.notInterestedRemark || '')
          ) {
            return false;
          }

          if (columnFilters.status && String(assignment.status || '') !== String(columnFilters.status || '')) {
            return false;
          }

          for (const header of visibleReadOnlyHeaders) {
            const rawFilterKey = `raw:${header}`;
            if (columnFilters[rawFilterKey] && !matchesFilterValue(rawData[header], columnFilters[rawFilterKey])) {
              return false;
            }
          }

          return true;
        })
      : assignments;

    const sortedEntries = [...filteredEntries].sort((left, right) => {
      const leftLead = left.lead || {};
      const rightLead = right.lead || {};

      const readValue = (row, lead) => {
        if (sortConfig.key === 'contact') {
          return formatContactDisplay(lead.rawData?.[contactHeader] || lead.contactNumber);
        }
        if (sortConfig.key === 'product') return row.product;
        if (sortConfig.key === 'status') return row.status;
        if (sortConfig.key === 'contactabilityStatus') return row.contactabilityStatus;
        if (sortConfig.key === 'callAttempt1Date') return row.callAttempt1Date;
        if (sortConfig.key === 'callAttempt2Date') return row.callAttempt2Date;
        if (sortConfig.key === 'callingRemark') return row.callingRemark;
        if (sortConfig.key === 'interestedRemark') return row.interestedRemark;
        if (sortConfig.key === 'notInterestedRemark') return row.notInterestedRemark;
        if (sortConfig.key === 'updatedAt') return row.updatedAt;
        if (sortConfig.key.startsWith('raw:')) return lead.rawData?.[sortConfig.key.replace('raw:', '')] || '';
        return row[sortConfig.key] || '';
      };

      const leftValue = normalizeSortValue(readValue(left, leftLead));
      const rightValue = normalizeSortValue(readValue(right, rightLead));
      return sortConfig.direction === 'asc'
        ? leftValue.localeCompare(rightValue)
        : rightValue.localeCompare(leftValue);
    });

    return sortedEntries;
  }, [assignments, columnFilters, contactHeader, isManagedView, sortConfig, visibleReadOnlyHeaders]);
  const batchStats = useMemo(() => {
    const countMatches = (matcher) => filteredAssignments.filter(matcher).length;
    const isNotDialed = (assignment) =>
      !assignment.contactabilityStatus &&
      !assignment.callingRemark &&
      !assignment.interestedRemark &&
      !assignment.notInterestedRemark &&
      !assignment.callAttempt1Date &&
      !assignment.callAttempt2Date;

    return {
      total: filteredAssignments.length,
      pending: countMatches(isNotDialed),
      dialed: countMatches((assignment) => !isNotDialed(assignment)),
      followUp: countMatches((assignment) => assignment.callingRemark === 'Follow up'),
      callback: countMatches((assignment) => assignment.callingRemark === 'Call back'),
      interested: countMatches(
        (assignment) => assignment.callingRemark === 'Interested' || Boolean(assignment.interestedRemark)
      ),
    };
  }, [filteredAssignments]);

  useEffect(() => {
    const container = tableContainerRef.current;
    const bottomScrollbar = bottomScrollbarRef.current;
    const tableElement = tableElementRef.current;

    if (!container || !bottomScrollbar || !tableElement) {
      return undefined;
    }

    const updateScrollState = () => {
      setCanScrollLeft(container.scrollLeft > 0);
      setCanScrollRight(container.scrollLeft + container.clientWidth < container.scrollWidth - 1);
      setTableScrollWidth(tableElement.scrollWidth);
    };

    const syncFromTable = () => {
      if (isSyncingScrollRef.current) {
        return;
      }
      isSyncingScrollRef.current = true;
      bottomScrollbar.scrollLeft = container.scrollLeft;
      updateScrollState();
      window.requestAnimationFrame(() => {
        isSyncingScrollRef.current = false;
      });
    };

    const syncFromBottom = () => {
      if (isSyncingScrollRef.current) {
        return;
      }
      isSyncingScrollRef.current = true;
      container.scrollLeft = bottomScrollbar.scrollLeft;
      updateScrollState();
      window.requestAnimationFrame(() => {
        isSyncingScrollRef.current = false;
      });
    };

    updateScrollState();
    bottomScrollbar.scrollLeft = container.scrollLeft;
    container.addEventListener('scroll', syncFromTable);
    bottomScrollbar.addEventListener('scroll', syncFromBottom);
    window.addEventListener('resize', updateScrollState);

    return () => {
      container.removeEventListener('scroll', syncFromTable);
      bottomScrollbar.removeEventListener('scroll', syncFromBottom);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [filteredAssignments, isManagedView]);

  const updateColumnFilter = (key, value) => {
    setColumnFilters((current) => {
      const nextFilters = { ...current };
      const normalizedValue = String(value ?? '').trim();

      if (!normalizedValue) {
        delete nextFilters[key];
        return nextFilters;
      }

      nextFilters[key] = value;
      return nextFilters;
    });
  };

  const toggleSort = (key) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const queueAutosave = (assignment) => {
    if (isManagedView) {
      return;
    }

    const existingTimer = timersRef.current.get(assignment._id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    setSaveState((current) => ({
      ...current,
      [assignment._id]: 'saving',
    }));

    const timer = setTimeout(async () => {
      try {
        await updateAssignment(assignment._id, {
          status: assignment.status,
          contactabilityStatus: assignment.contactabilityStatus,
          callAttempt1Date: assignment.callAttempt1Date,
          callAttempt2Date: assignment.callAttempt2Date,
          callingRemark: assignment.callingRemark,
          interestedRemark: assignment.interestedRemark,
          notInterestedRemark: assignment.notInterestedRemark,
          agentNotes: assignment.agentNotes,
          inPipeline: assignment.inPipeline,
          pipelineFollowUpDate: assignment.pipelineFollowUpDate,
          pipelineNameColumn: assignment.pipelineNameColumn,
          pipelineContactColumn: assignment.pipelineContactColumn,
          pipelineDisplayName: assignment.pipelineDisplayName,
          pipelineDisplayContact: assignment.pipelineDisplayContact,
          pipelineNotes: assignment.pipelineNotes,
        });
        setSaveState((current) => ({
          ...current,
          [assignment._id]: 'saved',
        }));
      } catch (error) {
        setSaveState((current) => ({
          ...current,
          [assignment._id]: 'error',
        }));
        setMessage(error.response?.data?.message || 'Could not save one of the rows');
      }
    }, AUTOSAVE_DELAY_MS);

    timersRef.current.set(assignment._id, timer);
  };

  const handleFieldChange = (assignmentId, field, value) => {
    if (isManagedView) {
      return;
    }

    setAssignments((current) =>
      current.map((assignment) => {
        if (assignment._id !== assignmentId) {
          return assignment;
        }

        const nextAssignment = { ...assignment, [field]: value };
        queueAutosave(nextAssignment);
        return nextAssignment;
      })
    );
  };

  const handleHideBatch = async () => {
    if (isManagedView) {
      return;
    }

    if (!batchId) {
      return;
    }

    await hideAssignmentBatch(batchId);
    navigate('/agent-dash');
  };

  const handlePageChange = (nextPage) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === currentPage) {
      return;
    }
    setCurrentPage(nextPage);
  };

  const isCalledAssignment = (assignment) =>
    Boolean(
      assignment.contactabilityStatus ||
        assignment.callingRemark ||
        assignment.interestedRemark ||
        assignment.notInterestedRemark ||
        assignment.callAttempt1Date ||
        assignment.callAttempt2Date
    );

  const handleCopyContact = async (assignmentId, value) => {
    const contactValue = formatContactDisplay(value);
    if (!contactValue) {
      return;
    }

    try {
      await navigator.clipboard.writeText(contactValue);
      setCopiedRowId(assignmentId);
      setMessage(`Copied ${contactValue}`);
    } catch (error) {
      setMessage('Could not copy contact number');
    }
  };

  const openPipelineDraft = (assignment) => {
    if (isManagedView) {
      return;
    }

    const sourceHeaders = [contactHeader, ...visibleReadOnlyHeaders];
    const defaultNameColumn = assignment.pipelineNameColumn || findDefaultNameColumn(sourceHeaders);
    const defaultContactColumn = assignment.pipelineContactColumn || contactHeader;

    setPipelineDraft({
      assignmentId: assignment._id,
      nameColumn: defaultNameColumn,
      contactColumn: defaultContactColumn,
      followUpDate: assignment.pipelineFollowUpDate || '',
      note: assignment.pipelineNotes || '',
      isAdded: Boolean(assignment.inPipeline),
    });
  };

  const handlePipelineDraftChange = (field, value) => {
    setPipelineDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const submitPipelineDraft = () => {
    if (isManagedView) {
      return;
    }

    if (!pipelineDraft?.assignmentId) {
      return;
    }

    const assignment = assignments.find((item) => item._id === pipelineDraft.assignmentId);
    if (!assignment) {
      setMessage('Could not find the row to add into pipeline.');
      return;
    }

    if (!pipelineDraft.followUpDate) {
      setMessage('Choose a follow-up date before adding the row to pipeline.');
      return;
    }

    const lead = assignment.lead || {};
    const pipelineDisplayName = String(lead.rawData?.[pipelineDraft.nameColumn] || '').trim();
    const pipelineDisplayContact = formatContactDisplay(
      lead.rawData?.[pipelineDraft.contactColumn] || lead.contactNumber || ''
    );

    const nextAssignment = {
      ...assignment,
      inPipeline: true,
      pipelineFollowUpDate: pipelineDraft.followUpDate,
      pipelineNotes: pipelineDraft.note,
      pipelineNameColumn: pipelineDraft.nameColumn,
      pipelineContactColumn: pipelineDraft.contactColumn,
      pipelineDisplayName,
      pipelineDisplayContact,
    };

    setAssignments((current) =>
      current.map((item) => (item._id === assignment._id ? nextAssignment : item))
    );
    queueAutosave(nextAssignment);
    setPipelineDraft(null);
    setMessage('Added to pipeline.');
  };

  const handleAttemptChange = (assignment, field, part, value) => {
    if (isManagedView) {
      return;
    }

    const currentParts = splitAttemptValue(assignment[field]);
    const nextDate = part === 'date' ? value : currentParts.date;
    const nextTime = part === 'time' ? value : currentParts.time;
    handleFieldChange(assignment._id, field, buildAttemptValue(nextDate, nextTime));
  };

  const getFieldHistoryEntries = (assignment, fieldKey) =>
    [...(assignment.fieldChangeHistory || [])]
      .filter((entry) => entry.fieldKey === fieldKey)
      .sort((left, right) => new Date(right.changedAt) - new Date(left.changedAt))
      .slice(0, 3);

  const renderManagedFieldHistory = (assignment, fieldKey, currentValue) => {
    const historyEntries = getFieldHistoryEntries(assignment, fieldKey);

    return (
      <div className="min-w-[180px] space-y-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
          {currentValue || 'Empty'}
        </div>
        <details className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-indigo-700">
            History {historyEntries.length ? `(${historyEntries.length})` : ''}
          </summary>
          <div className="mt-2 space-y-2">
            {historyEntries.length ? (
              historyEntries.map((entry) => (
                <div key={entry._id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <p className="font-semibold text-slate-700">
                    {new Date(entry.changedAt).toLocaleString('en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                  <p className="mt-1">Previous: <span className="font-medium text-slate-900">{entry.oldValue || 'Empty'}</span></p>
                  <p>Marked: <span className="font-medium text-slate-900">{entry.newValue || 'Empty'}</span></p>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500">No history yet.</p>
            )}
          </div>
        </details>
      </div>
    );
  };

  const scrollLeadSheet = (direction) => {
    const container = tableContainerRef.current;

    if (!container) {
      return;
    }

    container.scrollBy({
      left: direction === 'left' ? -420 : 420,
      behavior: 'smooth',
    });
  };

  const orderedColumnKeys = useMemo(
    () => [
      'contact',
      'product',
      ...visibleReadOnlyHeaders.map((header) => `raw:${header}`),
      'contactabilityStatus',
      'callAttempt1Date',
      'callAttempt2Date',
      'callingRemark',
      'interestedRemark',
      'notInterestedRemark',
      'agentNotes',
      'status',
      'pipeline',
      'saveState',
    ],
    [visibleReadOnlyHeaders]
  );

  const getColumnWidth = (columnKey) => {
    if (columnKey.startsWith('raw:')) {
      return Math.max(columnWidths[columnKey] || 170, MIN_COLUMN_WIDTH);
    }
    return Math.max(columnWidths[columnKey] || DEFAULT_COLUMN_WIDTHS[columnKey] || 160, MIN_COLUMN_WIDTH);
  };

  const pinnedColumnKeys = useMemo(
    () => orderedColumnKeys.filter((key) => fixedColumnKeys.includes(key) && !hiddenColumnKeys.includes(key)),
    [fixedColumnKeys, hiddenColumnKeys, orderedColumnKeys]
  );
  const orderedDisplayColumnKeys = useMemo(() => {
    const pinnedAfterContact = pinnedColumnKeys.filter((key) => key !== 'contact');
    const remaining = orderedColumnKeys.filter(
      (key) => key !== 'contact' && !pinnedAfterContact.includes(key) && !hiddenColumnKeys.includes(key)
    );
    return ['contact', ...pinnedAfterContact, ...remaining];
  }, [hiddenColumnKeys, orderedColumnKeys, pinnedColumnKeys]);

  const getPinnedOffset = (columnKey) =>
    pinnedColumnKeys
      .slice(0, pinnedColumnKeys.indexOf(columnKey))
      .reduce((total, key) => total + getColumnWidth(key), 0);

  const isFixedColumn = (columnKey) => fixedColumnKeys.includes(columnKey);
  const getPinnedClasses = (columnKey, baseClassName, bgClassName, zIndexClassName) => {
    if (!isFixedColumn(columnKey)) {
      return `${baseClassName} ${bgClassName}`;
    }

    return `sticky border-r border-slate-300 ${zIndexClassName} ${baseClassName} ${bgClassName} shadow-[8px_0_12px_-10px_rgba(15,23,42,0.34)]`;
  };
  const getPinnedStyle = (columnKey) =>
    isFixedColumn(columnKey)
      ? {
          left: `${getPinnedOffset(columnKey)}px`,
          minWidth: `${getColumnWidth(columnKey)}px`,
          width: `${getColumnWidth(columnKey)}px`,
          maxWidth: `${getColumnWidth(columnKey)}px`,
        }
      : undefined;
  const getColumnStyle = (columnKey) => {
    const width = `${getColumnWidth(columnKey)}px`;
    const pinnedStyle = getPinnedStyle(columnKey);

    return {
      minWidth: width,
      width,
      maxWidth: width,
      ...(pinnedStyle || {}),
    };
  };
  const getColumnColorClasses = (columnKey, kind = 'cell') => {
    const colorKey = columnColors[columnKey];
    const color = COLOR_OPTIONS.find((option) => option.key === colorKey);
    if (!color) {
      return '';
    }
    return color[kind] || '';
  };
  const setRemarkColumnColor = (columnKey, colorKey) => {
    pushLayoutHistory();
    setColumnColors((current) => ({
      ...current,
      [columnKey]: colorKey,
    }));
  };
  const toggleColumnHidden = (columnKey) => {
    if (columnKey === 'contact') {
      return;
    }

    pushLayoutHistory();
    setHiddenColumnKeys((current) =>
      current.includes(columnKey)
        ? current.filter((key) => key !== columnKey)
        : [...current, columnKey]
    );
  };
  const startColumnResize = (event, columnKey) => {
    if (isManagedView) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    pushLayoutHistory();

    resizeStateRef.current = {
      columnKey,
      startX: event.clientX,
      startWidth: getColumnWidth(columnKey),
    };

    if (document.body) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }
  };

  useEffect(() => {
    const handlePointerMove = (event) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState) {
        return;
      }

      const nextWidth = Math.max(
        resizeState.startWidth + (event.clientX - resizeState.startX),
        MIN_COLUMN_WIDTH
      );

      setColumnWidths((current) => {
        const nextWidths = {
          ...current,
          [resizeState.columnKey]: nextWidth,
        };

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(columnWidthStorageKey, JSON.stringify(nextWidths));
        }

        return nextWidths;
      });
    };

    const stopResize = () => {
      resizeStateRef.current = null;
      if (document.body) {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResize);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResize);
    };
  }, [columnWidthStorageKey]);
  const renderHeaderLabel = (columnKey, label, onSort) => (
    <div className="space-y-1">
      <div className="flex min-w-0 items-start justify-between gap-1">
        <button
          type="button"
          onClick={onSort}
          className="min-w-0 flex-1 truncate text-left leading-tight"
        >
          {label}
        </button>
        {isFixedColumnEditMode && !isManagedView ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                pushLayoutHistory();
                setFixedColumnKeys((current) =>
                  current.includes(columnKey)
                    ? current.filter((key) => key !== columnKey)
                    : [...current, columnKey]
                );
              }}
              className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                isFixedColumn(columnKey)
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
              title={isFixedColumn(columnKey) ? 'Remove from fixed columns' : 'Add to fixed columns'}
            >
              {isFixedColumn(columnKey) ? 'Fixed' : 'Pin'}
            </button>
            <button
              type="button"
              onClick={() => toggleColumnHidden(columnKey)}
              className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                hiddenColumnKeys.includes(columnKey)
                  ? 'bg-slate-700 text-white'
                  : 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50'
              }`}
              title={hiddenColumnKeys.includes(columnKey) ? 'Show column again' : 'Hide this column'}
            >
              {hiddenColumnKeys.includes(columnKey) ? 'Hidden' : 'Hide'}
            </button>
          </div>
        ) : null}
      </div>
      {isFixedColumnEditMode && !isManagedView && ['callingRemark', 'interestedRemark', 'notInterestedRemark'].includes(columnKey) ? (
        <div className="flex flex-wrap gap-1">
          {COLOR_OPTIONS.map((option) => (
            <button
              key={`${columnKey}-${option.key}`}
              type="button"
              onClick={() => setRemarkColumnColor(columnKey, option.key)}
              className={`h-5 w-5 rounded-full border ${
                columnColors[columnKey] === option.key ? 'border-slate-900 ring-1 ring-slate-500' : 'border-slate-300'
              } ${option.cell}`}
              title={`Use ${option.label} color`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
  const showHeaderTooltip = (event, label) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setHeaderTooltip({
      label,
      left: rect.left + rect.width / 2,
      top: Math.max(rect.top - 8, 8),
    });
  };
  const hideHeaderTooltip = () => setHeaderTooltip(null);
  const getColumnLabel = (columnKey) => {
    if (columnKey === 'contact') return contactHeader;
    if (columnKey === 'product') return 'Product';
    if (columnKey.startsWith('raw:')) return columnKey.replace('raw:', '');
    if (columnKey === 'contactabilityStatus') return 'Contactability Status';
    if (columnKey === 'callAttempt1Date') return activeRemarkConfig.callAttempt1Label;
    if (columnKey === 'callAttempt2Date') return activeRemarkConfig.callAttempt2Label;
    if (columnKey === 'callingRemark') return activeRemarkConfig.callingRemarkLabel;
    if (columnKey === 'interestedRemark') return activeRemarkConfig.interestedRemarkLabel;
    if (columnKey === 'notInterestedRemark') return activeRemarkConfig.notInterestedRemarkLabel;
    if (columnKey === 'agentNotes') return 'Agent Notes';
    if (columnKey === 'status') return 'Status';
    if (columnKey === 'pipeline') return 'Pipeline';
    if (columnKey === 'saveState') return 'Save State';
    return columnKey;
  };
  const getHeaderBgClass = (columnKey) => getColumnColorClasses(columnKey, 'header') || 'bg-slate-100 text-slate-700';
  const getFilterBgClass = (columnKey) => getColumnColorClasses(columnKey, 'filter') || 'bg-white';
  const getCellBgClass = (columnKey, fallbackBg) => getColumnColorClasses(columnKey, 'cell') || fallbackBg;
  const pageWrapperClassName = isFocusMode
    ? 'fixed inset-3 z-50 flex flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl'
    : 'flex min-h-[calc(100vh-9rem)] flex-col gap-6';
  const sheetSectionClassName = isFocusMode
    ? 'flex min-h-0 flex-1 flex-col border-t border-slate-200 bg-white'
    : 'flex flex-1 min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm';

  return (
    <div className={pageWrapperClassName}>
      {headerTooltip && (
        <div
          className="pointer-events-none fixed z-[9999] max-w-xs -translate-x-1/2 -translate-y-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-lg"
          style={{ left: `${headerTooltip.left}px`, top: `${headerTooltip.top}px` }}
        >
          {headerTooltip.label}
        </div>
      )}
      {!isFocusMode && (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{selectedBatch?.batchName || 'Agent Batch'}</h2>
            <p className="mt-2 text-sm text-slate-600">
              {isManagedView
                ? 'This is the actual agent lead sheet in read-only mode. Team Leads can inspect the same batch view without updating any row.'
                : 'Contact number stays fixed on the left. Source data comes next. Your editable calling fields stay on the right.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back
            </button>
          </div>
        </div>

        {selectedBatch && (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Working batch: <strong>{selectedBatch.batchName}</strong> ({totalCount} total rows, page {currentPage} of {totalPages})
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-slate-700">{batchStats.total} total</div>
              <div className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-800">{batchStats.pending} pending</div>
              <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sky-800">{batchStats.dialed} dialed</div>
              <div className="rounded-2xl bg-yellow-50 px-4 py-3 text-yellow-800">{batchStats.followUp} follow up</div>
              <div className="rounded-2xl bg-orange-50 px-4 py-3 text-orange-800">{batchStats.callback} callback</div>
              <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-800">{batchStats.interested} interested</div>
            </div>
          </div>
        )}

        {message && <p className="mt-4 text-sm text-slate-600">{message}</p>}
      </section>
      )}

      {!isFocusMode && !isManagedView && totalPages > 1 && (
        <section className="rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
            <div>
              Showing page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> · {PAGE_SIZE} rows per page ·{' '}
              <strong>{totalCount}</strong> total rows
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      )}

      {!isManagedView && pipelineDraft && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/35 p-4"
          onClick={() => setPipelineDraft(null)}
        >
          <div
            className="w-full max-w-4xl rounded-2xl border border-amber-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Add To Pipeline</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Choose one name column, one contact column, a follow-up date, and an optional note for the pipeline template.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPipelineDraft(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="px-6 py-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="text-sm font-medium text-slate-700">
                  Name Column
                  <select
                    value={pipelineDraft.nameColumn}
                    onChange={(event) => handlePipelineDraftChange('nameColumn', event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="">Select name column</option>
                    {[contactHeader, ...visibleReadOnlyHeaders].map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Contact Column
                  <select
                    value={pipelineDraft.contactColumn}
                    onChange={(event) => handlePipelineDraftChange('contactColumn', event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    {[contactHeader, ...visibleReadOnlyHeaders].map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Follow-up Date
                  <input
                    type="date"
                    value={pipelineDraft.followUpDate}
                    onChange={(event) => handlePipelineDraftChange('followUpDate', event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Pipeline Note
                  <input
                    type="text"
                    value={pipelineDraft.note}
                    onChange={(event) => handlePipelineDraftChange('note', event.target.value)}
                    placeholder="Optional note"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </label>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={submitPipelineDraft}
                  className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
                >
                  Save Pipeline Row
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className={`${sheetSectionClassName} relative`}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm font-medium text-slate-600">Lead sheet</div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {selectedBatch?.batchName || 'Batch'} · {totalCount} rows
            </div>
            <button
              type="button"
              onClick={() => {
                if (isFixedColumnEditMode) {
                  setIsFixedColumnEditMode(false);
                  editSessionSnapshotRef.current = null;
                  return;
                }

                editSessionSnapshotRef.current = captureLayoutSnapshot();
                setIsFixedColumnEditMode(true);
              }}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                isFixedColumnEditMode
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {isFixedColumnEditMode ? 'Done Editing Table' : 'Edit Table'}
            </button>
            {!isManagedView && (
              <button
                type="button"
                onClick={undoLayoutChange}
                disabled={!canUndoLayout}
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                title="Undo last table layout change"
              >
                Undo
              </button>
            )}
            {isFixedColumnEditMode && !isManagedView && (
              <button
                type="button"
                onClick={cancelEditTableSession}
                className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                title="Cancel layout changes from this edit session"
              >
                Cancel Edit
              </button>
            )}
            <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
              Fixed: {pinnedColumnKeys.length
                ? pinnedColumnKeys
                    .map((key) => fixedColumnOptions.find((option) => option.key === key)?.label || key)
                    .join(', ')
                : 'None'}
            </div>
            {message && <div className="text-xs font-medium text-slate-500">{message}</div>}
            {isFixedColumnEditMode && hiddenColumnKeys.length ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-500">Hidden:</span>
                {hiddenColumnKeys.map((key) => (
                  <button
                    key={`hidden-${key}`}
                    type="button"
                    onClick={() => toggleColumnHidden(key)}
                    className="rounded-full bg-slate-700 px-3 py-1 text-xs font-medium text-white"
                  >
                    {fixedColumnOptions.find((option) => option.key === key)?.label || key} x
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {!isManagedView && (
            <button
              type="button"
              onClick={() => setIsFocusMode((current) => !current)}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
                {isFocusMode ? 'Exit Expanded Sheet' : 'Expand Sheet'}
              </button>
            )}
            <button
              type="button"
              onClick={() => scrollLeadSheet('left')}
              disabled={!canScrollLeft}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => scrollLeadSheet('right')}
              disabled={!canScrollRight}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              →
            </button>
          </div>
        </div>
        <div
          ref={tableContainerRef}
          className="min-h-0 flex-1 overflow-y-auto overflow-x-auto [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <table ref={tableElementRef} className="min-w-[2200px] border-separate border-spacing-0 text-[12px] font-medium leading-4 text-black">
            <thead>
              <tr>
                {orderedDisplayColumnKeys.map((columnKey) => (
                  <th
                    key={`header-${columnKey}`}
                    className={getPinnedClasses(
                      columnKey,
                      'relative sticky top-0 whitespace-nowrap align-top border-b border-r border-black px-2 py-2 text-left text-[12px] font-semibold overflow-visible',
                      getHeaderBgClass(columnKey),
                      columnKey === 'contact' ? 'z-50' : 'z-40'
                    )}
                    style={getColumnStyle(columnKey)}
                    onMouseEnter={(event) => showHeaderTooltip(event, getColumnLabel(columnKey))}
                    onMouseLeave={hideHeaderTooltip}
                  >
                    <div className="relative min-w-0">
                      {['agentNotes', 'pipeline', 'saveState'].includes(columnKey)
                        ? <span className="block min-w-0 truncate leading-tight">{getColumnLabel(columnKey)}</span>
                        : renderHeaderLabel(columnKey, getColumnLabel(columnKey), () => toggleSort(columnKey))}
                    </div>
                    {!isManagedView ? (
                      <button
                        type="button"
                        onPointerDown={(event) => startColumnResize(event, columnKey)}
                        className="absolute top-0 right-[-5px] bottom-0 z-[60] w-[10px] cursor-col-resize bg-transparent"
                        title="Drag to resize column"
                      >
                        <span className="pointer-events-none absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2 bg-slate-300" />
                        <span className="pointer-events-none absolute top-1 bottom-1 left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-slate-500/80" />
                      </button>
                    ) : null}
                  </th>
                ))}
              </tr>
              <tr>
                {orderedDisplayColumnKeys.map((columnKey) => (
                  <th
                    key={`filter-${columnKey}`}
                    className={getPinnedClasses(
                      columnKey,
                      'sticky top-[36px] h-9 align-middle border-b border-r border-black px-2 py-1',
                      getFilterBgClass(columnKey),
                      columnKey === 'contact' ? 'z-40' : 'z-30'
                    )}
                    style={getColumnStyle(columnKey)}
                  >
                    {columnKey === 'contact' ? (
                      <input type="text" value={columnFilters.contact || ''} onChange={(event) => updateColumnFilter('contact', event.target.value)} placeholder="Search" className="h-7 w-full min-w-0 rounded-md border border-slate-300 px-2 py-0 text-[11px]" />
                    ) : columnKey === 'product' ? (
                      <input type="text" value={columnFilters.product || ''} onChange={(event) => updateColumnFilter('product', event.target.value)} placeholder="Filter" className="h-7 w-full min-w-0 rounded-md border border-slate-300 px-2 py-0 text-[11px]" />
                    ) : columnKey.startsWith('raw:') ? (
                      <input type="text" value={columnFilters[columnKey] || ''} onChange={(event) => updateColumnFilter(columnKey, event.target.value)} placeholder="Search" className="h-7 w-full min-w-0 rounded-md border border-slate-300 px-2 py-0 text-[11px]" />
                    ) : columnKey === 'contactabilityStatus' ? (
                      <select value={columnFilters.contactabilityStatus || ''} onChange={(event) => updateColumnFilter('contactabilityStatus', event.target.value)} className="h-7 w-full min-w-0 rounded-md border border-slate-300 px-2 py-0 text-[11px]"><option value="">All</option>{(activeRemarkConfig.contactabilityStatuses || []).map((status) => <option key={status} value={status}>{status}</option>)}</select>
                    ) : columnKey === 'callingRemark' ? (
                      <select value={columnFilters.callingRemark || ''} onChange={(event) => updateColumnFilter('callingRemark', event.target.value)} className="h-7 w-full min-w-0 rounded-md border border-slate-300 px-2 py-0 text-[11px]"><option value="">All</option>{activeRemarkConfig.callingRemarks.map((remark) => <option key={remark} value={remark}>{remark}</option>)}</select>
                    ) : columnKey === 'interestedRemark' ? (
                      <select value={columnFilters.interestedRemark || ''} onChange={(event) => updateColumnFilter('interestedRemark', event.target.value)} className="h-7 w-full min-w-0 rounded-md border border-slate-300 px-2 py-0 text-[11px]"><option value="">All</option>{activeRemarkConfig.interestedRemarks.map((remark) => <option key={remark} value={remark}>{remark}</option>)}</select>
                    ) : columnKey === 'notInterestedRemark' ? (
                      <select value={columnFilters.notInterestedRemark || ''} onChange={(event) => updateColumnFilter('notInterestedRemark', event.target.value)} className="h-7 w-full min-w-0 rounded-md border border-slate-300 px-2 py-0 text-[11px]"><option value="">All</option>{activeRemarkConfig.notInterestedRemarks.map((remark) => <option key={remark} value={remark}>{remark}</option>)}</select>
                    ) : columnKey === 'status' ? (
                      <select value={columnFilters.status || ''} onChange={(event) => updateColumnFilter('status', event.target.value)} className="h-7 w-full min-w-0 rounded-md border border-slate-300 px-2 py-0 text-[11px]"><option value="">All</option><option value="submitted">Submitted</option><option value="activated">Activated</option></select>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredAssignments.map((assignment, index) => {
                const lead = assignment.lead || {};
                const remarks = assignment.remarkConfig || DEFAULT_REMARK_CONFIG;
                const isCopiedRow = copiedRowId === assignment._id;
                const isCalledRow = isCalledAssignment(assignment);
                const baseRowBackground = index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60';
                const remarkRowBackground = getRemarkRowBackground(assignment);
                const accentRowBackground = isCopiedRow
                  ? 'bg-amber-300'
                  : remarkRowBackground || (isCalledRow
                    ? 'bg-emerald-100'
                    : baseRowBackground);

                return (
                  <tr key={assignment._id} className={`${accentRowBackground} ${isCopiedRow ? 'ring-1 ring-inset ring-amber-200' : ''}`}>
                    {orderedDisplayColumnKeys.map((columnKey) => {
                      const baseBg = getCellBgClass(columnKey, isCopiedRow ? 'bg-amber-300' : remarkRowBackground || (isCalledRow ? 'bg-emerald-100' : index % 2 === 0 ? 'bg-white' : 'bg-slate-50'));
                      const cellClassName = getPinnedClasses(columnKey, columnKey === 'contact' ? 'h-9 border-b border-r border-black px-2 py-1.5 font-medium text-black' : 'h-9 border-b border-r border-black px-2 py-1.5 text-black', baseBg, columnKey === 'contact' ? 'z-30' : 'z-20');

                      if (columnKey === 'contact') {
                        return (
                          <td key={`${assignment._id}-${columnKey}`} className={cellClassName} style={getColumnStyle(columnKey)}>
                            <button type="button" onClick={() => handleCopyContact(assignment._id, lead.rawData?.[contactHeader] || lead.contactNumber)} className="flex items-center gap-2 rounded px-1 py-0.5 text-left font-medium text-black hover:bg-indigo-50" title="Click to copy number">
                              <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full text-[11px] font-bold ${isCalledAssignment(assignment) ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{isCalledAssignment(assignment) ? '✓' : '•'}</span>
                              {formatContactDisplay(lead.rawData?.[contactHeader] || lead.contactNumber)}
                              {copiedRowId === assignment._id ? <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">Copied</span> : null}
                            </button>
                          </td>
                        );
                      }

                      if (columnKey === 'product') {
                        return <td key={`${assignment._id}-${columnKey}`} className={cellClassName} style={getColumnStyle(columnKey)}><div className="overflow-hidden whitespace-normal break-words [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]">{assignment.product?.toUpperCase() || '-'}</div></td>;
                      }

                      if (columnKey.startsWith('raw:')) {
                        const header = columnKey.replace('raw:', '');
                        return <td key={`${assignment._id}-${columnKey}`} className={cellClassName} style={getColumnStyle(columnKey)}><div className="overflow-hidden whitespace-normal break-words [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]">{lead.rawData?.[header] || '-'}</div></td>;
                      }

                      if (columnKey === 'contactabilityStatus') {
                        return (
                          <td key={`${assignment._id}-${columnKey}`} className={cellClassName} style={getColumnStyle(columnKey)}>
                            {isManagedView ? renderManagedFieldHistory(assignment, 'contactabilityStatus', assignment.contactabilityStatus) : (
                              <select value={assignment.contactabilityStatus || ''} onChange={(event) => handleFieldChange(assignment._id, 'contactabilityStatus', event.target.value)} className="w-full min-w-0 rounded-md border border-slate-300 px-2 py-0.5 text-[11px]">
                                <option value="">Select</option>
                                {(remarks.contactabilityStatuses || []).map((status) => <option key={status} value={status}>{status}</option>)}
                              </select>
                            )}
                          </td>
                        );
                      }

                      if (columnKey === 'callAttempt1Date' || columnKey === 'callAttempt2Date') {
                        const field = columnKey;
                        return (
                          <td key={`${assignment._id}-${columnKey}`} className={cellClassName} style={getColumnStyle(columnKey)}>
                            {isManagedView ? renderManagedFieldHistory(assignment, field, assignment[field]) : (
                              <div className="flex w-full min-w-0 gap-1.5">
                                <input type="date" value={splitAttemptValue(assignment[field]).date} onChange={(event) => handleAttemptChange(assignment, field, 'date', event.target.value)} className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-0.5 text-[11px]" />
                                <input type="time" value={splitAttemptValue(assignment[field]).time} onChange={(event) => handleAttemptChange(assignment, field, 'time', event.target.value)} className="w-[78px] min-w-0 rounded-md border border-slate-300 px-2 py-0.5 text-[11px]" />
                              </div>
                            )}
                          </td>
                        );
                      }

                      if (['callingRemark', 'interestedRemark', 'notInterestedRemark'].includes(columnKey)) {
                        const options =
                          columnKey === 'callingRemark' ? remarks.callingRemarks :
                          columnKey === 'interestedRemark' ? remarks.interestedRemarks :
                          remarks.notInterestedRemarks;
                        const widthClass = columnKey === 'notInterestedRemark' ? 'w-[170px]' : 'w-[160px]';
                        const selectColorClass = getRemarkValueClasses(columnKey, assignment[columnKey]);
                        return (
                          <td key={`${assignment._id}-${columnKey}`} className={cellClassName} style={getColumnStyle(columnKey)}>
                            {isManagedView ? renderManagedFieldHistory(assignment, columnKey, assignment[columnKey]) : (
                              <select value={assignment[columnKey] || ''} onChange={(event) => handleFieldChange(assignment._id, columnKey, event.target.value)} className={`w-full min-w-0 rounded-md border px-2 py-0.5 text-[11px] font-medium ${selectColorClass}`}>
                                <option value="">Select</option>
                                {options.map((remark) => <option key={remark} value={remark}>{remark}</option>)}
                              </select>
                            )}
                          </td>
                        );
                      }

                      if (columnKey === 'agentNotes') {
                        return (
                          <td key={`${assignment._id}-${columnKey}`} className={cellClassName} style={getColumnStyle(columnKey)}>
                            {isManagedView ? renderManagedFieldHistory(assignment, 'agentNotes', assignment.agentNotes) : (
                              <input type="text" value={assignment.agentNotes || ''} onChange={(event) => handleFieldChange(assignment._id, 'agentNotes', event.target.value)} className="w-full min-w-0 rounded-md border border-slate-300 px-2 py-0.5 text-[11px]" />
                            )}
                          </td>
                        );
                      }

                      if (columnKey === 'status') {
                        return (
                          <td key={`${assignment._id}-${columnKey}`} className={cellClassName} style={getColumnStyle(columnKey)}>
                            {isManagedView ? renderManagedFieldHistory(assignment, 'status', assignment.status) : (
                              <select value={assignment.status || ''} onChange={(event) => handleFieldChange(assignment._id, 'status', event.target.value)} className="w-full min-w-0 rounded-md border border-slate-300 px-2 py-0.5 text-[11px]">
                                <option value="">Select</option>
                                <option value="submitted">Submitted</option>
                                <option value="activated">Activated</option>
                              </select>
                            )}
                          </td>
                        );
                      }

                      if (columnKey === 'pipeline') {
                        return (
                          <td key={`${assignment._id}-${columnKey}`} className={cellClassName} style={getColumnStyle(columnKey)}>
                            {isManagedView ? renderManagedFieldHistory(assignment, 'pipeline', assignment.inPipeline ? `In Pipeline${assignment.pipelineFollowUpDate ? ` - ${assignment.pipelineFollowUpDate}` : ''}` : assignment.pipelineFollowUpDate || 'Not In Pipeline') : (
                              <div className="flex w-full min-w-0 gap-1.5">
                                <input type="date" value={assignment.pipelineFollowUpDate || ''} onChange={(event) => handleFieldChange(assignment._id, 'pipelineFollowUpDate', event.target.value)} className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-0.5 text-[11px]" />
                                <button type="button" onClick={() => openPipelineDraft(assignment)} className={`rounded-lg px-2 py-0.5 text-[11px] font-medium text-white ${assignment.inPipeline ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}`}>{assignment.inPipeline ? 'Added' : 'Add'}</button>
                              </div>
                            )}
                          </td>
                        );
                      }

                      if (columnKey === 'saveState') {
                        return <td key={`${assignment._id}-${columnKey}`} className="h-9 border-b border-r border-black px-3 py-1.5 text-xs font-medium text-black" style={getColumnStyle(columnKey)}>{!isManagedView && saveState[assignment._id] === 'saving' && 'Saving...'}{!isManagedView && saveState[assignment._id] === 'saved' && 'Saved'}{!isManagedView && saveState[assignment._id] === 'error' && 'Error'}</td>;
                      }

                      return <td key={`${assignment._id}-${columnKey}`} className={cellClassName} style={getColumnStyle(columnKey)}>-</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200 bg-white px-4 py-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => scrollLeadSheet('left')}
              disabled={!canScrollLeft}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ←
            </button>
            <div ref={bottomScrollbarRef} className="flex-1 overflow-x-scroll overflow-y-hidden">
              <div style={{ width: `${tableScrollWidth}px`, height: '12px' }} />
            </div>
            <button
              type="button"
              onClick={() => scrollLeadSheet('right')}
              disabled={!canScrollRight}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              →
            </button>
          </div>
        </div>
      </section>

      {!isFocusMode && !isManagedView && totalPages > 1 && (
        <section className="rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
            <div>
              Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default AgentBatchPage;
