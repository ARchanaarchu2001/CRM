import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import CreateUserForm from '../components/users/CreateUserForm.jsx';
import EditUserProfileModal from '../components/dashboard/EditUserProfileModal.jsx';
import MoveAgentToTeamModal from '../components/dashboard/MoveAgentToTeamModal.jsx';
import UserAvatar from '../components/UserAvatar.jsx';
import {
  deactivateDashboardUser,
  fetchAdminUsers,
  fetchTeams,
  moveDashboardUserToTeam,
  reactivateDashboardUser,
  removeDashboardUser,
  updateDashboardUser,
} from '../api/dashboard.js';
import { fetchMe } from '../features/auth/authSlice.js';
import {
  PROFILE_PHOTO_ACCEPT,
  getProfilePhotoUrl,
  validateProfilePhotoFile,
} from '../utils/profilePhoto.js';

const getRoleLabel = (role) =>
  String(role || '')
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const SuperAdminSettingsPage = () => {
  const dispatch = useDispatch();
  const { role, user: currentUser } = useSelector((state) => state.auth);
  const isAnalystSettings = role === 'data_analyst';
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
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isProfilePreviewOpen, setIsProfilePreviewOpen] = useState(false);
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [profilePreview, setProfilePreview] = useState('');
  const [isProfileSubmitting, setIsProfileSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return users;
    }

    return users.filter((user) => String(user.fullName || '').toLowerCase().includes(normalizedSearch));
  }, [searchTerm, users]);

  useEffect(() => {
    setProfilePreview(currentUser?.profilePhoto ? getProfilePhotoUrl(currentUser.profilePhoto) : '');
  }, [currentUser?.profilePhoto]);

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

  const handleRemoveAgent = async (user) => {
    if (!window.confirm(`Remove ${user.fullName} completely from the system?`)) {
      return;
    }

    setActionLoadingKey(`remove-${user._id}`);
    setBanner('');

    try {
      const response = await removeDashboardUser(user._id);
      setBanner(response.message || `${user.fullName} was removed from the system.`);
      await loadSettingsData();
    } catch (removeError) {
      setBanner(removeError.response?.data?.message || 'Failed to remove agent');
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
      const submitData = new FormData();
      submitData.append('fullName', payload.fullName);
      submitData.append('email', payload.email);

      if (payload.password) {
        submitData.append('password', payload.password);
      }

      if (payload.profilePhotoFile) {
        submitData.append('profilePhoto', payload.profilePhotoFile);
      }

      await updateDashboardUser(editingUser._id, submitData);
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

  const handleOwnProfilePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const validationMessage = validateProfilePhotoFile(file);
    if (validationMessage) {
      setBanner(validationMessage);
      setProfilePhotoFile(null);
      event.target.value = '';
      return;
    }

    setBanner('');
    setProfilePhotoFile(file);
    setProfilePreview(URL.createObjectURL(file));
  };

  const handleOwnProfileSubmit = async (event) => {
    event.preventDefault();

    if (!currentUser?._id) {
      setBanner('Could not identify your account.');
      return;
    }

    if (!profilePhotoFile) {
      setBanner('Choose a profile photo first.');
      return;
    }

    setIsProfileSubmitting(true);
    setBanner('');

    try {
      const submitData = new FormData();
      submitData.append('profilePhoto', profilePhotoFile);
      await updateDashboardUser(currentUser._id, submitData);
      await dispatch(fetchMe()).unwrap();
      setProfilePhotoFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setBanner('Your profile photo was updated successfully.');
    } catch (updateError) {
      setBanner(updateError.response?.data?.message || 'Failed to update your profile photo');
    } finally {
      setIsProfileSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 py-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Settings</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              {isAnalystSettings ? 'Analyst Settings' : 'System User Settings'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {isAnalystSettings
                ? 'Update your profile and manage Team Leads and agents from one workspace.'
                : 'View and manage all users, including Team Leads, agents, and other CRM roles, from one place.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{users.length}</span> users
            </div>
            <button
              type="button"
              onClick={() => setShowCreateForm((current) => !current)}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition ${
                showCreateForm ? 'bg-slate-500 hover:bg-slate-600' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {showCreateForm ? 'Close Form' : 'Create New User'}
            </button>
          </div>
        </div>
      </section>

      {isAnalystSettings && (
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">My Profile</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Update Profile Photo</h2>
              <p className="mt-1 text-sm text-slate-500">Keep your analyst profile picture current for the workspace header and settings tables.</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {currentUser?.email || 'No email available'}
            </div>
          </div>

          <form onSubmit={handleOwnProfileSubmit} className="mt-6 grid gap-6 xl:grid-cols-[240px,minmax(0,720px)] xl:justify-center xl:items-stretch">
            <div className="flex h-full flex-col items-center justify-center gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-6 text-center">
              <button
                type="button"
                onClick={() => profilePreview && setIsProfilePreviewOpen(true)}
                disabled={!profilePreview}
                className={`overflow-hidden rounded-full ${profilePreview ? 'cursor-zoom-in' : 'cursor-default'}`}
                title={profilePreview ? 'Preview current profile photo' : 'No profile photo uploaded'}
              >
                <UserAvatar
                  src={currentUser?.profilePhoto}
                  alt={currentUser?.fullName || 'Analyst avatar'}
                  className="h-28 w-28 rounded-full border border-slate-200 object-cover shadow-sm"
                />
              </button>
              <div className="text-center">
                <p className="font-semibold text-slate-900">{currentUser?.fullName || 'Data Analyst User'}</p>
                <p className="text-sm text-slate-500">Click the photo to preview it.</p>
              </div>
            </div>

            <div className="flex h-full flex-col justify-center rounded-[1.5rem] border border-slate-200 bg-white p-6">
              <div className="flex flex-col gap-5">
                <label className="flex min-w-0 flex-col gap-2 text-sm text-slate-700">
                  <span className="font-medium">Choose New Photo</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={PROFILE_PHOTO_ACCEPT}
                    onChange={handleOwnProfilePhotoChange}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-full file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                </label>

                <div className="flex justify-start xl:justify-end">
                  <button
                    type="submit"
                    disabled={isProfileSubmitting}
                    className="w-full rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {isProfileSubmitting ? 'Updating...' : 'Update Photo'}
                  </button>
                </div>
              </div>

              {profilePhotoFile && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Selected file: <span className="font-semibold text-slate-900">{profilePhotoFile.name}</span>
                </div>
              )}
            </div>
          </form>
        </section>
      )}

      {showCreateForm && (
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <CreateUserForm />
        </section>
      )}

      {banner && <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-800">{banner}</div>}
      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">User Directory</h2>
            <p className="mt-1 text-sm text-slate-500">
              Search by user name only.
            </p>
          </div>
          <div className="w-full sm:w-auto sm:min-w-[320px]">
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              placeholder="Search users by name"
            />
          </div>
        </div>
        {isLoading ? (
          <div className="py-10 text-center text-slate-500">Loading user settings...</div>
        ) : filteredUsers.length ? (
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
                {filteredUsers.map((user) => {
                  const isAgent = user.role === 'agent';
                  const isTeamLead = user.role === 'team_lead';
                  const teamName = user.assignedTeam || user.team?.name || 'Unassigned';
                  const teamLeadName = user.teamLead?.fullName || user.team?.lead?.fullName || 'Unassigned';

                  return (
                    <tr key={user._id} className="border-t border-slate-100">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            src={user.profilePhoto}
                            alt={user.fullName}
                            className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                          />
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
                            onClick={() => handleRemoveAgent(user)}
                            disabled={!isAgent || actionLoadingKey === `remove-${user._id}`}
                            className="rounded-xl border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {actionLoadingKey === `remove-${user._id}` ? 'Removing...' : 'Remove Agent'}
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
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
            No users matched "{searchTerm.trim()}".
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

      {isAnalystSettings && isProfilePreviewOpen && profilePreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8"
          onClick={() => setIsProfilePreviewOpen(false)}
        >
          <div
            className="relative w-full max-w-4xl rounded-[2rem] bg-white p-4 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsProfilePreviewOpen(false)}
              className="absolute right-4 top-4 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Close
            </button>
            <div className="mb-4 pr-20">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Profile Preview</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">{currentUser?.fullName || 'Data Analyst User'}</h2>
              <p className="mt-1 text-sm text-slate-500">{currentUser?.email || ''}</p>
            </div>
            <div className="overflow-hidden rounded-[1.5rem] bg-slate-100">
              <img
                src={profilePreview}
                alt={currentUser?.fullName || 'Profile photo preview'}
                className="max-h-[75vh] w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminSettingsPage;
