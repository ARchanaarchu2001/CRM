import { axiosPrivate } from './axios.js';

// Fetch metadata
export const fetchLeadMetadata = async () => {
  const response = await axiosPrivate.get('/leads/metadata');
  return response.data;
};

// Update remark config
export const updateRemarkConfig = async (product, payload) => {
  const response = await axiosPrivate.put(`/leads/remarks/${product}`, payload);
  return response.data;
};

// Preview lead file
export const previewLeadFile = async (payload) => {
  const formData = new FormData();

  formData.append('file', payload.file);

  if (payload.contactColumn) {
    formData.append('contactColumn', payload.contactColumn);
  }

  const response = await axiosPrivate.post('/leads/preview', formData);
  return response.data;
};

// Import lead file
export const importLeadFile = async (payload) => {
  const formData = new FormData();

  if (payload.product) formData.append('product', payload.product);
  if (payload.batchName) formData.append('batchName', payload.batchName);

  formData.append('file', payload.file);

  if (payload.contactColumn) {
    formData.append('contactColumn', payload.contactColumn);
  }

  formData.append(
    'removedColumns',
    JSON.stringify(payload.removedColumns || [])
  );

  formData.append(
    'addedColumns',
    JSON.stringify(payload.addedColumns || [])
  );

  const response = await axiosPrivate.post('/leads/import', formData);
  return response.data;
};

// Fetch analyst leads
export const fetchAnalystLeads = async (params) => {
  const response = await axiosPrivate.get('/leads/analyst', { params });
  return response.data;
};

// Fetch analyst batches
export const fetchAnalystBatches = async (params) => {
  const response = await axiosPrivate.get('/leads/analyst/batches', { params });
  return response.data;
};

// Delete analyst batch ✅ FIXED
export const deleteAnalystBatch = async (importBatchId) => {
  const response = await axiosPrivate.delete(
    `/leads/analyst/batches/${importBatchId}`
  );
  return response.data;
};

// Team lead conversion overview
export const fetchTeamLeadConversionOverview = async (params) => {
  const response = await axiosPrivate.get('/leads/team-lead/conversion', {
    params,
  });
  return response.data;
};

// Assign leads
export const assignLeads = async (payload) => {
  const response = await axiosPrivate.post('/leads/assign', payload);
  return response.data;
};

// Fetch my assignments
export const fetchMyAssignments = async (params) => {
  const response = await axiosPrivate.get('/leads/assignments/mine', { params });
  return response.data;
};

// Fetch assignment batches
export const fetchMyAssignmentBatches = async () => {
  const response = await axiosPrivate.get('/leads/assignments/batches');
  return response.data;
};

// Pipeline summary
export const fetchMyPipelineSummary = async () => {
  const response = await axiosPrivate.get(
    '/leads/assignments/pipeline/summary'
  );
  return response.data;
};

// Pipeline assignments
export const fetchMyPipelineAssignments = async () => {
  const response = await axiosPrivate.get('/leads/assignments/pipeline');
  return response.data;
};

// Hide assignment batch
export const hideAssignmentBatch = async (importBatchId) => {
  const response = await axiosPrivate.put(
    `/leads/assignments/batches/${importBatchId}/hide`
  );
  return response.data;
};

export const restoreAssignmentBatch = async (importBatchId) => {
  const response = await axiosPrivate.put(
    `/leads/assignments/batches/${importBatchId}/restore`
  );
  return response.data;
};

// Update assignment
export const updateAssignment = async (assignmentId, payload) => {
  const response = await axiosPrivate.put(
    `/leads/assignments/${assignmentId}`,
    payload
  );
  return response.data;
};
