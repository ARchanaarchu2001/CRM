const PROFILE_PHOTO_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
const PROFILE_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/x-png',
  'image/webp',
  'image/heic',
  'image/heif',
];

export const PROFILE_PHOTO_ACCEPT = 'image/*,.jpg,.jpeg,.png,.webp,.heic,.heif';
export const PROFILE_PHOTO_MAX_SIZE = 5 * 1024 * 1024;

const getFileExtension = (fileName = '') => {
  const segments = String(fileName).toLowerCase().split('.');
  return segments.length > 1 ? segments.pop() : '';
};

export const isSupportedProfilePhoto = (file) => {
  if (!file) {
    return false;
  }

  const extension = getFileExtension(file.name);
  const mimeType = String(file.type || '').toLowerCase();

  return PROFILE_PHOTO_EXTENSIONS.includes(extension) || PROFILE_PHOTO_MIME_TYPES.includes(mimeType);
};

export const validateProfilePhotoFile = (file) => {
  if (!file) {
    return 'Choose an image first.';
  }

  if (!isSupportedProfilePhoto(file)) {
    return 'Please choose a JPG, PNG, WEBP, HEIC, or HEIF image.';
  }

  if (file.size > PROFILE_PHOTO_MAX_SIZE) {
    return 'Please choose an image smaller than 5 MB.';
  }

  return '';
};
