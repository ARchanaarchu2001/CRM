import React, { useEffect, useMemo, useRef, useState } from 'react';
import { updateAssignment, fetchMyPipelineAssignments } from '../api/leads.js';
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

const AgentPipelinePage = () => {
  const [assignments, setAssignments] = useState([]);
  const [summary, setSummary] = useState({ dueTodayCount: 0, overdueCount: 0 });
  const [message, setMessage] = useState('');
  const [copiedContact, setCopiedContact] = useState('');
  const [saveState, setSaveState] = useState({});
  const timersRef = useRef(new Map());

  const loadPipeline = async () => {
    const data = await fetchMyPipelineAssignments();
    setAssignments(data.assignments || []);
    setSummary({
      dueTodayCount: data.dueTodayCount || 0,
      overdueCount: data.overdueCount || 0,
    });
  };

  useEffect(() => {
    loadPipeline();
  }, []);

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

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
          inPipeline: assignment.inPipeline,
          pipelineFollowUpDate: assignment.pipelineFollowUpDate,
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

  const removeFromPipeline = (assignment) => {
    handleFieldChange(assignment._id, 'inPipeline', false);
    handleFieldChange(assignment._id, 'pipelineFollowUpDate', '');
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Pipeline</h2>
        <p className="mt-2 text-sm text-slate-600">
          Move rows here for planned follow-up. Due-today and overdue rows act as your in-app notification list.
        </p>

        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-800">{summary.dueTodayCount} due today</div>
          <div className="rounded-2xl bg-rose-50 px-4 py-3 text-rose-800">{summary.overdueCount} overdue</div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-slate-700">{assignments.length} total in pipeline</div>
        </div>

        {message && <p className="mt-4 text-sm text-slate-600">{message}</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-auto">
          <table className="min-w-[1850px] divide-y divide-slate-200 text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100">
              <tr>
                <th className="sticky left-0 z-30 border-r border-slate-200 bg-slate-100 px-3 py-3 text-left font-semibold text-slate-700 shadow-[6px_0_8px_-8px_rgba(15,23,42,0.28)]">
                  {contactHeader}
                </th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Batch</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Follow-up Date</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Pipeline Notes</th>
                {visibleReadOnlyHeaders.map((header) => (
                  <th key={header} className="px-3 py-3 text-left font-semibold text-slate-700">
                    {header}
                  </th>
                ))}
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Contactability Status</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Call Attempt 1 - Date</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Call Attempt 2 - Date</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Calling Remarks</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Interested Remarks</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Not Interested Remarks</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Agent Notes</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Status</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {assignments.map((assignment) => {
                const lead = assignment.lead || {};
                const remarks = assignment.remarkConfig || DEFAULT_REMARK_CONFIG;
                const rowTone = assignment.isOverdue ? 'bg-rose-50' : assignment.isDueToday ? 'bg-amber-50' : '';

                return (
                  <tr key={assignment._id} className={rowTone}>
                    <td className="sticky left-0 z-20 border-r border-slate-200 bg-white px-3 py-2 font-medium text-slate-900 shadow-[6px_0_8px_-8px_rgba(15,23,42,0.28)]">
                      <button
                        type="button"
                        onClick={() => handleCopyContact(lead.rawData?.[contactHeader] || lead.contactNumber)}
                        className="rounded px-1 py-0.5 text-left text-indigo-700 hover:bg-indigo-50 hover:text-indigo-900"
                      >
                        {formatContactDisplay(lead.rawData?.[contactHeader] || lead.contactNumber)}
                        {copiedContact === formatContactDisplay(lead.rawData?.[contactHeader] || lead.contactNumber)
                          ? ' copied'
                          : ''}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{assignment.batchName}</td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={assignment.pipelineFollowUpDate || ''}
                        onChange={(event) => handleFieldChange(assignment._id, 'pipelineFollowUpDate', event.target.value)}
                        className="w-[145px] rounded-lg border border-slate-300 px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={assignment.pipelineNotes || ''}
                        onChange={(event) => handleFieldChange(assignment._id, 'pipelineNotes', event.target.value)}
                        className="w-[180px] rounded-lg border border-slate-300 px-2 py-1"
                      />
                    </td>
                    {visibleReadOnlyHeaders.map((header) => (
                      <td key={`${assignment._id}-${header}`} className="px-3 py-2 text-slate-600">
                        {lead.rawData?.[header] || '—'}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <select
                        value={assignment.contactabilityStatus || ''}
                        onChange={(event) => handleFieldChange(assignment._id, 'contactabilityStatus', event.target.value)}
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
                        onChange={(event) => handleFieldChange(assignment._id, 'notInterestedRemark', event.target.value)}
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
                      <button
                        type="button"
                        onClick={() => removeFromPipeline(assignment)}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Return To Batch
                      </button>
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

export default AgentPipelinePage;
