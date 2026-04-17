import React, { useMemo } from 'react';
import { DASHBOARD_RANGE_OPTIONS } from '../../utils/dashboard.js';

const ReportFilterPanel = ({ 
  filter, 
  onChange, 
  metadata = {}, 
  isLoading = false 
}) => {
  const { agents = [], recentImports = [] } = metadata;

  const teamOptions = useMemo(() => {
    const seen = new Set();
    const options = [];

    agents.forEach((agent) => {
      const label = agent.assignedTeam || agent.team?.name || 'Unassigned Team';
      const value = agent.team?._id ? agent.team._id : `team:${label}`;
      
      if (seen.has(value)) return;
      seen.add(value);
      options.push({ value, label });
    });

    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [agents]);

  const filteredAgents = useMemo(() => {
    if (!filter.teamId || filter.teamId === 'all') return agents;
    
    return agents.filter(agent => {
      const agentTeamValue = agent.team?._id ? agent.team._id : `team:${agent.assignedTeam || 'Unassigned Team'}`;
      return agentTeamValue === filter.teamId;
    });
  }, [agents, filter.teamId]);

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600">Reporting Scope</p>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Configure Your Report</h2>
          <p className="text-sm text-slate-500">Select the filters below to generate high-performance data visualizations.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {/* Range Selection */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Time Period</label>
            <select
              value={filter.range}
              disabled={isLoading}
              onChange={(e) => onChange({ range: e.target.value })}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 hover:border-slate-300"
            >
              {DASHBOARD_RANGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Team Selection */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Team / Department</label>
            <select
              value={filter.teamId || 'all'}
              disabled={isLoading}
              onChange={(e) => onChange({ teamId: e.target.value, agentId: 'all' })}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 hover:border-slate-300"
            >
              <option value="all">All Teams</option>
              {teamOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Agent Selection */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Individual Agent</label>
            <select
              value={filter.agentId || 'all'}
              disabled={isLoading}
              onChange={(e) => onChange({ agentId: e.target.value })}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 hover:border-slate-300"
            >
              <option value="all">All Agents in Scope</option>
              {filteredAgents.map((agent) => (
                <option key={agent._id} value={agent._id}>{agent.fullName}</option>
              ))}
            </select>
          </div>

          {/* Dataset Selection */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Data Set (Import Batch)</label>
            <select
              value={filter.importBatchId || ''}
              disabled={isLoading}
              onChange={(e) => onChange({ importBatchId: e.target.value })}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 hover:border-slate-300"
            >
              <option value="">Full Database</option>
              {recentImports.map((batch) => (
                <option key={batch._id} value={batch._id}>{batch.batchName} ({batch.product})</option>
              ))}
            </select>
          </div>
        </div>

        {filter.range === 'custom' && (
          <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <label className="text-xs font-bold uppercase text-slate-500">Start Date</label>
              <input
                type="date"
                value={filter.from}
                onChange={(e) => onChange({ from: e.target.value })}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <label className="text-xs font-bold uppercase text-slate-500">End Date</label>
              <input
                type="date"
                value={filter.to}
                onChange={(e) => onChange({ to: e.target.value })}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default ReportFilterPanel;
