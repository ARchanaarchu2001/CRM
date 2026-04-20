import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  assignLeads,
  downloadAnalystLeadExport,
  fetchAnalystLeadSelection,
  fetchAnalystLeads,
  fetchLeadMetadata,
  unassignLeadAssignments,
} from '../api/leads.js';
import { useSheetLayout } from '../hooks/useSheetLayout.js';
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

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 200;
const DEFAULT_ANALYST_COLUMN_WIDTHS = {
  pick: 72,
  contact: 220,
  assignedAgent: 220,
  status: 130,
  contactabilityStatus: 180,
  callAttempt1Date: 220,
  callAttempt2Date: 220,
  callingRemark: 180,
  interestedRemark: 180,
  notInterestedRemark: 190,
  agentNotes: 220,
};

const escapeCsvValue = (value) => {
  const stringValue = String(value ?? '');
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const matchesAnalystLeadSearch = (lead, query) => {
  const safeSearch = String(query || '').trim().toLowerCase();
  if (!safeSearch) {
    return true;
  }

  const valuesToSearch = [
    lead?.contactNumber,
    lead?.batchName,
    lead?.product,
    ...Object.values(lead?.rawData || {}),
  ];

  return valuesToSearch.some((value) => String(value || '').toLowerCase().includes(safeSearch));
};

const matchesAnalystAssignmentSearch = (assignment, query) => {
  const safeSearch = String(query || '').trim().toLowerCase();
  if (!safeSearch) {
    return true;
  }

  const valuesToSearch = [
    assignment?.assignedAgentName,
    assignment?.status,
    assignment?.contactabilityStatus,
    assignment?.callAttempt1Date,
    assignment?.callAttempt2Date,
    assignment?.callingRemark,
    assignment?.interestedRemark,
    assignment?.notInterestedRemark,
    assignment?.agentNotes,
  ];

  return valuesToSearch.some((value) => String(value || '').toLowerCase().includes(safeSearch));
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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pageSizeInput, setPageSizeInput] = useState(String(DEFAULT_PAGE_SIZE));
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null);
  const [isDragSelecting, setIsDragSelecting] = useState(false);
  const [dragSelectionMode, setDragSelectionMode] = useState('select');
  const [actionMessage, setActionMessage] = useState('');
  const [copiedContact, setCopiedContact] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [isUnassigning, setIsUnassigning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSelectionProcessing, setIsSelectionProcessing] = useState(false);
  const [customSelectCount, setCustomSelectCount] = useState('150');
  const rowRefs = useRef({});

  const loadMetadata = async () => {
    const data = await fetchLeadMetadata();
    setProducts(data.products || []);
    setAgents(data.agents || []);
    setRemarkConfigs(data.remarkConfigs || []);
    setAssignAgentId((current) => current || data.agents?.[0]?._id || '');
  };

  const loadLeads = async (filters = leadFilters, page = currentPage, options = {}) => {
    const { preserveSelection = false, requestedPageSize = pageSize } = options;
    const response = await fetchAnalystLeads({
      importBatchId: batchId,
      ...filters,
      page,
      pageSize: requestedPageSize,
    });
    setLeads(response.leads || []);
    setTotalCount(response.totalCount || 0);
    setCurrentPage(response.page || 1);
    setTotalPages(response.totalPages || 1);
    setPageSize(response.pageSize || requestedPageSize);
    setPageSizeInput(String(response.pageSize || requestedPageSize));
    if (!preserveSelection) {
      setSelectedLeadIds([]);
      setSelectedAssignmentIds([]);
      setLastSelectedIndex(null);
    }
  };

  useEffect(() => {
    loadMetadata();
    loadLeads(leadFilters, 1);
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
    setCurrentPage(1);
    loadLeads({
      ...leadFilters,
      assignmentStatus: nextAssignmentStatus,
    }, 1, { preserveSelection: false });
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
  const assignedRows = useMemo(() => {
    const safeSearch = leadFilters.search;

    return leads.flatMap((lead) => {
      const leadMatches = matchesAnalystLeadSearch(lead, safeSearch);

      return (lead.assignments || [])
        .filter((assignment) => leadMatches || matchesAnalystAssignmentSearch(assignment, safeSearch))
        .map((assignment) => ({
          ...assignment,
          lead,
        }));
    });
  }, [leadFilters.search, leads]);
  const filteredAgents = useMemo(() => {
    const safeSearch = agentSearch.trim().toLowerCase();
    if (!safeSearch) {
      return agents;
    }

    return agents.filter((agent) =>
      `${agent.fullName || ''} ${agent.email || ''}`.toLowerCase().includes(safeSearch)
    );
  }, [agentSearch, agents]);
  const selectedRowCount =
    leadFilters.assignmentStatus === 'assigned' ? selectedAssignmentIds.length : selectedLeadIds.length;
  const orderedAnalystColumnKeys = useMemo(() => {
    const base = ['pick', 'contact'];
    if (leadFilters.assignmentStatus === 'assigned') {
      return [
        ...base,
        'assignedAgent',
        ...visibleHeaders.map((header) => `raw:${header}`),
        'status',
        'contactabilityStatus',
        'callAttempt1Date',
        'callAttempt2Date',
        'callingRemark',
        'interestedRemark',
        'notInterestedRemark',
        'agentNotes',
      ];
    }

    return [...base, ...visibleHeaders.map((header) => `raw:${header}`)];
  }, [leadFilters.assignmentStatus, visibleHeaders]);
  const {
    isFocusMode,
    setIsFocusMode,
    isTableEditMode,
    setIsTableEditMode,
    fixedColumnKeys,
    setFixedColumnKeys,
    tableContainerRef,
    tableElementRef,
    bottomScrollbarRef,
    tableScrollWidth,
    orderedDisplayColumnKeys,
    isFixedColumn,
    getColumnStyle,
    getPinnedClasses,
    startColumnResize,
  } = useSheetLayout({
    storageKey: `analyst-sheet:${batchId}:${leadFilters.assignmentStatus || 'full'}`,
    orderedColumnKeys: orderedAnalystColumnKeys,
    defaultFixedColumnKeys: ['pick', 'contact'],
    defaultColumnWidths: DEFAULT_ANALYST_COLUMN_WIDTHS,
  });

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
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 1000);
  };

  const handleFullAssignedExport = async () => {
    setIsExporting(true);
    setActionMessage('');

    try {
      const response = await downloadAnalystLeadExport({
        importBatchId: batchId,
        ...leadFilters,
      });
      const blob = response?.data instanceof Blob
        ? response.data
        : new Blob([response?.data ?? ''], { type: 'text/csv;charset=utf-8;' });

      if (!blob || blob.size === 0) {
        setActionMessage('No rows available to export for this view.');
        return;
      }

      const contentDisposition = response?.headers?.['content-disposition'] || '';
      const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
      const downloadName =
        fileNameMatch?.[1] || `${batchName || 'dataset'}-${leadFilters.assignmentStatus || 'full'}.csv`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);
      setActionMessage(
        leadFilters.assignmentStatus === 'assigned'
          ? 'Full assigned dataset exported with agent details, original row data, and remarks.'
          : 'Full dataset exported.'
      );
    } catch (error) {
      console.error('Failed to export analyst dataset', error);
      const responseData = error.response?.data;
      if (responseData instanceof Blob) {
        try {
          const errorText = await responseData.text();
          const parsed = JSON.parse(errorText);
          setActionMessage(parsed.message || 'Failed to export this dataset.');
        } catch {
          setActionMessage('Failed to export this dataset.');
        }
      } else {
        setActionMessage(error.response?.data?.message || 'Failed to export this dataset.');
      }
    } finally {
      setIsExporting(false);
    }
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
    setCurrentPage(1);
    await loadLeads(leadFilters, 1);
  };

  const handleAssign = async () => {
    if (!selectedLeadIds.length || !assignAgentId) {
      setActionMessage('Choose rows and one agent before assigning.');
      return;
    }

    const selectedAgent = agents.find((agent) => agent._id === assignAgentId);
    const selectedCount = selectedLeadIds.length;
    setIsAssigning(true);

    try {
      const response = await assignLeads({
        leadIds: selectedLeadIds,
        agentId: assignAgentId,
      });
      setActionMessage(
        response.message ||
          `${selectedCount} lead${selectedCount === 1 ? '' : 's'} assigned to ${
            selectedAgent?.fullName || selectedAgent?.email || 'the selected agent'
          }.`
      );
      if (leadFilters.assignmentStatus === 'unassigned') {
        setLeads((current) => current.filter((lead) => !selectedLeadIds.includes(lead._id)));
      }
      setSelectedLeadIds([]);
      setLastSelectedIndex(null);
      const nextFilters =
        leadFilters.assignmentStatus === 'assigned'
          ? leadFilters
          : { ...leadFilters, assignmentStatus: 'unassigned' };
      setLeadFilters(nextFilters);
      await loadLeads(nextFilters, 1, { preserveSelection: false });
    } catch (error) {
      setActionMessage(error.response?.data?.message || 'Could not assign leads');
    } finally {
      setIsAssigning(false);
    }
  };

  const toggleAssignment = (assignmentId) => {
    setSelectedAssignmentIds((current) =>
      current.includes(assignmentId)
        ? current.filter((id) => id !== assignmentId)
        : [...current, assignmentId]
    );
  };

  const handleAssignmentMouseDown = (assignmentId) => {
    const isAlreadySelected = selectedAssignmentIds.includes(assignmentId);
    const nextMode = isAlreadySelected ? 'deselect' : 'select';
    setDragSelectionMode(nextMode);
    setIsDragSelecting(true);
    setSelectedAssignmentIds((current) =>
      nextMode === 'select'
        ? Array.from(new Set([...current, assignmentId]))
        : current.filter((id) => id !== assignmentId)
    );
  };

  const handleAssignmentMouseEnter = (assignmentId) => {
    if (!isDragSelecting) {
      return;
    }

    setSelectedAssignmentIds((current) =>
      dragSelectionMode === 'select'
        ? Array.from(new Set([...current, assignmentId]))
        : current.filter((id) => id !== assignmentId)
    );
  };

  const handleUnassign = async () => {
    if (!selectedAssignmentIds.length) {
      setActionMessage('Choose assigned rows before unassigning.');
      return;
    }

    const selectedCount = selectedAssignmentIds.length;
    const confirmed = window.confirm(
      `Unassign ${selectedCount} selected assigned lead${selectedCount === 1 ? '' : 's'}? This removes those rows from the selected agents, but keeps the original dataset leads.`
    );

    if (!confirmed) {
      return;
    }

    setIsUnassigning(true);
    try {
      const response = await unassignLeadAssignments({ assignmentIds: selectedAssignmentIds });
      setActionMessage(response.message || `Unassigned ${selectedCount} assigned lead${selectedCount === 1 ? '' : 's'}.`);
      setSelectedAssignmentIds([]);
      await loadLeads(leadFilters, currentPage, { preserveSelection: false });
    } catch (error) {
      setActionMessage(error.response?.data?.message || 'Could not unassign selected rows.');
    } finally {
      setIsUnassigning(false);
    }
  };

  const handlePageChange = async (nextPage) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === currentPage) {
      return;
    }
    await loadLeads(leadFilters, nextPage, { preserveSelection: true });
  };

  const handlePageSizeApply = async () => {
    const parsedCount = Number.parseInt(pageSizeInput, 10);

    if (!Number.isFinite(parsedCount) || parsedCount <= 0) {
      setActionMessage('Enter a valid row count greater than 0.');
      return;
    }

    const safePageSize = Math.min(parsedCount, MAX_PAGE_SIZE);
    if (safePageSize !== parsedCount) {
      setActionMessage(`Row count is limited to ${MAX_PAGE_SIZE} per page.`);
    } else {
      setActionMessage('');
    }

    await loadLeads(leadFilters, 1, {
      preserveSelection: false,
      requestedPageSize: safePageSize,
    });
  };

  const handleSelectFirst = async (count) => {
    setIsSelectionProcessing(true);
    setActionMessage('');

    try {
      const response = await fetchAnalystLeadSelection({
        importBatchId: batchId,
        ...leadFilters,
        count,
      });
      const nextIds = response.leadIds || [];
      setSelectedLeadIds(nextIds);
      setLastSelectedIndex(null);
      setActionMessage(`Selected first ${Math.min(count, nextIds.length)} lead${Math.min(count, nextIds.length) === 1 ? '' : 's'}.`);
    } catch (error) {
      setActionMessage(error.response?.data?.message || 'Could not select the requested rows.');
    } finally {
      setIsSelectionProcessing(false);
    }
  };

  const handleCustomSelectFirst = async () => {
    const parsedCount = Number.parseInt(customSelectCount, 10);
    if (!Number.isFinite(parsedCount) || parsedCount <= 0) {
      setActionMessage('Enter a valid custom count greater than 0.');
      return;
    }

    await handleSelectFirst(parsedCount);
  };

  const handleClearSelection = () => {
    setSelectedLeadIds([]);
    setSelectedAssignmentIds([]);
    setLastSelectedIndex(null);
    setActionMessage('Selection cleared.');
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

  const getAnalystColumnLabel = (columnKey) => {
    if (columnKey === 'pick') return 'Pick';
    if (columnKey === 'contact') return contactHeader;
    if (columnKey === 'assignedAgent') return 'Assigned Agent';
    if (columnKey.startsWith('raw:')) return columnKey.replace('raw:', '');
    if (columnKey === 'status') return 'Status';
    if (columnKey === 'contactabilityStatus') return 'Contactability Status';
    if (columnKey === 'callAttempt1Date') return activeRemarkConfig.callAttempt1Label;
    if (columnKey === 'callAttempt2Date') return activeRemarkConfig.callAttempt2Label;
    if (columnKey === 'callingRemark') return activeRemarkConfig.callingRemarkLabel;
    if (columnKey === 'interestedRemark') return activeRemarkConfig.interestedRemarkLabel;
    if (columnKey === 'notInterestedRemark') return activeRemarkConfig.notInterestedRemarkLabel;
    if (columnKey === 'agentNotes') return 'Agent Notes';
    return columnKey;
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

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <form onSubmit={handleFilterSubmit} className="grid gap-4 lg:grid-cols-[auto_auto_minmax(0,1fr)_auto]">
            <label className="text-sm font-medium text-slate-700">
              Product
              <select
                value={leadFilters.product}
                onChange={(event) => setLeadFilters((current) => ({ ...current, product: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
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
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
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
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
              >
                <option value="">All</option>
                <option value="unassigned">Unassigned</option>
                <option value="assigned">Assigned</option>
              </select>
            </label>

            <label className="min-w-[220px] text-sm font-medium text-slate-700">
              Search
              <input
                type="text"
                value={leadFilters.search}
                onChange={(event) => setLeadFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder="Search any field in the row"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
              />
            </label>

            <button
              type="submit"
              className="self-end rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Apply Filters
            </button>
          </form>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Selection</p>
                <h3 className="mt-1 text-base font-semibold text-slate-900">Pick rows quickly</h3>
              </div>
              <div className="rounded-full bg-indigo-100 px-4 py-2 text-sm font-semibold text-indigo-700">
                {selectedRowCount} selected
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {leadFilters.assignmentStatus === 'assigned' && (
                <button
                  type="button"
                  onClick={handleFullAssignedExport}
                  disabled={isExporting}
                  className="rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isExporting ? 'Exporting...' : 'Export Full Assigned Data'}
                </button>
              )}
              {leadFilters.assignmentStatus !== 'assigned' &&
                [50, 100, 200].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => handleSelectFirst(count)}
                    disabled={isSelectionProcessing}
                    className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    First {count}
                  </button>
                ))}
              <button
                type="button"
                onClick={handleClearSelection}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Clear
              </button>
            </div>

            {leadFilters.assignmentStatus !== 'assigned' ? (
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="min-w-[180px] flex-1 text-sm font-medium text-slate-700">
                  Custom count
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={customSelectCount}
                    onChange={(event) => setCustomSelectCount(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleCustomSelectFirst}
                  disabled={isSelectionProcessing}
                  className="rounded-xl border border-indigo-300 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Select Count
                </button>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Select assigned rows below to retrieve them from agents. If a lead has no other assignment after that, it returns to Unassigned.
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                {leadFilters.assignmentStatus === 'assigned' ? 'Retrieve' : 'Assignment'}
              </p>
              <h3 className="mt-1 text-base font-semibold text-slate-900">
                {leadFilters.assignmentStatus === 'assigned' ? 'Unassign selected rows' : 'Send selected rows'}
              </h3>
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              {leadFilters.assignmentStatus !== 'assigned' && (
                <>
                  <label className="min-w-[220px] flex-1 text-sm font-medium text-slate-700">
                    Search agent
                    <input
                      type="text"
                      value={agentSearch}
                      onChange={(event) => setAgentSearch(event.target.value)}
                      placeholder="Search by name or email"
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                    />
                  </label>
                  <label className="min-w-[260px] flex-1 text-sm font-medium text-slate-700">
                    Assign to agent
                    <select
                      value={assignAgentId}
                      onChange={(event) => setAssignAgentId(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                    >
                      <option value="">Select agent</option>
                      {filteredAgents.map((agent) => (
                        <option key={agent._id} value={agent._id}>
                          {agent.fullName} ({agent.email})
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              <button
                type="button"
                onClick={leadFilters.assignmentStatus === 'assigned' ? handleUnassign : handleAssign}
                disabled={leadFilters.assignmentStatus === 'assigned' ? isUnassigning : isAssigning}
                className={`rounded-xl px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                  leadFilters.assignmentStatus === 'assigned'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {leadFilters.assignmentStatus === 'assigned'
                  ? isUnassigning
                    ? 'Unassigning...'
                    : 'Unassign Selected'
                  : isAssigning
                    ? 'Assigning...'
                    : 'Assign Selected'}
              </button>
            </div>
          </section>
        </div>

        {actionMessage && <p className="mt-4 text-sm text-slate-600">{actionMessage}</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <div>
            Showing page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> · {pageSize} rows per page ·{' '}
            <strong>{totalCount}</strong> total rows
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-slate-700">
              Rows per page
              <input
                type="number"
                min="1"
                max={MAX_PAGE_SIZE}
                step="1"
                value={pageSizeInput}
                onChange={(event) => setPageSizeInput(event.target.value)}
                className="ml-2 w-24 rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={handlePageSizeApply}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Set Count
            </button>
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

      <section className={`relative rounded-2xl border border-slate-200 bg-white shadow-sm ${isFocusMode ? 'fixed inset-3 z-50 flex min-h-0 flex-col rounded-none border-0 shadow-2xl' : ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setIsTableEditMode((current) => !current)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                isTableEditMode
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {isTableEditMode ? 'Done Editing Table' : 'Edit Table'}
            </button>
            <button
              type="button"
              onClick={() => setIsFocusMode((current) => !current)}
              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {isFocusMode ? 'Exit Expanded Sheet' : 'Expand Sheet'}
            </button>
            <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
              Fixed: {fixedColumnKeys.map((key) => getAnalystColumnLabel(key)).join(', ')}
            </div>
          </div>
        </div>
        <div className="pointer-events-none sticky top-4 z-20 flex justify-end px-4 pt-4">
          <div className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700 shadow-sm">
            {selectedRowCount} selected
          </div>
        </div>
        <div ref={tableContainerRef} className="min-h-0 flex-1 overflow-auto pt-4">
          <table ref={tableElementRef} className="min-w-[1400px] border-separate border-spacing-0 text-[12px] font-medium leading-4 text-black">
            <thead>
              <tr>
                {orderedDisplayColumnKeys.map((columnKey) => (
                  <th
                    key={`header-${columnKey}`}
                    className={getPinnedClasses(
                      columnKey,
                      'relative sticky top-0 whitespace-nowrap align-top border-b border-r border-black px-2 py-2 text-left text-[12px] font-semibold text-slate-700',
                      'bg-slate-100',
                      columnKey === 'pick' ? 'z-40' : 'z-30'
                    )}
                    style={getColumnStyle(columnKey)}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <span className="min-w-0 truncate">{getAnalystColumnLabel(columnKey)}</span>
                      {isTableEditMode && columnKey !== 'pick' ? (
                        <button
                          type="button"
                          onClick={() =>
                            setFixedColumnKeys((current) =>
                              current.includes(columnKey)
                                ? current.filter((key) => key !== columnKey)
                                : [...current, columnKey]
                            )
                          }
                          className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                            isFixedColumn(columnKey)
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {isFixedColumn(columnKey) ? 'Fixed' : 'Pin'}
                        </button>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onPointerDown={(event) => startColumnResize(event, columnKey)}
                      className="absolute top-0 right-[-5px] bottom-0 z-[60] w-[10px] cursor-col-resize bg-transparent"
                      title="Drag to resize column"
                    >
                      <span className="pointer-events-none absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2 bg-slate-300" />
                      <span className="pointer-events-none absolute top-1 bottom-1 left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-slate-500/80" />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {leadFilters.assignmentStatus === 'assigned'
                ? assignedRows.map((assignment) => {
                    const lead = assignment.lead || {};
                    return (
                      <tr key={assignment._id} className={getDuplicateRowClasses(lead.duplicateStatus)}>
                        {orderedDisplayColumnKeys.map((columnKey) => {
                          const cellClassName = getPinnedClasses(
                            columnKey,
                            'h-9 border-b border-r border-black px-2 py-1.5 text-black',
                            'bg-white',
                            columnKey === 'pick' ? 'z-20' : 'z-10'
                          );

                          if (columnKey === 'pick') {
                            return (
                              <td
                                key={`${assignment._id}-${columnKey}`}
                                className={`${cellClassName} cursor-pointer`}
                                style={getColumnStyle(columnKey)}
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  handleAssignmentMouseDown(assignment._id);
                                }}
                                onMouseEnter={() => handleAssignmentMouseEnter(assignment._id)}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedAssignmentIds.includes(assignment._id)}
                                  onChange={() => toggleAssignment(assignment._id)}
                                  readOnly
                                  className="pointer-events-none"
                                />
                              </td>
                            );
                          }
                          if (columnKey === 'contact') {
                            return (
                              <td key={`${assignment._id}-${columnKey}`} className={cellClassName} style={getColumnStyle(columnKey)}>
                                <button
                                  type="button"
                                  onClick={() => handleCopyContact(lead.rawData?.[contactHeader] || lead.contactNumber)}
                                  className="rounded px-1 py-0.5 text-left text-black hover:bg-indigo-50"
                                >
                                  {formatContactDisplay(lead.rawData?.[contactHeader] || lead.contactNumber)}
                                  {copiedContact === formatContactDisplay(lead.rawData?.[contactHeader] || lead.contactNumber) ? ' copied' : ''}
                                </button>
                              </td>
                            );
                          }
                          if (columnKey === 'assignedAgent') return <td key={`${assignment._id}-${columnKey}`} className={cellClassName} style={getColumnStyle(columnKey)}>{assignment.assignedAgentName || '—'}</td>;
                          if (columnKey.startsWith('raw:')) {
                            const header = columnKey.replace('raw:', '');
                            return <td key={`${assignment._id}-${columnKey}`} className={cellClassName} style={getColumnStyle(columnKey)}>{lead.rawData?.[header] || '—'}</td>;
                          }
                          return <td key={`${assignment._id}-${columnKey}`} className={cellClassName} style={getColumnStyle(columnKey)}>{assignment[columnKey] || '—'}</td>;
                        })}
                      </tr>
                    );
                  })
                : leads.map((lead, index) => (
                    <tr
                      key={lead._id}
                      ref={(node) => {
                        if (node) {
                          rowRefs.current[String(lead._id)] = node;
                        }
                      }}
                      className={getDuplicateRowClasses(lead.duplicateStatus)}
                    >
                      {orderedDisplayColumnKeys.map((columnKey) => {
                        const cellClassName = getPinnedClasses(
                          columnKey,
                          'h-9 border-b border-r border-black px-2 py-1.5 text-black',
                          'bg-white',
                          columnKey === 'pick' ? 'z-20' : 'z-10'
                        );
                        if (columnKey === 'pick') {
                          return (
                            <td
                              key={`${lead._id}-${columnKey}`}
                              className={`${cellClassName} cursor-pointer`}
                              style={getColumnStyle(columnKey)}
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
                          );
                        }
                        if (columnKey === 'contact') {
                          return (
                            <td key={`${lead._id}-${columnKey}`} className={cellClassName} style={getColumnStyle(columnKey)}>
                              <button
                                type="button"
                                onClick={() => handleCopyContact(lead.rawData?.[contactHeader] || lead.contactNumber)}
                                className="rounded px-1 py-0.5 text-left text-black hover:bg-indigo-50"
                              >
                                {formatContactDisplay(lead.rawData?.[contactHeader] || lead.contactNumber)}
                                {copiedContact === formatContactDisplay(lead.rawData?.[contactHeader] || lead.contactNumber) ? ' copied' : ''}
                              </button>
                            </td>
                          );
                        }
                        if (columnKey.startsWith('raw:')) {
                          const header = columnKey.replace('raw:', '');
                          return <td key={`${lead._id}-${columnKey}`} className={cellClassName} style={getColumnStyle(columnKey)}>{lead.rawData?.[header] || '—'}</td>;
                        }
                        return <td key={`${lead._id}-${columnKey}`} className={cellClassName} style={getColumnStyle(columnKey)}>-</td>;
                      })}
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200 bg-white px-4 py-1">
          <div ref={bottomScrollbarRef} className="overflow-x-scroll overflow-y-hidden">
            <div style={{ width: `${tableScrollWidth}px`, height: '12px' }} />
          </div>
        </div>
      </section>

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
    </div>
  );
};

export default AnalystDatasetPage;
