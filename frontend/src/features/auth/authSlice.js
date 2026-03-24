import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { loginAPI, logoutAPI, fetchMeAPI, refreshTokenAPI } from './authApi.js';

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
  accessToken: null,
  isAuthenticated: false,
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
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
    },
    logoutLocally: (state) => {
      state.user = null;
      state.role = null;
      state.accessToken = null;
      state.isAuthenticated = false;
      state.status = 'idle';
      state.error = null;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Login User
      .addCase(loginUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.role = action.payload.user.role;
        state.accessToken = action.payload.accessToken;
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
      })
      .addCase(fetchMe.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      
      // Refresh Token
      .addCase(refreshToken.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(refreshToken.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.accessToken = action.payload.accessToken;
        state.isAuthenticated = true;
      })
      .addCase(refreshToken.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
        state.isAuthenticated = false;
        state.user = null;
        state.role = null;
        state.accessToken = null;
      });
  },
});

export const { setCredentials, logoutLocally, clearError } = authSlice.actions;
export default authSlice.reducer;
