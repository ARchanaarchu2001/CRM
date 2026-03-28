import React from 'react';
import { formatMetricValue } from '../../utils/dashboard.js';

const toneClasses = {
  dials: 'border-slate-900',
  submissions: 'border-indigo-600',
  activations: 'border-emerald-600',
  pipelineCount: 'border-slate-400',
  overduePipelineCount: 'border-rose-500',
  pendingLeads: 'border-amber-500',
};

const KpiCardGrid = ({ kpis = [] }) => {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {kpis.map((kpi) => (
        <article
          key={kpi.key}
          className={`rounded-[2rem] border border-slate-200 border-t-4 bg-white p-5 shadow-sm ${toneClasses[kpi.key] || toneClasses.dials}`}
        >
          <p className="text-sm font-medium text-slate-500">{kpi.title}</p>
          <p className="mt-4 text-4xl font-bold tracking-tight text-slate-900">{formatMetricValue(kpi.value)}</p>
        </article>
      ))}
    </section>
  );
};

export default KpiCardGrid;
