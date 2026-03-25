import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchMyAssignmentBatches,
  fetchMyAssignments,
  hideAssignmentBatch,
  updateAssignment,
} from '../api/leads.js';

const AUTOSAVE_DELAY_MS = 700;

const AgentDashboard = () => {
  const [filters, setFilters] = useState({
    product: '',
    status: '',
    search: '',
  });
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [message, setMessage] = useState('');
  const [saveState, setSaveState] = useState({});
  const timersRef = useRef(new Map());

  const loadBatches = async () => {
    const data = await fetchMyAssignmentBatches();
    setBatches(data.batches || []);
    setSelectedBatchId((current) => current || data.batches?.[0]?.importBatchId || '');
  };

  const loadAssignments = async (batchId = selectedBatchId, nextFilters = filters) => {
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
    const initialize = async () => {
      await loadBatches();
    };

    initialize();
  }, []);

  useEffect(() => {
    if (selectedBatchId) {
      loadAssignments(selectedBatchId, filters);
    }
  }, [selectedBatchId]);

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  const selectedBatch = batches.find((batch) => String(batch.importBatchId) === String(selectedBatchId));

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
    await loadAssignments(selectedBatchId, filters);
  };

  const handleHideBatch = async () => {
    if (!selectedBatchId) {
      return;
    }

    await hideAssignmentBatch(selectedBatchId);
    setMessage('Batch hidden from your dashboard.');
    setAssignments([]);
    setSelectedBatchId('');
    await loadBatches();
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[280px,1fr]">
      <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">My Batches</h2>
        <p className="mt-2 text-sm text-slate-600">
          Open a batch name and work inside it like a spreadsheet. Hidden batches stay in analytics.
        </p>

        <div className="mt-5 space-y-3">
          {batches.map((batch) => {
            const isSelected = String(batch.importBatchId) === String(selectedBatchId);
            return (
              <button
                key={String(batch.importBatchId)}
                type="button"
                onClick={() => setSelectedBatchId(String(batch.importBatchId))}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  isSelected
                    ? 'border-indigo-400 bg-indigo-50'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="font-semibold text-slate-900">{batch.batchName}</div>
                <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">{batch.product}</div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                  <span>{batch.totalRows} rows</span>
                  <span>{batch.newCount} new</span>
                  <span>{batch.followUpCount} follow-up</span>
                  <span>{batch.completedCount} done</span>
                </div>
              </button>
            );
          })}
          {batches.length === 0 && <p className="text-sm text-slate-500">No visible batches assigned.</p>}
        </div>
      </aside>

      <section className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Agent Excel Board</h2>
              <p className="mt-2 text-sm text-slate-600">
                Imported fields stay read-only. Your remarks and work columns autosave as you type.
              </p>
            </div>

            {selectedBatch && (
              <button
                type="button"
                onClick={handleHideBatch}
                className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Hide This Batch
              </button>
            )}
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
          {!selectedBatch && (
            <div className="p-6 text-sm text-slate-500">Choose a batch to start working.</div>
          )}

          {selectedBatch && (
            <div className="overflow-auto">
              <table className="min-w-[1400px] divide-y divide-slate-200 text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100">
                  <tr>
                    <th className="sticky left-0 z-20 border-r border-slate-200 bg-slate-100 px-3 py-3 text-left font-semibold text-slate-700">
                      {contactHeader}
                    </th>
                    <th className="sticky left-[170px] z-20 border-r border-slate-200 bg-slate-100 px-3 py-3 text-left font-semibold text-slate-700">
                      Name
                    </th>
                    <th className="sticky left-[360px] z-20 border-r border-slate-200 bg-slate-100 px-3 py-3 text-left font-semibold text-slate-700">
                      Batch
                    </th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-700">Contactability</th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-700">Call Attempt 1</th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-700">Call Attempt 2</th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-700">Calling Remark</th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-700">Interested Remark</th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-700">Not Interested Remark</th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-700">Agent Notes</th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-700">Status</th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-700">Save State</th>
                    {visibleReadOnlyHeaders.map((header) => (
                      <th key={header} className="px-3 py-3 text-left font-semibold text-slate-700">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {assignments.map((assignment) => {
                    const lead = assignment.lead || {};
                    const name =
                      lead.rawData?.NAME || lead.rawData?.Name || lead.rawData?.name || 'Unnamed lead';
                    const remarks = assignment.remarkConfig || {
                      callingRemarks: [],
                      interestedRemarks: [],
                      notInterestedRemarks: [],
                    };

                    return (
                      <tr key={assignment._id}>
                        <td className="sticky left-0 z-10 border-r border-slate-100 bg-white px-3 py-2 font-medium text-slate-900">
                          {lead.rawData?.[contactHeader] || lead.contactNumber}
                        </td>
                        <td className="sticky left-[170px] z-10 border-r border-slate-100 bg-white px-3 py-2 text-slate-700">
                          {name}
                        </td>
                        <td className="sticky left-[360px] z-10 border-r border-slate-100 bg-white px-3 py-2 text-slate-700">
                          {assignment.batchName}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={assignment.contactabilityStatus || ''}
                            onChange={(event) =>
                              handleFieldChange(assignment._id, 'contactabilityStatus', event.target.value)
                            }
                            className="w-[150px] rounded-lg border border-slate-300 px-2 py-1"
                          >
                            <option value="">Select</option>
                            <option value="Reachable">Reachable</option>
                            <option value="Not Reachable">Not Reachable</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={assignment.callAttempt1Date || ''}
                            onChange={(event) => handleFieldChange(assignment._id, 'callAttempt1Date', event.target.value)}
                            className="w-[160px] rounded-lg border border-slate-300 px-2 py-1"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={assignment.callAttempt2Date || ''}
                            onChange={(event) => handleFieldChange(assignment._id, 'callAttempt2Date', event.target.value)}
                            className="w-[160px] rounded-lg border border-slate-300 px-2 py-1"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={assignment.callingRemark || ''}
                            onChange={(event) => handleFieldChange(assignment._id, 'callingRemark', event.target.value)}
                            className="w-[170px] rounded-lg border border-slate-300 px-2 py-1"
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
                            onChange={(event) =>
                              handleFieldChange(assignment._id, 'interestedRemark', event.target.value)
                            }
                            className="w-[170px] rounded-lg border border-slate-300 px-2 py-1"
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
                            className="w-[190px] rounded-lg border border-slate-300 px-2 py-1"
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
                        <td className="px-3 py-2 text-xs text-slate-500">
                          {saveState[assignment._id] === 'saving' && 'Saving...'}
                          {saveState[assignment._id] === 'saved' && 'Saved'}
                          {saveState[assignment._id] === 'error' && 'Error'}
                        </td>
                        {visibleReadOnlyHeaders.map((header) => (
                          <td key={`${assignment._id}-${header}`} className="px-3 py-2 text-slate-600">
                            {lead.rawData?.[header] || '—'}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </div>
  );
};

export default AgentDashboard;
