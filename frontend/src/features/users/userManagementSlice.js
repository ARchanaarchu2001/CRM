import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { axiosPrivate } from '../../api/axios.js';

const API_URL = '/users'; // axiosPrivate baseURL already includes /api, so we just append /users

// Thunk for Super Admin to create a user
export const createUserByAdmin = createAsyncThunk(
  'userManagement/createUserByAdmin',
  async (formData, { rejectWithValue }) => {
    try {
      const response = await axiosPrivate.post(`${API_URL}/create`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to create user');
    }
  }
);

// Thunk for Team Lead to create an agent
export const createAgentByTeamLead = createAsyncThunk(
  'userManagement/createAgentByTeamLead',
  async (formData, { rejectWithValue }) => {
    try {
      const response = await axiosPrivate.post(`${API_URL}/team-lead/create-agent`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to create agent');
    }
  }
);

// Thunk to fetch all users (Admin only)
export const getAllUsersForAdmin = createAsyncThunk(
  'userManagement/getAllUsersForAdmin',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosPrivate.get(`${API_URL}/`);
      return response.data.data; 
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to fetch all users');
    }
  }
);

// Thunk to fetch Team Lead's agents
export const getTeamLeadAgents = createAsyncThunk(
  'userManagement/getTeamLeadAgents',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosPrivate.get(`${API_URL}/team-lead/agents`);
      return response.data.data; 
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to fetch agents');
    }
  }
);

// Thunk to deactivate any user (Admin or Team Lead scoped by backend)
export const deactivateUser = createAsyncThunk(
  'userManagement/deactivateUser',
  async (userId, { rejectWithValue }) => {
    try {
      await axiosPrivate.patch(`${API_URL}/${userId}/deactivate`);
      return userId; // Return ID to remove it from local state
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to deactivate user');
    }
  }
);

const initialState = {
  users: [],
  isLoading: false,
  isError: false,
  isSuccess: false,
  message: '',
};

const userManagementSlice = createSlice({
  name: 'userManagement',
  initialState,
  reducers: {
    resetState: (state) => {
      state.isLoading = false;
      state.isError = false;
      state.isSuccess = false;
      state.message = '';
    },
    updateAgentMetricsDirectly: (state, action) => {
      const { agentId, dailyDialsCount, pendingLeadsCount } = action.payload;
      const agentIndex = state.users.findIndex(u => u._id === agentId);
      if (agentIndex !== -1) {
        state.users[agentIndex].dailyDialsCount = dailyDialsCount;
        state.users[agentIndex].pendingLeadsCount = pendingLeadsCount;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(createUserByAdmin.pending, (state) => {
        state.isLoading = true;
        state.isError = false;
        state.isSuccess = false;
        state.message = '';
      })
      .addCase(createUserByAdmin.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.users.unshift(action.payload);
        state.message = 'User created successfully!';
      })
      .addCase(createUserByAdmin.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      })
      // Team Lead Agent Creation Cases
      .addCase(createAgentByTeamLead.pending, (state) => {
        state.isLoading = true;
        state.isError = false;
        state.isSuccess = false;
        state.message = '';
      })
      .addCase(createAgentByTeamLead.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.users.unshift(action.payload);
        state.message = 'Agent assigned successfully!';
      })
      .addCase(createAgentByTeamLead.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      })
      // Fetching All Users (Admin)
      .addCase(getAllUsersForAdmin.pending, (state) => {
        state.isLoading = true;
        state.isError = false;
      })
      .addCase(getAllUsersForAdmin.fulfilled, (state, action) => {
        state.isLoading = false;
        state.users = action.payload;
      })
      .addCase(getAllUsersForAdmin.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      })
      // Fetching Team Lead Agents
      .addCase(getTeamLeadAgents.pending, (state) => {
        state.isLoading = true;
        state.isError = false;
      })
      .addCase(getTeamLeadAgents.fulfilled, (state, action) => {
        state.isLoading = false;
        state.users = action.payload;
      })
      .addCase(getTeamLeadAgents.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      })
      // Deactivating User
      .addCase(deactivateUser.pending, (state) => {
        state.isLoading = true;
        state.isError = false;
        state.isSuccess = false;
      })
      .addCase(deactivateUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.users = state.users.filter((u) => u._id !== action.payload);
        state.message = 'User deactivated successfully';
      })
      .addCase(deactivateUser.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      });
  },
});

export const { resetState, updateAgentMetricsDirectly } = userManagementSlice.actions;
export default userManagementSlice.reducer;
