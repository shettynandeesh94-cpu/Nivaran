import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const LoginModal = ({ isOpen, onClose, onGotoSignup, showToast }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
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
            setSubmitting(true);
            const data = await login(cleanEmail, cleanPassword);
            showToast(`Welcome back, ${data.user.name}!`, 'success');
            onClose();
        } catch (err) {
            showToast(err.message || 'Login failed. Please check credentials.', 'error');
        } finally {
            setSubmitting(false);
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
                    <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
                        {submitting ? 'Signing In...' : 'Sign In'}
                    </button>
                    <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '14px' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', textAlign: 'center' }}>
                            Quick Demo Fill:
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ fontSize: '0.75rem', padding: '6px 8px' }}
                                onClick={() => { setEmail('gunda@gmail.com'); setPassword('123456'); }}
                            >
                                🏛️ PDO (Corporator)
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ fontSize: '0.75rem', padding: '6px 8px' }}
                                onClick={() => { setEmail('shettynandeesh94@gmail.com'); setPassword('123456'); }}
                            >
                                🛡️ Admin (Nandeesh)
                            </button>
                        </div>
                    </div>
                    <div className="modal-footer">
                        Don't have an account? <a href="#" onClick={(e) => { e.preventDefault(); onGotoSignup(); }}>Register here</a>
                    </div>
                </form>
            </div>
        </div>
    );
};
