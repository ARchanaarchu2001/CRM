import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchMyAssignmentBatches,
  fetchMyAssignments,
  fetchMyPipelineSummary,
  hideAssignmentBatch,
} from '../api/leads.js';

const AgentDashboard = () => {
  const [batches, setBatches] = useState([]);
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

  useEffect(() => {
    loadBatches();
    loadQueueSummary();
    loadPipelineSummary();
  }, []);

  const handleHideBatch = async (importBatchId) => {
    await hideAssignmentBatch(importBatchId);
    setMessage('Batch hidden from your dashboard.');
    await loadBatches();
    await loadQueueSummary();
    await loadPipelineSummary();
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">My Batches</h2>
            <p className="mt-2 text-sm text-slate-600">
              Open one batch at a time. The table will open on a separate page with source fields first and your work fields on the right.
            </p>
          </div>
        </div>

        {message && <p className="mt-4 text-sm text-slate-600">{message}</p>}
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

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
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
                className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Hide
              </button>
            </div>
          </article>
        ))}

        {batches.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            No visible batches assigned.
          </div>
        )}
      </section>
    </div>
  );
};

export default AgentDashboard;
