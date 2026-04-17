import React from 'react';
import { formatMetricValue } from '../../utils/dashboard.js';
import UserAvatar from '../UserAvatar.jsx';

const AgentLeaderboard = ({ data = [], title, description }) => {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100">
      <div className="p-6 border-b border-slate-100">
        <h3 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h3>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50/50 text-xs font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-4">Rank</th>
              <th className="px-6 py-4">Agent</th>
              <th className="px-6 py-4 text-center">Dials</th>
              <th className="px-6 py-4 text-center">Sub</th>
              <th className="px-6 py-4 text-center">Act</th>
              <th className="px-6 py-4 text-right">Conv. Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.length > 0 ? (
              data.map((agent, index) => {
                const convRate = agent.dials > 0 ? (agent.submissions / agent.dials) * 100 : 0;
                
                return (
                  <tr key={agent.agentId} className="group transition hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold shadow-sm border ${
                        index === 0 ? 'bg-amber-100 text-amber-700 border-amber-200' : 
                        index === 1 ? 'bg-slate-100 text-slate-700 border-slate-200' : 
                        index === 2 ? 'bg-orange-100 text-orange-700 border-orange-200' : 
                        'bg-white text-slate-500 border-slate-100'
                      }`}>
                        {index + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <UserAvatar 
                          src={agent.profilePhoto} 
                          className="h-10 w-10 rounded-full border border-slate-200 object-cover" 
                        />
                        <div>
                          <p className="font-bold text-slate-900 leading-none">{agent.agentName}</p>
                          <p className="mt-1 text-xs text-slate-500 font-medium uppercase tracking-tight">{agent.teamName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center font-medium text-slate-600">
                      {formatMetricValue(agent.dials)}
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-slate-900">
                      {formatMetricValue(agent.submissions)}
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-emerald-600">
                      {formatMetricValue(agent.activations)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-bold text-indigo-600">{convRate.toFixed(1)}%</span>
                        <div className="mt-1 h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                          <div 
                            className="h-full bg-indigo-500 rounded-full" 
                            style={{ width: `${Math.min(convRate * 2, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="6" className="px-6 py-12 text-center text-slate-400 italic">
                  No performance data within selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default AgentLeaderboard;
