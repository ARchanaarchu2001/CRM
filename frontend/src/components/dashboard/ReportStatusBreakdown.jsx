import React from 'react';
import { formatMetricValue } from '../../utils/dashboard.js';

const ReportStatusBreakdown = ({ data = [], remarks = [] }) => {
  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100">
        <div className="border-b border-slate-100 p-6">
          <h3 className="text-lg font-bold text-slate-900 tracking-tight">Status-Wise Call Report</h3>
          <p className="mt-1 text-sm text-slate-500">Calls and outcomes for the selected agent, team, dataset, and date range.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Rows</th>
                <th className="px-5 py-4 text-right">Calls</th>
                <th className="px-5 py-4 text-right">Connected</th>
                <th className="px-5 py-4 text-right">Submitted</th>
                <th className="px-5 py-4 text-right">Activated</th>
                <th className="px-5 py-4 text-right">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.length > 0 ? data.map((row) => (
                <tr key={row.status} className="hover:bg-slate-50/70">
                  <td className="px-5 py-4 font-bold text-slate-900">{row.status || 'new'}</td>
                  <td className="px-5 py-4 text-right">{formatMetricValue(row.total)}</td>
                  <td className="px-5 py-4 text-right font-bold text-slate-900">{formatMetricValue(row.calls)}</td>
                  <td className="px-5 py-4 text-right text-blue-700">{formatMetricValue(row.connected)}</td>
                  <td className="px-5 py-4 text-right text-indigo-700">{formatMetricValue(row.submitted)}</td>
                  <td className="px-5 py-4 text-right text-emerald-700">{formatMetricValue(row.activated)}</td>
                  <td className="px-5 py-4 text-right text-amber-700">{formatMetricValue(row.pipelineOpen)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="8" className="px-5 py-12 text-center text-slate-400 italic">No status data for selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <h3 className="text-lg font-bold text-slate-900 tracking-tight">Top Remarks</h3>
        <p className="mt-1 text-sm text-slate-500">Most frequent call, interested, and not-interested remarks.</p>
        <div className="mt-5 space-y-3">
          {remarks.length > 0 ? remarks.slice(0, 10).map((row) => (
            <div key={row.remark} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-700">{row.remark}</p>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-900 ring-1 ring-slate-200">
                {formatMetricValue(row.count)}
              </span>
            </div>
          )) : (
            <p className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm italic text-slate-400">No remarks yet.</p>
          )}
        </div>
      </div>
    </section>
  );
};

export default ReportStatusBreakdown;
