import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const SignupModal = ({ isOpen, onClose, onGotoLogin, showToast }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('citizen');
    const [ward, setWard] = useState('');
    
    const { signup } = useAuth();

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();

        const cleanName = name.trim();
        const cleanEmail = email.trim();
        const cleanPassword = password;
        
        if (!cleanName || !cleanEmail || !cleanPassword || !role || !ward) {
            showToast('All fields are required', 'error');
            return;
        }

        try {
            await signup(cleanName, cleanEmail, cleanPassword, role, ward);
            showToast('Registration successful! Please sign in.', 'success');
            setName('');
            setEmail('');
            setPassword('');
            setRole('citizen');
            setWard('');
            onGotoLogin();
        } catch (err) {
            showToast(err.message || 'Registration failed.', 'error');
        }
    };

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal-card">
                <button className="modal-close-btn" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
                <div className="modal-header">
                    <i className="fa-solid fa-shield-halved modal-logo-icon"></i>
                    <h3>Join Nivaran</h3>
                    <p>Create an account to submit and monitor civic issues</p>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="signup-name">Full Name</label>
                        <input 
                            type="text" 
                            id="signup-name" 
                            placeholder="John Doe" 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required 
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="signup-email">Email Address</label>
                        <input 
                            type="email" 
                            id="signup-email" 
                            placeholder="you@example.com" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required 
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="signup-password">Password</label>
                        <input 
                            type="password" 
                            id="signup-password" 
                            placeholder="Min. 6 characters" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required 
                            minLength={6}
                        />
                    </div>
                    <div className="form-grid">
                        <div className="form-group">
                            <label htmlFor="signup-role">Account Type</label>
                            <select 
                                id="signup-role" 
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                required
                            >
                                <option value="citizen">Citizen</option>
                                <option value="corporator">Corporator</option>
                                <option value="admin">Administrator</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="signup-ward">Ward</label>
                            <select 
                                id="signup-ward" 
                                value={ward}
                                onChange={(e) => setWard(e.target.value)}
                                required
                            >
                                <option value="">-- Select Ward --</option>
                                <option value="Kadri South">Kadri South</option>
                                <option value="Kadri North">Kadri North</option>
                                <option value="Bejai">Bejai</option>
                                <option value="Bendoor">Bendoor</option>
                                <option value="Lalbagh">Lalbagh</option>
                            </select>
                        </div>
                    </div>
                    <button type="submit" className="btn btn-primary btn-block">Register</button>
                    <div className="modal-footer">
                        Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); onGotoLogin(); }}>Sign In</a>
                    </div>
                </form>
            </div>
        </div>
    );
};
