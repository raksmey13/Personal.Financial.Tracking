import axios from 'axios';

const API = axios.create({
  baseURL: 'http://127.0.0.1:8000', // Matches your FastAPI server
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automatically injects token headers on every network call
API.interceptors.request.use(
  (config) => {
    const sessionToken = localStorage.getItem("token");
    if (sessionToken) {
      config.headers.Authorization = `Bearer ${sessionToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Packaged Profile & Auth Management API Methods
export const userAPI = {
  signup: (data) => API.post('/users/signup', data),
  login: (data) => API.post('/users/login', data),
  getProfile: () => API.get('/users/me'),
  updateProfile: (data) => API.put('/users/me', data),
  changePassword: (data) => API.put('/users/me/change-password', data),

  uploadAvatar: (formData) => API.post('/users/me/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    }
  }),
};

export const transactionAPI = {
  getAll: (startDate, endDate) => {
    const params = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return API.get('/transactions/', { params });
  },
  create: (data) => API.post('/transactions/', data),
  update: (id, data) => API.put(`/transactions/${id}`, data),
  delete: (id) => API.delete(`/transactions/${id}`),
};

export const accountAPI = {
  getAll: () => API.get('/accounts/'),
  create: (data) => API.post('/accounts/', data),
  update: (id, data) => API.put(`/accounts/${id}`, data),
  delete: (id) => API.delete(`/accounts/${id}`),
};

export const categoryAPI = {
  getAll: () => API.get("/categories/"),
  create: (data) => API.post("/categories/", data),
  update: (id, data) => API.put(`/categories/${id}`, data),
  delete: (id) => API.delete(`/categories/${id}`),
};

export const analyticsAPI = {
  getSummary: () => API.get('/analytics/summary'),
  getCustomReport: (params) => API.get('/analytics/report', { params }),
  getCalendarEvents: (params) => API.get('/analytics/calendar/events', { params }),
};

export const budgetAPI = {
  getCalculated: () => API.get('/budgets/calculated/'),
  create: (data) => API.post('/budgets/', data),
  delete: (id) => API.delete(`/budgets/${id}`),
};

// Frontend UI Notification API Connections
export const notificationAPI = {
  getAll: () => API.get('/notifications/'),
  markAsRead: (id) => API.put(`/notifications/${id}/read`),
};

export default API;