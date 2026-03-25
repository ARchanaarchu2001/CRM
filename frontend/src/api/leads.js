import { axiosPrivate } from './axios.js';

export const fetchLeadMetadata = async () => {
  const response = await axiosPrivate.get('/leads/metadata');
  return response.data;
};

export const updateRemarkConfig = async (product, payload) => {
  const response = await axiosPrivate.put(`/leads/remarks/${product}`, payload);
  return response.data;
};

export const previewLeadFile = async (payload) => {
  const formData = new FormData();
  formData.append('file', payload.file);
  if (payload.contactColumn) {
    formData.append('contactColumn', payload.contactColumn);
  }

  const response = await axiosPrivate.post('/leads/preview', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const importLeadFile = async (payload) => {
  const formData = new FormData();
  formData.append('product', payload.product);
  formData.append('batchName', payload.batchName);
  formData.append('file', payload.file);
  if (payload.contactColumn) {
    formData.append('contactColumn', payload.contactColumn);
  }
  formData.append('removedColumns', JSON.stringify(payload.removedColumns || []));
  formData.append('addedColumns', JSON.stringify(payload.addedColumns || []));

  const response = await axiosPrivate.post('/leads/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const fetchAnalystLeads = async (params) => {
  const response = await axiosPrivate.get('/leads/analyst', { params });
  return response.data;
};

export const assignLeads = async (payload) => {
  const response = await axiosPrivate.post('/leads/assign', payload);
  return response.data;
};

export const fetchMyAssignments = async (params) => {
  const response = await axiosPrivate.get('/leads/assignments/mine', { params });
  return response.data;
};

export const updateAssignment = async (assignmentId, payload) => {
  const response = await axiosPrivate.put(`/leads/assignments/${assignmentId}`, payload);
  return response.data;
};
