import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchMyAssignments, updateAssignment } from '../api/leads.js';
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
  const { queueType } = useParams();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [message, setMessage] = useState('');
  const [saveState, setSaveState] = useState({});
  const [copiedContact, setCopiedContact] = useState('');
  const timersRef = useRef(new Map());

  const loadAssignments = async () => {
    const data = await fetchMyAssignments();
    setAssignments(data.assignments || []);
  };

  useEffect(() => {
    loadAssignments();
  }, [queueType]);

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  const visibleAssignments = useMemo(
    () => assignments.filter((assignment) => matchesQueueType(assignment, queueType)),
    [assignments, queueType]
  );

  const readOnlyHeaders = useMemo(() => {
    const keys = new Set();
    visibleAssignments.forEach((assignment) => {
      Object.keys(assignment.lead?.rawData || {}).forEach((key) => keys.add(key));
    });
    return Array.from(keys);
  }, [visibleAssignments]);

  const contactHeader = visibleAssignments[0]?.lead?.contactColumn || 'Contact';
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
        setMessage(error.response?.data?.message || 'Could not save queue row');
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
    if (!contactValue) return;

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

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{getQueueLabel(queueType)}</h2>
            <p className="mt-2 text-sm text-slate-600">
              Work this queue across all products and datasets, then update remarks directly from here.
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
        </div>

        {message && <p className="mt-4 text-sm text-slate-600">{message}</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-auto">
          <table className="min-w-[1900px] divide-y divide-slate-200 text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100">
              <tr>
                <th className="sticky left-0 z-30 border-r border-slate-200 bg-slate-100 px-3 py-3 text-left font-semibold text-slate-700 shadow-[6px_0_8px_-8px_rgba(15,23,42,0.28)]">
                  {contactHeader}
                </th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Product</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Dataset</th>
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
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Save State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {visibleAssignments.map((assignment) => {
                const lead = assignment.lead || {};
                const remarks = assignment.remarkConfig || DEFAULT_REMARK_CONFIG;
                return (
                  <tr key={assignment._id}>
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
                    <td className="px-3 py-2 text-slate-700">{assignment.product?.toUpperCase() || '—'}</td>
                    <td className="px-3 py-2 text-slate-700">{assignment.batchName}</td>
                    {visibleReadOnlyHeaders.map((header) => (
                      <td key={`${assignment._id}-${header}`} className="px-3 py-2 text-slate-600">
                        {lead.rawData?.[header] || '—'}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <select value={assignment.contactabilityStatus || ''} onChange={(e) => handleFieldChange(assignment._id, 'contactabilityStatus', e.target.value)} className="w-[170px] rounded-lg border border-slate-300 px-2 py-1">
                        <option value="">Select</option>
                        {(remarks.contactabilityStatuses || []).map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex min-w-[220px] gap-2">
                        <input type="date" value={splitAttemptValue(assignment.callAttempt1Date).date} onChange={(e) => handleAttemptChange(assignment, 'callAttempt1Date', 'date', e.target.value)} className="w-[135px] rounded-lg border border-slate-300 px-2 py-1" />
                        <input type="time" value={splitAttemptValue(assignment.callAttempt1Date).time} onChange={(e) => handleAttemptChange(assignment, 'callAttempt1Date', 'time', e.target.value)} className="w-[95px] rounded-lg border border-slate-300 px-2 py-1" />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex min-w-[220px] gap-2">
                        <input type="date" value={splitAttemptValue(assignment.callAttempt2Date).date} onChange={(e) => handleAttemptChange(assignment, 'callAttempt2Date', 'date', e.target.value)} className="w-[135px] rounded-lg border border-slate-300 px-2 py-1" />
                        <input type="time" value={splitAttemptValue(assignment.callAttempt2Date).time} onChange={(e) => handleAttemptChange(assignment, 'callAttempt2Date', 'time', e.target.value)} className="w-[95px] rounded-lg border border-slate-300 px-2 py-1" />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <select value={assignment.callingRemark || ''} onChange={(e) => handleFieldChange(assignment._id, 'callingRemark', e.target.value)} className="w-[180px] rounded-lg border border-slate-300 px-2 py-1">
                        <option value="">Select</option>
                        {remarks.callingRemarks.map((remark) => <option key={remark} value={remark}>{remark}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select value={assignment.interestedRemark || ''} onChange={(e) => handleFieldChange(assignment._id, 'interestedRemark', e.target.value)} className="w-[180px] rounded-lg border border-slate-300 px-2 py-1">
                        <option value="">Select</option>
                        {remarks.interestedRemarks.map((remark) => <option key={remark} value={remark}>{remark}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select value={assignment.notInterestedRemark || ''} onChange={(e) => handleFieldChange(assignment._id, 'notInterestedRemark', e.target.value)} className="w-[200px] rounded-lg border border-slate-300 px-2 py-1">
                        <option value="">Select</option>
                        {remarks.notInterestedRemarks.map((remark) => <option key={remark} value={remark}>{remark}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" value={assignment.agentNotes || ''} onChange={(e) => handleFieldChange(assignment._id, 'agentNotes', e.target.value)} className="w-[220px] rounded-lg border border-slate-300 px-2 py-1" />
                    </td>
                    <td className="px-3 py-2">
                      <select value={assignment.status || ''} onChange={(e) => handleFieldChange(assignment._id, 'status', e.target.value)} className="w-[140px] rounded-lg border border-slate-300 px-2 py-1">
                        <option value="">Select</option>
                        <option value="submitted">Submitted</option>
                        <option value="activated">Activated</option>
                      </select>
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

export default AgentQueuePage;
