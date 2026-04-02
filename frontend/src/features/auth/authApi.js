import { axiosPrivate, axiosPublic } from '../../api/axios.js';

export const loginAPI = async (credentials) => {
  const response = await axiosPrivate.post('/auth/login', credentials);
  return response.data;
};

export const logoutAPI = async () => {
  const response = await axiosPrivate.post('/auth/logout');
  return response.data;
};

export const fetchMeAPI = async () => {
  const response = await axiosPrivate.get('/auth/me');
  return response.data;
};

export const refreshTokenAPI = async () => {
  const response = await axiosPublic.post('/auth/refresh-token');
  return response.data;
};

export const changePasswordAPI = async (payload) => {
  const response = await axiosPrivate.put('/auth/change-password', payload);
  return response.data;
};
