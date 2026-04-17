import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6', '#ec4899'];

const DistributionPieCharts = ({ kpis = [], products = [] }) => {
  // 1. Status Distribution from summary KPIs
  const statusData = kpis
    .filter(kpi => ['submissions', 'activations', 'pendingLeads', 'pipelineCount'].includes(kpi.key))
    .map(kpi => ({ name: kpi.title, value: kpi.value }))
    .filter(item => item.value > 0);

  // 2. Product Distribution
  const productData = products
    .map(p => ({ name: p.label, value: p.totalLeads }))
    .filter(item => item.value > 0);

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
    const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));

    if (percent < 0.05) return null;

    return (
      <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-[10px] font-bold">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {/* Product Lead Mix */}
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-slate-900 tracking-tight">Product Lead Mix</h3>
          <p className="mt-1 text-sm text-slate-500">Distribution of leads across sales categories.</p>
        </div>
        <div className="h-[300px] w-full">
          {productData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={productData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  labelLine={false}
                  label={renderCustomizedLabel}
                >
                  {productData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} cornerRadius={4} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">No data for selected scope</div>
          )}
        </div>
      </div>

      {/* Outcome Distribution */}
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-slate-900 tracking-tight">Outcome Distribution</h3>
          <p className="mt-1 text-sm text-slate-500">Breakdown of current pipeline and conversions.</p>
        </div>
        <div className="h-[300px] w-full">
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={0}
                  outerRadius={100}
                  dataKey="value"
                  labelLine={false}
                  label={renderCustomizedLabel}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">No data for selected scope</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DistributionPieCharts;
