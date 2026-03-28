import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import CreateAgentForm from '../components/users/CreateAgentForm';
import DateFilterBar from '../components/dashboard/DateFilterBar.jsx';
import KpiCardGrid from '../components/dashboard/KpiCardGrid.jsx';
import AgentMetricBarChart from '../components/dashboard/AgentMetricBarChart.jsx';
import AgentAnalyticsTable from '../components/dashboard/AgentAnalyticsTable.jsx';
import {
  deactivateDashboardUser,
  fetchTeamLeadDashboard,
  reactivateDashboardUser,
  removeDashboardUserFromTeam,
} from '../api/dashboard.js';
import { socket, connectSocket } from '../utils/socketClient.js';
import { buildDashboardParams, getDefaultDashboardFilter, getFilterBadgeLabel } from '../utils/dashboard.js';

const TeamLeadDash = () => {
  const navigate = useNavigate();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filter, setFilter] = useState(getDefaultDashboardFilter);
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoadingKey, setActionLoadingKey] = useState(null);
  const [banner, setBanner] = useState('');
  const [selectedAgent, setSelectedAgent] = useState(null);

  const { isSuccess, message } = useSelector((state) => state.userManagement || {});
  const params = useMemo(() => buildDashboardParams(filter), [filter]);

  const loadDashboard = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetchTeamLeadDashboard(params);
      setDashboard(response.dashboard);
      setSelectedAgent((current) => {
        if (!response.dashboard?.agentTable?.length) {
          return null;
        }

        if (!current) {
          return response.dashboard.agentTable[0];
        }

        return response.dashboard.agentTable.find((agent) => agent.agentId === current.agentId) || response.dashboard.agentTable[0];
      });
    } catch (loadError) {
      setError(loadError.response?.data?.message || 'Failed to load team dashboard');
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
      state: { from: '/team-lead-dash' },
    });
  };

  const handleToggleStatus = async (agentRow) => {
    const actionLabel = agentRow.isActive ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${actionLabel} ${agentRow.agentName}?`)) {
      return;
    }

    setActionLoadingKey(`status-${agentRow.agentId}`);
    setBanner('');

    try {
      if (agentRow.isActive) {
        await deactivateDashboardUser(agentRow.agentId);
        setBanner(`${agentRow.agentName} was deactivated successfully.`);
      } else {
        await reactivateDashboardUser(agentRow.agentId);
        setBanner(`${agentRow.agentName} was activated successfully.`);
      }
      await loadDashboard();
    } catch (statusError) {
      setBanner(statusError.response?.data?.message || `Failed to ${actionLabel} agent`);
    } finally {
      setActionLoadingKey(null);
    }
  };

  const handleRemoveFromTeam = async (agentRow) => {
    if (!window.confirm(`Remove ${agentRow.agentName} completely from your team?`)) {
      return;
    }

    setActionLoadingKey(`remove-${agentRow.agentId}`);
    setBanner('');

    try {
      await removeDashboardUserFromTeam(agentRow.agentId);
      setBanner(`${agentRow.agentName} was removed from the team.`);
      await loadDashboard();
    } catch (removeError) {
      setBanner(removeError.response?.data?.message || 'Failed to remove agent from team');
    } finally {
      setActionLoadingKey(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Team Lead Performance Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Compare agents by output, review team submission volume, and manage a selected agent from one focused workspace.
          </p>
        </div>

        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            showCreateForm ? 'bg-slate-500 hover:bg-slate-600 focus:ring-slate-500' : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
          }`}
        >
          {showCreateForm ? 'Cancel Creation' : 'Add New Agent'}
        </button>
      </div>

      {showCreateForm && (
        <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-300 ease-out">
          <CreateAgentForm />
        </div>
      )}

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Dashboard Filters</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">Team Dashboard Controls</h2>
          <p className="mt-1 text-sm text-slate-500">Keep the existing date filters while switching the team view between daily and range-based comparisons.</p>
        </div>
        <DateFilterBar filter={filter} onChange={handleFilterChange} isLoading={isLoading} />
      </section>

      {banner && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-800">
          {banner}
        </div>
      )}

      {error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700">{error}</div>
      ) : isLoading && !dashboard ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
          Loading team analytics...
        </div>
      ) : (
        <>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Current Scope</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">Team Overview</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Showing analytics for {getFilterBadgeLabel(dashboard?.filter)} across your managed agents.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                {dashboard?.agentTable?.length || 0} active agents
              </span>
            </div>
          </div>

          <KpiCardGrid kpis={dashboard?.kpis || []} />

          <div className="grid gap-6 xl:grid-cols-2">
            <AgentMetricBarChart
              title="Agents vs Dials"
              description="Simple dial comparison across all agents in your team for the selected date filter."
              data={dashboard?.charts?.agentDials || []}
              metricKey="dials"
              color="#0f172a"
            />
            <AgentMetricBarChart
              title="Agent Submissions in Team"
              description="Simple submission comparison across all agents in your team for the selected date filter."
              data={dashboard?.charts?.agentSubmissions || []}
              metricKey="submissions"
              color="#2563eb"
            />
          </div>

          <AgentAnalyticsTable
            rows={dashboard?.agentTable || []}
            selectedAgentId={selectedAgent?.agentId || ''}
            onSelectAgent={setSelectedAgent}
            onViewDetails={handleViewDetails}
          />
        </>
      )}
    </div>
  );
};

export default TeamLeadDash;
