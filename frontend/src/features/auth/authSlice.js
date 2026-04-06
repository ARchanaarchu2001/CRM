import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { loginAPI, logoutAPI, fetchMeAPI, refreshTokenAPI } from './authApi.js';
import { setAuthToken, removeAuthToken, getAuthToken } from '../../utils/localStorage.js';

// Async Thunks
export const loginUser = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const data = await loginAPI(credentials);
      return data;
    } catch (error) {
      if (!error.response) throw error;
      return rejectWithValue(error.response.data.message || error.response.data.errors || 'Login failed');
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await logoutAPI();
      return true;
    } catch (error) {
      if (!error.response) throw error;
      return rejectWithValue(error.response.data.message || 'Logout failed');
    }
  }
);

export const fetchMe = createAsyncThunk(
  'auth/fetchMe',
  async (_, { rejectWithValue }) => {
    try {
      const data = await fetchMeAPI();
      return data;
    } catch (error) {
      if (!error.response) throw error;
      return rejectWithValue(error.response.data.message || 'Fetch failed');
    }
  }
);

export const refreshToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { rejectWithValue }) => {
    try {
      const data = await refreshTokenAPI();
      return data;
    } catch (error) {
      if (!error.response) throw error;
      return rejectWithValue(error.response.data.message || 'Failed to refresh token');
    }
  }
);

const initialState = {
  user: null,
  role: null,
  accessToken: getAuthToken(), // Initialize immediately if available
  isAuthenticated: false,
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
  sessionNotice: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      state.user = action.payload.user;
      state.role = action.payload.user?.role || null;
      state.accessToken = action.payload.accessToken;
      state.isAuthenticated = true;
      state.error = null;
      state.sessionNotice = null;

      if (action.payload.accessToken) {
        setAuthToken(action.payload.accessToken);
      }
    },
    logoutLocally: (state, action) => {
      state.user = null;
      state.role = null;
      state.accessToken = null;
      state.isAuthenticated = false;
      state.status = 'idle';
      state.error = null;
      state.sessionNotice = action.payload?.notice || null;
      removeAuthToken();
    },
    restoreAuthFromStorage: (state) => {
      const token = getAuthToken();
      if (token) {
        state.accessToken = token;
        state.isAuthenticated = true; // Temporary trust until fetchMe resolves
      }
    },
    clearError: (state) => {
      state.error = null;
      state.sessionNotice = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Login User
      .addCase(loginUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
        state.sessionNotice = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.role = action.payload.user.role;
        state.accessToken = action.payload.accessToken;
        state.sessionNotice = null;
        setAuthToken(action.payload.accessToken);
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
        state.isAuthenticated = false;
      })
      
      // Logout User
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.role = null;
        state.accessToken = null;
        state.isAuthenticated = false;
        state.status = 'idle';
        state.error = null;
        state.sessionNotice = null;
        removeAuthToken();
      })
      
      // Fetch Me
      .addCase(fetchMe.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload.user;
        state.role = action.payload.user.role;
        state.isAuthenticated = true;
        state.sessionNotice = null;
      })
      .addCase(fetchMe.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      
      // Refresh Token
      .addCase(refreshToken.pending, (state) => {
        // Keep the current UI mounted during silent refreshes triggered on focus/visibility.
        // PersistLogin already owns the initial boot loading screen.
        if (state.status === 'idle') {
          state.status = 'loading';
        }
      })
      .addCase(refreshToken.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.accessToken = action.payload.accessToken;
        state.isAuthenticated = true;
        state.sessionNotice = null;
        setAuthToken(action.payload.accessToken);
      })
      .addCase(refreshToken.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
        state.isAuthenticated = false;
        state.user = null;
        state.role = null;
        state.accessToken = null;
        removeAuthToken();
      });
  },
});

export const { setCredentials, logoutLocally, restoreAuthFromStorage, clearError } = authSlice.actions;
export default authSlice.reducer;
