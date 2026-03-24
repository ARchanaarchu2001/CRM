import React, { useEffect, useState } from 'react';
import { fetchMyAssignments, updateAssignment } from '../api/leads.js';

const AgentDashboard = () => {
  const [filters, setFilters] = useState({
    product: '',
    status: '',
    search: '',
  });
  const [assignments, setAssignments] = useState([]);
  const [message, setMessage] = useState('');

  const loadAssignments = async (params = filters) => {
    const data = await fetchMyAssignments(params);
    setAssignments(data.assignments || []);
  };

  useEffect(() => {
    loadAssignments();
  }, []);

  const handleFilter = async (event) => {
    event.preventDefault();
    await loadAssignments(filters);
  };

  const handleFieldChange = (assignmentId, field, value) => {
    setAssignments((current) =>
      current.map((assignment) =>
        assignment._id === assignmentId ? { ...assignment, [field]: value } : assignment
      )
    );
  };

  const handleSave = async (assignment) => {
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
      setMessage(`Saved updates for ${assignment.lead?.contactNumber}`);
      await loadAssignments(filters);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not save assigned lead');
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Agent Calling Board</h2>
        <p className="mt-2 text-sm text-slate-600">
          Use the fixed remark options from the analyst and add your own notes for each assigned lead.
        </p>

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

        {message && <p className="mt-4 text-sm text-slate-600">{message}</p>}
      </section>

      <div className="space-y-5">
        {assignments.map((assignment) => {
          const lead = assignment.lead || {};
          const name = lead.rawData?.NAME || lead.rawData?.Name || lead.rawData?.name || '';
          const remarks = assignment.remarkConfig || {
            callingRemarks: [],
            interestedRemarks: [],
            notInterestedRemarks: [],
          };

          return (
            <section key={assignment._id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{lead.contactNumber}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {name || 'Unnamed lead'} · {assignment.product.toUpperCase()} · Assigned to {assignment.assignedAgentName}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-700">
                  {assignment.status.replace('_', ' ')}
                </span>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <label className="text-sm font-medium text-slate-700">
                  Contactability
                  <select
                    value={assignment.contactabilityStatus || ''}
                    onChange={(event) => handleFieldChange(assignment._id, 'contactabilityStatus', event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="">Select</option>
                    <option value="Reachable">Reachable</option>
                    <option value="Not Reachable">Not Reachable</option>
                  </select>
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Call attempt 1
                  <input
                    type="text"
                    value={assignment.callAttempt1Date || ''}
                    onChange={(event) => handleFieldChange(assignment._id, 'callAttempt1Date', event.target.value)}
                    placeholder="Date or note"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Call attempt 2
                  <input
                    type="text"
                    value={assignment.callAttempt2Date || ''}
                    onChange={(event) => handleFieldChange(assignment._id, 'callAttempt2Date', event.target.value)}
                    placeholder="Date or note"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Calling remark
                  <select
                    value={assignment.callingRemark || ''}
                    onChange={(event) => handleFieldChange(assignment._id, 'callingRemark', event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="">Select</option>
                    {remarks.callingRemarks.map((remark) => (
                      <option key={remark} value={remark}>
                        {remark}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Interested remark
                  <select
                    value={assignment.interestedRemark || ''}
                    onChange={(event) => handleFieldChange(assignment._id, 'interestedRemark', event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="">Select</option>
                    {remarks.interestedRemarks.map((remark) => (
                      <option key={remark} value={remark}>
                        {remark}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Not interested remark
                  <select
                    value={assignment.notInterestedRemark || ''}
                    onChange={(event) =>
                      handleFieldChange(assignment._id, 'notInterestedRemark', event.target.value)
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="">Select</option>
                    {remarks.notInterestedRemarks.map((remark) => (
                      <option key={remark} value={remark}>
                        {remark}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="mt-4 block text-sm font-medium text-slate-700">
                Agent notes
                <textarea
                  rows="3"
                  value={assignment.agentNotes || ''}
                  onChange={(event) => handleFieldChange(assignment._id, 'agentNotes', event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </label>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                <details className="text-sm text-slate-600">
                  <summary className="cursor-pointer font-medium text-slate-800">View raw uploaded fields</summary>
                  <div className="mt-3 rounded-xl bg-slate-50 p-4">
                    <pre className="whitespace-pre-wrap break-words text-xs text-slate-700">
                      {JSON.stringify(lead.rawData || {}, null, 2)}
                    </pre>
                  </div>
                </details>

                <div className="flex items-center gap-3">
                  <select
                    value={assignment.status || 'new'}
                    onChange={(event) => handleFieldChange(assignment._id, 'status', event.target.value)}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="new">New</option>
                    <option value="in_progress">In progress</option>
                    <option value="follow_up">Follow up</option>
                    <option value="completed">Completed</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => handleSave(assignment)}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Save
                  </button>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default AgentDashboard;
