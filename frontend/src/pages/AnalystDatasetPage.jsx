import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { assignLeads, fetchAnalystLeads, fetchLeadMetadata } from '../api/leads.js';
import { formatContactDisplay } from '../utils/contactNumber.js';

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

const DEFAULT_REMARK_CONFIG = {
  contactabilityStatuses: ['Reachable', 'Not Reachable'],
  callAttempt1Label: 'Call Attempt 1 - Date',
  callAttempt2Label: 'Call Attempt 2 - Date',
  callingRemarkLabel: 'Calling Remarks',
  interestedRemarkLabel: 'Interested Remarks',
  notInterestedRemarkLabel: 'Not Interested Remarks',
};

const escapeCsvValue = (value) => {
  const stringValue = String(value ?? '');
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const AnalystDatasetPage = () => {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedView = searchParams.get('view') || 'full';
  const [products, setProducts] = useState([]);
  const [agents, setAgents] = useState([]);
  const [remarkConfigs, setRemarkConfigs] = useState([]);
  const [assignAgentId, setAssignAgentId] = useState('');
  const [agentSearch, setAgentSearch] = useState('');
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
  const [totalCount, setTotalCount] = useState(0);
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null);
  const [isDragSelecting, setIsDragSelecting] = useState(false);
  const [dragSelectionMode, setDragSelectionMode] = useState('select');
  const [actionMessage, setActionMessage] = useState('');
  const [copiedContact, setCopiedContact] = useState('');

  const loadMetadata = async () => {
    const data = await fetchLeadMetadata();
    setProducts(data.products || []);
    setAgents(data.agents || []);
    setRemarkConfigs(data.remarkConfigs || []);
    setAssignAgentId((current) => current || data.agents?.[0]?._id || '');
  };

  const loadLeads = async (filters = leadFilters) => {
    const response = await fetchAnalystLeads({
      importBatchId: batchId,
      ...filters,
    });
    setLeads(response.leads || []);
    setTotalCount(response.totalCount || 0);
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

  useEffect(() => {
    const stopDragSelection = () => setIsDragSelecting(false);
    window.addEventListener('mouseup', stopDragSelection);
    return () => window.removeEventListener('mouseup', stopDragSelection);
  }, []);

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
  const currentProduct = leads[0]?.product || leadFilters.product || '';
  const activeRemarkConfig =
    remarkConfigs.find((config) => config.product === currentProduct) || DEFAULT_REMARK_CONFIG;
  const assignedRows = useMemo(
    () =>
      leads.flatMap((lead) =>
        (lead.assignments || []).map((assignment) => ({
          ...assignment,
          lead,
        }))
      ),
    [leads]
  );
  const filteredAgents = useMemo(() => {
    const safeSearch = agentSearch.trim().toLowerCase();
    if (!safeSearch) {
      return agents;
    }

    return agents.filter((agent) =>
      `${agent.fullName || ''} ${agent.email || ''}`.toLowerCase().includes(safeSearch)
    );
  }, [agentSearch, agents]);

  const exportRows = useMemo(() => {
    if (leadFilters.assignmentStatus === 'assigned') {
      return assignedRows.map((assignment) => {
        const row = {
          [contactHeader]: formatContactDisplay(
            assignment.lead?.rawData?.[contactHeader] || assignment.lead?.contactNumber || ''
          ),
          AssignedAgent: assignment.assignedAgentName || '',
          Status: assignment.status || '',
          ContactabilityStatus: assignment.contactabilityStatus || '',
          [activeRemarkConfig.callAttempt1Label]: assignment.callAttempt1Date || '',
          [activeRemarkConfig.callAttempt2Label]: assignment.callAttempt2Date || '',
          [activeRemarkConfig.callingRemarkLabel]: assignment.callingRemark || '',
          [activeRemarkConfig.interestedRemarkLabel]: assignment.interestedRemark || '',
          [activeRemarkConfig.notInterestedRemarkLabel]: assignment.notInterestedRemark || '',
          AgentNotes: assignment.agentNotes || '',
        };
        visibleHeaders.forEach((header) => {
          row[header] = assignment.lead?.rawData?.[header] || '';
        });
        return row;
      });
    }

    return leads.map((lead) => {
      const row = {
        [contactHeader]: formatContactDisplay(lead.rawData?.[contactHeader] || lead.contactNumber || ''),
      };
      visibleHeaders.forEach((header) => {
        row[header] = lead.rawData?.[header] || '';
      });
      return row;
    });
  }, [activeRemarkConfig, assignedRows, contactHeader, leadFilters.assignmentStatus, leads, visibleHeaders]);

  const handleExport = () => {
    if (!exportRows.length) {
      setActionMessage('No rows available to export for this view.');
      return;
    }

    const headers = Object.keys(exportRows[0]);
    const csv = [headers.map(escapeCsvValue).join(',')]
      .concat(exportRows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(',')))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${batchName || 'dataset'}-${leadFilters.assignmentStatus || 'full'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

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

  const handleLeadMouseDown = (leadId, index) => {
    const isAlreadySelected = selectedLeadIds.includes(leadId);
    const nextMode = isAlreadySelected ? 'deselect' : 'select';
    setDragSelectionMode(nextMode);
    setIsDragSelecting(true);
    setSelectedLeadIds((current) =>
      nextMode === 'select' ? Array.from(new Set([...current, leadId])) : current.filter((id) => id !== leadId)
    );
    setLastSelectedIndex(index);
  };

  const handleLeadMouseEnter = (leadId) => {
    if (!isDragSelecting) {
      return;
    }

    setSelectedLeadIds((current) =>
      dragSelectionMode === 'select'
        ? Array.from(new Set([...current, leadId]))
        : current.filter((id) => id !== leadId)
    );
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
      if (leadFilters.assignmentStatus === 'unassigned') {
        setLeads((current) => current.filter((lead) => !selectedLeadIds.includes(lead._id)));
      }
      setSelectedLeadIds([]);
      setLastSelectedIndex(null);
      await loadLeads();
    } catch (error) {
      setActionMessage(error.response?.data?.message || 'Could not assign leads');
    }
  };

  const handleCopyContact = async (value) => {
    const contactValue = formatContactDisplay(value);
    if (!contactValue) {
      return;
    }

    try {
      await navigator.clipboard.writeText(contactValue);
      setCopiedContact(contactValue);
      setActionMessage(`Copied ${contactValue}`);
      window.setTimeout(() => {
        setCopiedContact((current) => (current === contactValue ? '' : current));
      }, 1800);
    } catch (error) {
      setActionMessage('Could not copy contact number');
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{batchName || 'Dataset'}</h2>
            <p className="mt-2 text-sm text-slate-600">
              Full-width dataset workspace. Use `Shift + click` or drag across the first column to select rows quickly.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back
            </button>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {totalCount} rows
              {hasDuplicates ? ' · duplicate rows are highlighted' : ''}
            </div>
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
                placeholder="Search any field in the row"
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
            <button
              type="button"
              onClick={handleExport}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Export View
            </button>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              {selectedLeadIds.length} selected
            </div>
            <div className="min-w-[280px] space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Search agent
                <input
                  type="text"
                  value={agentSearch}
                  onChange={(event) => setAgentSearch(event.target.value)}
                  placeholder="Search by name or email"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Assign to agent
                <select
                  value={assignAgentId}
                  onChange={(event) => setAssignAgentId(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="">Select agent</option>
                  {filteredAgents.map((agent) => (
                    <option key={agent._id} value={agent._id}>
                      {agent.fullName} ({agent.email})
                    </option>
                  ))}
                </select>
              </label>
            </div>

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
                {leadFilters.assignmentStatus !== 'assigned' && (
                  <th className="sticky left-0 z-30 border-r border-slate-200 bg-slate-100 px-3 py-3 text-left font-semibold text-slate-700 shadow-[6px_0_8px_-8px_rgba(15,23,42,0.28)]">
                    Pick
                  </th>
                )}
                <th
                  className={`sticky z-30 border-r border-slate-200 bg-slate-100 px-3 py-3 text-left font-semibold text-slate-700 shadow-[6px_0_8px_-8px_rgba(15,23,42,0.28)] ${
                    leadFilters.assignmentStatus === 'assigned' ? 'left-0' : 'left-[72px]'
                  }`}
                >
                  {contactHeader}
                </th>
                {leadFilters.assignmentStatus === 'assigned' && (
                  <>
                    <th className="px-3 py-3 text-left font-semibold text-slate-700">Assigned Agent</th>
                  </>
                )}
                {visibleHeaders.map((header) => (
                  <th key={header} className="px-3 py-3 text-left font-semibold text-slate-700">
                    {header}
                  </th>
                ))}
                {leadFilters.assignmentStatus === 'assigned' && (
                  <>
                    <th className="px-3 py-3 text-left font-semibold text-slate-700">Status</th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-700">Contactability Status</th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-700">
                      {activeRemarkConfig.callAttempt1Label}
                    </th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-700">
                      {activeRemarkConfig.callAttempt2Label}
                    </th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-700">
                      {activeRemarkConfig.callingRemarkLabel}
                    </th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-700">
                      {activeRemarkConfig.interestedRemarkLabel}
                    </th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-700">
                      {activeRemarkConfig.notInterestedRemarkLabel}
                    </th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-700">Agent Notes</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {leadFilters.assignmentStatus === 'assigned'
                ? assignedRows.map((assignment) => {
                    const lead = assignment.lead || {};
                    return (
                      <tr key={assignment._id} className={getDuplicateRowClasses(lead.duplicateStatus)}>
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
                        <td className="px-3 py-2 text-slate-700">{assignment.assignedAgentName || '—'}</td>
                        {visibleHeaders.map((header) => (
                          <td key={`${assignment._id}-${header}`} className="px-3 py-2 text-slate-700">
                            {lead.rawData?.[header] || '—'}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-slate-700">{assignment.status || 'new'}</td>
                        <td className="px-3 py-2 text-slate-700">{assignment.contactabilityStatus || '—'}</td>
                        <td className="px-3 py-2 text-slate-700">{assignment.callAttempt1Date || '—'}</td>
                        <td className="px-3 py-2 text-slate-700">{assignment.callAttempt2Date || '—'}</td>
                        <td className="px-3 py-2 text-slate-700">{assignment.callingRemark || '—'}</td>
                        <td className="px-3 py-2 text-slate-700">{assignment.interestedRemark || '—'}</td>
                        <td className="px-3 py-2 text-slate-700">{assignment.notInterestedRemark || '—'}</td>
                        <td className="px-3 py-2 text-slate-700">{assignment.agentNotes || '—'}</td>
                      </tr>
                    );
                  })
                : leads.map((lead, index) => (
                    <tr key={lead._id} className={getDuplicateRowClasses(lead.duplicateStatus)}>
                      <td
                        className="sticky left-0 z-20 cursor-pointer border-r border-slate-200 bg-white px-3 py-2 shadow-[6px_0_8px_-8px_rgba(15,23,42,0.28)]"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          handleLeadMouseDown(lead._id, index);
                        }}
                        onMouseEnter={() => handleLeadMouseEnter(lead._id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedLeadIds.includes(lead._id)}
                          readOnly
                          className="pointer-events-none"
                        />
                      </td>
                      <td className="sticky left-[72px] z-20 border-r border-slate-200 bg-white px-3 py-2 font-medium text-slate-900 shadow-[6px_0_8px_-8px_rgba(15,23,42,0.28)]">
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
