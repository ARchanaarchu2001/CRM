import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { assignLeads, fetchAnalystLeads, fetchLeadMetadata, importLeadFile, previewLeadFile } from '../api/leads.js';

const createAddedColumn = () => ({
  id: `column-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: '',
  defaultValue: '',
});

const AnalystDashboard = () => {
  const [products, setProducts] = useState(['mnp', 'p2p', 'fne', 'plus', 'general']);
  const [agents, setAgents] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('p2p');
  const [leadFilters, setLeadFilters] = useState({
    product: '',
    duplicateStatus: '',
    assignmentStatus: '',
    search: '',
  });
  const [leads, setLeads] = useState([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [assignAgentId, setAssignAgentId] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [uploadState, setUploadState] = useState({
    file: null,
    batchName: '',
    contactColumn: '',
    preview: null,
    removedColumns: [],
    addedColumns: [],
    status: '',
  });

  const loadMetadata = async () => {
    const data = await fetchLeadMetadata();
    setProducts(data.products || []);
    setAgents(data.agents || []);
    setSelectedProduct((current) => current || data.products?.[0] || 'p2p');
    setAssignAgentId((current) => current || data.agents?.[0]?._id || '');
  };

  const loadLeads = async (filters = leadFilters) => {
    const response = await fetchAnalystLeads(filters);
    setLeads(response.leads || []);
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        await loadMetadata();
        await loadLeads();
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  const previewColumns = useMemo(() => {
    const keys = new Set();
    leads.slice(0, 10).forEach((lead) => {
      Object.keys(lead.rawData || {})
        .slice(0, 6)
        .forEach((key) => keys.add(key));
    });
    return Array.from(keys).slice(0, 6);
  }, [leads]);

  const visiblePreviewHeaders = useMemo(() => {
    const previewHeaders = uploadState.preview?.headers || [];
    const removed = new Set(uploadState.removedColumns);
    const keptHeaders = previewHeaders.filter((header) => !removed.has(header));
    const addedHeaders = uploadState.addedColumns
      .map((column) => column.name.trim())
      .filter(Boolean)
      .filter((name) => !keptHeaders.includes(name));
    return [...keptHeaders, ...addedHeaders];
  }, [uploadState.preview, uploadState.removedColumns, uploadState.addedColumns]);

  const previewRows = useMemo(() => {
    if (!uploadState.preview?.sampleRows) {
      return [];
    }

    return uploadState.preview.sampleRows.map((row) => {
      const nextRow = {};
      visiblePreviewHeaders.forEach((header) => {
        const customColumn = uploadState.addedColumns.find((column) => column.name.trim() === header);
        nextRow[header] = customColumn ? customColumn.defaultValue : row[header] || '';
      });
      return nextRow;
    });
  }, [uploadState.preview, visiblePreviewHeaders, uploadState.addedColumns]);

  const toggleLead = (leadId) => {
    setSelectedLeadIds((current) =>
      current.includes(leadId) ? current.filter((id) => id !== leadId) : [...current, leadId]
    );
  };

  const handlePreview = async (event) => {
    event.preventDefault();
    if (!uploadState.file) {
      setUploadState((current) => ({ ...current, status: 'Please choose a file first.' }));
      return;
    }

    try {
      setUploadState((current) => ({ ...current, status: 'Preparing preview...' }));
      const preview = await previewLeadFile({
        file: uploadState.file,
        contactColumn: uploadState.contactColumn,
      });
      setUploadState((current) => ({
        ...current,
        preview,
        batchName: current.batchName || preview.suggestedBatchName || '',
        contactColumn: current.contactColumn || preview.detectedContactColumn || '',
        removedColumns: [],
        addedColumns: [],
        status: `Preview ready. ${preview.totalRows} rows found.`,
      }));
    } catch (error) {
      setUploadState((current) => ({
        ...current,
        status: error.response?.data?.message || 'Could not preview file',
      }));
    }
  };

  const handleImport = async () => {
    if (!uploadState.file || !uploadState.preview) {
      setUploadState((current) => ({ ...current, status: 'Preview the file before importing.' }));
      return;
    }

    try {
      setUploadState((current) => ({ ...current, status: 'Importing leads...' }));
      const response = await importLeadFile({
        product: selectedProduct,
        batchName: uploadState.batchName,
        file: uploadState.file,
        contactColumn: uploadState.contactColumn,
        removedColumns: uploadState.removedColumns,
        addedColumns: uploadState.addedColumns.filter((column) => column.name.trim()),
      });
      setUploadState({
        file: null,
        batchName: '',
        contactColumn: '',
        preview: null,
        removedColumns: [],
        addedColumns: [],
        status: `${response.summary.totalRows} leads imported. Contact column: ${response.detectedContactColumn}`,
      });
      setActionMessage('Import completed successfully.');
      await loadMetadata();
      await loadLeads();
    } catch (error) {
      setUploadState((current) => ({
        ...current,
        status: error.response?.data?.message || 'Lead import failed',
      }));
    }
  };

  const handleFilterSubmit = async (event) => {
    event.preventDefault();
    await loadLeads(leadFilters);
  };

  const handleAssign = async () => {
    if (!selectedLeadIds.length || !assignAgentId) {
      setActionMessage('Choose leads and one agent before assigning.');
      return;
    }

    try {
      const response = await assignLeads({
        leadIds: selectedLeadIds,
        agentId: assignAgentId,
      });
      setActionMessage(response.message);
      setSelectedLeadIds([]);
      await loadLeads();
    } catch (error) {
      setActionMessage(error.response?.data?.message || 'Could not assign leads');
    }
  };

  const toggleRemovedColumn = (header) => {
    setUploadState((current) => ({
      ...current,
      removedColumns: current.removedColumns.includes(header)
        ? current.removedColumns.filter((item) => item !== header)
        : [...current.removedColumns, header],
    }));
  };

  const updateAddedColumn = (index, field, value) => {
    setUploadState((current) => ({
      ...current,
      addedColumns: current.addedColumns.map((column, columnIndex) =>
        columnIndex === index ? { ...column, [field]: value } : column
      ),
    }));
  };

  const addCustomColumn = () => {
    setUploadState((current) => ({
      ...current,
      addedColumns: [...current.addedColumns, createAddedColumn()],
    }));
  };

  const removeCustomColumn = (index) => {
    setUploadState((current) => ({
      ...current,
      addedColumns: current.addedColumns.filter((_, columnIndex) => columnIndex !== index),
    }));
  };

  if (isLoading) {
    return <div className="text-sm text-slate-500">Loading analyst workspace...</div>;
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Lead Upload</h2>
            <p className="mt-2 text-sm text-slate-600">
              Upload first, preview the detected contact column, remove unwanted columns, add custom columns, then import.
            </p>
          </div>
          <Link
            to="/lead-settings"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Open Product Settings
          </Link>
        </div>

        <form onSubmit={handlePreview} className="mt-5 grid gap-4 lg:grid-cols-4">
          <label className="text-sm font-medium text-slate-700">
            Product
            <select
              value={selectedProduct}
              onChange={(event) => setSelectedProduct(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            >
              {products.map((product) => (
                <option key={product} value={product}>
                  {product.toUpperCase()}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700 lg:col-span-2">
            File
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(event) =>
                setUploadState((current) => ({
                  ...current,
                  file: event.target.files?.[0] || null,
                  preview: null,
                  status: '',
                }))
              }
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Import name
            <input
              type="text"
              value={uploadState.batchName}
              onChange={(event) =>
                setUploadState((current) => ({
                  ...current,
                  batchName: event.target.value,
                }))
              }
              placeholder="Example: extrafreshleads"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Contact column override
            <input
              type="text"
              value={uploadState.contactColumn}
              onChange={(event) =>
                setUploadState((current) => ({
                  ...current,
                  contactColumn: event.target.value,
                }))
              }
              placeholder="Optional"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>

          <div className="lg:col-span-4">
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Preview File
            </button>
          </div>
        </form>

        {uploadState.status && <p className="mt-4 text-sm text-slate-600">{uploadState.status}</p>}

        {uploadState.preview && (
          <div className="mt-6 space-y-6 rounded-2xl bg-slate-50 p-5">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-slate-500">Detected contact column</div>
                <div className="mt-2 font-semibold text-slate-900">
                  {uploadState.preview.detectedContactColumn || 'Not detected'}
                </div>
              </div>
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-slate-500">Rows in file</div>
                <div className="mt-2 font-semibold text-slate-900">{uploadState.preview.totalRows}</div>
              </div>
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-slate-500">File</div>
                <div className="mt-2 font-semibold text-slate-900">{uploadState.preview.fileName}</div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Remove Uploaded Columns</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Uncheck nothing. Select columns you want to remove before import. The contact column should stay.
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {uploadState.preview.headers.map((header) => {
                    const isContactColumn = header === uploadState.contactColumn;
                    return (
                      <label key={header} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={uploadState.removedColumns.includes(header)}
                          disabled={isContactColumn}
                          onChange={() => toggleRemovedColumn(header)}
                        />
                        <span className="text-sm text-slate-700">
                          {header}
                          {isContactColumn ? ' (contact column)' : ''}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Add Custom Columns</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      Add new columns such as `Language`, `Priority`, or `Source Team`.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addCustomColumn}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Add Column
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {uploadState.addedColumns.length === 0 && (
                    <p className="text-sm text-slate-500">No custom columns added yet.</p>
                  )}
                  {uploadState.addedColumns.map((column, index) => (
                    <div key={column.id} className="grid gap-3 lg:grid-cols-[1fr,1fr,auto]">
                      <input
                        type="text"
                        value={column.name}
                        onChange={(event) => updateAddedColumn(index, 'name', event.target.value)}
                        placeholder="Column name"
                        className="rounded-xl border border-slate-300 px-3 py-2"
                      />
                      <input
                        type="text"
                        value={column.defaultValue}
                        onChange={(event) => updateAddedColumn(index, 'defaultValue', event.target.value)}
                        placeholder="Default value for all imported rows"
                        className="rounded-xl border border-slate-300 px-3 py-2"
                      />
                      <button
                        type="button"
                        onClick={() => removeCustomColumn(index)}
                        className="rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Preview After Column Changes</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    This is how the first rows will look after your remove/add changes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleImport}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  Import Edited Leads
                </button>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {visiblePreviewHeaders.map((header) => (
                        <th key={header} className="px-3 py-3 text-left font-semibold text-slate-700">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {previewRows.map((row, index) => (
                      <tr key={index}>
                        {visiblePreviewHeaders.map((header) => (
                          <td key={header} className="px-3 py-3 text-slate-600">
                            {row[header] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
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
                <option value="unique">Unique</option>
                <option value="duplicate_in_file">Duplicate in file</option>
                <option value="duplicate_in_system">Duplicate in system</option>
                <option value="duplicate_in_file_and_system">Duplicate in both</option>
              </select>
            </label>

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

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Pick</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Contact</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Product</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Duplicate</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Assigned</th>
                {previewColumns.map((column) => (
                  <th key={column} className="px-3 py-3 text-left font-semibold text-slate-700">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {leads.map((lead) => (
                <tr key={lead._id}>
                  <td className="px-3 py-3 align-top">
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.includes(lead._id)}
                      onChange={() => toggleLead(lead._id)}
                    />
                  </td>
                  <td className="px-3 py-3 align-top font-medium text-slate-900">{lead.contactNumber}</td>
                  <td className="px-3 py-3 align-top uppercase text-slate-600">{lead.product}</td>
                  <td className="px-3 py-3 align-top text-slate-600">{lead.duplicateStatus}</td>
                  <td className="px-3 py-3 align-top text-slate-600">{lead.assignedAgentCount}</td>
                  {previewColumns.map((column) => (
                    <td key={column} className="max-w-[220px] px-3 py-3 align-top text-slate-600">
                      {lead.rawData?.[column] || '—'}
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

export default AnalystDashboard;
