import React, { useEffect, useState } from 'react';
import EditUserProfileModal from '../components/dashboard/EditUserProfileModal.jsx';
import MoveAgentToTeamModal from '../components/dashboard/MoveAgentToTeamModal.jsx';
import {
  deactivateDashboardUser,
  fetchAdminUsers,
  fetchTeams,
  moveDashboardUserToTeam,
  reactivateDashboardUser,
  removeDashboardUser,
  removeDashboardUserFromTeam,
  updateDashboardUser,
} from '../api/dashboard.js';

const getRoleLabel = (role) =>
  String(role || '')
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const SuperAdminSettingsPage = () => {
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [banner, setBanner] = useState('');
  const [error, setError] = useState('');
  const [actionLoadingKey, setActionLoadingKey] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isMoveSubmitting, setIsMoveSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  const loadSettingsData = async () => {
    setIsLoading(true);
    setError('');

    try {
      const [usersResponse, teamsResponse] = await Promise.all([fetchAdminUsers(), fetchTeams()]);
      setUsers((usersResponse.data || []).filter((user) => user.role !== 'super_admin'));
      setTeams(teamsResponse.data || []);
    } catch (loadError) {
      setError(loadError.response?.data?.message || 'Failed to load admin settings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettingsData();
  }, []);

  const handleToggleStatus = async (user) => {
    const actionLabel = user.isActive ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${actionLabel} ${user.fullName}?`)) {
      return;
    }

    setActionLoadingKey(`status-${user._id}`);
    setBanner('');

    try {
      if (user.isActive) {
        await deactivateDashboardUser(user._id);
        setBanner(`${user.fullName} was deactivated successfully.`);
      } else {
        await reactivateDashboardUser(user._id);
        setBanner(`${user.fullName} was activated successfully.`);
      }
      await loadSettingsData();
    } catch (statusError) {
      setBanner(statusError.response?.data?.message || `Failed to ${actionLabel} user`);
    } finally {
      setActionLoadingKey(null);
    }
  };

  const handleRemoveFromTeam = async (user) => {
    if (!window.confirm(`Remove ${user.fullName} from the team?`)) {
      return;
    }

    setActionLoadingKey(`remove-${user._id}`);
    setBanner('');

    try {
      await removeDashboardUserFromTeam(user._id);
      setBanner(`${user.fullName} was removed from the team.`);
      await loadSettingsData();
    } catch (removeError) {
      setBanner(removeError.response?.data?.message || 'Failed to remove user from team');
    } finally {
      setActionLoadingKey(null);
    }
  };

  const handleOpenMoveModal = (user) => {
    setSelectedUser({
      agentId: user._id,
      agentName: user.fullName,
      teamId: user.team?._id ? String(user.team._id) : '',
      teamName: user.assignedTeam || user.team?.name || 'Unassigned Team',
      teamLeadName: user.teamLead?.fullName || user.team?.lead?.fullName || 'Unassigned',
    });
    setIsMoveModalOpen(true);
  };

  const handleCloseMoveModal = () => {
    if (isMoveSubmitting) {
      return;
    }

    setIsMoveModalOpen(false);
    setSelectedUser(null);
  };

  const handleMoveToTeam = async (teamId) => {
    if (!selectedUser) {
      return;
    }

    setIsMoveSubmitting(true);
    setActionLoadingKey(`move-${selectedUser.agentId}`);
    setBanner('');

    try {
      const response = await moveDashboardUserToTeam(selectedUser.agentId, teamId);
      setBanner(response.message || `${selectedUser.agentName} was moved successfully.`);
      setIsMoveModalOpen(false);
      setSelectedUser(null);
      await loadSettingsData();
    } catch (moveError) {
      setBanner(moveError.response?.data?.message || 'Failed to move user to another team');
    } finally {
      setIsMoveSubmitting(false);
      setActionLoadingKey(null);
    }
  };

  const handleOpenEditModal = (user) => {
    setEditingUser(user);
  };

  const handleCloseEditModal = () => {
    if (isEditSubmitting) {
      return;
    }

    setEditingUser(null);
  };

  const handleSaveProfile = async (payload) => {
    if (!editingUser) {
      return;
    }

    setIsEditSubmitting(true);
    setActionLoadingKey(`edit-${editingUser._id}`);
    setBanner('');

    try {
      await updateDashboardUser(editingUser._id, payload);
      setBanner(`${payload.fullName} was updated successfully.`);
      setEditingUser(null);
      await loadSettingsData();
    } catch (updateError) {
      setBanner(updateError.response?.data?.message || 'Failed to update user profile');
    } finally {
      setIsEditSubmitting(false);
      setActionLoadingKey(null);
    }
  };

  const handleRemoveUser = async (user) => {
    if (!window.confirm(`Remove ${user.fullName} from the system? This will disable the account and remove it from active user lists.`)) {
      return;
    }

    setActionLoadingKey(`delete-${user._id}`);
    setBanner('');

    try {
      const response = await removeDashboardUser(user._id);
      setBanner(response.message || `${user.fullName} was removed from the system.`);
      await loadSettingsData();
    } catch (removeError) {
      setBanner(removeError.response?.data?.message || 'Failed to remove user from the system');
    } finally {
      setActionLoadingKey(null);
    }
  };

  return (
    <div className="space-y-6 py-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Settings</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">System User Settings</h1>
            <p className="mt-1 text-sm text-slate-500">View and manage all users, including Team Leads, agents, and other CRM roles, from one place.</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{users.length}</span> users
          </div>
        </div>
      </section>

      {banner && <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-800">{banner}</div>}
      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        {isLoading ? (
          <div className="py-10 text-center text-slate-500">Loading user settings...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-700">
                <tr>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Team</th>
                  <th className="px-4 py-3 font-semibold">Team Lead</th>
                  <th className="px-4 py-3 font-semibold text-center">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isAgent = user.role === 'agent';
                  const isTeamLead = user.role === 'team_lead';
                  const teamName = user.assignedTeam || user.team?.name || 'Unassigned';
                  const teamLeadName = user.teamLead?.fullName || user.team?.lead?.fullName || 'Unassigned';

                  return (
                    <tr key={user._id} className="border-t border-slate-100">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          {user.profilePhoto ? (
                            <img src={`/uploads/${user.profilePhoto}`} alt={user.fullName} className="h-10 w-10 rounded-full border border-slate-200 object-cover" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-700">
                              {user.fullName?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-slate-900">{user.fullName}</p>
                            <p className="text-xs text-slate-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-700">{getRoleLabel(user.role)}</td>
                      <td className="px-4 py-4 text-slate-700">{teamName}</td>
                      <td className="px-4 py-4 text-slate-700">{teamLeadName}</td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(user)}
                            disabled={actionLoadingKey === `edit-${user._id}`}
                            className="rounded-xl border border-indigo-300 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                          >
                            {actionLoadingKey === `edit-${user._id}` ? 'Opening...' : 'Edit Profile'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(user)}
                            disabled={actionLoadingKey === `status-${user._id}`}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            {actionLoadingKey === `status-${user._id}` ? 'Saving...' : user.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenMoveModal(user)}
                            disabled={!isAgent || actionLoadingKey === `move-${user._id}`}
                            className="rounded-xl border border-indigo-300 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {actionLoadingKey === `move-${user._id}` ? 'Opening...' : 'Change Team'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveFromTeam(user)}
                            disabled={!isAgent || actionLoadingKey === `remove-${user._id}`}
                            className="rounded-xl border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {actionLoadingKey === `remove-${user._id}` ? 'Removing...' : 'Remove From Team'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveUser(user)}
                            disabled={!isTeamLead || actionLoadingKey === `delete-${user._id}`}
                            className="rounded-xl border border-rose-400 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {actionLoadingKey === `delete-${user._id}` ? 'Removing...' : 'Remove Team Lead'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <MoveAgentToTeamModal
        isOpen={isMoveModalOpen}
        agent={selectedUser}
        teams={teams}
        isSubmitting={isMoveSubmitting}
        onClose={handleCloseMoveModal}
        onSubmit={handleMoveToTeam}
      />

      <EditUserProfileModal
        isOpen={Boolean(editingUser)}
        user={editingUser}
        isSubmitting={isEditSubmitting}
        onClose={handleCloseEditModal}
        onSubmit={handleSaveProfile}
      />
    </div>
  );
};

export default SuperAdminSettingsPage;
