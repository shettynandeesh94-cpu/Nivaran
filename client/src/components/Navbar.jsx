import React from 'react';
import { useAuth } from '../context/AuthContext';

export const Navbar = ({ setView, onOpenLogin, onOpenSignup, switchTab }) => {
    const { user, logout } = useAuth();

    const handleLogoClick = (e) => {
        e.preventDefault();
        if (user) {
            setView('dashboard');
            switchTab('tab-overview');
        } else {
            setView('landing');
        }
    };

    const handleLogout = () => {
        logout();
        setView('landing');
    };

    return (
        <header className="navbar">
            <div className="nav-container">
                <a href="#" className="logo" onClick={handleLogoClick}>
                    <i className="fa-solid fa-shield-halved logo-icon"></i>
                    <span className="logo-text">Nivaran</span>
                </a>
                <nav className="nav-menu" id="nav-menu">
                    {!user ? (
                        <div className="nav-group-logged-out" id="nav-guest-links">
                            <a href="#features" className="nav-link">Features</a>
                            <button className="btn btn-secondary" onClick={onOpenLogin}>Sign In</button>
                            <button class="btn btn-primary" onClick={onOpenSignup}>Register</button>
                        </div>
                    ) : (
                        <div className="nav-group-logged-in" id="nav-user-links">
                            <span className="nav-user-badge">
                                <i className="fa-solid fa-circle-user"></i>
                                <span>{user.name}</span>
                                <span className="role-badge">{user.role}</span>
                            </span>
                            <button className="btn btn-outline" onClick={handleLogout}>
                                <i className="fa-solid fa-arrow-right-from-bracket"></i> Logout
                            </button>
                        </div>
                    )}
                </nav>
            </div>
        </header>
    );
};
