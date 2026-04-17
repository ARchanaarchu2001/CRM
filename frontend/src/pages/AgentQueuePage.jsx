import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchManagedAgentQueueView, fetchMyAssignments, updateAssignment } from '../api/leads.js';
import { useSheetLayout } from '../hooks/useSheetLayout.js';
import { formatContactDisplay } from '../utils/contactNumber.js';

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
const MIN_COLUMN_WIDTH = 56;
const DEFAULT_QUEUE_COLUMN_WIDTHS = {
  contact: 220,
  product: 120,
  batchName: 220,
  contactabilityStatus: 180,
  callAttempt1Date: 220,
  callAttempt2Date: 220,
  callingRemark: 180,
  interestedRemark: 180,
  notInterestedRemark: 190,
  agentNotes: 220,
  status: 140,
  pipeline: 120,
  saveState: 170,
};
const DEFAULT_QUEUE_FIXED_COLUMNS = ['contact'];

const getRemarkValueClasses = (columnKey, value) => {
  const normalizedValue = String(value || '').trim().toLowerCase();

  if (!normalizedValue) {
    return 'bg-white text-slate-700 border-slate-300';
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

  return 'bg-white text-slate-700 border-slate-300';
};

const splitAttemptValue = (value) => {
  const normalizedValue = String(value || '').trim();
  const match = normalizedValue.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?$/);
  if (!match) {
    return { date: '', time: '' };
  }
  return { date: match[1] || '', time: match[2] || '' };
};

const buildAttemptValue = (dateValue, timeValue) => {
  const date = String(dateValue || '').trim();
  const time = String(timeValue || '').trim();
  if (!date) {
    return '';
  }
  return time ? `${date} ${time}` : date;
};

const getQueueLabel = (queueType) =>
  ({
    pending: 'Pending / Undialed',
    follow_up: 'Follow Up',
    callback: 'Callback',
    interested: 'Interested',
  })[queueType] || 'Work Queue';

const matchesQueueType = (assignment, queueType) => {
  const isNotDialed =
    !assignment.contactabilityStatus &&
    !assignment.callingRemark &&
    !assignment.interestedRemark &&
    !assignment.notInterestedRemark &&
    !assignment.callAttempt1Date &&
    !assignment.callAttempt2Date;

  if (queueType === 'pending') return isNotDialed;
  if (queueType === 'follow_up') return assignment.callingRemark === 'Follow up';
  if (queueType === 'callback') return assignment.callingRemark === 'Call back';
  if (queueType === 'interested') return assignment.callingRemark === 'Interested' || Boolean(assignment.interestedRemark);
  return true;
};

const AgentQueuePage = () => {
  const { queueType, agentId } = useParams();
  const isManagedView = Boolean(agentId);
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [message, setMessage] = useState('');
  const [saveState, setSaveState] = useState({});
  const [copiedRowId, setCopiedRowId] = useState('');
  const [pipelineDraft, setPipelineDraft] = useState(null);
  const [agentName, setAgentName] = useState('');
  const [persistedRemarkConfig, setPersistedRemarkConfig] = useState(DEFAULT_REMARK_CONFIG);
  const [pendingSessionRowIds, setPendingSessionRowIds] = useState([]);
  const timersRef = useRef(new Map());

  const loadAssignments = async () => {
    if (isManagedView) {
      const data = await fetchManagedAgentQueueView(agentId);
      setAssignments(data.view?.assignments || []);
      setAgentName(data.view?.agent?.fullName || '');
      return;
    }

    const data = await fetchMyAssignments();
    setAssignments(data.assignments || []);
  };

  useEffect(() => {
    loadAssignments();
  }, [queueType, agentId, isManagedView]);

  useEffect(() => {
    if (queueType !== 'pending') {
      setPendingSessionRowIds([]);
      return;
    }

    setPendingSessionRowIds((current) => {
      const nextIds = assignments
        .filter((assignment) => matchesQueueType(assignment, 'pending'))
        .map((assignment) => assignment._id);

      if (!current.length) {
        return nextIds;
      }

      const merged = new Set([...current, ...nextIds]);
      return Array.from(merged);
    });
  }, [assignments, queueType]);

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  const visibleAssignments = useMemo(
    () =>
      assignments.filter((assignment) => {
        if (queueType !== 'pending') {
          return matchesQueueType(assignment, queueType);
        }

        return matchesQueueType(assignment, 'pending') || pendingSessionRowIds.includes(assignment._id);
      }),
    [assignments, pendingSessionRowIds, queueType]
  );

  useEffect(() => {
    const nextRemarkConfig = visibleAssignments[0]?.remarkConfig;
    if (nextRemarkConfig) {
      setPersistedRemarkConfig(nextRemarkConfig);
    }
  }, [visibleAssignments]);

  const readOnlyHeaders = useMemo(() => {
    const keys = new Set();
    visibleAssignments.forEach((assignment) => {
      Object.keys(assignment.lead?.rawData || {}).forEach((key) => keys.add(key));
    });
    return Array.from(keys);
  }, [visibleAssignments]);

  const contactHeader = visibleAssignments[0]?.lead?.contactColumn || 'Contact';
  const visibleReadOnlyHeaders = readOnlyHeaders.filter((header) => header !== contactHeader);

  const orderedColumnKeys = useMemo(
    () => [
      'contact',
      'product',
      'batchName',
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
  const {
    isFocusMode,
    setIsFocusMode,
    isTableEditMode,
    setIsTableEditMode,
    fixedColumnKeys,
    setFixedColumnKeys,
    tableContainerRef,
    tableElementRef,
    bottomScrollbarRef,
    tableScrollWidth,
    orderedDisplayColumnKeys,
    isFixedColumn,
    getColumnStyle,
    getPinnedClasses,
    startColumnResize,
  } = useSheetLayout({
    storageKey: `agent-queue-layout:${isManagedView ? agentId || 'managed' : 'self'}:${queueType || 'default'}`,
    orderedColumnKeys,
    defaultFixedColumnKeys: DEFAULT_QUEUE_FIXED_COLUMNS,
    defaultColumnWidths: DEFAULT_QUEUE_COLUMN_WIDTHS,
  });

  const getColumnLabel = (columnKey) => {
    if (columnKey === 'contact') return contactHeader;
    if (columnKey === 'product') return 'Product';
    if (columnKey === 'batchName') return 'Dataset';
    if (columnKey.startsWith('raw:')) return columnKey.replace('raw:', '');
    if (columnKey === 'contactabilityStatus') return 'Contactability Status';
    if (columnKey === 'callAttempt1Date') return 'Call Attempt 1 - Date';
    if (columnKey === 'callAttempt2Date') return 'Call Attempt 2 - Date';
    if (columnKey === 'callingRemark') return 'Calling Remarks';
    if (columnKey === 'interestedRemark') return 'Interested Remarks';
    if (columnKey === 'notInterestedRemark') return 'Not Interested Remarks';
    if (columnKey === 'agentNotes') return 'Agent Notes';
    if (columnKey === 'status') return 'Status';
    if (columnKey === 'pipeline') return 'Pipeline';
    if (columnKey === 'saveState') return 'Save State';
    return columnKey;
  };

  const findDefaultNameColumn = (headers = []) =>
    headers.find((header) => /^(name|customer name|lead name|full name)$/i.test(header)) ||
    headers.find((header) => /name/i.test(header)) ||
    '';

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
        setMessage(error.response?.data?.message || 'Could not save queue row');
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
        if (queueType === 'pending') {
          setPendingSessionRowIds((currentPendingIds) =>
            currentPendingIds.includes(assignmentId) ? currentPendingIds : [...currentPendingIds, assignmentId]
          );
        }
        const nextAssignment = { ...assignment, [field]: value };
        queueAutosave(nextAssignment);
        return nextAssignment;
      })
    );
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

  const isCalledAssignment = (assignment) =>
    Boolean(
      assignment.contactabilityStatus ||
        assignment.callingRemark ||
        assignment.interestedRemark ||
        assignment.notInterestedRemark ||
        assignment.callAttempt1Date ||
        assignment.callAttempt2Date
    );

  const isSoftVisiblePendingRow = (assignment) =>
    queueType === 'pending' &&
    pendingSessionRowIds.includes(assignment._id) &&
    !matchesQueueType(assignment, 'pending');

  const handleCopyContact = async (assignmentId, value) => {
    const contactValue = formatContactDisplay(value);
    if (!contactValue) return;

    try {
      await navigator.clipboard.writeText(contactValue);
      setCopiedRowId(assignmentId);
      setMessage(`Copied ${contactValue}`);
    } catch {
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

  return (
    <div className={isFocusMode ? 'fixed inset-3 z-50 flex flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl' : 'space-y-6'}>
      <section className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${isFocusMode ? 'rounded-none border-0 border-b shadow-none' : ''}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{getQueueLabel(queueType)}</h2>
            <p className="mt-2 text-sm text-slate-600">
              {isManagedView
                ? `${agentName || 'Agent'} queue in read-only mode. You can inspect pending, follow up, callback, and interested rows here.`
                : 'Work this queue across all products and datasets, then update remarks directly from here.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-slate-700">{visibleAssignments.length} rows in this queue</div>
          {queueType === 'pending' ? (
            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-800">
              Updated rows stay visible until refresh so you can finish remarks.
            </div>
          ) : null}
          {!isManagedView ? (
            <button
              type="button"
              onClick={() => setIsFocusMode((current) => !current)}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-700 hover:bg-slate-50"
            >
              {isFocusMode ? 'Exit Expanded Sheet' : 'Expand Sheet'}
            </button>
          ) : null}
        </div>

        {message && <p className="mt-4 text-sm text-slate-600">{message}</p>}
      </section>

      {pipelineDraft && !isManagedView && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Add To Pipeline</h3>
              <p className="mt-2 text-sm text-slate-600">
                Choose one name column, one contact column, a follow-up date, and an optional note for the pipeline template.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPipelineDraft(null)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
            >
              Close
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={submitPipelineDraft}
              className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
            >
              Save To Pipeline
            </button>
            <button
              type="button"
              onClick={() => setPipelineDraft(null)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${isFocusMode ? 'flex min-h-0 flex-1 flex-col rounded-none border-0 shadow-none' : ''}`}>
        {!isManagedView ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setIsTableEditMode((current) => !current)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  isTableEditMode
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {isTableEditMode ? 'Done Editing Table' : 'Edit Table'}
              </button>
              <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                Fixed: {fixedColumnKeys.map((key) => getColumnLabel(key)).join(', ')}
              </div>
            </div>
          </div>
        ) : null}
        <div ref={tableContainerRef} className="min-h-0 flex-1 overflow-auto">
          <table ref={tableElementRef} className="min-w-[2050px] border-separate border-spacing-0 text-[12px] font-medium leading-4 text-black">
            <thead>
              <tr>
                {orderedDisplayColumnKeys.map((columnKey) => (
                  <th
                    key={`header-${columnKey}`}
                    className={getPinnedClasses(
                      columnKey,
                      'relative sticky top-0 whitespace-nowrap align-top border-b border-r border-black px-2 py-2 text-left text-[12px] font-semibold text-slate-700',
                      'bg-slate-100',
                      columnKey === 'contact' ? 'z-40' : 'z-30'
                    )}
                    style={getColumnStyle(columnKey)}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <span className="min-w-0 truncate">{getColumnLabel(columnKey)}</span>
                      {isTableEditMode && !isManagedView && columnKey !== 'contact' ? (
                        <button
                          type="button"
                          onClick={() =>
                            setFixedColumnKeys((current) =>
                              current.includes(columnKey)
                                ? current.filter((key) => key !== columnKey)
                                : [...current, columnKey]
                            )
                          }
                          className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                            isFixedColumn(columnKey)
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {isFixedColumn(columnKey) ? 'Fixed' : 'Pin'}
                        </button>
                      ) : null}
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
            </thead>
            <tbody className="bg-white">
              {visibleAssignments.map((assignment) => {
                const lead = assignment.lead || {};
                const remarks = assignment.remarkConfig || persistedRemarkConfig || DEFAULT_REMARK_CONFIG;
                const isCopiedRow = copiedRowId === assignment._id;
                const isCalledRow = isCalledAssignment(assignment);
                const isSoftVisibleRow = isSoftVisiblePendingRow(assignment);
                return (
                  <tr
                    key={assignment._id}
                    className={
                      isCopiedRow
                        ? 'bg-amber-50 ring-1 ring-inset ring-amber-200'
                        : isCalledRow
                          ? 'bg-emerald-50/40'
                          : ''
                    }
                  >
                    {orderedDisplayColumnKeys.map((columnKey) => {
                      const baseBg = isCopiedRow ? 'bg-amber-50' : isCalledRow ? 'bg-emerald-50' : 'bg-white';
                      const cellClassName = getPinnedClasses(
                        columnKey,
                        'h-9 border-b border-r border-black px-2 py-1.5 text-black',
                        baseBg,
                        columnKey === 'contact' ? 'z-20' : 'z-10'
                      );

                      if (columnKey === 'contact') {
                        return (
                          <td key={`${assignment._id}-${columnKey}`} className={cellClassName} style={getColumnStyle(columnKey)}>
                            <button
                              type="button"
                              onClick={() => handleCopyContact(assignment._id, lead.rawData?.[contactHeader] || lead.contactNumber)}
                              className="flex items-center gap-2 rounded px-1 py-0.5 text-left text-black hover:bg-indigo-50"
                            >
                              <span
                                className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                                  isCalledRow ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                                }`}
                              >
                                {isCalledRow ? '✓' : '•'}
                              </span>
                              {formatContactDisplay(lead.rawData?.[contactHeader] || lead.contactNumber)}
                              {isCopiedRow ? <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">Copied</span> : null}
                            </button>
                          </td>
                        );
                      }

                      if (columnKey === 'product') {
                        return <td key={`${assignment._id}-${columnKey}`} className={cellClassName} style={getColumnStyle(columnKey)}>{assignment.product?.toUpperCase() || '—'}</td>;
                      }

                      if (columnKey === 'batchName') {
                        return (
                          <td key={`${assignment._id}-${columnKey}`} className={cellClassName} style={getColumnStyle(columnKey)}>
                            <div className="flex flex-wrap items-center gap-2">
                              <span>{assignment.batchName}</span>
                              {isSoftVisibleRow ? (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                                  Updated
                                </span>
                              ) : null}
                            </div>
                          </td>
                        );
                      }

                      if (columnKey.startsWith('raw:')) {
                        const header = columnKey.replace('raw:', '');
                        return <td key={`${assignment._id}-${columnKey}`} className={cellClassName} style={getColumnStyle(columnKey)}>{lead.rawData?.[header] || '—'}</td>;
                      }

                      if (columnKey === 'contactabilityStatus') {
                        return (
                          <td key={`${assignment._id}-${columnKey}`} className={cellClassName} style={getColumnStyle(columnKey)}>
                            <select disabled={isManagedView} value={assignment.contactabilityStatus || ''} onChange={(e) => handleFieldChange(assignment._id, 'contactabilityStatus', e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-0.5 text-[11px] disabled:bg-slate-50 disabled:text-slate-500">
                              <option value="">Select</option>
                              {(remarks.contactabilityStatuses || []).map((status) => <option key={status} value={status}>{status}</option>)}
                            </select>
                          </td>
                        );
                      }

                      if (columnKey === 'callAttempt1Date' || columnKey === 'callAttempt2Date') {
                        const field = columnKey;
                        return (
                          <td key={`${assignment._id}-${columnKey}`} className={cellClassName} style={getColumnStyle(columnKey)}>
                            <div className="flex min-w-[220px] gap-2">
                              <input disabled={isManagedView} type="date" value={splitAttemptValue(assignment[field]).date} onChange={(e) => handleAttemptChange(assignment, field, 'date', e.target.value)} className="w-[135px] rounded-md border border-slate-300 px-2 py-0.5 text-[11px] disabled:bg-slate-50 disabled:text-slate-500" />
                              <input disabled={isManagedView} type="time" value={splitAttemptValue(assignment[field]).time} onChange={(e) => handleAttemptChange(assignment, field, 'time', e.target.value)} className="w-[95px] rounded-md border border-slate-300 px-2 py-0.5 text-[11px] disabled:bg-slate-50 disabled:text-slate-500" />
                            </div>
                          </td>
                        );
                      }

                      if (columnKey === 'callingRemark' || columnKey === 'interestedRemark' || columnKey === 'notInterestedRemark') {
                        const options =
                          columnKey === 'callingRemark' ? remarks.callingRemarks :
                          columnKey === 'interestedRemark' ? remarks.interestedRemarks :
                          remarks.notInterestedRemarks;
                        return (
                          <td key={`${assignment._id}-${columnKey}`} className={cellClassName} style={getColumnStyle(columnKey)}>
                            <select disabled={isManagedView} value={assignment[columnKey] || ''} onChange={(e) => handleFieldChange(assignment._id, columnKey, e.target.value)} className={`w-full rounded-md border px-2 py-0.5 text-[11px] font-medium disabled:bg-slate-50 disabled:text-slate-500 ${getRemarkValueClasses(columnKey, assignment[columnKey])}`}>
                              <option value="">Select</option>
                              {options.map((remark) => <option key={remark} value={remark}>{remark}</option>)}
                            </select>
                          </td>
                        );
                      }

                      if (columnKey === 'agentNotes') {
                        return <td key={`${assignment._id}-${columnKey}`} className={cellClassName} style={getColumnStyle(columnKey)}><input disabled={isManagedView} type="text" value={assignment.agentNotes || ''} onChange={(e) => handleFieldChange(assignment._id, 'agentNotes', e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-0.5 text-[11px] disabled:bg-slate-50 disabled:text-slate-500" /></td>;
                      }

                      if (columnKey === 'status') {
                        return (
                          <td key={`${assignment._id}-${columnKey}`} className={cellClassName} style={getColumnStyle(columnKey)}>
                            <select disabled={isManagedView} value={assignment.status || ''} onChange={(e) => handleFieldChange(assignment._id, 'status', e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-0.5 text-[11px] disabled:bg-slate-50 disabled:text-slate-500">
                              <option value="">Select</option>
                              <option value="submitted">Submitted</option>
                              <option value="activated">Activated</option>
                            </select>
                          </td>
                        );
                      }

                      if (columnKey === 'pipeline') {
                        return (
                          <td key={`${assignment._id}-${columnKey}`} className={cellClassName} style={getColumnStyle(columnKey)}>
                            {isManagedView ? (
                              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                                {assignment.inPipeline ? 'In Pipeline' : 'Not Added'}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openPipelineDraft(assignment)}
                                className="rounded-lg border border-amber-200 px-2.5 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-50"
                              >
                                {assignment.inPipeline ? 'Added' : 'Add'}
                              </button>
                            )}
                          </td>
                        );
                      }

                      if (columnKey === 'saveState') {
                        return (
                          <td key={`${assignment._id}-${columnKey}`} className={cellClassName} style={getColumnStyle(columnKey)}>
                            {isSoftVisibleRow ? (
                              <span className="mr-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 font-semibold uppercase tracking-wide text-amber-800">
                                Stays until refresh
                              </span>
                            ) : null}
                            {!isManagedView && saveState[assignment._id] === 'saving' && 'Saving...'}
                            {!isManagedView && saveState[assignment._id] === 'saved' && 'Saved'}
                            {!isManagedView && saveState[assignment._id] === 'error' && 'Error'}
                            {isManagedView && 'Read only'}
                          </td>
                        );
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
          <div ref={bottomScrollbarRef} className="overflow-x-scroll overflow-y-hidden">
            <div style={{ width: `${tableScrollWidth}px`, height: '12px' }} />
          </div>
        </div>
      </section>
    </div>
  );
};

export default AgentQueuePage;
