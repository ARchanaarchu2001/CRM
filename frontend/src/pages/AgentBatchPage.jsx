import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchMyAssignmentBatches,
  fetchMyAssignments,
  hideAssignmentBatch,
  updateAssignment,
} from '../api/leads.js';
import { formatContactDisplay } from '../utils/contactNumber.js';

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

const AgentBatchPage = () => {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    product: '',
    status: '',
    search: '',
  });
  const [batches, setBatches] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [message, setMessage] = useState('');
  const [saveState, setSaveState] = useState({});
  const [copiedContact, setCopiedContact] = useState('');
  const timersRef = useRef(new Map());

  const loadBatches = async () => {
    const data = await fetchMyAssignmentBatches();
    setBatches(data.batches || []);
  };

  const loadAssignments = async (nextFilters = filters) => {
    if (!batchId) {
      setAssignments([]);
      return;
    }

    const data = await fetchMyAssignments({
      importBatchId: batchId,
      ...nextFilters,
    });
    setAssignments(data.assignments || []);
  };

  useEffect(() => {
    loadBatches();
  }, [batchId]);

  useEffect(() => {
    loadAssignments(filters);
  }, [batchId]);

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

  const queueAutosave = (assignment) => {
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
        setMessage(error.response?.data?.message || 'Could not save one of the rows');
      }
    }, AUTOSAVE_DELAY_MS);

    timersRef.current.set(assignment._id, timer);
  };

  const handleFieldChange = (assignmentId, field, value) => {
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

  const handleFilter = async (event) => {
    event.preventDefault();
    await loadAssignments(filters);
  };

  const handleHideBatch = async () => {
    if (!batchId) {
      return;
    }

    await hideAssignmentBatch(batchId);
    navigate('/agent-dash');
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

  const moveToPipeline = (assignment) => {
    if (!assignment.pipelineFollowUpDate) {
      setMessage('Choose a follow-up date before adding the row to pipeline.');
      return;
    }

    handleFieldChange(assignment._id, 'inPipeline', true);
    handleFieldChange(
      assignment._id,
      'status',
      assignment.status === 'completed' ? assignment.status : 'follow_up'
    );
    setMessage('Added to pipeline.');
  };

  const handleAttemptChange = (assignment, field, part, value) => {
    const currentParts = splitAttemptValue(assignment[field]);
    const nextDate = part === 'date' ? value : currentParts.date;
    const nextTime = part === 'time' ? value : currentParts.time;
    handleFieldChange(assignment._id, field, buildAttemptValue(nextDate, nextTime));
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{selectedBatch?.batchName || 'Agent Batch'}</h2>
            <p className="mt-2 text-sm text-slate-600">
              Contact number stays fixed on the left. Source data comes next. Your editable calling fields stay on the right.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate('/agent-dash')}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back To Batches
            </button>
            <button
              type="button"
              onClick={handleHideBatch}
              className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Hide This Batch
            </button>
          </div>
        </div>

        <form onSubmit={handleFilter} className="mt-5 flex flex-wrap gap-3">
          <label className="text-sm font-medium text-slate-700">
            Product
            <input
              type="text"
              value={filters.product}
              onChange={(event) => setFilters((current) => ({ ...current, product: event.target.value }))}
              placeholder="p2p, mnp..."
              className="mt-1 rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Status
            <select
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
              className="mt-1 rounded-xl border border-slate-300 px-3 py-2"
            >
              <option value="">All</option>
              <option value="new">New</option>
              <option value="in_progress">In progress</option>
              <option value="follow_up">Follow up</option>
              <option value="completed">Completed</option>
            </select>
          </label>

          <label className="min-w-[220px] flex-1 text-sm font-medium text-slate-700">
            Search
            <input
              type="text"
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Search contact or name"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>

          <button
            type="submit"
            className="self-end rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Apply Filters
          </button>
        </form>

        {selectedBatch && (
          <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Working batch: <strong>{selectedBatch.batchName}</strong> ({selectedBatch.totalRows} rows)
          </div>
        )}

        {message && <p className="mt-4 text-sm text-slate-600">{message}</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-auto">
          <table className="min-w-[1600px] divide-y divide-slate-200 text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100">
              <tr>
                <th className="sticky left-0 z-30 border-r border-slate-200 bg-slate-100 px-3 py-3 text-left font-semibold text-slate-700 shadow-[6px_0_8px_-8px_rgba(15,23,42,0.28)]">
                  {contactHeader}
                </th>
                {visibleReadOnlyHeaders.map((header) => (
                  <th key={header} className="px-3 py-3 text-left font-semibold text-slate-700">
                    {header}
                  </th>
                ))}
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Contactability Status</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">{activeRemarkConfig.callAttempt1Label}</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">{activeRemarkConfig.callAttempt2Label}</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">{activeRemarkConfig.callingRemarkLabel}</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">{activeRemarkConfig.interestedRemarkLabel}</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">{activeRemarkConfig.notInterestedRemarkLabel}</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Agent Notes</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Status</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Pipeline</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Save State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {assignments.map((assignment) => {
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
                    {visibleReadOnlyHeaders.map((header) => (
                      <td key={`${assignment._id}-${header}`} className="px-3 py-2 text-slate-600">
                        {lead.rawData?.[header] || '—'}
                      </td>
                    ))}
                    <td className="px-3 py-2">
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
                    </td>
                    <td className="px-3 py-2">
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
                    </td>
                    <td className="px-3 py-2">
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
                    </td>
                    <td className="px-3 py-2">
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
                    </td>
                    <td className="px-3 py-2">
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
                    </td>
                    <td className="px-3 py-2">
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
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={assignment.agentNotes || ''}
                        onChange={(event) => handleFieldChange(assignment._id, 'agentNotes', event.target.value)}
                        className="w-[220px] rounded-lg border border-slate-300 px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={assignment.status || 'new'}
                        onChange={(event) => handleFieldChange(assignment._id, 'status', event.target.value)}
                        className="w-[140px] rounded-lg border border-slate-300 px-2 py-1"
                      >
                        <option value="new">New</option>
                        <option value="in_progress">In progress</option>
                        <option value="follow_up">Follow up</option>
                        <option value="completed">Completed</option>
                        </select>
                    </td>
                    <td className="px-3 py-2">
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
                          onClick={() => moveToPipeline(assignment)}
                          className={`rounded-lg px-3 py-1 text-xs font-medium text-white ${
                            assignment.inPipeline ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
                          }`}
                        >
                          {assignment.inPipeline ? 'Added' : 'Add'}
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {saveState[assignment._id] === 'saving' && 'Saving...'}
                      {saveState[assignment._id] === 'saved' && 'Saved'}
                      {saveState[assignment._id] === 'error' && 'Error'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default AgentBatchPage;
