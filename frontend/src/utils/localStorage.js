const getTokenExpiry = (token) => {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;

    const decodedPayload = JSON.parse(atob(payload));
    if (!decodedPayload?.exp) return null;

    return decodedPayload.exp * 1000;
  } catch (error) {
    return null;
  }
};

export const setAuthToken = (token) => {
  const expiresAt = getTokenExpiry(token);

  if (!expiresAt) {
    removeAuthToken();
    return;
  }

  const data = {
    accessToken: token,
    expiresAt,
  };

  localStorage.setItem('crm_auth_session', JSON.stringify(data));
};

export const getAuthToken = () => {
  const dataStr = localStorage.getItem('crm_auth_session');
  if (!dataStr) return null;

  try {
    const data = JSON.parse(dataStr);
    
    // Check expiry
    if (Date.now() > data.expiresAt) {
      removeAuthToken(); // clear expired token
      return null;
    }

    return data.accessToken;
  } catch (error) {
    removeAuthToken();
    return null;
  }
};

export const removeAuthToken = () => {
  localStorage.removeItem('crm_auth_session');
};
