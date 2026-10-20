// React API Client Wrapper for Nivaran

const BASE_URL = import.meta.env.VITE_API_URL 
    ? (import.meta.env.VITE_API_URL.endsWith('/api') 
        ? import.meta.env.VITE_API_URL 
        : `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`)
    : '/api';

const getToken = () => localStorage.getItem('nivaran_token');
const setToken = (token) => localStorage.setItem('nivaran_token', token);
const clearToken = () => localStorage.removeItem('nivaran_token');

const getUser = () => {
    try {
        const user = localStorage.getItem('nivaran_user');
        return user ? JSON.parse(user) : null;
    } catch (e) {
        return null;
    }
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
        const text = await response.text();
        let data;
        const isHtmlResponse = text && (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html') || text.trim().startsWith('<!doctype'));

        if (isHtmlResponse) {
            const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
            const htmlErrMsg = isLocal
                ? 'Backend server is unreachable or offline. Please ensure the backend server is running on port 5000.'
                : 'Backend API is unreachable. Please ensure your backend is deployed and VITE_API_URL is configured in your hosting environment.';
            const error = new Error(htmlErrMsg);
            error.status = 502;
            throw error;
        }

        try {
            data = text ? JSON.parse(text) : {};
        } catch (e) {
            const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
            data = { 
                message: response.ok 
                    ? text 
                    : (response.status === 502 || response.status === 504 
                        ? (isLocal ? 'Backend server is unreachable or offline. Please ensure the backend server is running on port 5000.' : 'Backend server is unreachable. Please ensure the backend is deployed and running.')
                        : (isLocal ? 'Backend server connection error. Please ensure the server is running on port 5000.' : 'Backend server connection error. Please ensure the backend service is reachable.'))
            };
        }

        if (!response.ok) {
            if (response.status === 401 && !endpoint.startsWith('/auth/')) {
                clearToken();
                clearUser();
                window.dispatchEvent(new Event('auth:unauthorized'));
            }
            const fallbackMsg = response.status === 401
                ? 'Your login session has expired or is unauthorized. Please sign in again as Corporator or Admin.'
                : response.status === 403
                    ? 'Access denied: Only Corporators or Administrators are authorized to perform this operation.'
                    : response.status === 503
                        ? 'Database service is connecting. Please retry in a few moments.'
                        : response.status === 500
                            ? 'Server error occurred while processing request. Please retry.'
                            : `Server error (${response.status})`;

            const errorMsg = data.message || data.error || fallbackMsg;
            const error = new Error(errorMsg);
            error.status = response.status;
            error.data = data;
            throw error;
        }

        return data;
    } catch (err) {
        if (!err.status && (err.message === 'Failed to fetch' || err.message?.includes('NetworkError') || err.message?.includes('Load failed'))) {
            const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
            const netErr = new Error(
                isLocal 
                    ? 'Unable to connect to Nivaran backend server on port 5000. Please ensure the backend server is running.'
                    : 'Unable to connect to Nivaran backend API. Please ensure your backend server is deployed and active.'
            );
            netErr.status = 0;
            throw netErr;
        }
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

    signup: async (nameOrData, email, password, role, ward, district, taluk, panchayat) => {
        let body;
        if (typeof nameOrData === 'object' && nameOrData !== null) {
            body = nameOrData;
        } else {
            body = { name: nameOrData, email, password, role, ward, district, taluk, panchayat };
        }
        return await request('/auth/signup', {
            method: 'POST',
            body: JSON.stringify(body),
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

    createComplaint: async (complaintData) => {
        // Accepts object or traditional args
        let bodyPayload;
        if (typeof complaintData === 'object' && complaintData !== null && !Array.isArray(complaintData) && complaintData.title) {
            bodyPayload = complaintData;
        } else {
            const [title, description, ward, attachment] = arguments;
            bodyPayload = { title, description, ward, attachment };
        }
        return await request('/complaints', {
            method: 'POST',
            body: JSON.stringify(bodyPayload),
        });
    },

    aiAnalyzeImage: async (image, mimeType = 'image/jpeg') => {
        return await request('/complaints/ai-analyze-image', {
            method: 'POST',
            body: JSON.stringify({ image, mimeType }),
        });
    },

    autoVerifyAndResolveComplaint: async (id, resolutionImage, resolutionLocation = null) => {
        return await request(`/complaints/${id}/auto-verify-resolve`, {
            method: 'POST',
            body: JSON.stringify({ resolutionImage, resolutionLocation }),
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

    requestComplaintExtension: async (id, daysRequested, reason) => {
        return await request(`/complaints/${id}/extension-request`, {
            method: 'POST',
            body: JSON.stringify({ daysRequested, reason }),
        });
    },

    sendAdminClarification: async (id, message, extendedDays, approveExtension) => {
        return await request(`/complaints/${id}/admin-clarification`, {
            method: 'POST',
            body: JSON.stringify({ message, extendedDays, approveExtension }),
        });
    },

    getTechnicians: async () => {
        return await request('/technicians', {
            method: 'GET',
        });
    },

    addTechnician: async (technicianData) => {
        return await request('/technicians', {
            method: 'POST',
            body: JSON.stringify(technicianData),
        });
    },

    deleteTechnician: async (id) => {
        return await request(`/technicians/${id}`, {
            method: 'DELETE',
        });
    },

    assignTechnician: async (complaintId, technicianId) => {
        return await request(`/technicians/assign/${complaintId}`, {
            method: 'PATCH',
            body: JSON.stringify({ technicianId }),
        });
    },

    getToken,
    getUser,
};
