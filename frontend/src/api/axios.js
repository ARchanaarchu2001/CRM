import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Avoid standard module circular dependencies by dynamic injection
let store;
export const injectStore = (_store) => {
  store = _store;
};

export const axiosPrivate = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

export const axiosPublic = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

let refreshPromise = null;

const isAuthRequest = (url = '') => String(url).includes('/auth/');
const shouldForceLogout = (error) => {
  const status = error?.response?.status;
  return status === 401 || status === 403;
};

const getFreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = axiosPublic
      .post('/auth/refresh-token')
      .then((response) => response.data.accessToken)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

// Request interceptor: Always attach latest JWT token from Redux
axiosPrivate.interceptors.request.use(
  (config) => {
    if (store) {
      const token = store.getState().auth.accessToken;
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Automatically refresh token on 401 errors
axiosPrivate.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Retry exactly once on 401 Unauthorized
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthRequest(originalRequest.url)
    ) {
      originalRequest._retry = true;

      try {
        const accessToken = await getFreshAccessToken();

        // Dispatch raw action to purely avoid circular imports with Slice
        if (store) {
          store.dispatch({
            type: 'auth/setCredentials',
            payload: {
              user: store.getState().auth.user,
              accessToken: accessToken,
            },
          });
        }

        // Attach new token to original headers and immediately retry
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return axiosPrivate(originalRequest);
        
      } catch (refreshError) {
        // Only force logout when refresh is truly unauthorized/forbidden.
        // Temporary server issues should not immediately destroy the session UI.
        if (store && shouldForceLogout(refreshError)) {
          store.dispatch({
            type: 'auth/logoutLocally',
            payload: {
              notice: 'Your session expired. Please log in again.',
            },
          });
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});
