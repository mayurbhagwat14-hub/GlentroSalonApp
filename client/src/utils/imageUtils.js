export const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://') || imagePath.startsWith('data:') || imagePath.startsWith('blob:')) {
    return imagePath;
  }
  
  let uploadUrl = (import.meta.env.VITE_UPLOAD_PATH || '').trim();
  
  // If a Linux filesystem path like /var/www/... was mistakenly put into frontend env, strip it
  if (uploadUrl.startsWith('/var/') || uploadUrl.startsWith('/root/') || uploadUrl.startsWith('/home/') || uploadUrl.startsWith('C:\\')) {
    uploadUrl = '';
  }

  // If accessed from outside localhost (e.g. mobile IP or domain), don't force localhost:5000
  if (typeof window !== 'undefined') {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocal && uploadUrl.includes('localhost')) {
      uploadUrl = '';
    }
  }

  // Remove trailing slash if present
  if (uploadUrl.endsWith('/')) {
    uploadUrl = uploadUrl.slice(0, -1);
  }
  
  // Clean leading slash or redundant 'uploads/' prefix from imagePath
  let cleanImagePath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
  if (cleanImagePath.startsWith('uploads/')) {
    cleanImagePath = cleanImagePath.slice('uploads/'.length);
  }
  
  return uploadUrl ? `${uploadUrl}/uploads/${cleanImagePath}` : `/uploads/${cleanImagePath}`;
};
