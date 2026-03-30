import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAgentSelfDashboard } from '../api/dashboard.js';
import {
  fetchMyAssignmentBatches,
  fetchMyAssignments,
  fetchMyPipelineSummary,
  hideAssignmentBatch,
  restoreAssignmentBatch,
} from '../api/leads.js';

const AgentDashboard = () => {
  const [batches, setBatches] = useState([]);
  const [completedBatches, setCompletedBatches] = useState([]);
  const [batchActionState, setBatchActionState] = useState({});
  const [performanceSummary, setPerformanceSummary] = useState({
    today: { dials: 0, submissions: 0, activations: 0 },
    week: { dials: 0, submissions: 0, activations: 0 },
    month: { dials: 0, submissions: 0, activations: 0 },
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [pipelineSummary, setPipelineSummary] = useState({
    totalPipelineRows: 0,
    dueTodayCount: 0,
    overdueCount: 0,
  });
  const [queueSummary, setQueueSummary] = useState({
    pending: 0,
    followUp: 0,
    callback: 0,
    interested: 0,
  });
  const [message, setMessage] = useState('');

  const loadBatches = async () => {
    const data = await fetchMyAssignmentBatches();
    setBatches(data.batches || []);
    setCompletedBatches(data.completedBatches || []);
  };

  const loadQueueSummary = async () => {
    const data = await fetchMyAssignments();
    const assignments = data.assignments || [];

    const isNotDialed = (assignment) =>
      !assignment.contactabilityStatus &&
      !assignment.callingRemark &&
      !assignment.interestedRemark &&
      !assignment.notInterestedRemark &&
      !assignment.callAttempt1Date &&
      !assignment.callAttempt2Date;

    setQueueSummary({
      pending: assignments.filter(isNotDialed).length,
      followUp: assignments.filter((assignment) => assignment.callingRemark === 'Follow up').length,
      callback: assignments.filter((assignment) => assignment.callingRemark === 'Call back').length,
      interested: assignments.filter(
        (assignment) => assignment.callingRemark === 'Interested' || Boolean(assignment.interestedRemark)
      ).length,
    });
  };

  const loadPipelineSummary = async () => {
    const data = await fetchMyPipelineSummary();
    setPipelineSummary(data);
  };

  const loadPerformanceSummary = async () => {
    setStatsLoading(true);

    try {
      const [todayResponse, weekResponse, monthResponse] = await Promise.all([
        fetchAgentSelfDashboard({ range: 'today' }),
        fetchAgentSelfDashboard({ range: 'week' }),
        fetchAgentSelfDashboard({ range: 'month' }),
      ]);

      setPerformanceSummary({
        today: {
          dials: todayResponse.dashboard?.summary?.dials || 0,
          submissions: todayResponse.dashboard?.summary?.submissions || 0,
          activations: todayResponse.dashboard?.summary?.activations || 0,
        },
        week: {
          dials: weekResponse.dashboard?.summary?.dials || 0,
          submissions: weekResponse.dashboard?.summary?.submissions || 0,
          activations: weekResponse.dashboard?.summary?.activations || 0,
        },
        month: {
          dials: monthResponse.dashboard?.summary?.dials || 0,
          submissions: monthResponse.dashboard?.summary?.submissions || 0,
          activations: monthResponse.dashboard?.summary?.activations || 0,
        },
      });
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
    loadQueueSummary();
    loadPipelineSummary();
    loadPerformanceSummary();
  }, []);

  const handleHideBatch = async (importBatchId) => {
    setBatchActionState((current) => ({
      ...current,
      [String(importBatchId)]: 'completing',
    }));

    try {
      await hideAssignmentBatch(importBatchId);
      setMessage('Batch marked as completed.');
      await loadBatches();
      await loadQueueSummary();
      await loadPipelineSummary();
    } finally {
      setBatchActionState((current) => {
        const nextState = { ...current };
        delete nextState[String(importBatchId)];
        return nextState;
      });
    }
  };

  const handleRestoreBatch = async (importBatchId) => {
    setBatchActionState((current) => ({
      ...current,
      [String(importBatchId)]: 'restoring',
    }));

    try {
      await restoreAssignmentBatch(importBatchId);
      setMessage('Batch moved back to active datasets.');
      await loadBatches();
      await loadQueueSummary();
      await loadPipelineSummary();
    } finally {
      setBatchActionState((current) => {
        const nextState = { ...current };
        delete nextState[String(importBatchId)];
        return nextState;
      });
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          {message}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">My Performance</h2>
            <p className="mt-2 text-sm text-slate-600">
              See your dial, submission, and activation counts for today, this week, and this month.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {[
            { key: 'today', label: 'Today', tone: 'border-sky-200 bg-sky-50' },
            { key: 'week', label: 'This Week', tone: 'border-indigo-200 bg-indigo-50' },
            { key: 'month', label: 'This Month', tone: 'border-emerald-200 bg-emerald-50' },
          ].map((card) => (
            <div key={card.key} className={`rounded-2xl border p-5 shadow-sm ${card.tone}`}>
              <div className="text-sm font-semibold text-slate-900">{card.label}</div>
              {statsLoading ? (
                <div className="mt-4 text-sm text-slate-600">Loading...</div>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Dials</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">{performanceSummary[card.key].dials}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Submissions</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">{performanceSummary[card.key].submissions}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Activations</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">{performanceSummary[card.key].activations}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Work Queue</h2>
            <p className="mt-2 text-sm text-slate-600">
              Open a global queue to work pending, follow up, callback, or interested leads across all products and datasets.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Link to="/agent-queue/pending" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm hover:bg-amber-100">
            <div className="text-sm font-medium text-amber-900">Pending / Undialed</div>
            <div className="mt-2 text-3xl font-bold text-amber-800">{queueSummary.pending}</div>
          </Link>
          <Link to="/agent-queue/follow_up" className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5 shadow-sm hover:bg-yellow-100">
            <div className="text-sm font-medium text-yellow-900">Follow Up</div>
            <div className="mt-2 text-3xl font-bold text-yellow-800">{queueSummary.followUp}</div>
          </Link>
          <Link to="/agent-queue/callback" className="rounded-2xl border border-orange-200 bg-orange-50 p-5 shadow-sm hover:bg-orange-100">
            <div className="text-sm font-medium text-orange-900">Callback</div>
            <div className="mt-2 text-3xl font-bold text-orange-800">{queueSummary.callback}</div>
          </Link>
          <Link to="/agent-queue/interested" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm hover:bg-emerald-100">
            <div className="text-sm font-medium text-emerald-900">Interested</div>
            <div className="mt-2 text-3xl font-bold text-emerald-800">{queueSummary.interested}</div>
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Pipeline</h2>
            <p className="mt-2 text-sm text-slate-600">
              Move rows here when they need a dated follow-up. Due today and overdue counts act as your notification reminder.
            </p>
          </div>

          <Link
            to="/agent-pipeline"
            className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            Open Pipeline
          </Link>
        </div>

        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-slate-700">
            {pipelineSummary.totalPipelineRows} in pipeline
          </div>
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-800">
            {pipelineSummary.dueTodayCount} due today
          </div>
          <div className="rounded-2xl bg-rose-50 px-4 py-3 text-rose-800">
            {pipelineSummary.overdueCount} overdue
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Active Datasets</h2>
            <p className="mt-2 text-sm text-slate-600">
              These are the datasets currently on your dashboard for calling work.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href="#active-datasets"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Active Datasets
            </a>
            <a
              href="#completed-datasets"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Completed Datasets
            </a>
          </div>
        </div>

        <div id="active-datasets" className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3 scroll-mt-24">
        {batches.map((batch) => (
          <article key={String(batch.importBatchId)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{batch.batchName}</h3>
                <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{batch.product}</p>
              </div>
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

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                to={`/agent-dash/${batch.importBatchId}`}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Open Batch
              </Link>
              <button
                type="button"
                onClick={() => handleHideBatch(batch.importBatchId)}
                disabled={Boolean(batchActionState[String(batch.importBatchId)])}
                className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {batchActionState[String(batch.importBatchId)] === 'completing'
                  ? 'Completing...'
                  : 'Completed'}
              </button>
            </div>
          </article>
        ))}

        {batches.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            No active datasets assigned.
          </div>
        )}
        </div>
      </section>

      <section id="completed-datasets" className="space-y-4 scroll-mt-24">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Completed Datasets</h2>
          <p className="mt-2 text-sm text-slate-600">
            Completed datasets are removed from your active dashboard, but you can still open them here anytime.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {completedBatches.map((batch) => (
            <article key={String(batch.importBatchId)} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{batch.batchName}</h3>
                  <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{batch.product}</p>
                </div>
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

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  to={`/agent-dash/${batch.importBatchId}`}
                  className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Open Batch
                </Link>
                <button
                  type="button"
                  onClick={() => handleRestoreBatch(batch.importBatchId)}
                  disabled={Boolean(batchActionState[String(batch.importBatchId)])}
                  className="rounded-xl border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {batchActionState[String(batch.importBatchId)] === 'restoring'
                    ? 'Restoring...'
                    : 'Restore'}
                </button>
              </div>
            </article>
          ))}

          {completedBatches.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
              No completed datasets yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default AgentDashboard;
