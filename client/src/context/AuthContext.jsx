import React, { createContext, useState, useContext, useEffect } from 'react';
import { api } from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedToken = api.getToken();
        const storedUser = api.getUser();
        if (storedToken && storedUser) {
            setUser(storedUser);
        } else {
            api.logout();
            setUser(null);
        }
        setLoading(false);

        const handleUnauthorized = () => {
            setUser(null);
        };
        window.addEventListener('auth:unauthorized', handleUnauthorized);
        return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
    }, []);

    const login = async (email, password) => {
        const data = await api.login(email, password);
        if (data.user) {
            setUser(data.user);
        }
        return data;
    };

    const signup = async (name, email, password, role, ward) => {
        return await api.signup(name, email, password, role, ward);
    };

    const logout = () => {
        api.logout();
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
