import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const BAR_COLORS = ['#0f172a', '#1d4ed8', '#0891b2', '#059669', '#ea580c', '#7c3aed'];

const DialsTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) {
    return null;
  }

  const row = payload[0].payload;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xl">
      <p className="text-sm font-semibold text-slate-900">{row.agentName}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{row.teamName}</p>
      <p className="mt-2 text-sm font-medium text-slate-600">
        Dials: <span className="font-semibold text-slate-900">{row.dials}</span>
      </p>
    </div>
  );
};

const AllAgentDialsChart = ({ data = [] }) => {
  const chartHeight = Math.max(300, data.length * 48);

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Agent Activity</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">All Agent Dials</h3>
          <p className="mt-1 text-sm text-slate-500">Directly compare dial volume across every agent in the selected date window.</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Ranked by <span className="font-semibold text-slate-900">dial count</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div style={{ height: chartHeight, minWidth: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 8, right: 20, left: 10, bottom: 8 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fill: '#475569', fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1' }}
              />
              <YAxis
                type="category"
                dataKey="agentName"
                width={130}
                tick={{ fill: '#334155', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<DialsTooltip />} cursor={{ fill: '#e2e8f0', opacity: 0.35 }} />
              <Bar dataKey="dials" radius={[0, 10, 10, 0]}>
                {data.map((entry, index) => (
                  <Cell key={entry.agentId} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
};

export default AllAgentDialsChart;
