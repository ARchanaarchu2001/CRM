import React, { useEffect, useState } from 'react';

const MoveAgentToTeamModal = ({
  isOpen,
  agent = null,
  teams = [],
  isSubmitting = false,
  onClose,
  onSubmit,
}) => {
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setSelectedTeamId('');
      setError('');
      return;
    }

    const currentTeamId = agent?.teamId || '';
    setSelectedTeamId(currentTeamId);
    setError('');
  }, [isOpen, agent]);

  if (!isOpen || !agent) {
    return null;
  }

  const availableTeams = teams.filter((team) => team._id !== agent.teamId);

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!selectedTeamId) {
      setError('Please select a team for this agent.');
      return;
    }

    if (selectedTeamId === agent.teamId) {
      setError('Please choose a different team from the current one.');
      return;
    }

    setError('');
    onSubmit?.(selectedTeamId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
      <div className="w-full max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Team Transfer</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Move To Team</h2>
            <p className="mt-1 text-sm text-slate-500">Review the current assignment and choose the next active team.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Agent Name</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{agent.agentName}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current Team</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{agent.teamName || 'Unassigned Team'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current Team Lead</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{agent.teamLeadName || 'Unassigned'}</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              New Team <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedTeamId}
              onChange={(event) => setSelectedTeamId(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Select a target team</option>
              {availableTeams.map((team) => (
                <option key={team._id} value={team._id}>
                  {team.name} - {team.teamLeadName}
                </option>
              ))}
            </select>
            {availableTeams.length === 0 && (
              <p className="text-sm text-amber-700">No other teams are available for transfer right now.</p>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || availableTeams.length === 0}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Moving...' : 'Confirm Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MoveAgentToTeamModal;
