import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchManagedAgentPipelineView } from '../api/leads.js';
import { formatContactDisplay } from '../utils/contactNumber.js';

const ManagedAgentPipelineView = () => {
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
        const response = await fetchManagedAgentPipelineView(agentId);
        setView(response.view);
      } catch (loadError) {
        setError(loadError.response?.data?.message || 'Failed to load agent pipeline view');
      } finally {
        setIsLoading(false);
      }
    };

    loadView();
  }, [agentId]);

  if (isLoading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">Loading pipeline...</div>;
  }

  if (error) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>;
  }

  return (
    <div className="space-y-6 py-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Read Only View</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">{view?.agent?.fullName} Pipeline</h2>
            <p className="mt-2 text-sm text-slate-600">View-only pipeline for this agent. No updates can be made from here.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-800">{view?.dueTodayCount || 0} due today</div>
          <div className="rounded-2xl bg-rose-50 px-4 py-3 text-rose-800">{view?.overdueCount || 0} overdue</div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-slate-700">{view?.assignments?.length || 0} total in pipeline</div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          {(view?.assignments || []).map((assignment) => {
            const lead = assignment.lead || {};
            const rowTone = assignment.isOverdue ? 'border-rose-200 bg-rose-50' : assignment.isDueToday ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white';

            return (
              <article key={assignment._id} className={`rounded-2xl border p-4 ${rowTone}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{assignment.pipelineDisplayName || 'Unnamed Lead'}</p>
                    <p className="mt-1 text-sm text-slate-500">{formatContactDisplay(assignment.pipelineDisplayContact || lead.contactNumber)}</p>
                  </div>
                  <div className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {assignment.product?.toUpperCase() || 'GENERAL'}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-white/80 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Batch</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{assignment.batchName || '-'}</p>
                  </div>
                  <div className="rounded-xl bg-white/80 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Follow-up Date</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{assignment.pipelineFollowUpDate || '-'}</p>
                  </div>
                  <div className="rounded-xl bg-white/80 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Contactability</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{assignment.contactabilityStatus || '-'}</p>
                  </div>
                  <div className="rounded-xl bg-white/80 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{assignment.status || '-'}</p>
                  </div>
                </div>

                <div className="mt-3 rounded-xl bg-white/80 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pipeline Notes</p>
                  <p className="mt-1 text-sm text-slate-700">{assignment.pipelineNotes || '-'}</p>
                </div>
              </article>
            );
          })}

          {!(view?.assignments || []).length && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
              No pipeline rows for this agent.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default ManagedAgentPipelineView;
