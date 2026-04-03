import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchManagedAgentQueueView, fetchMyAssignments, updateAssignment } from '../api/leads.js';
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
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-auto">
          <table className="min-w-[2050px] divide-y divide-slate-200 text-sm">
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
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Pipeline</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Save State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {visibleAssignments.map((assignment) => {
                const lead = assignment.lead || {};
                const remarks = assignment.remarkConfig || persistedRemarkConfig || DEFAULT_REMARK_CONFIG;
                const isCopiedRow = copiedRowId === assignment._id;
                const isCalledRow = isCalledAssignment(assignment);
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
                    <td className={`sticky left-0 z-20 border-r border-slate-300 px-3 py-2 font-medium text-slate-900 shadow-[8px_0_12px_-10px_rgba(15,23,42,0.34)] ${isCopiedRow ? 'bg-amber-50' : isCalledRow ? 'bg-emerald-50' : 'bg-white'}`}>
                      <button
                        type="button"
                        onClick={() => handleCopyContact(assignment._id, lead.rawData?.[contactHeader] || lead.contactNumber)}
                        className="flex items-center gap-2 rounded px-1 py-0.5 text-left text-indigo-700 hover:bg-indigo-50 hover:text-indigo-900"
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
                    <td className="px-3 py-2 text-slate-700">{assignment.product?.toUpperCase() || '—'}</td>
                    <td className="px-3 py-2 text-slate-700">{assignment.batchName}</td>
                    {visibleReadOnlyHeaders.map((header) => (
                      <td key={`${assignment._id}-${header}`} className="px-3 py-2 text-slate-600">
                        {lead.rawData?.[header] || '—'}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <select disabled={isManagedView} value={assignment.contactabilityStatus || ''} onChange={(e) => handleFieldChange(assignment._id, 'contactabilityStatus', e.target.value)} className="w-[170px] rounded-lg border border-slate-300 px-2 py-1 disabled:bg-slate-50 disabled:text-slate-500">
                        <option value="">Select</option>
                        {(remarks.contactabilityStatuses || []).map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex min-w-[220px] gap-2">
                        <input disabled={isManagedView} type="date" value={splitAttemptValue(assignment.callAttempt1Date).date} onChange={(e) => handleAttemptChange(assignment, 'callAttempt1Date', 'date', e.target.value)} className="w-[135px] rounded-lg border border-slate-300 px-2 py-1 disabled:bg-slate-50 disabled:text-slate-500" />
                        <input disabled={isManagedView} type="time" value={splitAttemptValue(assignment.callAttempt1Date).time} onChange={(e) => handleAttemptChange(assignment, 'callAttempt1Date', 'time', e.target.value)} className="w-[95px] rounded-lg border border-slate-300 px-2 py-1 disabled:bg-slate-50 disabled:text-slate-500" />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex min-w-[220px] gap-2">
                        <input disabled={isManagedView} type="date" value={splitAttemptValue(assignment.callAttempt2Date).date} onChange={(e) => handleAttemptChange(assignment, 'callAttempt2Date', 'date', e.target.value)} className="w-[135px] rounded-lg border border-slate-300 px-2 py-1 disabled:bg-slate-50 disabled:text-slate-500" />
                        <input disabled={isManagedView} type="time" value={splitAttemptValue(assignment.callAttempt2Date).time} onChange={(e) => handleAttemptChange(assignment, 'callAttempt2Date', 'time', e.target.value)} className="w-[95px] rounded-lg border border-slate-300 px-2 py-1 disabled:bg-slate-50 disabled:text-slate-500" />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <select disabled={isManagedView} value={assignment.callingRemark || ''} onChange={(e) => handleFieldChange(assignment._id, 'callingRemark', e.target.value)} className={`w-[180px] rounded-lg border px-2 py-1 font-medium disabled:bg-slate-50 disabled:text-slate-500 ${getRemarkValueClasses('callingRemark', assignment.callingRemark)}`}>
                        <option value="">Select</option>
                        {remarks.callingRemarks.map((remark) => <option key={remark} value={remark}>{remark}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select disabled={isManagedView} value={assignment.interestedRemark || ''} onChange={(e) => handleFieldChange(assignment._id, 'interestedRemark', e.target.value)} className={`w-[180px] rounded-lg border px-2 py-1 font-medium disabled:bg-slate-50 disabled:text-slate-500 ${getRemarkValueClasses('interestedRemark', assignment.interestedRemark)}`}>
                        <option value="">Select</option>
                        {remarks.interestedRemarks.map((remark) => <option key={remark} value={remark}>{remark}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select disabled={isManagedView} value={assignment.notInterestedRemark || ''} onChange={(e) => handleFieldChange(assignment._id, 'notInterestedRemark', e.target.value)} className={`w-[200px] rounded-lg border px-2 py-1 font-medium disabled:bg-slate-50 disabled:text-slate-500 ${getRemarkValueClasses('notInterestedRemark', assignment.notInterestedRemark)}`}>
                        <option value="">Select</option>
                        {remarks.notInterestedRemarks.map((remark) => <option key={remark} value={remark}>{remark}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input disabled={isManagedView} type="text" value={assignment.agentNotes || ''} onChange={(e) => handleFieldChange(assignment._id, 'agentNotes', e.target.value)} className="w-[220px] rounded-lg border border-slate-300 px-2 py-1 disabled:bg-slate-50 disabled:text-slate-500" />
                    </td>
                    <td className="px-3 py-2">
                      <select disabled={isManagedView} value={assignment.status || ''} onChange={(e) => handleFieldChange(assignment._id, 'status', e.target.value)} className="w-[140px] rounded-lg border border-slate-300 px-2 py-1 disabled:bg-slate-50 disabled:text-slate-500">
                        <option value="">Select</option>
                        <option value="submitted">Submitted</option>
                        <option value="activated">Activated</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      {isManagedView ? (
                        <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
                          {assignment.inPipeline ? 'In Pipeline' : 'Not Added'}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openPipelineDraft(assignment)}
                          className="rounded-xl border border-amber-200 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50"
                        >
                          {assignment.inPipeline ? 'Added' : 'Add'}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {!isManagedView && saveState[assignment._id] === 'saving' && 'Saving...'}
                      {!isManagedView && saveState[assignment._id] === 'saved' && 'Saved'}
                      {!isManagedView && saveState[assignment._id] === 'error' && 'Error'}
                      {isManagedView && 'Read only'}
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
