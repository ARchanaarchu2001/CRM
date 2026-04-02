import React from 'react';

const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <defs>
        <linearGradient id="avatarBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#e2e8f0" />
          <stop offset="100%" stop-color="#cbd5e1" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="32" fill="url(#avatarBg)" />
      <circle cx="32" cy="24" r="12" fill="#94a3b8" />
      <path d="M14 52c2-10 10-16 18-16s16 6 18 16" fill="#94a3b8" />
    </svg>
  `);

const UserAvatar = ({ src = '', alt = 'User avatar', className = '' }) => (
  <img
    src={src ? `/uploads/${src}` : DEFAULT_AVATAR}
    alt={alt}
    className={className}
  />
);

export default UserAvatar;
