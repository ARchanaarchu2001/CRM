import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const TeamComparisonTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xl">
      <p className="text-sm font-semibold text-slate-900">{label}</p>
      <div className="mt-2 space-y-1 text-sm text-slate-600">
        {payload.map((item) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
            <span className="font-semibold text-slate-900">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const TeamComparisonChart = ({ data = [] }) => {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Primary View</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900 sm:text-xl">Team Comparison</h3>
          <p className="mt-1 text-sm text-slate-500">
            Compare team-level dials, submissions, activations, and pending leads for the selected range.
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{data.length}</span> tracked teams
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="h-[20rem] min-w-[700px] sm:h-[24rem]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={6} barCategoryGap={20}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="team"
              tick={{ fill: '#475569', fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: '#475569', fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
            />
            <Tooltip content={<TeamComparisonTooltip />} />
            <Legend />
            <Bar dataKey="dials" name="Dials" fill="#0f172a" radius={[8, 8, 0, 0]} />
            <Bar dataKey="submissions" name="Submissions" fill="#2563eb" radius={[8, 8, 0, 0]} />
            <Bar dataKey="activations" name="Activations" fill="#059669" radius={[8, 8, 0, 0]} />
            <Bar dataKey="pendingLeads" name="Pending Leads" fill="#f59e0b" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
};

export default TeamComparisonChart;
