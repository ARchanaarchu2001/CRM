import React from 'react';

const DetailedInteractionLog = ({ data = [], isLoading = false }) => {
  if (!isLoading && data.length === 0) {
    return (
      <div className="rounded-[2rem] border border-slate-200 bg-white p-12 text-center shadow-sm ring-1 ring-slate-100">
        <p className="text-slate-400 italic">No detailed interaction logs found for this scope.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900 tracking-tight">Detailed Interaction Log</h3>
          <p className="mt-1 text-sm text-slate-500">Showing the most recent in-scope agent interactions for selected filters.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
          {data.length} entries
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead className="bg-slate-50/50 text-xs font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-4">Time</th>
              <th className="px-6 py-4">Agent</th>
              <th className="px-6 py-4">Lead Detail</th>
              <th className="px-6 py-4">Company</th>
              <th className="px-6 py-4">Outcome</th>
              <th className="px-6 py-4">Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((log) => {
              const rawData = log.rawData || log.lead?.rawData || {};
              const companyName = rawData.Company || rawData.company || rawData['Company Name'] || rawData['COMPANY'] || '-';
              const customerName = log.leadName || rawData.Name || rawData.name || rawData['Customer Name'] || '-';
              const rowDate = log.updatedAt || log.date || log.createdAt;
              const agentName = log.agentName || log.agent?.fullName || 'Unassigned Agent';
              const teamName = log.teamName || log.agent?.assignedTeam || 'Unassigned';
              const contactNumber = log.leadContactNumber || log.lead?.contactNumber || '';

              return (
                <tr key={log._id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-900">
                      {rowDate ? new Date(rowDate).toLocaleDateString() : '-'}
                    </div>
                    <div className="text-xs text-slate-400">
                      {rowDate ? new Date(rowDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-slate-700">{agentName}</div>
                    <div className="text-xs text-slate-400 uppercase font-medium">{teamName}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-slate-900">{customerName}</div>
                    <div className="text-xs text-indigo-600 font-medium">{contactNumber}</div>
                    <div className="mt-1 text-[10px] font-bold uppercase text-slate-400">{log.batchName} {log.product ? `- ${String(log.product).toUpperCase()}` : ''}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-slate-600 font-medium">{companyName}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-tight ${
                      log.status === 'submitted' ? 'bg-emerald-100 text-emerald-700' :
                      log.status === 'activated' ? 'bg-indigo-100 text-indigo-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {log.status || 'NEW'}
                    </span>
                    {log.contactabilityStatus && (
                      <div className="mt-1 text-[10px] text-slate-400 font-bold uppercase">{log.contactabilityStatus}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 max-w-sm">
                    <div className="space-y-1">
                      {log.callingRemark && (
                         <p className="text-xs"><span className="font-bold text-slate-500">Call:</span> {log.callingRemark}</p>
                      )}
                      {log.interestedRemark && (
                         <p className="text-xs"><span className="font-bold text-amber-600">Int:</span> {log.interestedRemark}</p>
                      )}
                      {log.notInterestedRemark && (
                         <p className="text-xs"><span className="font-bold text-rose-600">NI:</span> {log.notInterestedRemark}</p>
                      )}
                      {log.agentNotes && (
                         <p className="text-xs italic text-slate-500 line-clamp-2">"{log.agentNotes}"</p>
                      )}
                      {!log.callingRemark && !log.interestedRemark && !log.notInterestedRemark && !log.agentNotes && (
                        <span className="text-xs text-slate-300 italic">No remarks entries</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DetailedInteractionLog;
