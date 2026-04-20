import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AgentAnalyticsTable from '../components/dashboard/AgentAnalyticsTable.jsx';
import DateFilterBar from '../components/dashboard/DateFilterBar.jsx';
import { fetchAnalystPerformanceOverview } from '../api/leads.js';
import { socket } from '../utils/socketClient.js';
import { buildDashboardParams, getDefaultDashboardFilter, getFilterBadgeLabel } from '../utils/dashboard.js';

const AnalystAgentPerformancePage = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState(getDefaultDashboardFilter);
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [selectedAgent, setSelectedAgent] = useState(null);

  const dashboardParams = useMemo(() => buildDashboardParams(filter), [filter]);

  const loadOverview = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetchAnalystPerformanceOverview(dashboardParams);
      setOverview(response.dashboard);
    } catch (loadError) {
      setError(loadError.response?.data?.message || 'Failed to load analyst agent performance');
    } finally {
      setIsLoading(false);
    }
  }, [dashboardParams]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    const refreshOverview = () => {
      loadOverview();
    };

    socket.on('assignmentCreated', refreshOverview);
    socket.on('assignmentRemoved', refreshOverview);

    return () => {
      socket.off('assignmentCreated', refreshOverview);
      socket.off('assignmentRemoved', refreshOverview);
    };
  }, [loadOverview]);

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

  const scopedAgents = useMemo(() => {
    const rows = overview?.agentTable || [];
    if (selectedTeam === 'all') {
      return rows;
    }

    return rows.filter((row) => (row.teamId || `team:${row.teamName || 'Unassigned Team'}`) === selectedTeam);
  }, [overview, selectedTeam]);

  useEffect(() => {
    setSelectedAgent((current) => {
      if (!scopedAgents.length) {
        return null;
      }

      if (!current) {
        return scopedAgents[0];
      }

      return scopedAgents.find((agent) => agent.agentId === current.agentId) || scopedAgents[0];
    });
  }, [scopedAgents]);

  const selectedTeamLabel = useMemo(
    () => teamOptions.find((option) => option.value === selectedTeam)?.label || 'All Agents',
    [selectedTeam, teamOptions]
  );

  const handleViewDetails = (agentRow) => {
    const searchParams = new URLSearchParams(dashboardParams);
    navigate(`/agent-performance/${agentRow.agentId}?${searchParams.toString()}`, {
      state: { from: '/analyst-agent-performance' },
    });
  };

  const handleOpenAgentDashboard = (agentRow) => {
    navigate(`/analyst/agents/${agentRow.agentId}/dashboard`);
  };

  return (
    <div className="space-y-6 py-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Analyst Overview</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Agent Performance</h1>
            <p className="mt-1 text-sm text-slate-500">
              Review the full analyst-side agent performance list in one dedicated section.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {overview?.filter ? getFilterBadgeLabel(overview.filter) : 'Today'}
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
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : isLoading && !overview ? (
        <div className="rounded-[2rem] border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
          Loading agent performance...
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
            Showing performance for <span className="font-semibold text-slate-900">{selectedTeamLabel}</span>.
          </div>

          <AgentAnalyticsTable
            rows={scopedAgents}
            showTeam
            selectedAgentId={selectedAgent?.agentId || ''}
            onSelectAgent={setSelectedAgent}
            onViewDetails={handleViewDetails}
            onOpenAgentDashboard={handleOpenAgentDashboard}
          />
        </>
      )}
    </div>
  );
};

export default AnalystAgentPerformancePage;
