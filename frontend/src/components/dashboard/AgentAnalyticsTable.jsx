import React from 'react';
import { formatLastActivity, formatMetricValue, isLastActivityStale } from '../../utils/dashboard.js';

const AgentAnalyticsTable = ({
  rows = [],
  showTeam = false,
  selectedAgentId = '',
  onSelectAgent,
  onViewDetails,
  onOpenAgentDashboard,
}) => {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Agent Performance</h3>
          <p className="mt-1 text-sm text-slate-500">All values in this table follow the selected date filter.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
          {rows.length} agents
        </span>
      </div>

      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <article
            key={row.agentId}
            onClick={() => onSelectAgent?.(row)}
            className={`rounded-2xl border border-slate-200 p-4 transition ${
              onSelectAgent ? 'cursor-pointer hover:border-slate-300 hover:bg-slate-50/70' : ''
            } ${selectedAgentId === row.agentId ? 'border-indigo-300 bg-indigo-50/60' : 'bg-white'}`}
          >
            {(() => {
              const isStale = isLastActivityStale(row.lastActivity);
              return (
                <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {row.profilePhoto ? (
                  <img
                    src={`/uploads/${row.profilePhoto}`}
                    alt={row.agentName}
                    className="h-11 w-11 rounded-full border border-slate-200 object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-700">
                    {row.agentName?.charAt(0)?.toUpperCase() || 'A'}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-900">{row.agentName}</div>
                  <div className="mt-1 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    {row.isActive ? 'Active' : 'Inactive'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onViewDetails?.(row);
                }}
                className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                View Details
              </button>
              {onOpenAgentDashboard && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenAgentDashboard(row);
                  }}
                  className="shrink-0 rounded-xl border border-indigo-300 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                >
                  Agent Dashboard
                </button>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {showTeam && (
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Team</p>
                  <p className="mt-1 font-medium text-slate-900">{row.teamName || 'Unassigned Team'}</p>
                </div>
              )}
              {showTeam && (
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Team Lead</p>
                  <p className="mt-1 font-medium text-slate-900">{row.teamLeadName || 'Unassigned'}</p>
                </div>
              )}
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Dials</p>
                <p className="mt-1 font-semibold text-slate-900">{formatMetricValue(row.dials)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Submissions</p>
                <p className="mt-1 font-semibold text-slate-900">{formatMetricValue(row.submissions)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Activations</p>
                <p className="mt-1 font-semibold text-slate-900">{formatMetricValue(row.activations)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pending Leads</p>
                <p className="mt-1 font-semibold text-slate-900">{formatMetricValue(row.pendingLeads)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total Leads Assigned</p>
                <p className="mt-1 font-semibold text-slate-900">{formatMetricValue(row.totalAssignedLeads)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Last Activity</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${isStale ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                  <p className={`font-medium ${isStale ? 'text-rose-700' : 'text-slate-900'}`}>{formatLastActivity(row.lastActivity)}</p>
                </div>
                {isStale && <p className="mt-1 text-[11px] font-semibold text-rose-600">No change in 1 hour</p>}
              </div>
            </div>
                </>
              );
            })()}
          </article>
        ))}

        {rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-slate-500">
            No agents found for this range.
          </div>
        )}
      </div>

      <div className="hidden overflow-x-auto md:block">
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
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
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
                {(() => {
                  const isStale = isLastActivityStale(row.lastActivity);
                  return (
                    <>
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
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${isStale ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                    <span className={isStale ? 'font-medium text-rose-700' : 'text-slate-500'}>{formatLastActivity(row.lastActivity)}</span>
                  </div>
                  {isStale && <div className="mt-1 text-[11px] font-semibold text-rose-600">No change in 1 hour</div>}
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="flex justify-end gap-2">
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
                    {onOpenAgentDashboard && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenAgentDashboard(row);
                        }}
                        className="rounded-xl border border-indigo-300 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                      >
                        Agent Dashboard
                      </button>
                    )}
                  </div>
                </td>
                    </>
                  );
                })()}
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
