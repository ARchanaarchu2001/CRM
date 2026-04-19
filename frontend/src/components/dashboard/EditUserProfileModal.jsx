import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { PROFILE_PHOTO_ACCEPT, getProfilePhotoUrl, validateProfilePhotoFile } from '../../utils/profilePhoto.js';

const EditUserProfileModal = ({
  isOpen,
  user = null,
  isSubmitting = false,
  onClose,
  onSubmit,
}) => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
  });
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !user) {
      return;
    }

    setFormData({
      fullName: user.fullName || '',
      email: user.email || '',
      password: '',
    });
    setProfilePhotoFile(null);
    setPhotoPreview(user.profilePhoto ? getProfilePhotoUrl(user.profilePhoto) : '');
    setShowPassword(false);
    setFileError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [isOpen, user]);

  if (!isOpen || !user) {
    return null;
  }

  const photoInputId = `edit-profile-photo-${user._id || 'user'}`;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const validationMessage = validateProfilePhotoFile(file);
    if (validationMessage) {
      setProfilePhotoFile(null);
      setFileError(validationMessage);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setProfilePhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setFileError('');
  };

  const handleSubmit = (e) => {
  e.preventDefault();   // ✅ IMPORTANT
  onSubmit?.({
    fullName: formData.fullName.trim(),
    email: formData.email.trim(),
    password: formData.password.trim(),
    profilePhotoFile,
  });
};

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
      <div
        className="w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Profile Edit</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Edit User Profile</h2>
            <p className="mt-1 text-sm text-slate-500">Update the user’s basic profile information from the settings workspace.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              <span className="font-medium">Full Name</span>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                required
                className="rounded-xl border border-slate-300 px-4 py-2.5 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-slate-700">
              <span className="font-medium">Email</span>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="rounded-xl border border-slate-300 px-4 py-2.5 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              <span className="font-medium">Password</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  minLength={6}
                  placeholder="Leave blank to keep the current password"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 pr-12 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition-colors hover:text-slate-600"
                >
                  {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>
              <span className="text-xs text-slate-500">Enter a new password only when you want to update it.</span>
            </label>

            <div className="flex flex-col gap-2 text-sm text-slate-700">
              <label htmlFor={photoInputId} className="font-medium">
                Profile Photo
              </label>
              <input
                id={photoInputId}
                ref={fileInputRef}
                type="file"
                accept={PROFILE_PHOTO_ACCEPT}
                onChange={handleFileChange}
                className="sr-only"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
                >
                  Choose Photo
                </button>
                <span className="text-sm text-slate-500">
                  {profilePhotoFile ? profilePhotoFile.name : 'No file selected'}
                </span>
              </div>
              <span className="text-xs text-slate-500">Uploading a photo is optional. Supported formats: JPG, PNG, WEBP, HEIC, HEIF up to 5 MB.</span>
              {fileError ? <span className="text-xs font-medium text-rose-600">{fileError}</span> : null}
            </div>
          </div>

          {photoPreview && (
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <img
                src={photoPreview}
                alt={formData.fullName || user.fullName || 'Profile preview'}
                className="h-14 w-14 rounded-full border border-slate-200 object-cover"
              />
              <div className="text-sm text-slate-600">
                <p className="font-medium text-slate-900">Profile photo preview</p>
                <p>{profilePhotoFile ? profilePhotoFile.name : 'Current photo'}</p>
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Role: <span className="font-semibold text-slate-900">{user.role}</span>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default EditUserProfileModal;



