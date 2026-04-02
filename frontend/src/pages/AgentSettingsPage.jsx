import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { changePasswordAPI } from '../features/auth/authApi.js';
import { logoutLocally } from '../features/auth/authSlice.js';

const AgentSettingsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const toggleVisibility = (field) => {
    setShowPasswords((current) => ({ ...current, [field]: !current[field] }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    if (formData.newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('New password and confirm password must match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await changePasswordAPI({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });

      setMessage(response.message || 'Password changed successfully. Please log in again.');
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });

      dispatch(
        logoutLocally({
          notice: response.message || 'Password changed successfully. Please log in again.',
        })
      );

      setTimeout(() => {
        navigate('/login');
      }, 1200);
    } catch (changeError) {
      setError(changeError.response?.data?.message || 'Failed to change password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPasswordField = (field, label, placeholder) => (
    <label className="flex flex-col gap-1 text-sm text-slate-700">
      <span className="font-medium">
        {label} <span className="text-rose-500">*</span>
      </span>
      <div className="relative">
        <input
          type={showPasswords[field] ? 'text' : 'password'}
          name={field}
          value={formData[field]}
          onChange={handleChange}
          required
          minLength={6}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-14 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
        <button
          type="button"
          onClick={() => toggleVisibility(field)}
          className="absolute inset-y-0 right-3 text-sm font-semibold text-slate-500 hover:text-slate-700"
        >
          {showPasswords[field] ? 'Hide' : 'Show'}
        </button>
      </div>
    </label>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Settings</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Agent Settings</h1>
        <p className="mt-2 text-sm text-slate-500">
          Update your password securely by entering your current password first.
        </p>
      </section>

      {message && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4">
            {renderPasswordField('currentPassword', 'Current Password', 'Enter your current password')}
            {renderPasswordField('newPassword', 'New Password', 'Enter your new password')}
            {renderPasswordField('confirmPassword', 'Confirm New Password', 'Re-enter your new password')}
          </div>

          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            After the password is changed, you will be logged out and asked to sign in again.
          </div>

          <div className="flex justify-end border-t border-slate-200 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default AgentSettingsPage;
