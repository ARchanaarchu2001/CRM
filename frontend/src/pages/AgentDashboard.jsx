import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyAssignmentBatches, fetchMyPipelineSummary, hideAssignmentBatch } from '../api/leads.js';

const AgentDashboard = () => {
  const [batches, setBatches] = useState([]);
  const [pipelineSummary, setPipelineSummary] = useState({
    totalPipelineRows: 0,
    dueTodayCount: 0,
    overdueCount: 0,
  });
  const [message, setMessage] = useState('');

  const loadBatches = async () => {
    const data = await fetchMyAssignmentBatches();
    setBatches(data.batches || []);
  };

  const loadPipelineSummary = async () => {
    const data = await fetchMyPipelineSummary();
    setPipelineSummary(data);
  };

  useEffect(() => {
    loadBatches();
    loadPipelineSummary();
  }, []);

  const handleHideBatch = async (importBatchId) => {
    await hideAssignmentBatch(importBatchId);
    setMessage('Batch hidden from your dashboard.');
    await loadBatches();
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
