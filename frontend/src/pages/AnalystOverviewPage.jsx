import React, { useEffect, useMemo, useState } from 'react';
import AgentMetricBarChart from '../components/dashboard/AgentMetricBarChart.jsx';
import AgentProductConversionTable from '../components/dashboard/AgentProductConversionTable.jsx';
import DateFilterBar from '../components/dashboard/DateFilterBar.jsx';
import KpiCardGrid from '../components/dashboard/KpiCardGrid.jsx';
import { fetchAnalystPerformanceOverview } from '../api/leads.js';
import { buildDashboardParams, getDefaultDashboardFilter, getFilterBadgeLabel } from '../utils/dashboard.js';

const AnalystOverviewPage = () => {
  const [filter, setFilter] = useState(getDefaultDashboardFilter);
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState('all');

  const dashboardParams = useMemo(() => buildDashboardParams(filter), [filter]);

  useEffect(() => {
    const loadOverview = async () => {
      setIsLoading(true);
      setError('');

      try {
        const response = await fetchAnalystPerformanceOverview(dashboardParams);
        setOverview(response.dashboard);
      } catch (loadError) {
        setError(loadError.response?.data?.message || 'Failed to load analyst overview');
      } finally {
        setIsLoading(false);
      }
    };

    loadOverview();
  }, [filter.range, filter.from, filter.to]);

  const teamOptions = useMemo(() => {
    const rows = overview?.agentTable || [];
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
  }, [overview]);

  useEffect(() => {
    if (selectedTeam === 'all') {
      return;
    }

    if (!teamOptions.some((option) => option.value === selectedTeam)) {
      setSelectedTeam('all');
    }
  }, [selectedTeam, teamOptions]);

  const selectedTeamLabel = useMemo(
    () => teamOptions.find((option) => option.value === selectedTeam)?.label || 'All Agents',
    [selectedTeam, teamOptions]
  );

  const scopedAgents = useMemo(() => {
    const rows = overview?.agentTable || [];
    if (selectedTeam === 'all') {
      return rows;
    }
    return rows.filter((row) => (row.teamId || `team:${row.teamName || 'Unassigned Team'}`) === selectedTeam);
  }, [overview, selectedTeam]);

  const scopedKpis = useMemo(() => {
    const summary = scopedAgents.reduce(
      (accumulator, row) => ({
        dials: accumulator.dials + (row.dials || 0),
        submissions: accumulator.submissions + (row.submissions || 0),
        activations: accumulator.activations + (row.activations || 0),
        pendingLeads: accumulator.pendingLeads + (row.pendingLeads || 0),
      }),
      { dials: 0, submissions: 0, activations: 0, pendingLeads: 0 }
    );

    return [
      { key: 'dials', title: overview?.kpiTitles?.dials || "Today's Dials", value: summary.dials },
      { key: 'submissions', title: overview?.kpiTitles?.submissions || "Today's Submissions", value: summary.submissions },
      { key: 'activations', title: overview?.kpiTitles?.activations || "Today's Activations", value: summary.activations },
      { key: 'pendingLeads', title: overview?.kpiTitles?.pendingLeads || "Today's Pending Leads", value: summary.pendingLeads },
    ];
  }, [overview, scopedAgents]);

  const scopedAgentConversions = useMemo(() => {
    const rows = overview?.agentConversions || [];
    if (selectedTeam === 'all') {
      return rows;
    }
    return rows.filter((row) => (row.teamId || `team:${row.teamName || 'Unassigned Team'}`) === selectedTeam);
  }, [overview, selectedTeam]);

  const scopedProducts = useMemo(() => {
    const productsOrder = overview?.products || [];
    return productsOrder.map((product) => ({
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
  }, [overview, scopedAgentConversions]);

  const scopedAgentDials = useMemo(
    () =>
      [...scopedAgents]
        .sort((left, right) => (right.dials || 0) - (left.dials || 0))
        .map((row) => ({
          agentName: row.agentName,
          dials: row.dials || 0,
        })),
    [scopedAgents]
  );

  const scopedAgentSubmissions = useMemo(
    () =>
      [...scopedAgents]
        .sort((left, right) => (right.submissions || 0) - (left.submissions || 0))
        .map((row) => ({
          agentName: row.agentName,
          submissions: row.submissions || 0,
        })),
    [scopedAgents]
  );

  return (
    <div className="space-y-6 py-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Analyst Overview</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Performance Overview</h1>
            <p className="mt-1 text-sm text-slate-500">
              Review KPI cards, product conversion, and agent activity before working inside the upload workspace.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {overview?.filter ? getFilterBadgeLabel(overview.filter) : 'Today'}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),260px]">
          <DateFilterBar filter={filter} onChange={(updates) => setFilter((current) => ({ ...current, ...updates }))} isLoading={isLoading} />

          <label className="flex flex-col gap-1 self-start text-sm text-slate-600">
            <span className="font-medium text-slate-700">Team Scope</span>
            <select
              value={selectedTeam}
              onChange={(event) => setSelectedTeam(event.target.value)}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="all">All Agents</option>
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
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>
      ) : (
        <>
          <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 shadow-sm border border-slate-200">
            Showing overview for <span className="font-semibold text-slate-900">{selectedTeamLabel}</span>.
          </div>

          <KpiCardGrid kpis={scopedKpis} />

          <AgentProductConversionTable
            rows={scopedAgentConversions}
            products={scopedProducts}
            title="Agent Product Conversion Table"
            description="Understand clearly, for each agent, how many total leads were assigned from each product and how many submissions were made from those same product leads."
          />

          <div className="grid gap-6 xl:grid-cols-2">
            <AgentMetricBarChart
              title="Agents vs Dials"
              description="Simple dial comparison for all agents or the selected team."
              data={scopedAgentDials}
              metricKey="dials"
              color="#0f172a"
            />
            <AgentMetricBarChart
              title="Agent Submissions"
              description="Simple submission comparison for all agents or the selected team."
              data={scopedAgentSubmissions}
              metricKey="submissions"
              color="#2563eb"
            />
          </div>
        </>
      )}
    </div>
  );
};

export default AnalystOverviewPage;
