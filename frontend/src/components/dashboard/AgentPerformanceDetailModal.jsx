import React from 'react';
import KpiCardGrid from './KpiCardGrid.jsx';
import PerformanceTrendChart from './PerformanceTrendChart.jsx';
import ProductPerformanceChart from './ProductPerformanceChart.jsx';
import { formatLastActivity, getFilterBadgeLabel } from '../../utils/dashboard.js';

const AgentPerformanceDetailModal = ({ detail, onClose, isLoading = false }) => {
  if (!detail && !isLoading) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[2rem] bg-slate-100 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Agent Drilldown</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              {detail?.agent?.agentName || 'Loading agent performance'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {detail?.agent?.email || 'Fetching detail analytics'} {detail?.filter ? `- ${getFilterBadgeLabel(detail.filter)}` : ''}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="space-y-6 p-6">
          {isLoading ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
              Loading agent detail...
            </div>
          ) : (
            <>
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last Activity</p>
                    <p className="mt-2 text-sm font-medium text-slate-900">{formatLastActivity(detail?.agent?.lastActivity)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pipeline Count</p>
                    <p className="mt-2 text-sm font-medium text-slate-900">{detail?.agent?.pipelineCount || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Overdue Pipeline</p>
                    <p className="mt-2 text-sm font-medium text-rose-600">{detail?.agent?.overduePipelineCount || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending Leads</p>
                    <p className="mt-2 text-sm font-medium text-amber-700">{detail?.agent?.pendingLeads || 0}</p>
                  </div>
                </div>
              </section>

              <KpiCardGrid kpis={detail?.kpis || []} />

              <div className="grid gap-6 xl:grid-cols-2">
                <PerformanceTrendChart
                  title="Selected-Range Trend"
                  description="Daily trend across dials, submissions, and activations for this agent."
                  data={detail?.trend || []}
                />
                <ProductPerformanceChart
                  title="Product-Wise Performance"
                  description="Dials, submissions, and activations split by product category."
                  data={detail?.productPerformance || []}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentPerformanceDetailModal;
