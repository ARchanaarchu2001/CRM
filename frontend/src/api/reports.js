import { axiosPrivate } from './axios.js';
import * as XLSX from 'xlsx';

const API_URL = '/reports';

// Get lead report
export const getLeadReport = async (leadId) => {
  const response = await axiosPrivate.get(`${API_URL}/lead/${leadId}`);
  return response.data;
};

// Get agent performance report
export const getAgentPerformanceReport = async (params) => {
  const response = await axiosPrivate.get(`${API_URL}/agent-performance`, { params });
  return response.data;
};

// Get daily report
export const getDailyReport = async (date, additionalParams = {}) => {
  const response = await axiosPrivate.get(`${API_URL}/daily`, {
    params: { date, ...additionalParams },
  });
  return response.data;
};

// Get weekly report
export const getWeeklyReport = async (week, year, additionalParams = {}) => {
  const response = await axiosPrivate.get(`${API_URL}/weekly`, {
    params: { week, year, ...additionalParams },
  });
  return response.data;
};

// Get monthly report
export const getMonthlyReport = async (month, year, additionalParams = {}) => {
  const response = await axiosPrivate.get(`${API_URL}/monthly`, {
    params: { month, year, ...additionalParams },
  });
  return response.data;
};

// Get all saved reports
export const getAllReports = async (params) => {
  const response = await axiosPrivate.get(API_URL, { params });
  return response.data;
};

// Get report by ID
export const getReportById = async (reportId) => {
  const response = await axiosPrivate.get(`${API_URL}/saved/${reportId}`);
  return response.data;
};

// Save a report
export const saveReport = async (reportData) => {
  const response = await axiosPrivate.post(`${API_URL}/save`, reportData);
  return response.data;
};

// Delete a report
export const deleteReport = async (reportId) => {
  const response = await axiosPrivate.delete(`${API_URL}/${reportId}`);
  return response.data;
};

// Fetch all leads for selection
export const fetchLeadsForReport = async (params) => {
  const response = await axiosPrivate.get('/leads/analyst', { params });
  return response.data;
};

// Fetch all agents/users for selection
export const fetchAgentsForReport = async () => {
  const response = await axiosPrivate.get('/users/agents-list');
  return response.data;
};

// Export report as CSV
export const exportReportAsExcel = (reportData, fileName = 'report.xlsx') => {
  if (!reportData || typeof reportData !== 'object') {
    return;
  }

  const workbook = XLSX.utils.book_new();

  const addSheet = (name, data) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, name);
  };

  if (reportData.summary) {
    const summaryRows = Object.entries(reportData.summary).map(([key, value]) => ({ Metric: key, Value: value }));
    if (summaryRows.length) {
      addSheet('Summary', summaryRows);
    }
  }

  if (reportData.agentMetrics && reportData.agentMetrics.length) {
    addSheet('Agent Metrics', reportData.agentMetrics);
  }

  if (reportData.agentPerformance && reportData.agentPerformance.length) {
    addSheet('Agent Performance', reportData.agentPerformance);
  }

  if (reportData.rawAssignments && reportData.rawAssignments.length) {
    addSheet('Assignments', reportData.rawAssignments);
  }

  if (reportData.assignments && reportData.assignments.length) {
    const assignments = reportData.assignments.map((assignment) => ({
      ...assignment,
      agent: assignment.agent?.fullName || '',
      assignedBy: assignment.assignedBy?.fullName || '',
      leadProduct: assignment.lead?.product || '',
      leadBatchName: assignment.lead?.batchName || '',
      leadContactNumber: assignment.lead?.contactNumber || '',
    }));
    addSheet('Lead Assignments', assignments);
  }

  if (workbook.SheetNames.length === 0) {
    addSheet('Report', [{ Message: 'No report data available' }]);
  }

  XLSX.writeFile(workbook, fileName);
};
