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

const ProductLeadConversionChart = ({ data = [] }) => {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Product Lead Conversion</h3>
        <p className="mt-1 text-sm text-slate-500">Compare total assigned leads and submitted leads for each product in the selected date range.</p>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
            <YAxis allowDecimals={false} tick={{ fill: '#475569', fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="totalLeads" name="Total Leads" fill="#0f172a" radius={[8, 8, 0, 0]} />
            <Bar dataKey="submissions" name="Submissions" fill="#2563eb" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};

export default ProductLeadConversionChart;
