import React from 'react';
import { DASHBOARD_RANGE_OPTIONS } from '../../utils/dashboard.js';

const DateFilterBar = ({ filter, onChange, isLoading = false }) => {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white/95 p-4 shadow-sm ring-1 ring-slate-100 sm:rounded-[2rem] sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Date Filter</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900 sm:text-xl">Performance Window</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Switch between Today, Yesterday, This Week, This Month, or a custom date range.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm text-slate-600">
            <span className="font-medium text-slate-700">Range</span>
            <select
              value={filter.range}
              disabled={isLoading}
              onChange={(event) => onChange({ range: event.target.value })}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              {DASHBOARD_RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-600">
            <span className="font-medium text-slate-700">From</span>
            <input
              type="date"
              value={filter.from}
              disabled={isLoading || filter.range !== 'custom'}
              onChange={(event) => onChange({ from: event.target.value })}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-600">
            <span className="font-medium text-slate-700">To</span>
            <input
              type="date"
              value={filter.to}
              disabled={isLoading || filter.range !== 'custom'}
              onChange={(event) => onChange({ to: event.target.value })}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100"
            />
          </label>
        </div>
      </div>
    </div>
  );
};

export default DateFilterBar;
