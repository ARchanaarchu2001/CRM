import React, { useEffect, useMemo, useState } from 'react';
import DateFilterBar from '../components/dashboard/DateFilterBar.jsx';
import ProductLeadConversionChart from '../components/dashboard/ProductLeadConversionChart.jsx';
import { fetchTeamLeadConversionOverview } from '../api/leads.js';
import { buildDashboardParams, getDefaultDashboardFilter, getFilterBadgeLabel } from '../utils/dashboard.js';

const TeamLeadConversionPage = () => {
  const [filter, setFilter] = useState(getDefaultDashboardFilter);
  const [overview, setOverview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const params = useMemo(() => buildDashboardParams(filter), [filter]);

  const loadOverview = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetchTeamLeadConversionOverview(params);
      setOverview(response.overview);
    } catch (loadError) {
      setError(loadError.response?.data?.message || 'Failed to load conversion overview');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, [filter.range, filter.from, filter.to]);

  const handleFilterChange = (updates) => {
    setFilter((current) => ({ ...current, ...updates }));
  };

  return (
    <div className="space-y-6 py-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Data Conversion</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Product Conversion Workspace</h1>
            <p className="mt-1 text-sm text-slate-500">
              Review how many leads were given by product and how many submissions were made by each agent for the selected period.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {overview?.filter ? getFilterBadgeLabel(overview.filter) : 'Today'}
          </div>
        </div>
      </section>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <DateFilterBar filter={filter} onChange={handleFilterChange} isLoading={isLoading} />
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>
      ) : isLoading && !overview ? (
        <div className="rounded-[2rem] border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">Loading conversion overview...</div>
      ) : (
        <>
          <ProductLeadConversionChart data={overview?.products || []} />

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Agent Product Conversion Table</h2>
              <p className="mt-1 text-sm text-slate-500">Track total assigned leads and submissions by agent, broken down across products.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1100px] text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-700">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Agent</th>
                    <th className="px-4 py-3 font-semibold text-center">Total Leads</th>
                    <th className="px-4 py-3 font-semibold text-center">Submissions</th>
                    {(overview?.products || []).map((product) => (
                      <th key={product.product} className="px-4 py-3 font-semibold text-center">
                        {product.label} Leads/Submissions
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(overview?.agents || []).map((agent) => (
                    <tr key={agent.agentId} className="border-t border-slate-100">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          {agent.profilePhoto ? (
                            <img src={`/uploads/${agent.profilePhoto}`} alt={agent.agentName} className="h-10 w-10 rounded-full border border-slate-200 object-cover" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-700">
                              {agent.agentName?.charAt(0)?.toUpperCase() || 'A'}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-slate-900">{agent.agentName}</p>
                            <p className="text-xs text-slate-500">{agent.teamName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center font-semibold text-slate-900">{agent.totalAssignedLeads}</td>
                      <td className="px-4 py-4 text-center font-semibold text-slate-900">{agent.totalSubmissions}</td>
                      {agent.products.map((product) => (
                        <td key={`${agent.agentId}-${product.product}`} className="px-4 py-4 text-center text-slate-700">
                          {product.totalLeads} / {product.submissions}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default TeamLeadConversionPage;
