import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice.js';
import userManagementReducer from '../features/users/userManagementSlice.js';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    userManagement: userManagementReducer,
  },
  devTools: process.env.NODE_ENV !== 'production',
});
