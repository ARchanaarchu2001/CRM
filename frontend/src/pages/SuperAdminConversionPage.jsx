import React, { useEffect, useMemo, useState } from 'react';
import AgentProductConversionTable from '../components/dashboard/AgentProductConversionTable.jsx';
import DateFilterBar from '../components/dashboard/DateFilterBar.jsx';
import { fetchSuperAdminDashboard } from '../api/dashboard.js';
import { buildDashboardParams, getDefaultDashboardFilter, getFilterBadgeLabel } from '../utils/dashboard.js';

const SuperAdminConversionPage = () => {
  const [filter, setFilter] = useState(getDefaultDashboardFilter);
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('all');

  const params = useMemo(() => buildDashboardParams(filter), [filter]);

  useEffect(() => {
    const loadDashboard = async () => {
      setIsLoading(true);
      setError('');

      try {
        const response = await fetchSuperAdminDashboard(params);
        setDashboard(response.dashboard);
      } catch (loadError) {
        setError(loadError.response?.data?.message || 'Failed to load admin product conversion');
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, [filter.range, filter.from, filter.to]);

  const teamOptions = useMemo(() => {
    const rows = dashboard?.agentConversions || [];
    const seen = new Set();
    const options = [];

    rows.forEach((row) => {
      const label = row.teamName || 'Unassigned Team';
      const value = row.teamId || `team:${label}`;
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
      options.push({ value, label });
    });

    return options.sort((left, right) => left.label.localeCompare(right.label));
  }, [dashboard]);

  useEffect(() => {
    if (selectedTeam === 'all') {
      return;
    }

    if (!teamOptions.some((option) => option.value === selectedTeam)) {
      setSelectedTeam('all');
    }
  }, [selectedTeam, teamOptions]);

  const scopedAgentConversions = useMemo(() => {
    const rows = dashboard?.agentConversions || [];
    if (selectedTeam === 'all') {
      return rows;
    }
    return rows.filter((row) => (row.teamId || `team:${row.teamName || 'Unassigned Team'}`) === selectedTeam);
  }, [dashboard, selectedTeam]);

  const scopedProducts = useMemo(() => {
    const products = dashboard?.products || [];
    return products.map((product) => ({
      product: product.product,
      label: product.label,
      totalLeads: scopedAgentConversions.reduce(
        (sum, row) => sum + (row.products.find((item) => item.product === product.product)?.totalLeads || 0),
        0
      ),
      submissions: scopedAgentConversions.reduce(
        (sum, row) => sum + (row.products.find((item) => item.product === product.product)?.submissions || 0),
        0
      ),
    }));
  }, [dashboard, scopedAgentConversions]);

  const selectedTeamLabel = useMemo(
    () => teamOptions.find((option) => option.value === selectedTeam)?.label || 'All Teams',
    [selectedTeam, teamOptions]
  );

  return (
    <div className="space-y-6 py-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Admin Dashboard</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Product Conversion</h1>
            <p className="mt-1 text-sm text-slate-500">
              Review product-wise assigned leads and submissions across all teams or one selected team.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {dashboard?.filter ? getFilterBadgeLabel(dashboard.filter) : 'Today'}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),260px]">
          <DateFilterBar
            filter={filter}
            onChange={(updates) => setFilter((current) => ({ ...current, ...updates }))}
            isLoading={isLoading}
          />

          <label className="flex flex-col gap-1 self-start text-sm text-slate-600">
            <span className="font-medium text-slate-700">Team Scope</span>
            <select
              value={selectedTeam}
              onChange={(event) => setSelectedTeam(event.target.value)}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="all">All Teams</option>
              {teamOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : isLoading && !dashboard ? (
        <div className="rounded-[2rem] border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
          Loading product conversion...
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
            Showing product conversion for <span className="font-semibold text-slate-900">{selectedTeamLabel}</span>.
          </div>

          <AgentProductConversionTable
            rows={scopedAgentConversions}
            products={scopedProducts}
            title="Admin Product Conversion Table"
            description="Track how many leads each agent received from each product and how many submissions came from those same product leads."
          />
        </>
      )}
    </div>
  );
};

export default SuperAdminConversionPage;
