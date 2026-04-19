import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createUserByAdmin, resetState } from '../../features/users/userManagementSlice';
import { fetchTeams } from '../../api/dashboard.js';
import { PROFILE_PHOTO_ACCEPT, validateProfilePhotoFile } from '../../utils/profilePhoto.js';

const AVAILABLE_ROLES = [
  { value: 'data_analyst', label: 'Data Analyst' },
  { value: 'team_lead', label: 'Team Lead' },
  { value: 'manager', label: 'Manager' },
  { value: 'agent', label: 'Agent' }
];

const CreateUserForm = () => {
  const dispatch = useDispatch();

  const { isLoading, isError, isSuccess, message } = useSelector(
    (state) => state.userManagement || {}
  );
  const currentRole = useSelector((state) => state.auth?.role || '');

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    role: '',
    teamName: '',
    teamId: '',
  });

  const [profilePhoto, setProfilePhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [teams, setTeams] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const photoInputRef = useRef(null);
  const roleOptions = currentRole === 'data_analyst'
    ? AVAILABLE_ROLES.filter((role) => ['team_lead', 'agent'].includes(role.value))
    : AVAILABLE_ROLES;

  useEffect(() => {
    if (isSuccess) {
      setFormData({
        fullName: '',
        email: '',
        password: '',
        role: '',
        teamName: '',
        teamId: '',
      });
      setProfilePhoto(null);
      setPhotoPreview(null);
      setShowPassword(false);
      setPhotoError('');
      if (photoInputRef.current) {
        photoInputRef.current.value = '';
      }
      
      setTimeout(() => {
        dispatch(resetState());
      }, 3000);
    }
  }, [isSuccess, dispatch]);

  useEffect(() => {
    const loadTeams = async () => {
      setTeamsLoading(true);
      setTeamError('');

      try {
        const response = await fetchTeams();
        setTeams(response.data || []);
      } catch (error) {
        setTeamError(error.response?.data?.message || 'Failed to load teams');
      } finally {
        setTeamsLoading(false);
      }
    };

    loadTeams();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const nextState = { ...prev, [name]: value };

      if (name === 'role') {
        if (value !== 'team_lead') {
          nextState.teamName = '';
        }
        if (value !== 'agent') {
          nextState.teamId = '';
        }
      }

      return nextState;
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    const validationMessage = validateProfilePhotoFile(file);
    if (validationMessage) {
      setProfilePhoto(null);
      setPhotoPreview(null);
      setPhotoError(validationMessage);
      e.target.value = '';
      return;
    }

    setProfilePhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoError('');
  };

  const clearPreview = () => {
    setProfilePhoto(null);
    setPhotoPreview(null);
    setPhotoError('');
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (formData.role === 'team_lead' && !formData.teamName.trim()) {
      return;
    }

    const submitData = new FormData();
    submitData.append('fullName', formData.fullName);
    submitData.append('email', formData.email);
    submitData.append('password', formData.password);
    submitData.append('role', formData.role);

    if (formData.role === 'team_lead') submitData.append('teamName', formData.teamName.trim());
    if (formData.role === 'agent' && formData.teamId) submitData.append('teamId', formData.teamId);
    if (profilePhoto) submitData.append('profilePhoto', profilePhoto);

    dispatch(createUserByAdmin(submitData));
  };

  return (
    <div className="mx-auto max-w-3xl rounded-xl bg-white p-6 shadow-md border border-slate-200">
      <div className="mb-6 flex content-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Create New User</h2>
          <p className="text-sm text-slate-500">Super Admin panel for provisioning CRM users.</p>
        </div>
      </div>

      {isSuccess && message && (
        <div className="mb-6 rounded-md bg-green-50 p-4 border border-green-200">
          <p className="text-sm font-medium text-green-800">{message}</p>
        </div>
      )}

      {isError && message && (
        <div className="mb-6 rounded-md bg-red-50 p-4 border border-red-200">
          <p className="text-sm font-medium text-red-800">{message}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="fullName"
              required
              value={formData.fullName}
              onChange={handleInputChange}
              className="rounded-lg border border-slate-300 p-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="John Doe"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              required
              value={formData.email}
              onChange={handleInputChange}
              className="rounded-lg border border-slate-300 p-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="john@example.com"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">
              Temporary Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                required
                minLength={6}
                value={formData.password}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-slate-300 p-2.5 pr-10 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-10-7a18.7 18.7 0 014.223-5.72M6.1 6.1A9.956 9.956 0 0112 5c5 0 9 4 10 7a18.7 18.7 0 01-4.223 5.72M15 12a3 3 0 11-6 0 3 3 0 016 0zm6 6l-18-18" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm7.938 0A10.05 10.05 0 0012 5c-5 0-9 4-10 7a10.05 10.05 0 0010 7c5 0 9-4 10-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">
              Role Allocation <span className="text-red-500">*</span>
            </label>
            <select
              name="role"
              required
              value={formData.role}
              onChange={handleInputChange}
              className="rounded-lg border border-slate-300 p-2.5 text-sm bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="" disabled>Select User Role</option>
              {roleOptions.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {formData.role === 'team_lead' && (
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">
                Team Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="teamName"
                required
                value={formData.teamName}
                onChange={handleInputChange}
                className="rounded-lg border border-slate-300 p-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Phoenix Team"
              />
              <p className="text-xs text-slate-500">This becomes the primary team linked to the new Team Lead.</p>
            </div>
          )}

          {formData.role === 'agent' && (
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Assign Team (Optional)</label>
              <select
                name="teamId"
                value={formData.teamId}
                onChange={handleInputChange}
                className="rounded-lg border border-slate-300 p-2.5 text-sm bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Create as unassigned agent</option>
                {teams.map((team) => (
                  <option key={team._id} value={team._id}>
                    {team.name} - {team.teamLeadName}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                {teamsLoading ? 'Loading active teams...' : 'Choose a team now or move the agent later from the dashboard.'}
              </p>
              {teamError && <p className="text-xs text-rose-600">{teamError}</p>}
            </div>
          )}

        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6">
          <label className="text-sm font-medium text-slate-700">
            Profile Photo (Optional - max 5MB)
          </label>
          <div className="flex items-center gap-4">
            
            <input
              ref={photoInputRef}
              id="profilePhotoInput"
              type="file"
              accept={PROFILE_PHOTO_ACCEPT}
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-full file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
            />
            
            {photoPreview && (
              <div className="relative h-16 w-16 flex-shrink-0">
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="h-full w-full rounded-full object-cover border-2 border-slate-200 shadow-sm"
                />
                <button
                  type="button"
                  onClick={clearPreview}
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white shadow hover:bg-red-600"
                  title="Remove Image"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
          {photoError && <p className="text-sm font-medium text-rose-600">{photoError}</p>}
        </div>

        <div className="flex justify-end border-t border-slate-200 pt-6">
          <button
           type="submit"
           disabled={isLoading}
           className="flex min-w-[140px] items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              'Create User'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateUserForm;
