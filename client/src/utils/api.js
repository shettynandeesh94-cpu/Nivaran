// React API Client Wrapper for Nivaran

const BASE_URL = '/api';

const getToken = () => localStorage.getItem('nivaran_token');
const setToken = (token) => localStorage.setItem('nivaran_token', token);
const clearToken = () => localStorage.removeItem('nivaran_token');

const getUser = () => {
    const user = localStorage.getItem('nivaran_user');
    return user ? JSON.parse(user) : null;
};
const setUser = (user) => localStorage.setItem('nivaran_user', JSON.stringify(user));
const clearUser = () => localStorage.removeItem('nivaran_user');

const request = async (endpoint, options = {}) => {
    const url = `${BASE_URL}${endpoint}`;
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    const token = getToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        ...options,
        headers,
    };

    try {
        const response = await fetch(url, config);
        const data = await response.json();

        if (!response.ok) {
            const error = new Error(data.message || 'Something went wrong');
            error.status = response.status;
            error.data = data;
            throw error;
        }

        return data;
    } catch (err) {
        console.error(`API Error on ${endpoint}:`, err);
        throw err;
    }
};

export const api = {
    login: async (email, password) => {
        const data = await request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        if (data.token) {
            setToken(data.token);
            setUser(data.user);
        }
        return data;
    },

    signup: async (name, email, password, role, ward) => {
        return await request('/auth/signup', {
            method: 'POST',
            body: JSON.stringify({ name, email, password, role, ward }),
        });
    },

    logout: () => {
        clearToken();
        clearUser();
    },

    getComplaints: async () => {
        return await request('/complaints', {
            method: 'GET',
        });
    },

    getComplaintById: async (id) => {
        return await request(`/complaints/${id}`, {
            method: 'GET',
        });
    },

    createComplaint: async (title, description, ward) => {
        return await request('/complaints', {
            method: 'POST',
            body: JSON.stringify({ title, description, ward }),
        });
    },

    updateComplaintStatus: async (id, status) => {
        return await request(`/complaints/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        });
    },

    addComplaintExpense: async (id, item, cost, note) => {
        return await request(`/complaints/${id}/expenses`, {
            method: 'POST',
            body: JSON.stringify({ item, cost, note }),
        });
    },

    getDepartmentBudgets: async () => {
        return await request('/budget/departments', {
            method: 'GET',
        });
    },

    getBudgetRequests: async () => {
        return await request('/budget/requests', {
            method: 'GET',
        });
    },

    createBudgetRequest: async (departmentId, amount, reason, complaintId) => {
        return await request('/budget/requests', {
            method: 'POST',
            body: JSON.stringify({ departmentId, amount, reason, complaintId }),
        });
    },

    actionBudgetRequest: async (requestId, status, adminNote) => {
        return await request(`/budget/requests/${requestId}/action`, {
            method: 'PATCH',
            body: JSON.stringify({ status, adminNote }),
        });
    },

    updateDepartmentBudget: async (departmentId, budget) => {
        return await request(`/budget/departments/${departmentId}`, {
            method: 'PATCH',
            body: JSON.stringify({ budget }),
        });
    },

    getToken,
    getUser,
};
