import React, { useState } from 'react';

const SaveReportModal = ({ isOpen, onClose, onSave, filters, isSaving }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...formData,
      filters,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md scale-100 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Save Report</h2>
          <p className="mt-2 text-sm text-slate-500">
            Save your current filters and segments as a template for quick access.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Report Name</label>
            <input
              autoFocus
              required
              type="text"
              placeholder="e.g., Team Alpha - Weekly Performance"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-50"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Description (Optional)</label>
            <textarea
              rows={3}
              placeholder="What does this report show?"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-50 resize-none"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="rounded-2xl bg-indigo-50/50 p-4 border border-indigo-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Captured Filters</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-lg bg-white px-2 py-1 text-[10px] font-bold text-indigo-600 border border-indigo-100 uppercase">{filters.range}</span>
              <span className="rounded-lg bg-white px-2 py-1 text-[10px] font-bold text-indigo-600 border border-indigo-100 uppercase">{filters.teamId || 'All Teams'}</span>
              {filters.product && (
                <span className="rounded-lg bg-white px-2 py-1 text-[10px] font-bold text-indigo-600 border border-indigo-100 uppercase">{filters.product}</span>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-[2] rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSaving ? 'Creating...' : 'Save Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SaveReportModal;
