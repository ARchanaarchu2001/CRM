import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { assignLeads, fetchAnalystLeads, fetchLeadMetadata } from '../api/leads.js';

const getDuplicateRowClasses = (duplicateStatus) => {
  if (duplicateStatus === 'duplicate_in_file_and_system') {
    return 'bg-rose-50';
  }
  if (duplicateStatus === 'duplicate_in_system') {
    return 'bg-amber-50';
  }
  if (duplicateStatus === 'duplicate_in_file') {
    return 'bg-yellow-50';
  }
  return '';
};

const AnalystDatasetPage = () => {
  const { batchId } = useParams();
  const [searchParams] = useSearchParams();
  const requestedView = searchParams.get('view') || 'full';
  const [products, setProducts] = useState([]);
  const [agents, setAgents] = useState([]);
  const [assignAgentId, setAssignAgentId] = useState('');
  const [leadFilters, setLeadFilters] = useState({
    product: '',
    duplicateStatus: '',
    assignmentStatus:
      requestedView === 'assigned'
        ? 'assigned'
        : requestedView === 'unassigned'
          ? 'unassigned'
          : '',
    search: '',
  });
  const [leads, setLeads] = useState([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null);
  const [actionMessage, setActionMessage] = useState('');

  const loadMetadata = async () => {
    const data = await fetchLeadMetadata();
    setProducts(data.products || []);
    setAgents(data.agents || []);
    setAssignAgentId((current) => current || data.agents?.[0]?._id || '');
  };

  const loadLeads = async (filters = leadFilters) => {
    const response = await fetchAnalystLeads({
      importBatchId: batchId,
      ...filters,
    });
    setLeads(response.leads || []);
  };

  useEffect(() => {
    loadMetadata();
    loadLeads();
  }, [batchId]);

  useEffect(() => {
    const nextAssignmentStatus =
      requestedView === 'assigned'
        ? 'assigned'
        : requestedView === 'unassigned'
          ? 'unassigned'
          : '';

    setLeadFilters((current) => ({
      ...current,
      assignmentStatus: nextAssignmentStatus,
    }));
    loadLeads({
      ...leadFilters,
      assignmentStatus: nextAssignmentStatus,
    });
  }, [requestedView]);

  const batchHeaders = useMemo(() => {
    const keys = new Set();
    leads.forEach((lead) => {
      Object.keys(lead.rawData || {}).forEach((key) => keys.add(key));
    });
    return Array.from(keys);
  }, [leads]);

  const hasDuplicates = leads.some((lead) => lead.duplicateStatus !== 'unique');
  const batchName = leads[0]?.batchName || '';
  const contactHeader = leads[0]?.contactColumn || 'Contact';
  const visibleHeaders = batchHeaders.filter((header) => header !== contactHeader);
  const showAssignmentRemarks =
    leadFilters.assignmentStatus === 'assigned' || leads.some((lead) => (lead.assignments || []).length > 0);

  const toggleLead = (leadId, index, shiftKey) => {
    if (shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const rangeIds = leads.slice(start, end + 1).map((lead) => lead._id);
      setSelectedLeadIds((current) => Array.from(new Set([...current, ...rangeIds])));
      setLastSelectedIndex(index);
      return;
    }

    setSelectedLeadIds((current) =>
      current.includes(leadId) ? current.filter((id) => id !== leadId) : [...current, leadId]
    );
    setLastSelectedIndex(index);
  };

  const handleFilterSubmit = async (event) => {
    event.preventDefault();
    await loadLeads(leadFilters);
  };

  const handleAssign = async () => {
    if (!selectedLeadIds.length || !assignAgentId) {
      setActionMessage('Choose rows and one agent before assigning.');
      return;
    }

    try {
      const response = await assignLeads({
        leadIds: selectedLeadIds,
        agentId: assignAgentId,
      });
      setActionMessage(response.message);
      setSelectedLeadIds([]);
      setLastSelectedIndex(null);
      await loadLeads();
    } catch (error) {
      setActionMessage(error.response?.data?.message || 'Could not assign leads');
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{batchName || 'Dataset'}</h2>
            <p className="mt-2 text-sm text-slate-600">
              Full-width dataset workspace. Use `Shift + click` on the first column to select a range of rows quickly.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {leads.length} rows
            {hasDuplicates ? ' · duplicate rows are highlighted' : ''}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-4">
          <form onSubmit={handleFilterSubmit} className="flex flex-1 flex-wrap items-end gap-3">
            <label className="text-sm font-medium text-slate-700">
              Product
              <select
                value={leadFilters.product}
                onChange={(event) => setLeadFilters((current) => ({ ...current, product: event.target.value }))}
                className="mt-1 rounded-xl border border-slate-300 px-3 py-2"
              >
                <option value="">All</option>
                {products.map((product) => (
                  <option key={product} value={product}>
                    {product.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>

            {hasDuplicates && (
              <label className="text-sm font-medium text-slate-700">
                Duplicate
                <select
                  value={leadFilters.duplicateStatus}
                  onChange={(event) =>
                    setLeadFilters((current) => ({ ...current, duplicateStatus: event.target.value }))
                  }
                  className="mt-1 rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="">All</option>
                  <option value="unique">Unique only</option>
                  <option value="duplicate_in_file">Duplicate in file</option>
                  <option value="duplicate_in_system">Duplicate in system</option>
                  <option value="duplicate_in_file_and_system">Duplicate in both</option>
                </select>
              </label>
            )}

            <label className="text-sm font-medium text-slate-700">
              Assignment
              <select
                value={leadFilters.assignmentStatus}
                onChange={(event) =>
                  setLeadFilters((current) => ({ ...current, assignmentStatus: event.target.value }))
                }
                className="mt-1 rounded-xl border border-slate-300 px-3 py-2"
              >
                <option value="">All</option>
                <option value="unassigned">Unassigned</option>
                <option value="assigned">Assigned</option>
              </select>
            </label>

            <label className="min-w-[220px] flex-1 text-sm font-medium text-slate-700">
              Search
              <input
                type="text"
                value={leadFilters.search}
                onChange={(event) => setLeadFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder="Search contact or name"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>

            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Apply Filters
            </button>
          </form>

          <div className="flex items-end gap-3">
            <label className="text-sm font-medium text-slate-700">
              Assign to agent
              <select
                value={assignAgentId}
                onChange={(event) => setAssignAgentId(event.target.value)}
                className="mt-1 rounded-xl border border-slate-300 px-3 py-2"
              >
                <option value="">Select agent</option>
                {agents.map((agent) => (
                  <option key={agent._id} value={agent._id}>
                    {agent.fullName}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={handleAssign}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Assign Selected
            </button>
          </div>
        </div>

        {actionMessage && <p className="mt-4 text-sm text-slate-600">{actionMessage}</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-auto">
          <table className="min-w-[1400px] divide-y divide-slate-200 text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100">
              <tr>
                <th className="sticky left-0 z-20 border-r border-slate-200 bg-slate-100 px-3 py-3 text-left font-semibold text-slate-700">
                  Pick
                </th>
                <th className="sticky left-[72px] z-20 border-r border-slate-200 bg-slate-100 px-3 py-3 text-left font-semibold text-slate-700">
                  {contactHeader}
                </th>
                {showAssignmentRemarks && (
                  <th className="px-3 py-3 text-left font-semibold text-slate-700">Agent Remarks</th>
                )}
                {visibleHeaders.map((header) => (
                  <th key={header} className="px-3 py-3 text-left font-semibold text-slate-700">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {leads.map((lead, index) => (
                <tr key={lead._id} className={getDuplicateRowClasses(lead.duplicateStatus)}>
                  <td className="sticky left-0 z-10 border-r border-slate-100 bg-inherit px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.includes(lead._id)}
                      onChange={(event) => toggleLead(lead._id, index, event.nativeEvent.shiftKey)}
                    />
                  </td>
                  <td className="sticky left-[72px] z-10 border-r border-slate-100 bg-inherit px-3 py-2 font-medium text-slate-900">
                    {lead.rawData?.[contactHeader] || lead.contactNumber}
                  </td>
                  {showAssignmentRemarks && (
                    <td className="min-w-[280px] px-3 py-2 text-slate-700">
                      {(lead.assignments || []).length === 0 && '—'}
                      {(lead.assignments || []).map((assignment) => (
                        <div key={assignment._id} className="mb-2 rounded-lg bg-white/70 px-2 py-1 text-xs leading-5">
                          <div className="font-semibold text-slate-800">{assignment.assignedAgentName}</div>
                          <div>Status: {assignment.status || 'new'}</div>
                          {assignment.callingRemark && <div>Calling: {assignment.callingRemark}</div>}
                          {assignment.interestedRemark && <div>Interested: {assignment.interestedRemark}</div>}
                          {assignment.notInterestedRemark && <div>Not interested: {assignment.notInterestedRemark}</div>}
                          {assignment.agentNotes && <div>Notes: {assignment.agentNotes}</div>}
                        </div>
                      ))}
                    </td>
                  )}
                  {visibleHeaders.map((header) => (
                    <td key={`${lead._id}-${header}`} className="px-3 py-2 text-slate-700">
                      {lead.rawData?.[header] || '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default AnalystDatasetPage;
