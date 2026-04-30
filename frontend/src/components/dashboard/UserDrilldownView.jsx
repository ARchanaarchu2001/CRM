import React from 'react';
import FunnelChart from './FunnelChart.jsx';
import { formatMetricValue } from '../../utils/dashboard.js';
import { LuPhone, LuPhoneCall, LuUserCheck, LuFileText, LuCheck, LuDatabase } from 'react-icons/lu';

const UserDrilldownView = ({ report, isLoading }) => {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50/50">
        <div className="flex flex-col items-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600 mb-4" />
          <p className="text-slate-500 font-medium">Loading user performance report...</p>
        </div>
      </div>
    );
  }

  if (!report || !report.user) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50/50">
        <div className="text-center text-slate-400">
          <LuUserCheck className="mx-auto text-4xl mb-3 opacity-30" />
          <p>Select a user to view detailed analytics</p>
        </div>
      </div>
    );
  }

  const { user, funnel, datasetBreakdown } = report;

  const funnelData = [
    { label: 'Assigned Leads', value: funnel.assigned, color: '#94a3b8' },
    { label: 'Dialed', value: funnel.dialed, color: '#3b82f6' },
    { label: 'Connected', value: funnel.connected, color: '#06b6d4' },
    { label: 'Submitted', value: funnel.submitted, color: '#6366f1' },
    { label: 'Activated', value: funnel.activated, color: '#8b5cf6' },
  ];

  const kpis = [
    { label: 'Total Assigned', value: user.totalAssignedLeads, icon: LuDatabase, color: 'text-slate-500', bg: 'bg-slate-50' },
    { label: 'Total Dials', value: user.dials, icon: LuPhone, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Connected Calls', value: user.connectCallCount, icon: LuPhoneCall, color: 'text-cyan-500', bg: 'bg-cyan-50' },
    { label: 'Submissions', value: user.submissions, icon: LuFileText, color: 'text-indigo-500', bg: 'bg-indigo-50' },
    { label: 'Activations', value: user.activations, icon: LuCheck, color: 'text-violet-500', bg: 'bg-violet-50' },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/30 p-8 space-y-8 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex items-center gap-6 pb-6 border-b border-slate-200">
        <img 
          src={user.profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.agentName)}&background=e0e7ff&color=3730a3`} 
          alt={user.agentName} 
          className="h-20 w-20 rounded-full object-cover ring-4 ring-white shadow-sm"
        />
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">{user.agentName}</h1>
          <p className="text-slate-500 font-medium mt-1">{user.teamName} • {user.email}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Conversion Rate</p>
          <p className="text-4xl font-black text-indigo-600">
            {user.dials > 0 ? ((user.submissions / user.dials) * 100).toFixed(1) : 0}%
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi, i) => (
          <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center text-center hover:shadow-md transition-shadow">
            <div className={`p-3 rounded-xl ${kpi.bg} ${kpi.color} mb-3`}>
              <kpi.icon className="text-xl" />
            </div>
            <p className="text-2xl font-black text-slate-800">{formatMetricValue(kpi.value)}</p>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Funnel */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
          <span className="h-6 w-1 bg-indigo-500 rounded-full"></span>
          Conversion Funnel
        </h3>
        <FunnelChart data={funnelData} />
      </div>

      {/* Dataset Breakdown */}
      <div className="space-y-6">
        <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
          <span className="h-6 w-1 bg-emerald-500 rounded-full"></span>
          Dataset Breakdown
        </h3>
        
        {datasetBreakdown?.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center text-slate-500">
            No datasets assigned to this user in the selected period.
          </div>
        ) : (
          datasetBreakdown?.map((ds) => (
            <div key={ds.batchId} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800">{ds.batchName}</h4>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">{ds.product}</p>
                </div>
                <div className="flex gap-4">
                  <div className="text-center"><p className="text-lg font-bold text-slate-800">{ds.summary.calls}</p><p className="text-[10px] uppercase font-bold text-slate-400">Calls</p></div>
                  <div className="text-center"><p className="text-lg font-bold text-blue-600">{ds.summary.connected}</p><p className="text-[10px] uppercase font-bold text-slate-400">Conn</p></div>
                  <div className="text-center"><p className="text-lg font-bold text-indigo-600">{ds.summary.submitted}</p><p className="text-[10px] uppercase font-bold text-slate-400">Sub</p></div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-white text-slate-500 font-medium text-xs uppercase tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4">Lead</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Remarks</th>
                      <th className="px-6 py-4">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {ds.logs.slice(0, 10).map((log) => (
                      <tr key={log._id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-800">{log.leadName || 'Unknown Lead'}</p>
                          <p className="text-slate-500">{log.leadContactNumber}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            log.status === 'submitted' ? 'bg-indigo-100 text-indigo-800' :
                            log.status === 'activated' ? 'bg-violet-100 text-violet-800' :
                            'bg-slate-100 text-slate-800'
                          }`}>
                            {log.status || 'Assigned'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-slate-700">{log.callingRemark || '-'}</p>
                          {(log.interestedRemark || log.notInterestedRemark) && (
                            <p className="text-xs text-slate-500">{log.interestedRemark || log.notInterestedRemark}</p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-500 text-xs">
                          {new Date(log.updatedAt || log.date).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {ds.logs.length > 10 && (
                  <div className="bg-slate-50 px-6 py-3 text-center border-t border-slate-100">
                    <p className="text-xs text-slate-500 font-medium">+ {ds.logs.length - 10} more leads. Export to view all.</p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default UserDrilldownView;
