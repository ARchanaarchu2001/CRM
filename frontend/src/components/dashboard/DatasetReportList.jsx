import React, { useState } from 'react';
import { LuSearch, LuDatabase, LuChevronRight } from 'react-icons/lu';

const DatasetReportList = ({ datasets, selectedBatchId, onSelectBatch }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredDatasets = datasets.filter((ds) =>
    ds.batchName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ds.batchId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      <div className="p-4 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Datasets</h2>
        <div className="relative">
          <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search datasets..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-shadow"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredDatasets.length === 0 ? (
          <div className="p-4 text-center text-sm text-slate-500">No datasets found.</div>
        ) : (
          filteredDatasets.map((ds) => (
            <button
              key={ds.batchId}
              onClick={() => onSelectBatch(ds.batchId)}
              className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-3 group ${
                selectedBatchId === ds.batchId
                  ? 'bg-emerald-50 border border-emerald-100 shadow-sm'
                  : 'hover:bg-slate-50 border border-transparent'
              }`}
            >
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                selectedBatchId === ds.batchId ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
              }`}>
                <LuDatabase className="text-lg" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold truncate ${selectedBatchId === ds.batchId ? 'text-emerald-900' : 'text-slate-700'}`}>
                  {ds.batchName}
                </p>
                <p className="text-xs text-slate-500 uppercase tracking-wider">{ds.product}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-xs font-bold ${selectedBatchId === ds.batchId ? 'text-emerald-600' : 'text-slate-900'}`}>
                  {ds.totalAssignedLeads} Leads
                </p>
                <p className="text-[10px] text-slate-400 font-medium">
                  {ds.submissions} Subs
                </p>
              </div>
              <LuChevronRight className={`text-slate-300 transition-transform ${selectedBatchId === ds.batchId ? 'translate-x-1 text-emerald-400' : ''}`} />
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default DatasetReportList;
