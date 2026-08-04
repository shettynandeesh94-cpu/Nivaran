import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const LoginModal = ({ isOpen, onClose, onGotoSignup, showToast }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { login } = useAuth();

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const cleanEmail = email.trim();
        const cleanPassword = password;

        if (!cleanEmail || !cleanPassword) {
            showToast('Email and password are required', 'error');
            return;
        }

        try {
            const data = await login(cleanEmail, cleanPassword);
            showToast(`Welcome back, ${data.user.name}!`, 'success');
            onClose();
        } catch (err) {
            showToast(err.message || 'Login failed. Please check credentials.', 'error');
        }
    };

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal-card">
                <button className="modal-close-btn" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
                <div className="modal-header">
                    <i className="fa-solid fa-shield-halved modal-logo-icon"></i>
                    <h3>Welcome to Nivaran</h3>
                    <p>Sign in to access your civic dashboard</p>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="login-email">Email Address</label>
                        <input 
                            type="email" 
                            id="login-email" 
                            placeholder="you@example.com" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required 
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="login-password">Password</label>
                        <input 
                            type="password" 
                            id="login-password" 
                            placeholder="••••••••" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required 
                        />
                    </div>
                    <button type="submit" className="btn btn-primary btn-block">Sign In</button>
                    <div className="modal-footer">
                        Don't have an account? <a href="#" onClick={(e) => { e.preventDefault(); onGotoSignup(); }}>Register here</a>
                    </div>
                </form>
            </div>
        </div>
    );
};
