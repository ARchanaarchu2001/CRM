import React from 'react';
import { formatLastActivity, formatMetricValue } from '../../utils/dashboard.js';

const AgentAnalyticsTable = ({
  rows = [],
  showTeam = false,
  selectedAgentId = '',
  onSelectAgent,
  onViewDetails,
}) => {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Agent Performance</h3>
          <p className="mt-1 text-sm text-slate-500">All values in this table follow the selected date filter.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
          {rows.length} agents
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-700">
            <tr>
              <th className="px-4 py-3 font-semibold">Agent Name</th>
              {showTeam && <th className="px-4 py-3 font-semibold">Team Name</th>}
              {showTeam && <th className="px-4 py-3 font-semibold">Team Lead</th>}
              <th className="px-4 py-3 font-semibold text-center">Dials</th>
              <th className="px-4 py-3 font-semibold text-center">Submissions</th>
              <th className="px-4 py-3 font-semibold text-center">Activations</th>
              <th className="px-4 py-3 font-semibold text-center">Pipeline Count</th>
              <th className="px-4 py-3 font-semibold text-center">Overdue Pipeline Count</th>
              <th className="px-4 py-3 font-semibold text-center">Pending Leads</th>
              <th className="px-4 py-3 font-semibold text-center">Total Leads Assigned</th>
              <th className="px-4 py-3 font-semibold">Last Activity</th>
              <th className="px-4 py-3 font-semibold text-right">View</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.agentId}
                onClick={() => onSelectAgent?.(row)}
                className={`border-t border-slate-100 transition ${onSelectAgent ? 'cursor-pointer hover:bg-slate-50/80' : ''} ${
                  selectedAgentId === row.agentId ? 'bg-indigo-50/60' : ''
                }`}
              >
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    {row.profilePhoto ? (
                      <img
                        src={`/uploads/${row.profilePhoto}`}
                        alt={row.agentName}
                        className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-700">
                        {row.agentName?.charAt(0)?.toUpperCase() || 'A'}
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-slate-900">{row.agentName}</div>
                      <div className="mt-1 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                        {row.isActive ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                  </div>
                </td>
                {showTeam && <td className="px-4 py-4 text-slate-700">{row.teamName || 'Unassigned Team'}</td>}
                {showTeam && <td className="px-4 py-4 text-slate-700">{row.teamLeadName || 'Unassigned'}</td>}
                <td className="px-4 py-4 text-center font-semibold text-slate-900">{formatMetricValue(row.dials)}</td>
                <td className="px-4 py-4 text-center font-semibold text-slate-900">{formatMetricValue(row.submissions)}</td>
                <td className="px-4 py-4 text-center font-semibold text-slate-900">{formatMetricValue(row.activations)}</td>
                <td className="px-4 py-4 text-center">{formatMetricValue(row.pipelineCount)}</td>
                <td className="px-4 py-4 text-center text-slate-900">{formatMetricValue(row.overduePipelineCount)}</td>
                <td className="px-4 py-4 text-center text-slate-900">{formatMetricValue(row.pendingLeads)}</td>
                <td className="px-4 py-4 text-center text-slate-900">{formatMetricValue(row.totalAssignedLeads)}</td>
                <td className="px-4 py-4 text-slate-500">{formatLastActivity(row.lastActivity)}</td>
                <td className="px-4 py-4 text-right">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onViewDetails?.(row);
                    }}
                    className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={showTeam ? 12 : 10} className="px-4 py-10 text-center text-slate-500">
                  No agents found for this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default AgentAnalyticsTable;
