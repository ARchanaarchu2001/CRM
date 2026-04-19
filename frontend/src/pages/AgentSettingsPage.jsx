import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateDashboardUser } from '../api/dashboard.js';
import { fetchMe } from '../features/auth/authSlice.js';
import { PROFILE_PHOTO_ACCEPT, getProfilePhotoUrl, validateProfilePhotoFile } from '../utils/profilePhoto.js';

const AgentSettingsPage = () => {
  const dispatch = useDispatch();
  const { user, role } = useSelector((state) => state.auth);
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(user?.profilePhoto ? getProfilePhotoUrl(user.profilePhoto) : '');
  const [isPhotoSubmitting, setIsPhotoSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const roleLabel = role === 'data_analyst' ? 'Data Analyst' : 'Agent';
  const pageDescription =
    role === 'data_analyst'
      ? 'Update your profile picture for the analyst workspace.'
      : 'Update your profile picture.';

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const validationMessage = validateProfilePhotoFile(file);
    if (validationMessage) {
      setProfilePhotoFile(null);
      setError(validationMessage);
      setMessage('');
      event.target.value = '';
      return;
    }

    setProfilePhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setMessage('');
    setError('');
  };

  const handlePhotoSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!user?._id) {
      setError('Could not identify your account.');
      return;
    }

    if (!profilePhotoFile) {
      setError('Choose a profile photo first.');
      return;
    }

    setIsPhotoSubmitting(true);

    try {
      const submitData = new FormData();
      submitData.append('profilePhoto', profilePhotoFile);
      await updateDashboardUser(user._id, submitData);
      await dispatch(fetchMe()).unwrap();
      setProfilePhotoFile(null);
      setMessage('Profile photo updated successfully.');
    } catch (updateError) {
      setError(updateError.response?.data?.message || 'Failed to update profile photo');
    } finally {
      setIsPhotoSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl py-6">
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Settings</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{roleLabel} Profile Photo</h1>
        <p className="mt-2 text-sm text-slate-500">{pageDescription}</p>

        {message && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {message}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        )}

        <div className="mt-5 flex flex-col items-center gap-4 rounded-2xl bg-slate-50 p-5">
          <div className="h-24 w-24 overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm">
            {photoPreview ? (
              <img src={photoPreview} alt={user?.fullName || 'Profile preview'} className="h-full w-full object-cover" />
            ) : null}
          </div>

          <form onSubmit={handlePhotoSubmit} className="w-full space-y-4">
            <input
              type="file"
              accept={PROFILE_PHOTO_ACCEPT}
              onChange={handlePhotoChange}
              className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-full file:border-0 file:bg-indigo-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-200"
            />

            <button
              type="submit"
              disabled={isPhotoSubmitting}
              className="w-full rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPhotoSubmitting ? 'Updating...' : 'Update Photo'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};

export default AgentSettingsPage;
