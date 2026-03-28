import React from 'react';

const SelectedAgentActionsPanel = ({
  selectedAgent = null,
  actionLoadingKey = null,
  onViewDetails,
  onToggleStatus,
  onMoveToTeam,
  onRemoveFromTeam,
}) => {
  const hasAgent = Boolean(selectedAgent);

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Settings</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">Selected Agent Actions</h3>
          <p className="mt-1 text-sm text-slate-500">
            {hasAgent
              ? 'Use these controls for the agent selected in the performance list.'
              : 'Select an agent from the performance list to unlock management actions.'}
          </p>
        </div>

        {hasAgent && (
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
            {selectedAgent.profilePhoto ? (
              <img
                src={`/uploads/${selectedAgent.profilePhoto}`}
                alt={selectedAgent.agentName}
                className="h-12 w-12 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
                {selectedAgent.agentName?.charAt(0)?.toUpperCase() || 'A'}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-slate-900">{selectedAgent.agentName}</p>
              <p className="text-xs text-slate-500">
                {selectedAgent.teamName || 'Unassigned Team'}
                {selectedAgent.teamLeadName ? ` - ${selectedAgent.teamLeadName}` : ''}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onViewDetails?.(selectedAgent)}
          disabled={!hasAgent}
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          View Details
        </button>
        <button
          type="button"
          onClick={() => onToggleStatus?.(selectedAgent)}
          disabled={!hasAgent || actionLoadingKey === `status-${selectedAgent?.agentId}`}
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {!hasAgent
            ? 'Deactivate'
            : actionLoadingKey === `status-${selectedAgent.agentId}`
              ? 'Saving...'
              : selectedAgent.isActive
                ? 'Deactivate'
                : 'Activate'}
        </button>
        {onMoveToTeam && (
          <button
            type="button"
            onClick={() => onMoveToTeam?.(selectedAgent)}
            disabled={!hasAgent || actionLoadingKey === `move-${selectedAgent?.agentId}`}
            className="rounded-xl border border-indigo-300 px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {!hasAgent
              ? 'Move To Team'
              : actionLoadingKey === `move-${selectedAgent.agentId}`
                ? 'Opening...'
                : 'Move To Team'}
          </button>
        )}
        <button
          type="button"
          onClick={() => onRemoveFromTeam?.(selectedAgent)}
          disabled={!hasAgent || actionLoadingKey === `remove-${selectedAgent?.agentId}`}
          className="rounded-xl border border-rose-300 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {!hasAgent
            ? 'Remove From Team'
            : actionLoadingKey === `remove-${selectedAgent.agentId}`
              ? 'Removing...'
              : 'Remove From Team'}
        </button>
      </div>
    </section>
  );
};

export default SelectedAgentActionsPanel;
