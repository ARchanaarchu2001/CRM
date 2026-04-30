import React, { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { formatMetricValue } from '../../utils/dashboard.js';

const AdvancedTrendChart = ({ data = [], title, description }) => {
  const [selectedPoint, setSelectedPoint] = useState(null);

  const selectedNode = selectedPoint || data.findLast?.((row) =>
    (row.dials || 0) + (row.connectCallCount || 0) + (row.reachableCount || 0) + (row.submissions || 0) > 0
  ) || data[data.length - 1] || null;

  const totals = useMemo(() => data.reduce((acc, row) => ({
    dials: acc.dials + Number(row.dials || 0),
    connectCallCount: acc.connectCallCount + Number(row.connectCallCount || 0),
    submissions: acc.submissions + Number(row.submissions || 0),
    activations: acc.activations + Number(row.activations || 0),
  }), {
    dials: 0,
    connectCallCount: 0,
    submissions: 0,
    activations: 0,
  }), [data]);

  const metrics = [
    { key: 'dials', label: 'Dials', color: '#4f46e5' },
    { key: 'connectCallCount', label: 'Connected', color: '#2563eb' },
    { key: 'submissions', label: 'Submissions', color: '#059669' },
  ];

  const handleChartClick = (chartState) => {
    const point = chartState?.activePayload?.[0]?.payload;
    if (point) {
      setSelectedPoint(point);
    }
  };

  const connectRate = selectedNode?.dials > 0
    ? ((selectedNode.connectCallCount || 0) / selectedNode.dials) * 100
    : 0;

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-slate-100 h-full">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h3>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[420px]">
          {metrics.map((metric) => (
            <div key={metric.key} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-bold uppercase text-slate-500">{metric.label}</p>
              <p className="mt-1 text-lg font-extrabold text-slate-900">{formatMetricValue(totals[metric.key])}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="h-[420px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 24, left: 0, bottom: 0 }}
              onClick={handleChartClick}
            >
              <defs>
                {metrics.map((metric) => (
                  <linearGradient key={metric.key} id={`color-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={metric.color} stopOpacity={0.12}/>
                    <stop offset="95%" stopColor={metric.color} stopOpacity={0}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '1rem',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                  padding: '1rem'
                }}
                cursor={{ stroke: '#cbd5e1', strokeWidth: 2 }}
              />
              <Legend verticalAlign="top" height={36} align="right" iconType="circle" />
              {metrics.map((metric) => (
                <Area
                  key={metric.key}
                  name={metric.label}
                  type="monotone"
                  dataKey={metric.key}
                  stroke={metric.color}
                  strokeWidth={3}
                  fillOpacity={1}
                  fill={`url(#color-${metric.key})`}
                  activeDot={{ r: 7, strokeWidth: 3, stroke: '#ffffff', cursor: 'pointer' }}
                  dot={{ r: 3, strokeWidth: 2, fill: '#ffffff', cursor: 'pointer' }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Selected Node</p>
          <h4 className="mt-2 text-2xl font-extrabold text-slate-900">{selectedNode?.label || 'No data'}</h4>
          <div className="mt-5 space-y-3">
            {metrics.map((metric) => (
              <div key={metric.key} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: metric.color }} />
                  {metric.label}
                </span>
                <span className="text-sm font-extrabold text-slate-950">{formatMetricValue(selectedNode?.[metric.key])}</span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
              <span className="text-sm font-semibold text-slate-600">Activations</span>
              <span className="text-sm font-extrabold text-slate-950">{formatMetricValue(selectedNode?.activations)}</span>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3">
            <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
              <p className="text-[11px] font-bold uppercase text-slate-400">Connect Rate</p>
              <p className="mt-1 text-lg font-extrabold text-blue-700">{connectRate.toFixed(1)}%</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default AdvancedTrendChart;
