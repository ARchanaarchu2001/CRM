import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const SubmissionTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) {
    return null;
  }

  const row = payload[0].payload;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xl">
      <p className="text-sm font-semibold text-slate-900">{row.agentName}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{row.teamName}</p>
      <div className="mt-2 space-y-1 text-sm text-slate-600">
        <p>
          Submissions: <span className="font-semibold text-slate-900">{row.submissions}</span>
        </p>
        <p>
          Activations: <span className="font-semibold text-slate-900">{row.activations}</span>
        </p>
      </div>
    </div>
  );
};

const AgentAvatar = ({ agent }) => {
  if (agent.profilePhoto) {
    return (
      <img
        src={`/uploads/${agent.profilePhoto}`}
        alt={agent.agentName}
        className="h-11 w-11 rounded-full border border-slate-200 object-cover shadow-sm"
      />
    );
  }

  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
      {agent.agentName?.charAt(0)?.toUpperCase() || 'A'}
    </div>
  );
};

const AgentSubmissionLeaderboard = ({ data = [] }) => {
  const chartHeight = Math.max(280, data.length * 42);
  const maxSubmissions = Math.max(...data.map((agent) => agent.submissions || 0), 1);

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Submission View</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">Whole Agent Submission Graph</h3>
          <p className="mt-1 text-sm text-slate-500">
            Submission counts for all agents, with a visual leaderboard that keeps profile photos front and center.
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Sorted by <span className="font-semibold text-slate-900">submissions</span>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
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
                <Tooltip content={<SubmissionTooltip />} cursor={{ fill: '#dbeafe', opacity: 0.35 }} />
                <Bar dataKey="submissions" fill="#2563eb" radius={[0, 10, 10, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-3">
          {data.map((agent, index) => (
            <div
              key={agent.agentId}
              className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                {index + 1}
              </div>
              <AgentAvatar agent={agent} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{agent.agentName}</p>
                    <p className="truncate text-xs text-slate-500">{agent.teamName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-900">{agent.submissions}</p>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Submissions</p>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                    style={{ width: `${Math.max((agent.submissions / maxSubmissions) * 100, agent.submissions > 0 ? 8 : 0)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}

          {data.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              No submission data found for the selected range.
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default AgentSubmissionLeaderboard;
