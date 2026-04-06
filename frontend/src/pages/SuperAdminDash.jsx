import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import DateFilterBar from '../components/dashboard/DateFilterBar.jsx';
import KpiCardGrid from '../components/dashboard/KpiCardGrid.jsx';
import TeamComparisonChart from '../components/dashboard/TeamComparisonChart.jsx';
import AgentMetricBarChart from '../components/dashboard/AgentMetricBarChart.jsx';
import AgentAnalyticsTable from '../components/dashboard/AgentAnalyticsTable.jsx';
import {
  fetchSuperAdminDashboard,
} from '../api/dashboard.js';
import { socket, connectSocket } from '../utils/socketClient.js';
import { buildDashboardParams, getDefaultDashboardFilter, getFilterBadgeLabel } from '../utils/dashboard.js';

const SuperAdminDash = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState(getDefaultDashboardFilter);
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('all');

  const { isSuccess, message } = useSelector((state) => state.userManagement || {});
  const params = useMemo(() => buildDashboardParams(filter), [filter]);

  const loadDashboard = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetchSuperAdminDashboard(params);
      setDashboard(response.dashboard);
    } catch (loadError) {
      setError(loadError.response?.data?.message || 'Failed to load super admin dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [filter.range, filter.from, filter.to]);

  useEffect(() => {
    if (isSuccess && message) {
      loadDashboard();
    }
  }, [isSuccess, message]);

  useEffect(() => {
    connectSocket();
    const refreshDashboard = () => {
      loadDashboard();
    };

    socket.on('agentMetricsUpdated', refreshDashboard);

    return () => {
      socket.off('agentMetricsUpdated', refreshDashboard);
    };
  }, [filter.range, filter.from, filter.to]);

  const handleFilterChange = (updates) => {
    setFilter((current) => ({ ...current, ...updates }));
  };

  const handleViewDetails = (agentRow) => {
    const searchParams = new URLSearchParams(params);
    navigate(`/agent-performance/${agentRow.agentId}?${searchParams.toString()}`, {
      state: { from: '/admin-dash' },
    });
  };

  const teamOptions = useMemo(() => {
    const rows = dashboard?.agentTable || [];
    const seen = new Set();
    const options = [];

    rows.forEach((row) => {
      const teamName = row.teamName || 'Unassigned Team';
      const value = row.teamId || `team:${teamName}`;

      if (seen.has(value)) {
        return;
      }

      seen.add(value);
      options.push({
        value,
        label: teamName,
        teamName,
      });
    });

    return options.sort((left, right) => left.label.localeCompare(right.label));
  }, [dashboard]);

  useEffect(() => {
    if (selectedTeam === 'all') {
      return;
    }

    const stillExists = teamOptions.some((option) => option.value === selectedTeam);
    if (!stillExists) {
      setSelectedTeam('all');
    }
  }, [selectedTeam, teamOptions]);

  const selectedTeamOption = useMemo(
    () => teamOptions.find((option) => option.value === selectedTeam) || null,
    [selectedTeam, teamOptions]
  );

  const scopedAgentRows = useMemo(() => {
    const rows = dashboard?.agentTable || [];

    if (selectedTeam === 'all') {
      return rows;
    }

    return rows.filter((row) => (row.teamId || `team:${row.teamName || 'Unassigned Team'}`) === selectedTeam);
  }, [dashboard, selectedTeam]);

  const scopedSummary = useMemo(() => {
    return scopedAgentRows.reduce(
      (summary, row) => ({
        dials: summary.dials + (row.dials || 0),
        submissions: summary.submissions + (row.submissions || 0),
        activations: summary.activations + (row.activations || 0),
        pipelineCount: summary.pipelineCount + (row.pipelineCount || 0),
        overduePipelineCount: summary.overduePipelineCount + (row.overduePipelineCount || 0),
        pendingLeads: summary.pendingLeads + (row.pendingLeads || 0),
      }),
      {
        dials: 0,
        submissions: 0,
        activations: 0,
        pipelineCount: 0,
        overduePipelineCount: 0,
        pendingLeads: 0,
      }
    );
  }, [scopedAgentRows]);

  const scopedKpis = useMemo(() => {
    const titles = dashboard?.kpiTitles || {};

    return [
      { key: 'dials', title: titles.dials || "Today's Dials", value: scopedSummary.dials },
      { key: 'submissions', title: titles.submissions || "Today's Submissions", value: scopedSummary.submissions },
      { key: 'activations', title: titles.activations || "Today's Activations", value: scopedSummary.activations },
      { key: 'pipelineCount', title: titles.pipelineCount || 'Pipeline Count', value: scopedSummary.pipelineCount },
      {
        key: 'overduePipelineCount',
        title: titles.overduePipelineCount || 'Overdue Pipeline',
        value: scopedSummary.overduePipelineCount,
      },
      { key: 'pendingLeads', title: titles.pendingLeads || 'Pending Leads', value: scopedSummary.pendingLeads },
    ];
  }, [dashboard, scopedSummary]);

  const scopedAgentDials = useMemo(
    () =>
      [...scopedAgentRows]
        .sort((left, right) => (right.dials || 0) - (left.dials || 0))
        .map((row) => ({
          agentId: row.agentId,
          agentName: row.agentName,
          dials: row.dials || 0,
          teamName: row.teamName,
        })),
    [scopedAgentRows]
  );

  const scopedAgentSubmissions = useMemo(
    () =>
      [...scopedAgentRows]
        .sort((left, right) => (right.submissions || 0) - (left.submissions || 0))
        .map((row) => ({
          agentId: row.agentId,
          agentName: row.agentName,
          submissions: row.submissions || 0,
          teamName: row.teamName,
        })),
    [scopedAgentRows]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-5">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Dashboard Filters</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">Global Dashboard Controls</h2>
          <p className="mt-1 text-sm text-slate-500">Filter the entire CRM view while keeping user management inside the dedicated settings workspace.</p>
        </div>
        <DateFilterBar filter={filter} onChange={handleFilterChange} isLoading={isLoading} />
      </section>

      {banner && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-800">
          {banner}
        </div>
      )}

      {error ? (
        <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-5 text-rose-700 sm:rounded-3xl sm:p-6">{error}</div>
      ) : isLoading && !dashboard ? (
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm sm:rounded-3xl sm:p-10">
          Loading global analytics...
        </div>
      ) : (
        <>
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Current Scope</p>
                <h2 className="mt-2 text-lg font-semibold text-slate-900 sm:text-xl">Global Overview</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Showing {getFilterBadgeLabel(dashboard?.filter)} performance for{' '}
                  {selectedTeamOption ? selectedTeamOption.teamName : 'all active agents in the system'}.
                </p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end lg:w-auto lg:justify-end">
                <label className="flex w-full min-w-0 flex-col gap-1 text-sm text-slate-600 sm:min-w-[220px] lg:w-auto">
                  <span className="font-medium text-slate-700">Team Scope</span>
                  <select
                    value={selectedTeam}
                    onChange={(event) => setSelectedTeam(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="all">All Teams</option>
                    {teamOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="inline-flex w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                  {scopedAgentRows.length} active agents
                </span>
              </div>
            </div>
          </div>

          <KpiCardGrid kpis={scopedKpis} />

          <TeamComparisonChart data={dashboard?.charts?.teamComparison || []} />

          <div className="grid gap-6 xl:grid-cols-2">
            <AgentMetricBarChart
              title="All Agents vs Dials"
              description="Simple dial comparison across the agents in the current team scope."
              data={scopedAgentDials}
              metricKey="dials"
              color="#0f172a"
            />
            <AgentMetricBarChart
              title="Whole Agent Submissions"
              description="Simple submission comparison across the agents in the current team scope."
              data={scopedAgentSubmissions}
              metricKey="submissions"
              color="#2563eb"
            />
          </div>

          <AgentAnalyticsTable
            rows={scopedAgentRows}
            onViewDetails={handleViewDetails}
            showTeam
          />
        </>
      )}
    </div>
  );
};

export default SuperAdminDash;
