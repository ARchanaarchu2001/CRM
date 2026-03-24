import React, { useEffect, useMemo, useState } from 'react';
import {
  assignLeads,
  fetchAnalystLeads,
  fetchLeadMetadata,
  importLeadFile,
  updateRemarkConfig,
} from '../api/leads.js';

const createInitialRemarkState = (configs = []) =>
  configs.reduce((accumulator, config) => {
    accumulator[config.product] = {
      callingRemarks: (config.callingRemarks || []).join('\n'),
      interestedRemarks: (config.interestedRemarks || []).join('\n'),
      notInterestedRemarks: (config.notInterestedRemarks || []).join('\n'),
    };
    return accumulator;
  }, {});

const AnalystDashboard = () => {
  const [products, setProducts] = useState(['mnp', 'p2p', 'fne', 'plus', 'general']);
  const [agents, setAgents] = useState([]);
  const [remarkState, setRemarkState] = useState({});
  const [selectedProduct, setSelectedProduct] = useState('p2p');
  const [file, setFile] = useState(null);
  const [contactColumn, setContactColumn] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
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

  const loadMetadata = async () => {
    const data = await fetchLeadMetadata();
    setProducts(data.products || []);
    setAgents(data.agents || []);
    setRemarkState(createInitialRemarkState(data.remarkConfigs || []));
    setSelectedProduct((currentProduct) => currentProduct || data.products?.[0] || 'p2p');
    setAssignAgentId((currentAgentId) => currentAgentId || data.agents?.[0]?._id || '');
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

  const currentRemarkConfig = remarkState[selectedProduct] || {
    callingRemarks: '',
    interestedRemarks: '',
    notInterestedRemarks: '',
  };

  const previewColumns = useMemo(() => {
    const keys = new Set();
    leads.slice(0, 10).forEach((lead) => {
      Object.keys(lead.rawData || {})
        .slice(0, 6)
        .forEach((key) => keys.add(key));
    });
    return Array.from(keys).slice(0, 6);
  }, [leads]);

  const toggleLead = (leadId) => {
    setSelectedLeadIds((current) =>
      current.includes(leadId) ? current.filter((id) => id !== leadId) : [...current, leadId]
    );
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!file) {
      setUploadStatus('Please choose a file first.');
      return;
    }

    try {
      setUploadStatus('Uploading leads...');
      const response = await importLeadFile({
        product: selectedProduct,
        file,
        contactColumn,
      });
      setUploadStatus(
        `${response.summary.totalRows} leads imported. Contact column: ${response.detectedContactColumn}`
      );
      setFile(null);
      setContactColumn('');
      event.target.reset();
      await loadMetadata();
      await loadLeads();
    } catch (error) {
      setUploadStatus(error.response?.data?.message || 'Lead upload failed');
    }
  };

  const handleRemarkSave = async () => {
    try {
      const payload = {
        callingRemarks: currentRemarkConfig.callingRemarks.split('\n'),
        interestedRemarks: currentRemarkConfig.interestedRemarks.split('\n'),
        notInterestedRemarks: currentRemarkConfig.notInterestedRemarks.split('\n'),
      };
      const response = await updateRemarkConfig(selectedProduct, payload);
      setRemarkState((current) => ({
        ...current,
        [selectedProduct]: {
          callingRemarks: response.remarkConfig.callingRemarks.join('\n'),
          interestedRemarks: response.remarkConfig.interestedRemarks.join('\n'),
          notInterestedRemarks: response.remarkConfig.notInterestedRemarks.join('\n'),
        },
      }));
      setActionMessage(`Remark options saved for ${selectedProduct.toUpperCase()}.`);
    } catch (error) {
      setActionMessage(error.response?.data?.message || 'Could not save remark options');
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

  if (isLoading) {
    return <div className="text-sm text-slate-500">Loading analyst workspace...</div>;
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={handleUpload} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Lead Upload</h2>
          <p className="mt-2 text-sm text-slate-600">
            Upload CSV or Excel files. Only the contact number column needs mapping if the system cannot detect it automatically.
          </p>

          <div className="mt-5 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
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

            <label className="block text-sm font-medium text-slate-700">
              File
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Contact column override
              <input
                type="text"
                value={contactColumn}
                onChange={(event) => setContactColumn(event.target.value)}
                placeholder="Optional. Example: Mobile No or MSISDN"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>

            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Import Leads
            </button>

            {uploadStatus && <p className="text-sm text-slate-600">{uploadStatus}</p>}
          </div>
        </form>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Product Remarks</h2>
              <p className="mt-2 text-sm text-slate-600">
                Agents can only select from these options. Only analysts can edit them.
              </p>
            </div>
            <select
              value={selectedProduct}
              onChange={(event) => setSelectedProduct(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              {products.map((product) => (
                <option key={product} value={product}>
                  {product.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-5 grid gap-4">
            <label className="text-sm font-medium text-slate-700">
              Calling remarks
              <textarea
                rows="6"
                value={currentRemarkConfig.callingRemarks}
                onChange={(event) =>
                  setRemarkState((current) => ({
                    ...current,
                    [selectedProduct]: {
                      ...currentRemarkConfig,
                      callingRemarks: event.target.value,
                    },
                  }))
                }
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Interested remarks
              <textarea
                rows="5"
                value={currentRemarkConfig.interestedRemarks}
                onChange={(event) =>
                  setRemarkState((current) => ({
                    ...current,
                    [selectedProduct]: {
                      ...currentRemarkConfig,
                      interestedRemarks: event.target.value,
                    },
                  }))
                }
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Not interested remarks
              <textarea
                rows="4"
                value={currentRemarkConfig.notInterestedRemarks}
                onChange={(event) =>
                  setRemarkState((current) => ({
                    ...current,
                    [selectedProduct]: {
                      ...currentRemarkConfig,
                      notInterestedRemarks: event.target.value,
                    },
                  }))
                }
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>

            <button
              type="button"
              onClick={handleRemarkSave}
              className="w-fit rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Save Remark Options
            </button>
          </div>
        </section>
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
