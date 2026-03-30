import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchManagedAgentDashboardView } from '../api/leads.js';

const ManagedAgentDashboardView = () => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const [view, setView] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadView = async () => {
      setIsLoading(true);
      setError('');

      try {
        const response = await fetchManagedAgentDashboardView(agentId);
        setView(response.view);
      } catch (loadError) {
        setError(loadError.response?.data?.message || 'Failed to load agent dashboard view');
      } finally {
        setIsLoading(false);
      }
    };

    loadView();
  }, [agentId]);

  if (isLoading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">Loading agent dashboard...</div>;
  }

  if (error) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>;
  }

  return (
    <div className="space-y-6 py-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Read Only View</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{view?.agent?.fullName} Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">View-only dashboard snapshot for this agent. Team Leads cannot edit from here.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Work Queue</h2>
            <p className="mt-2 text-sm text-slate-600">Current queue mix for this agent across pending, follow up, callback, and interested leads.</p>
          </div>
          <Link
            to={`/team-lead/agents/${agentId}/pipeline`}
            className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            View Pipeline
          </Link>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <div className="text-sm font-medium text-amber-900">Pending / Undialed</div>
            <div className="mt-2 text-3xl font-bold text-amber-800">{view?.queueSummary?.pending || 0}</div>
          </div>
          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5 shadow-sm">
            <div className="text-sm font-medium text-yellow-900">Follow Up</div>
            <div className="mt-2 text-3xl font-bold text-yellow-800">{view?.queueSummary?.followUp || 0}</div>
          </div>
          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
            <div className="text-sm font-medium text-orange-900">Callback</div>
            <div className="mt-2 text-3xl font-bold text-orange-800">{view?.queueSummary?.callback || 0}</div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <div className="text-sm font-medium text-emerald-900">Interested</div>
            <div className="mt-2 text-3xl font-bold text-emerald-800">{view?.queueSummary?.interested || 0}</div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Pipeline Summary</h2>
            <p className="mt-2 text-sm text-slate-600">Quick read-only snapshot of this agent’s pipeline workload.</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-slate-700">{view?.pipelineSummary?.totalPipelineRows || 0} in pipeline</div>
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-800">{view?.pipelineSummary?.dueTodayCount || 0} due today</div>
          <div className="rounded-2xl bg-rose-50 px-4 py-3 text-rose-800">{view?.pipelineSummary?.overdueCount || 0} overdue</div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {(view?.batches || []).map((batch) => (
          <article key={String(batch.importBatchId)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{batch.batchName}</h3>
              <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{batch.product}</p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
              <span>{batch.totalRows} rows</span>
              <span>{batch.notDialedCount || 0} pending</span>
              <span>{batch.dialedCount || 0} dialed</span>
              <span>{batch.followUpCount || 0} follow up</span>
              <span>{batch.callbackCount || 0} callback</span>
              <span>{batch.interestedCount || 0} interested</span>
              <span>{batch.pipelineCount || 0} in pipeline</span>
              <span>{batch.submittedCount || 0} submitted</span>
              <span>{batch.activatedCount || 0} activated</span>
            </div>
          </article>
        ))}

        {!(view?.batches || []).length && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            No visible batches assigned.
          </div>
        )}
      </section>
    </div>
  );
};

export default ManagedAgentDashboardView;
