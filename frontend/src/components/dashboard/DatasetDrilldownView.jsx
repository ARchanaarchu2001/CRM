import React from 'react';
import FunnelChart from './FunnelChart.jsx';
import { formatMetricValue } from '../../utils/dashboard.js';
import { LuDatabase, LuUsers, LuPhone, LuFileText } from 'react-icons/lu';

const DatasetDrilldownView = ({ report, isLoading }) => {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50/50">
        <div className="flex flex-col items-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600 mb-4" />
          <p className="text-slate-500 font-medium">Loading dataset performance report...</p>
        </div>
      </div>
    );
  }

  if (!report || !report.dataset) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50/50">
        <div className="text-center text-slate-400">
          <LuDatabase className="mx-auto text-4xl mb-3 opacity-30" />
          <p>Select a dataset to view detailed analytics</p>
        </div>
      </div>
    );
  }

  const { dataset, funnel, agentDistribution, statusBreakdown } = report;

  const funnelData = [
    { label: 'Assigned Leads', value: funnel.assigned, color: '#94a3b8' },
    { label: 'Dialed', value: funnel.dialed, color: '#3b82f6' },
    { label: 'Connected', value: funnel.connected, color: '#06b6d4' },
    { label: 'Reachable', value: funnel.reachable, color: '#10b981' },
    { label: 'Submitted', value: funnel.submitted, color: '#6366f1' },
    { label: 'Activated', value: funnel.activated, color: '#8b5cf6' },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/30 p-8 space-y-8 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex items-center gap-6 pb-6 border-b border-slate-200">
        <div className="h-20 w-20 rounded-2xl bg-emerald-100 flex items-center justify-center shadow-sm">
          <LuDatabase className="text-4xl text-emerald-600" />
        </div>
        <div>
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-inset ring-emerald-700/10 mb-2">
            Dataset
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900">{dataset.batchName}</h1>
          <p className="text-slate-500 font-medium mt-1 uppercase tracking-widest text-xs">{dataset.product}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Total Rows</p>
          <p className="text-4xl font-black text-slate-800">
            {formatMetricValue(dataset.totalRows)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Funnel */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <span className="h-6 w-1 bg-emerald-500 rounded-full"></span>
              Dataset Funnel
            </h3>
            <FunnelChart data={funnelData} />
          </div>

          {/* Agent Distribution */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <span className="h-6 w-1 bg-emerald-500 rounded-full"></span>
              Agent Distribution
            </h3>
            
            <div className="space-y-4">
              {agentDistribution.map(agent => (
                <div key={agent.agentId} className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-colors">
                  <img src={agent.profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(agent.agentName)}`} alt={agent.agentName} className="w-10 h-10 rounded-full object-cover" />
                  <div className="flex-1">
                    <p className="font-bold text-slate-800">{agent.agentName}</p>
                    <p className="text-xs text-slate-500">{agent.teamName}</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-800">{agent.totalAssignedLeads}</p>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Assigned</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-blue-600">{agent.dials}</p>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Dials</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-600">{agent.submissions}</p>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Subs</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Quick Stats */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Quick Stats</h3>
            
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
              <div className="flex items-center gap-3">
                <LuUsers className="text-slate-400 text-lg" />
                <span className="font-medium text-slate-600">Assigned Leads</span>
              </div>
              <span className="font-bold text-slate-900">{funnel.assigned}</span>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
              <div className="flex items-center gap-3">
                <LuPhone className="text-slate-400 text-lg" />
                <span className="font-medium text-slate-600">Unworked Leads</span>
              </div>
              <span className="font-bold text-rose-600">{funnel.assigned - funnel.dialed}</span>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
              <div className="flex items-center gap-3">
                <LuFileText className="text-slate-400 text-lg" />
                <span className="font-medium text-slate-600">Duplicates Removed</span>
              </div>
              <span className="font-bold text-slate-900">{dataset.duplicateCount}</span>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Status Breakdown</h3>
            <div className="space-y-3">
              {statusBreakdown.slice(0, 5).map(status => (
                <div key={status.status} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">{status.status}</span>
                  <span className="text-sm font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded-lg">{status.total}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatasetDrilldownView;
