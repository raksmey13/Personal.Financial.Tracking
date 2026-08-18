import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
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
  verifyOTP: (data) => API.post('/users/verify-otp', data), // 🟢 6-Digit OTP Verification Connection
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

export const exportImportAPI = {
  getTemplateUrl: () => `${API.defaults.baseURL}/export-import/template`,

  exportCSV: (params) => {
    const queryString = new URLSearchParams(params).toString();
    return `${API.defaults.baseURL}/export-import/csv?${queryString}`;
  },

  exportPDF: (params) => {
    const queryString = new URLSearchParams(params).toString();
    return `${API.defaults.baseURL}/export-import/pdf?${queryString}`;
  },

  importCSV: (formData) => API.post('/export-import/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    }
  }),
};

export const settingsAPI = {
  getSettings: () => API.get('/settings/'),
  updateSettings: (data) => API.patch('/settings/', data),
};

export default API;