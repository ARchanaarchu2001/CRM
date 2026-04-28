import { axiosPrivate } from './axios.js';

export const DEVELOPER_DASHBOARD_PATH =
  import.meta.env.VITE_DEVELOPER_DASHBOARD_PATH || 'ops-vault-9f3c7a-monitor';

const DEV_BASE = `/dev/${DEVELOPER_DASHBOARD_PATH}`;

export const fetchDeveloperDashboard = async () => {
  const response = await axiosPrivate.get(`${DEV_BASE}/monitor`);
  return response.data.dashboard;
};

export const downloadDeveloperExport = async (collectionKey, limit = 5000) => {
  const response = await axiosPrivate.get(`${DEV_BASE}/export/${collectionKey}`, {
    params: { limit },
    responseType: 'blob',
  });

  return response.data;
};
