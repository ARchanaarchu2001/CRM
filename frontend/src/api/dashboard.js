import { axiosPrivate } from './axios.js';

const DASHBOARD_BASE = '/users/dashboard';

export const fetchTeamLeadDashboard = async (params) => {
  const response = await axiosPrivate.get(`${DASHBOARD_BASE}/team-lead`, { params });
  return response.data;
};

export const fetchAgentSelfDashboard = async (params) => {
  const response = await axiosPrivate.get(`${DASHBOARD_BASE}/agent-self`, { params });
  return response.data;
};

export const fetchSuperAdminDashboard = async (params) => {
  const response = await axiosPrivate.get(`${DASHBOARD_BASE}/super-admin`, { params });
  return response.data;
};

export const fetchAgentPerformanceDetail = async (agentId, params) => {
  const response = await axiosPrivate.get(`${DASHBOARD_BASE}/agents/${agentId}`, { params });
  return response.data;
};

export const deactivateDashboardUser = async (userId) => {
  const response = await axiosPrivate.patch(`/users/${userId}/deactivate`);
  return response.data;
};

export const reactivateDashboardUser = async (userId) => {
  const response = await axiosPrivate.patch(`/users/${userId}/reactivate`);
  return response.data;
};

export const removeDashboardUserFromTeam = async (userId) => {
  const response = await axiosPrivate.patch(`/users/${userId}/remove-from-team`);
  return response.data;
};

export const fetchTeams = async () => {
  const response = await axiosPrivate.get('/users/teams');
  return response.data;
};

export const moveDashboardUserToTeam = async (userId, teamId) => {
  const response = await axiosPrivate.patch(`/users/${userId}/move-team`, { teamId });
  return response.data;
};
