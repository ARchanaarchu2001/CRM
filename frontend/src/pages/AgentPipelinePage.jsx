import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateAssignment, fetchManagedAgentPipelineView, fetchMyPipelineAssignments } from '../api/leads.js';
import { formatContactDisplay } from '../utils/contactNumber.js';
import { useParams } from 'react-router-dom';

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

const normalizeSortValue = (value) => String(value || '').toLowerCase();

const AgentPipelinePage = () => {
  const { agentId } = useParams();
  const isManagedView = Boolean(agentId);
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [summary, setSummary] = useState({ dueTodayCount: 0, overdueCount: 0 });
  const [message, setMessage] = useState('');
  const [copiedContact, setCopiedContact] = useState('');
  const [saveState, setSaveState] = useState({});
  const [removingIds, setRemovingIds] = useState({});
  const [viewFilter, setViewFilter] = useState('all');
  const [columnFilters, setColumnFilters] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: 'pipelineFollowUpDate', direction: 'asc' });
  const timersRef = useRef(new Map());

  const loadPipeline = async () => {
    if (isManagedView) {
      const data = await fetchManagedAgentPipelineView(agentId);
      setAssignments(data.view?.assignments || []);
      setSummary({
        dueTodayCount: data.view?.dueTodayCount || 0,
        overdueCount: data.view?.overdueCount || 0,
      });
      return;
    }

    const data = await fetchMyPipelineAssignments();
    setAssignments(data.assignments || []);
    setSummary({
      dueTodayCount: data.dueTodayCount || 0,
      overdueCount: data.overdueCount || 0,
    });
  };

  useEffect(() => {
    loadPipeline();
  }, [agentId]);

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  const filteredAssignments = useMemo(() => {
    const filtered = assignments.filter((assignment) => {
      if (viewFilter === 'due_today' && !assignment.isDueToday) {
        return false;
      }

      if (viewFilter === 'overdue' && !assignment.isOverdue) {
        return false;
      }

      const checks = [
        ['contact', assignment.pipelineDisplayContact || assignment.lead?.contactNumber],
        ['name', assignment.pipelineDisplayName],
        ['batch', assignment.batchName],
        ['product', assignment.product],
        ['pipelineNotes', assignment.pipelineNotes],
        ['contactabilityStatus', assignment.contactabilityStatus],
        ['callingRemark', assignment.callingRemark],
        ['interestedRemark', assignment.interestedRemark],
        ['notInterestedRemark', assignment.notInterestedRemark],
        ['status', assignment.status],
      ];

      return checks.every(([key, value]) => {
        const filterValue = String(columnFilters[key] || '').trim().toLowerCase();
        if (!filterValue) {
          return true;
        }
        return String(value || '').toLowerCase().includes(filterValue);
      });
    });

    return [...filtered].sort((left, right) => {
      const readValue = (row) => row[sortConfig.key] || '';
      if (sortConfig.key === 'contact') return sortConfig.direction === 'asc'
        ? normalizeSortValue(left.pipelineDisplayContact).localeCompare(normalizeSortValue(right.pipelineDisplayContact))
        : normalizeSortValue(right.pipelineDisplayContact).localeCompare(normalizeSortValue(left.pipelineDisplayContact));
      const leftValue = normalizeSortValue(readValue(left));
      const rightValue = normalizeSortValue(readValue(right));
      return sortConfig.direction === 'asc'
        ? leftValue.localeCompare(rightValue)
        : rightValue.localeCompare(leftValue);
    });
  }, [assignments, columnFilters, sortConfig, viewFilter]);

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
        setMessage(error.response?.data?.message || 'Could not save pipeline row');
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

  const handleAttemptChange = (assignment, field, part, value) => {
    if (isManagedView) {
      return;
    }

    const currentParts = splitAttemptValue(assignment[field]);
    const nextDate = part === 'date' ? value : currentParts.date;
    const nextTime = part === 'time' ? value : currentParts.time;
    handleFieldChange(assignment._id, field, buildAttemptValue(nextDate, nextTime));
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
    } catch {
      setMessage('Could not copy contact number');
    }
  };

  const removeFromPipeline = async (assignment) => {
    const existingTimer = timersRef.current.get(assignment._id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      timersRef.current.delete(assignment._id);
    }

    setRemovingIds((current) => ({
      ...current,
      [assignment._id]: true,
    }));

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
        inPipeline: false,
        pipelineFollowUpDate: '',
        pipelineNameColumn: assignment.pipelineNameColumn,
        pipelineContactColumn: assignment.pipelineContactColumn,
        pipelineDisplayName: assignment.pipelineDisplayName,
        pipelineDisplayContact: assignment.pipelineDisplayContact,
        pipelineNotes: assignment.pipelineNotes,
      });

      setAssignments((current) =>
        current.filter((item) => item._id !== assignment._id)
      );
      setSummary((current) => ({
        dueTodayCount:
          assignment.isDueToday && current.dueTodayCount > 0
            ? current.dueTodayCount - 1
            : current.dueTodayCount,
        overdueCount:
          assignment.isOverdue && current.overdueCount > 0
            ? current.overdueCount - 1
            : current.overdueCount,
      }));
      setSaveState((current) => {
        const nextState = { ...current };
        delete nextState[assignment._id];
        return nextState;
      });
      setMessage('Removed from pipeline');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not remove pipeline row');
    } finally {
      setRemovingIds((current) => {
        const nextState = { ...current };
        delete nextState[assignment._id];
        return nextState;
      });
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Pipeline</h2>
            <p className="mt-2 text-sm text-slate-600">
              {isManagedView
                ? 'This is the actual agent pipeline in read-only mode. Team Leads can inspect it but cannot edit any row.'
                : 'Move rows here for planned follow-up. Due-today and overdue rows act as your in-app notification list.'}
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
          <button
            type="button"
            onClick={() => setViewFilter('due_today')}
            className={`rounded-2xl px-4 py-3 text-left transition ${viewFilter === 'due_today'
              ? 'bg-amber-200 text-amber-950 ring-2 ring-amber-400'
              : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
          >
            {summary.dueTodayCount} due today
          </button>
          <button
            type="button"
            onClick={() => setViewFilter('overdue')}
            className={`rounded-2xl px-4 py-3 text-left transition ${viewFilter === 'overdue'
              ? 'bg-rose-200 text-rose-950 ring-2 ring-rose-400'
              : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
              }`}
          >
            {summary.overdueCount} overdue
          </button>
          <button
            type="button"
            onClick={() => setViewFilter('all')}
            className={`rounded-2xl px-4 py-3 text-left transition ${viewFilter === 'all'
              ? 'bg-slate-200 text-slate-950 ring-2 ring-slate-400'
              : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
          >
            {assignments.length} total in pipeline
          </button>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-slate-700">
            Showing {filteredAssignments.length} rows
          </div>
        </div>

        {message && <p className="mt-4 text-sm text-slate-600">{message}</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-auto">
          <table className="min-w-[1850px] divide-y divide-slate-200 text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100">
              <tr>
                <th className="sticky left-0 z-30 border-r border-slate-200 bg-slate-100 px-3 py-3 text-left font-semibold text-slate-700 shadow-[6px_0_8px_-8px_rgba(15,23,42,0.28)]">
                  <button type="button" onClick={() => toggleSort('contact')}>Contact No</button>
                </th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700"><button type="button" onClick={() => toggleSort('pipelineDisplayName')}>Name</button></th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700"><button type="button" onClick={() => toggleSort('product')}>Product</button></th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700"><button type="button" onClick={() => toggleSort('batchName')}>Batch</button></th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700"><button type="button" onClick={() => toggleSort('pipelineFollowUpDate')}>Follow-up Date</button></th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700"><button type="button" onClick={() => toggleSort('pipelineNotes')}>Pipeline Notes</button></th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700"><button type="button" onClick={() => toggleSort('contactabilityStatus')}>Contactability Status</button></th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Call Attempt 1 - Date</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Call Attempt 2 - Date</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700"><button type="button" onClick={() => toggleSort('callingRemark')}>Calling Remarks</button></th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700"><button type="button" onClick={() => toggleSort('interestedRemark')}>Interested Remarks</button></th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700"><button type="button" onClick={() => toggleSort('notInterestedRemark')}>Not Interested Remarks</button></th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Agent Notes</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700"><button type="button" onClick={() => toggleSort('status')}>Status</button></th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Actions</th>
              </tr>
              <tr className="bg-white">
                <th className="sticky left-0 z-20 border-r border-slate-200 bg-white px-3 py-2 shadow-[6px_0_8px_-8px_rgba(15,23,42,0.18)]">
                  <input type="text" value={columnFilters.contact || ''} onChange={(e) => updateColumnFilter('contact', e.target.value)} placeholder="Search" className="w-[140px] rounded-lg border border-slate-300 px-2 py-1" />
                </th>
                <th className="px-3 py-2">
                  <input type="text" value={columnFilters.name || ''} onChange={(e) => updateColumnFilter('name', e.target.value)} placeholder="Search" className="w-[140px] rounded-lg border border-slate-300 px-2 py-1" />
                </th>
                <th className="px-3 py-2">
                  <input type="text" value={columnFilters.product || ''} onChange={(e) => updateColumnFilter('product', e.target.value)} placeholder="Filter" className="w-[120px] rounded-lg border border-slate-300 px-2 py-1" />
                </th>
                <th className="px-3 py-2">
                  <input type="text" value={columnFilters.batch || ''} onChange={(e) => updateColumnFilter('batch', e.target.value)} placeholder="Search" className="w-[140px] rounded-lg border border-slate-300 px-2 py-1" />
                </th>
                <th className="px-3 py-2" />
                <th className="px-3 py-2">
                  <input type="text" value={columnFilters.pipelineNotes || ''} onChange={(e) => updateColumnFilter('pipelineNotes', e.target.value)} placeholder="Search" className="w-[150px] rounded-lg border border-slate-300 px-2 py-1" />
                </th>
                <th className="px-3 py-2">
                  <select value={columnFilters.contactabilityStatus || ''} onChange={(e) => updateColumnFilter('contactabilityStatus', e.target.value)} className="w-[160px] rounded-lg border border-slate-300 px-2 py-1">
                    <option value="">All</option>
                    {DEFAULT_REMARK_CONFIG.contactabilityStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </th>
                <th className="px-3 py-2" />
                <th className="px-3 py-2" />
                <th className="px-3 py-2">
                  <input type="text" value={columnFilters.callingRemark || ''} onChange={(e) => updateColumnFilter('callingRemark', e.target.value)} placeholder="Filter" className="w-[150px] rounded-lg border border-slate-300 px-2 py-1" />
                </th>
                <th className="px-3 py-2">
                  <input type="text" value={columnFilters.interestedRemark || ''} onChange={(e) => updateColumnFilter('interestedRemark', e.target.value)} placeholder="Filter" className="w-[150px] rounded-lg border border-slate-300 px-2 py-1" />
                </th>
                <th className="px-3 py-2">
                  <input type="text" value={columnFilters.notInterestedRemark || ''} onChange={(e) => updateColumnFilter('notInterestedRemark', e.target.value)} placeholder="Filter" className="w-[160px] rounded-lg border border-slate-300 px-2 py-1" />
                </th>
                <th className="px-3 py-2" />
                <th className="px-3 py-2">
                  <select value={columnFilters.status || ''} onChange={(e) => updateColumnFilter('status', e.target.value)} className="w-[140px] rounded-lg border border-slate-300 px-2 py-1">
                    <option value="">All</option>
                    <option value="submitted">Submitted</option>
                    <option value="activated">Activated</option>
                  </select>
                </th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredAssignments.map((assignment) => {
                const lead = assignment.lead || {};
                const remarks = assignment.remarkConfig || DEFAULT_REMARK_CONFIG;
                const rowTone = assignment.isOverdue ? 'bg-rose-50' : assignment.isDueToday ? 'bg-amber-50' : '';

                return (
                  <tr key={assignment._id} className={rowTone}>
                    <td className="sticky left-0 z-20 border-r border-slate-200 bg-white px-3 py-2 font-medium text-slate-900 shadow-[6px_0_8px_-8px_rgba(15,23,42,0.28)]">
                      <button
                        type="button"
                        onClick={() => handleCopyContact(assignment.pipelineDisplayContact || lead.contactNumber)}
                        className="rounded px-1 py-0.5 text-left text-indigo-700 hover:bg-indigo-50 hover:text-indigo-900"
                      >
                        {formatContactDisplay(assignment.pipelineDisplayContact || lead.contactNumber)}
                        {copiedContact === formatContactDisplay(assignment.pipelineDisplayContact || lead.contactNumber)
                          ? ' copied'
                          : ''}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{assignment.pipelineDisplayName || '—'}</td>
                    <td className="px-3 py-2 text-slate-700">{assignment.product?.toUpperCase() || '—'}</td>
                    <td className="px-3 py-2 text-slate-700">{assignment.batchName}</td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={assignment.pipelineFollowUpDate || ''}
                        onChange={(event) => handleFieldChange(assignment._id, 'pipelineFollowUpDate', event.target.value)}
                        disabled={isManagedView}
                        className="w-[145px] rounded-lg border border-slate-300 px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={assignment.pipelineNotes || ''}
                        onChange={(event) => handleFieldChange(assignment._id, 'pipelineNotes', event.target.value)}
                        disabled={isManagedView}
                        className="w-[180px] rounded-lg border border-slate-300 px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={assignment.contactabilityStatus || ''}
                        onChange={(event) => handleFieldChange(assignment._id, 'contactabilityStatus', event.target.value)}
                        disabled={isManagedView}
                        className="w-[170px] rounded-lg border border-slate-300 px-2 py-1"
                      >
                        <option value="">Select</option>
                        {(remarks.contactabilityStatuses || []).map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex min-w-[220px] gap-2">
                        <input
                          type="date"
                          value={splitAttemptValue(assignment.callAttempt1Date).date}
                          onChange={(event) => handleAttemptChange(assignment, 'callAttempt1Date', 'date', event.target.value)}
                          disabled={isManagedView}
                          className="w-[135px] rounded-lg border border-slate-300 px-2 py-1"
                        />
                        <input
                          type="time"
                          value={splitAttemptValue(assignment.callAttempt1Date).time}
                          onChange={(event) => handleAttemptChange(assignment, 'callAttempt1Date', 'time', event.target.value)}
                          disabled={isManagedView}
                          className="w-[95px] rounded-lg border border-slate-300 px-2 py-1"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex min-w-[220px] gap-2">
                        <input
                          type="date"
                          value={splitAttemptValue(assignment.callAttempt2Date).date}
                          onChange={(event) => handleAttemptChange(assignment, 'callAttempt2Date', 'date', event.target.value)}
                          disabled={isManagedView}
                          className="w-[135px] rounded-lg border border-slate-300 px-2 py-1"
                        />
                        <input
                          type="time"
                          value={splitAttemptValue(assignment.callAttempt2Date).time}
                          onChange={(event) => handleAttemptChange(assignment, 'callAttempt2Date', 'time', event.target.value)}
                          disabled={isManagedView}
                          className="w-[95px] rounded-lg border border-slate-300 px-2 py-1"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={assignment.callingRemark || ''}
                        onChange={(event) => handleFieldChange(assignment._id, 'callingRemark', event.target.value)}
                        disabled={isManagedView}
                        className="w-[180px] rounded-lg border border-slate-300 px-2 py-1"
                      >
                        <option value="">Select</option>
                        {remarks.callingRemarks.map((remark) => (
                          <option key={remark} value={remark}>
                            {remark}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={assignment.interestedRemark || ''}
                        onChange={(event) => handleFieldChange(assignment._id, 'interestedRemark', event.target.value)}
                        disabled={isManagedView}
                        className="w-[180px] rounded-lg border border-slate-300 px-2 py-1"
                      >
                        <option value="">Select</option>
                        {remarks.interestedRemarks.map((remark) => (
                          <option key={remark} value={remark}>
                            {remark}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={assignment.notInterestedRemark || ''}
                        onChange={(event) => handleFieldChange(assignment._id, 'notInterestedRemark', event.target.value)}
                        disabled={isManagedView}
                        className="w-[200px] rounded-lg border border-slate-300 px-2 py-1"
                      >
                        <option value="">Select</option>
                        {remarks.notInterestedRemarks.map((remark) => (
                          <option key={remark} value={remark}>
                            {remark}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={assignment.agentNotes || ''}
                        onChange={(event) => handleFieldChange(assignment._id, 'agentNotes', event.target.value)}
                        disabled={isManagedView}
                        className="w-[220px] rounded-lg border border-slate-300 px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={assignment.status || ''}
                        onChange={(event) => handleFieldChange(assignment._id, 'status', event.target.value)}
                        disabled={isManagedView}
                        className="w-[140px] rounded-lg border border-slate-300 px-2 py-1"
                      >
                        <option value="">Select</option>
                        <option value="submitted">Submitted</option>
                        <option value="activated">Activated</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => removeFromPipeline(assignment)}
                        disabled={Boolean(removingIds[assignment._id])}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {removingIds[assignment._id] ? 'Removing...' : 'Remove From Pipeline'}
                      </button>
                    </td >
                  </tr >
                );
              })}
            </tbody >
          </table >
        </div >
      </section >
    </div >
  );
};

export default AgentPipelinePage;
