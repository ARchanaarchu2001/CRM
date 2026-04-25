import React, { useState } from 'react';
import { formatMetricValue } from '../../utils/dashboard.js';

const toneClasses = {
  dials: 'border-slate-900',
  connectCallCount: 'border-blue-600',
  reachableCount: 'border-teal-600',
  submissions: 'border-indigo-600',
  activations: 'border-emerald-600',
  pipelineCount: 'border-slate-400',
  overduePipelineCount: 'border-rose-500',
  pendingLeads: 'border-amber-500',
};

const KpiCardGrid = ({ kpis = [], agentData = [] }) => {
  const [selectedKpi, setSelectedKpi] = useState(null);

  const handleKpiClick = (kpi) => {
    if (['dials', 'connectCallCount', 'reachableCount', 'submissions', 'activations'].includes(kpi.key)) {
      setSelectedKpi(kpi);
    }
  };

  const closeModal = () => setSelectedKpi(null);

  const getAgentDataForKpi = (kpiKey) => {
    return agentData.map(agent => ({
      name: agent.agentName,
      value: agent[kpiKey] || 0,
      team: agent.teamName,
    })).sort((a, b) => b.value - a.value);
  };

  const getKpiLabel = (key) => {
    const labels = {
      dials: 'Dials',
      connectCallCount: 'Connect Calls',
      reachableCount: 'Reachable',
      submissions: 'Submissions',
      activations: 'Activations',
    };
    return labels[key] || key;
  };

  return (
    <>
      <section className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
        {kpis.map((kpi) => (
          <article
            key={kpi.key}
            onClick={() => handleKpiClick(kpi)}
            className={`rounded-[1.5rem] border border-slate-200 border-t-4 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-5 ${toneClasses[kpi.key] || toneClasses.dials} ${
              ['dials', 'connectCallCount', 'reachableCount', 'submissions', 'activations'].includes(kpi.key)
                ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all'
                : ''
            }`}
          >
            <p className="text-sm font-medium text-slate-500">{kpi.title}</p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:mt-4 sm:text-4xl">{formatMetricValue(kpi.value)}</p>
            {['dials', 'connectCallCount', 'reachableCount', 'submissions', 'activations'].includes(kpi.key) && (
              <p className="mt-2 text-xs text-slate-400 font-medium">Click for details</p>
            )}
          </article>
        ))}
      </section>

      {/* Modal for detailed breakdown */}
      {selectedKpi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeModal}>
          <div 
            className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">{getKpiLabel(selectedKpi.key)} Breakdown</h3>
                <p className="text-sm text-slate-500 mt-1">Total: {formatMetricValue(selectedKpi.value)}</p>
              </div>
              <button 
                onClick={closeModal}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <table className="w-full">
                <thead className="sticky top-0 bg-white border-b border-slate-200">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-bold text-slate-600">Agent</th>
                    <th className="text-left py-3 px-4 text-sm font-bold text-slate-600">Team</th>
                    <th className="text-right py-3 px-4 text-sm font-bold text-slate-600">{getKpiLabel(selectedKpi.key)}</th>
                    <th className="text-right py-3 px-4 text-sm font-bold text-slate-600">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {getAgentDataForKpi(selectedKpi.key).map((agent, index) => (
                    <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 text-sm font-medium text-slate-900">{agent.name}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">{agent.team}</td>
                      <td className="py-3 px-4 text-sm font-bold text-slate-900 text-right">{formatMetricValue(agent.value)}</td>
                      <td className="py-3 px-4 text-sm text-slate-600 text-right">
                        {selectedKpi.value > 0 ? ((agent.value / selectedKpi.value) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default KpiCardGrid;
