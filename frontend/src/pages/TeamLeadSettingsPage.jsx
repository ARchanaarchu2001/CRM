import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  deactivateDashboardUser,
  fetchTeamLeadDashboard,
  reactivateDashboardUser,
  removeDashboardUserFromTeam,
  updateDashboardUser,
} from '../api/dashboard.js';
import EditUserProfileModal from '../components/dashboard/EditUserProfileModal.jsx';

const TeamLeadSettingsPage = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [banner, setBanner] = useState('');
  const [error, setError] = useState('');
  const [actionLoadingKey, setActionLoadingKey] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  const loadUsers = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetchTeamLeadDashboard({ range: 'today' });
      setUsers(response.dashboard?.agentTable || []);
    } catch (loadError) {
      setError(loadError.response?.data?.message || 'Failed to load team settings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleViewDetails = (user) => {
    navigate(`/agent-performance/${user.agentId}?range=today`, {
      state: { from: '/team-lead-settings' },
    });
  };

  const handleOpenEditModal = (user) => {
    setEditingUser(user);
    setBanner('');
  };

  const handleCloseEditModal = () => {
    if (isEditSubmitting) {
      return;
    }
    setEditingUser(null);
  };

  const handleToggleStatus = async (user) => {
    const actionLabel = user.isActive ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${actionLabel} ${user.agentName}?`)) {
      return;
    }

    setActionLoadingKey(`status-${user.agentId}`);
    setBanner('');

    try {
      if (user.isActive) {
        await deactivateDashboardUser(user.agentId);
        setBanner(`${user.agentName} was deactivated successfully.`);
      } else {
        await reactivateDashboardUser(user.agentId);
        setBanner(`${user.agentName} was activated successfully.`);
      }
      await loadUsers();
    } catch (statusError) {
      setBanner(statusError.response?.data?.message || `Failed to ${actionLabel} user`);
    } finally {
      setActionLoadingKey(null);
    }
  };

  const handleRemoveFromTeam = async (user) => {
    if (!window.confirm(`Remove ${user.agentName} from your team?`)) {
      return;
    }

    setActionLoadingKey(`remove-${user.agentId}`);
    setBanner('');

    try {
      await removeDashboardUserFromTeam(user.agentId);
      setBanner(`${user.agentName} was removed from the team.`);
      await loadUsers();
    } catch (removeError) {
      setBanner(removeError.response?.data?.message || 'Failed to remove user from team');
    } finally {
      setActionLoadingKey(null);
    }
  };

  const handleSaveProfile = async (payload) => {
    if (!editingUser) {
      return;
    }

    setIsEditSubmitting(true);
    setBanner('');

    try {
      await updateDashboardUser(editingUser.agentId, payload);
      setBanner(`${payload.fullName || editingUser.agentName} was updated successfully.`);
      setEditingUser(null);
      await loadUsers();
    } catch (saveError) {
      setBanner(saveError.response?.data?.message || 'Failed to update user profile');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 py-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Settings</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Team User Settings</h1>
            <p className="mt-1 text-sm text-slate-500">Manage your team members here without crowding the analytics dashboard.</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{users.length}</span> team users
          </div>
        </div>
      </section>

      {banner && <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-800">{banner}</div>}
      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        {isLoading ? (
          <div className="py-10 text-center text-slate-500">Loading team users...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-700">
                <tr>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold text-center">Dials</th>
                  <th className="px-4 py-3 font-semibold text-center">Submissions</th>
                  <th className="px-4 py-3 font-semibold text-center">Total Leads Assigned</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.agentId} className="border-t border-slate-100">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        {user.profilePhoto ? (
                          <img src={`/uploads/${user.profilePhoto}`} alt={user.agentName} className="h-10 w-10 rounded-full border border-slate-200 object-cover" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-700">
                            {user.agentName?.charAt(0)?.toUpperCase() || 'A'}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-slate-900">{user.agentName}</p>
                          <p className="text-xs text-slate-500">{user.isActive ? 'Active' : 'Inactive'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center font-semibold text-slate-900">{user.dials || 0}</td>
                    <td className="px-4 py-4 text-center font-semibold text-slate-900">{user.submissions || 0}</td>
                    <td className="px-4 py-4 text-center font-semibold text-slate-900">{user.totalAssignedLeads || 0}</td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(user)}
                          className="rounded-xl border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                        >
                          Edit Profile
                        </button>
                        <button type="button" onClick={() => handleViewDetails(user)} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">
                          View Details
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(user)}
                          disabled={actionLoadingKey === `status-${user.agentId}`}
                          className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {actionLoadingKey === `status-${user.agentId}` ? 'Saving...' : user.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromTeam(user)}
                          disabled={actionLoadingKey === `remove-${user.agentId}`}
                          className="rounded-xl border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                        >
                          {actionLoadingKey === `remove-${user.agentId}` ? 'Removing...' : 'Remove From Team'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <EditUserProfileModal
        isOpen={Boolean(editingUser)}
        user={editingUser ? {
          _id: editingUser.agentId,
          fullName: editingUser.agentName,
          email: editingUser.email,
          role: editingUser.role,
        } : null}
        isSubmitting={isEditSubmitting}
        onClose={handleCloseEditModal}
        onSubmit={handleSaveProfile}
      />
    </div>
  );
};

export default TeamLeadSettingsPage;
