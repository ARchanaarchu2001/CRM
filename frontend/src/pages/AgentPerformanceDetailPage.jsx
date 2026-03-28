import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import KpiCardGrid from '../components/dashboard/KpiCardGrid.jsx';
import MetricTrendChart from '../components/dashboard/MetricTrendChart.jsx';
import { fetchAgentPerformanceDetail } from '../api/dashboard.js';
import { formatLastActivity, getFilterBadgeLabel } from '../utils/dashboard.js';

const AgentPerformanceDetailPage = () => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [detail, setDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const params = useMemo(() => {
    const range = searchParams.get('range') || 'today';
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    return {
      range,
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    };
  }, [searchParams]);

  useEffect(() => {
    const loadDetail = async () => {
      setIsLoading(true);
      setError('');

      try {
        const response = await fetchAgentPerformanceDetail(agentId, params);
        setDetail(response.detail);
      } catch (loadError) {
        setError(loadError.response?.data?.message || 'Failed to load agent performance detail');
      } finally {
        setIsLoading(false);
      }
    };

    loadDetail();
  }, [agentId, params.range, params.from, params.to]);

  const backPath = location.state?.from || '/dashboard';

  return (
    <div className="space-y-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Agent Detail</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            {detail?.agent?.agentName || 'Agent Performance'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {detail?.filter ? getFilterBadgeLabel(detail.filter) : 'Selected range'} performance, simplified for quick review.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back
          </button>
          <Link
            to={backPath}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Dashboard
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700">{error}</div>
      ) : isLoading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
          Loading agent performance...
        </div>
      ) : (
        <>
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Agent</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{detail?.agent?.agentName}</p>
                <p className="text-sm text-slate-500">{detail?.agent?.email}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{detail?.agent?.isActive ? 'Active' : 'Inactive'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Team</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{detail?.agent?.teamName || 'Unassigned Team'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Team Lead</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{detail?.agent?.teamLeadName || 'Unassigned'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last Activity</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{formatLastActivity(detail?.agent?.lastActivity)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending Leads</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{detail?.agent?.pendingLeads || 0}</p>
              </div>
            </div>
          </section>

          <KpiCardGrid kpis={detail?.kpis || []} />

          <div className="grid gap-6 xl:grid-cols-2">
            <MetricTrendChart
              title="Agent Dials Graph"
              description="This graph tracks only the selected agent's dial activity across the chosen date range."
              data={detail?.trend || []}
              metricKey="dials"
              color="#0f172a"
            />
            <MetricTrendChart
              title="Agent Submission Graph"
              description="This graph tracks only the selected agent's submissions across the same date-filtered period."
              data={detail?.trend || []}
              metricKey="submissions"
              color="#2563eb"
            />
          </div>
        </>
      )}
    </div>
  );
};

export default AgentPerformanceDetailPage;
