import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const Navbar = ({ setView, onOpenLogin, onOpenSignup, switchTab }) => {
    const { user, logout } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);

    const handleLogoClick = (e) => {
        e.preventDefault();
        setMobileOpen(false);
        if (user) {
            setView('dashboard');
            switchTab('tab-overview');
        } else {
            setView('landing');
        }
    };

    const handleLogout = () => {
        setMobileOpen(false);
        logout();
        setView('landing');
    };

    const handleLoginClick = () => {
        setMobileOpen(false);
        onOpenLogin();
    };

    const handleSignupClick = () => {
        setMobileOpen(false);
        onOpenSignup();
    };

    return (
        <header className="navbar">
            <div className="nav-container">
                <a href="#" className="logo" onClick={handleLogoClick}>
                    <i className="fa-solid fa-shield-halved logo-icon"></i>
                    <span className="logo-text">Nivaran</span>
                </a>

                {/* Mobile Hamburger Toggle Button */}
                <button 
                    className="mobile-nav-toggle" 
                    aria-label="Toggle navigation menu"
                    aria-expanded={mobileOpen}
                    onClick={() => setMobileOpen(prev => !prev)}
                >
                    <i className={`fa-solid ${mobileOpen ? 'fa-xmark' : 'fa-bars'}`}></i>
                </button>

                {/* Navigation Menu */}
                <nav className={`nav-menu ${mobileOpen ? 'open' : ''}`} id="nav-menu">
                    {!user ? (
                        <div className="nav-group-logged-out" id="nav-guest-links">
                            <a href="#features" className="nav-link" onClick={() => setMobileOpen(false)}>Features</a>
                            <button className="btn btn-secondary" onClick={handleLoginClick}>Sign In</button>
                            <button className="btn btn-primary" onClick={handleSignupClick}>Register</button>
                        </div>
                    ) : (
                        <div className="nav-group-logged-in" id="nav-user-links">
                            <span className="nav-user-badge">
                                <i className="fa-solid fa-circle-user"></i>
                                <span className="nav-user-name">{user.name}</span>
                                <span className="role-badge">{user.role}</span>
                            </span>
                            <button className="btn btn-outline" onClick={handleLogout}>
                                <i className="fa-solid fa-arrow-right-from-bracket"></i> Logout
                            </button>
                        </div>
                    )}
                </nav>
            </div>
            {/* Mobile Backdrop Overlay */}
            {mobileOpen && (
                <div className="mobile-nav-backdrop" onClick={() => setMobileOpen(false)}></div>
            )}
        </header>
    );
};

