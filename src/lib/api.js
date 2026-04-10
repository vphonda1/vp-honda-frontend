import { API_BASE } from '../utils/apiConfig';
const API_URL = API_BASE + '/api';

export const api = {
  // Auth
  login: async (email, password) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return res.json();
  },

  // Customers
  getCustomers: async () => {
    const res = await fetch(`${API_URL}/customers`);
    return res.json();
  },

  // Import
  importFile: async (file, type) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    
    const res = await fetch(`${API_URL}/import/upload`, {
      method: 'POST',
      body: formData
    });
    return res.json();
  },

  // Export
  exportData: (type) => {
    window.open(`${API_URL}/import/export/${type}`, '_blank');
  }
};