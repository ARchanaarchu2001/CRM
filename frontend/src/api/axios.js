import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Avoid standard module circular dependencies by dynamic injection
let store;
export const injectStore = (_store) => {
  store = _store;
};

export const axiosPrivate = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

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
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Ping refresh endpoint using a fresh standard axios instance (bypassing interceptors context loop)
        const apiResponse = await axios.post(
          `${BASE_URL}/auth/refresh-token`,
          {},
          { withCredentials: true }
        );

        const { accessToken } = apiResponse.data;

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
        // Ultimate failure: Token completely dead, kick out user locally
        if (store) {
          store.dispatch({ type: 'auth/logoutLocally' });
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});
