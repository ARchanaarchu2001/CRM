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
  callingRemarks: [],
  interestedRemarks: [],
  notInterestedRemarks: [],
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

const AgentBatchPage = () => {
  const { batchId, agentId } = useParams();
  const isManagedView = Boolean(agentId);
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [message, setMessage] = useState('');
  const [saveState, setSaveState] = useState({});
  const [copiedContact, setCopiedContact] = useState('');
  const [pipelineDraft, setPipelineDraft] = useState(null);
  const [columnFilters, setColumnFilters] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: 'updatedAt', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const timersRef = useRef(new Map());
  const serializedColumnFilters = JSON.stringify(columnFilters);

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

    const data = await fetchMyAssignments({
      importBatchId: batchId,
      page: currentPage,
      pageSize: PAGE_SIZE,
      contact: columnFilters.contact || '',
      product: columnFilters.product || '',
      contactabilityStatus: columnFilters.contactabilityStatus || '',
      callingRemark: columnFilters.callingRemark || '',
      interestedRemark: columnFilters.interestedRemark || '',
      notInterestedRemark: columnFilters.notInterestedRemark || '',
      status: columnFilters.status || '',
      rawFilters: JSON.stringify(
        Object.fromEntries(
          Object.entries(columnFilters)
            .filter(([key, value]) => key.startsWith('raw:') && String(value || '').trim())
            .map(([key, value]) => [key.replace('raw:', ''), value])
        )
      ),
    });
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
  const activeRemarkConfig =
    assignments[0]?.remarkConfig || (selectedBatch ? assignments.find((assignment) => assignment.product === selectedBatch.product)?.remarkConfig : null) || DEFAULT_REMARK_CONFIG;

  const readOnlyHeaders = useMemo(() => {
    const keys = new Set();
    assignments.forEach((assignment) => {
      Object.keys(assignment.lead?.rawData || {}).forEach((key) => keys.add(key));
    });
    return Array.from(keys);
  }, [assignments]);

  const contactHeader = assignments[0]?.lead?.contactColumn || 'Contact';
  const visibleReadOnlyHeaders = readOnlyHeaders.filter((header) => header !== contactHeader);
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

  const updateColumnFilter = (key, value) => {
    setColumnFilters((current) => ({
      ...current,
      [key]: value,
    }));
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

  const handleCopyContact = async (value) => {
    const contactValue = formatContactDisplay(value);
    if (!contactValue) {
      return;
    }

    try {
      await navigator.clipboard.writeText(contactValue);
      setCopiedContact(contactValue);
      setMessage(`Copied ${contactValue}`);
      window.setTimeout(() => {
        setCopiedContact((current) => (current === contactValue ? '' : current));
      }, 1800);
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

  return (
    <div className="space-y-6">
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
            {!isManagedView && (
              <button
                type="button"
                onClick={handleHideBatch}
                className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Hide This Batch
              </button>
            )}
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

      {!isManagedView && totalPages > 1 && (
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

          <div className="mt-5">
            <button
              type="button"
              onClick={submitPipelineDraft}
              className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
            >
              Save Pipeline Row
            </button>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-auto">
          <table className="min-w-[2200px] divide-y divide-slate-200 text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100">
              <tr>
                <th className="sticky left-0 z-30 border-r border-slate-200 bg-slate-100 px-3 py-3 text-left font-semibold text-slate-700 shadow-[6px_0_8px_-8px_rgba(15,23,42,0.28)]">
                  <button type="button" onClick={() => toggleSort('contact')}>
                    {contactHeader}
                  </button>
                </th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">
                  <button type="button" onClick={() => toggleSort('product')}>
                    Product
                  </button>
                </th>
                {visibleReadOnlyHeaders.map((header) => (
                  <th key={header} className="px-3 py-3 text-left font-semibold text-slate-700">
                    <button type="button" onClick={() => toggleSort(`raw:${header}`)}>
                      {header}
                    </button>
                  </th>
                ))}
                <th className="px-3 py-3 text-left font-semibold text-slate-700">
                  <button type="button" onClick={() => toggleSort('contactabilityStatus')}>
                    Contactability Status
                  </button>
                </th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">{activeRemarkConfig.callAttempt1Label}</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">{activeRemarkConfig.callAttempt2Label}</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">
                  <button type="button" onClick={() => toggleSort('callingRemark')}>
                    {activeRemarkConfig.callingRemarkLabel}
                  </button>
                </th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">
                  <button type="button" onClick={() => toggleSort('interestedRemark')}>
                    {activeRemarkConfig.interestedRemarkLabel}
                  </button>
                </th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">
                  <button type="button" onClick={() => toggleSort('notInterestedRemark')}>
                    {activeRemarkConfig.notInterestedRemarkLabel}
                  </button>
                </th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Agent Notes</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">
                  <button type="button" onClick={() => toggleSort('status')}>
                    Status
                  </button>
                </th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Pipeline</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Save State</th>
              </tr>
              <tr className="bg-white">
                <th className="sticky left-0 z-20 border-r border-slate-200 bg-white px-3 py-2 shadow-[6px_0_8px_-8px_rgba(15,23,42,0.18)]">
                  <input
                    type="text"
                    value={columnFilters.contact || ''}
                    onChange={(event) => updateColumnFilter('contact', event.target.value)}
                    placeholder="Search"
                    className="w-[140px] rounded-lg border border-slate-300 px-2 py-1"
                  />
                </th>
                <th className="px-3 py-2">
                  <input
                    type="text"
                    value={columnFilters.product || ''}
                    onChange={(event) => updateColumnFilter('product', event.target.value)}
                    placeholder="Filter"
                    className="w-[120px] rounded-lg border border-slate-300 px-2 py-1"
                  />
                </th>
                {visibleReadOnlyHeaders.map((header) => (
                  <th key={`${header}-filter`} className="px-3 py-2">
                    <input
                      type="text"
                      value={columnFilters[`raw:${header}`] || ''}
                      onChange={(event) => updateColumnFilter(`raw:${header}`, event.target.value)}
                      placeholder="Search"
                      className="w-[140px] rounded-lg border border-slate-300 px-2 py-1"
                    />
                  </th>
                ))}
                <th className="px-3 py-2">
                  <select
                    value={columnFilters.contactabilityStatus || ''}
                    onChange={(event) => updateColumnFilter('contactabilityStatus', event.target.value)}
                    className="w-[160px] rounded-lg border border-slate-300 px-2 py-1"
                  >
                    <option value="">All</option>
                    {(activeRemarkConfig.contactabilityStatuses || []).map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="px-3 py-2" />
                <th className="px-3 py-2" />
                <th className="px-3 py-2">
                  <select
                    value={columnFilters.callingRemark || ''}
                    onChange={(event) => updateColumnFilter('callingRemark', event.target.value)}
                    className="w-[170px] rounded-lg border border-slate-300 px-2 py-1"
                  >
                    <option value="">All</option>
                    {activeRemarkConfig.callingRemarks.map((remark) => (
                      <option key={remark} value={remark}>
                        {remark}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="px-3 py-2">
                  <select
                    value={columnFilters.interestedRemark || ''}
                    onChange={(event) => updateColumnFilter('interestedRemark', event.target.value)}
                    className="w-[170px] rounded-lg border border-slate-300 px-2 py-1"
                  >
                    <option value="">All</option>
                    {activeRemarkConfig.interestedRemarks.map((remark) => (
                      <option key={remark} value={remark}>
                        {remark}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="px-3 py-2">
                  <select
                    value={columnFilters.notInterestedRemark || ''}
                    onChange={(event) => updateColumnFilter('notInterestedRemark', event.target.value)}
                    className="w-[180px] rounded-lg border border-slate-300 px-2 py-1"
                  >
                    <option value="">All</option>
                    {activeRemarkConfig.notInterestedRemarks.map((remark) => (
                      <option key={remark} value={remark}>
                        {remark}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="px-3 py-2" />
                <th className="px-3 py-2">
                  <select
                    value={columnFilters.status || ''}
                    onChange={(event) => updateColumnFilter('status', event.target.value)}
                    className="w-[140px] rounded-lg border border-slate-300 px-2 py-1"
                  >
                    <option value="">All</option>
                    <option value="submitted">Submitted</option>
                    <option value="activated">Activated</option>
                  </select>
                </th>
                <th className="px-3 py-2" />
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredAssignments.map((assignment) => {
                const lead = assignment.lead || {};
                const remarks = assignment.remarkConfig || DEFAULT_REMARK_CONFIG;

                return (
                  <tr key={assignment._id}>
                    <td className="sticky left-0 z-20 border-r border-slate-200 bg-white px-3 py-2 font-medium text-slate-900 shadow-[6px_0_8px_-8px_rgba(15,23,42,0.28)]">
                      <button
                        type="button"
                        onClick={() => handleCopyContact(lead.rawData?.[contactHeader] || lead.contactNumber)}
                        className="rounded px-1 py-0.5 text-left text-indigo-700 hover:bg-indigo-50 hover:text-indigo-900"
                        title="Click to copy number"
                      >
                        {formatContactDisplay(lead.rawData?.[contactHeader] || lead.contactNumber)}
                        {copiedContact === formatContactDisplay(lead.rawData?.[contactHeader] || lead.contactNumber)
                          ? ' copied'
                          : ''}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{assignment.product?.toUpperCase() || '—'}</td>
                    {visibleReadOnlyHeaders.map((header) => (
                      <td key={`${assignment._id}-${header}`} className="px-3 py-2 text-slate-600">
                        {lead.rawData?.[header] || '—'}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      {isManagedView ? (
                        renderManagedFieldHistory(
                          assignment,
                          'contactabilityStatus',
                          assignment.contactabilityStatus
                        )
                      ) : (
                        <select
                          value={assignment.contactabilityStatus || ''}
                          onChange={(event) =>
                            handleFieldChange(assignment._id, 'contactabilityStatus', event.target.value)
                          }
                          className="w-[170px] rounded-lg border border-slate-300 px-2 py-1"
                        >
                          <option value="">Select</option>
                          {(remarks.contactabilityStatuses || []).map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isManagedView ? (
                        renderManagedFieldHistory(assignment, 'callAttempt1Date', assignment.callAttempt1Date)
                      ) : (
                        <div className="flex min-w-[220px] gap-2">
                          <input
                            type="date"
                            value={splitAttemptValue(assignment.callAttempt1Date).date}
                            onChange={(event) => handleAttemptChange(assignment, 'callAttempt1Date', 'date', event.target.value)}
                            className="w-[135px] rounded-lg border border-slate-300 px-2 py-1"
                          />
                          <input
                            type="time"
                            value={splitAttemptValue(assignment.callAttempt1Date).time}
                            onChange={(event) => handleAttemptChange(assignment, 'callAttempt1Date', 'time', event.target.value)}
                            className="w-[95px] rounded-lg border border-slate-300 px-2 py-1"
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isManagedView ? (
                        renderManagedFieldHistory(assignment, 'callAttempt2Date', assignment.callAttempt2Date)
                      ) : (
                        <div className="flex min-w-[220px] gap-2">
                          <input
                            type="date"
                            value={splitAttemptValue(assignment.callAttempt2Date).date}
                            onChange={(event) => handleAttemptChange(assignment, 'callAttempt2Date', 'date', event.target.value)}
                            className="w-[135px] rounded-lg border border-slate-300 px-2 py-1"
                          />
                          <input
                            type="time"
                            value={splitAttemptValue(assignment.callAttempt2Date).time}
                            onChange={(event) => handleAttemptChange(assignment, 'callAttempt2Date', 'time', event.target.value)}
                            className="w-[95px] rounded-lg border border-slate-300 px-2 py-1"
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isManagedView ? (
                        renderManagedFieldHistory(assignment, 'callingRemark', assignment.callingRemark)
                      ) : (
                        <select
                          value={assignment.callingRemark || ''}
                          onChange={(event) => handleFieldChange(assignment._id, 'callingRemark', event.target.value)}
                          className="w-[180px] rounded-lg border border-slate-300 px-2 py-1"
                        >
                          <option value="">Select</option>
                          {remarks.callingRemarks.map((remark) => (
                            <option key={remark} value={remark}>
                              {remark}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isManagedView ? (
                        renderManagedFieldHistory(assignment, 'interestedRemark', assignment.interestedRemark)
                      ) : (
                        <select
                          value={assignment.interestedRemark || ''}
                          onChange={(event) => handleFieldChange(assignment._id, 'interestedRemark', event.target.value)}
                          className="w-[180px] rounded-lg border border-slate-300 px-2 py-1"
                        >
                          <option value="">Select</option>
                          {remarks.interestedRemarks.map((remark) => (
                            <option key={remark} value={remark}>
                              {remark}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isManagedView ? (
                        renderManagedFieldHistory(assignment, 'notInterestedRemark', assignment.notInterestedRemark)
                      ) : (
                        <select
                          value={assignment.notInterestedRemark || ''}
                          onChange={(event) =>
                            handleFieldChange(assignment._id, 'notInterestedRemark', event.target.value)
                          }
                          className="w-[200px] rounded-lg border border-slate-300 px-2 py-1"
                        >
                          <option value="">Select</option>
                          {remarks.notInterestedRemarks.map((remark) => (
                            <option key={remark} value={remark}>
                              {remark}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isManagedView ? (
                        renderManagedFieldHistory(assignment, 'agentNotes', assignment.agentNotes)
                      ) : (
                        <input
                          type="text"
                          value={assignment.agentNotes || ''}
                          onChange={(event) => handleFieldChange(assignment._id, 'agentNotes', event.target.value)}
                          className="w-[220px] rounded-lg border border-slate-300 px-2 py-1"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isManagedView ? (
                        renderManagedFieldHistory(assignment, 'status', assignment.status)
                      ) : (
                        <select
                          value={assignment.status || ''}
                          onChange={(event) => handleFieldChange(assignment._id, 'status', event.target.value)}
                          className="w-[140px] rounded-lg border border-slate-300 px-2 py-1"
                        >
                          <option value="">Select</option>
                          <option value="submitted">Submitted</option>
                          <option value="activated">Activated</option>
                        </select>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isManagedView ? (
                        renderManagedFieldHistory(
                          assignment,
                          'pipeline',
                          assignment.inPipeline
                            ? `In Pipeline${assignment.pipelineFollowUpDate ? ` - ${assignment.pipelineFollowUpDate}` : ''}`
                            : assignment.pipelineFollowUpDate || 'Not In Pipeline'
                        )
                      ) : (
                        <div className="flex min-w-[220px] gap-2">
                          <input
                            type="date"
                            value={assignment.pipelineFollowUpDate || ''}
                            onChange={(event) =>
                              handleFieldChange(assignment._id, 'pipelineFollowUpDate', event.target.value)
                            }
                            className="w-[145px] rounded-lg border border-slate-300 px-2 py-1"
                          />
                          <button
                            type="button"
                            onClick={() => openPipelineDraft(assignment)}
                            className={`rounded-lg px-3 py-1 text-xs font-medium text-white ${
                              assignment.inPipeline ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
                            }`}
                          >
                            {assignment.inPipeline ? 'Added' : 'Add'}
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {!isManagedView && saveState[assignment._id] === 'saving' && 'Saving...'}
                      {!isManagedView && saveState[assignment._id] === 'saved' && 'Saved'}
                      {!isManagedView && saveState[assignment._id] === 'error' && 'Error'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {!isManagedView && totalPages > 1 && (
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
