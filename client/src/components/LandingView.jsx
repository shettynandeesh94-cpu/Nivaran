import React from 'react';
import { useAuth } from '../context/AuthContext';

export const LandingView = ({ setView, onOpenLogin, switchTab }) => {
    const { user } = useAuth();

    const handleStartClick = () => {
        if (user) {
            setView('dashboard');
            switchTab('tab-new-complaint');
        } else {
            onOpenLogin();
        }
    };

    return (
        <section id="view-landing" className="landing-section">
            <div className="hero">
                <div className="hero-badge">Smart Civic Redressal</div>
                <h1 className="hero-title">
                    Civic Resolution, <span className="gradient-text">Made Intelligent.</span>
                </h1>
                <p class="hero-subtitle">
                    Submit grievances, prevent duplicate filings, and track live SLA progress. Powered by Nivaran's real-time routing and escalation engine.
                </p>
                <div className="hero-actions">
                    <button className="btn btn-primary btn-lg" onClick={handleStartClick}>
                        File a Complaint <i className="fa-solid fa-arrow-right icon-right"></i>
                    </button>
                    <a href="#features" className="btn btn-secondary btn-lg">Learn More</a>
                </div>
            </div>

            {/* Stats Section */}
            <div className="landing-stats">
                <div className="stat-card">
                    <div className="stat-icon"><i className="fa-solid fa-circle-check"></i></div>
                    <div className="stat-number">98.4%</div>
                    <div className="stat-label">SLA Compliance</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><i class="fa-solid fa-bolt"></i></div>
                    <div class="stat-number">&lt; 48 hrs</div>
                    <div class="stat-label">Avg. Resolution Time</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><i className="fa-solid fa-users"></i></div>
                    <div className="stat-number">12,400+</div>
                    <div className="stat-label">Citizens Empowered</div>
                </div>
            </div>

            {/* Features Grid */}
            <div id="features" className="features-container">
                <h2 className="section-title">Why Nivaran is Different</h2>
                <div className="features-grid">
                    <div className="feature-card">
                        <div className="feature-icon-wrapper purple"><i className="fa-solid fa-brain"></i></div>
                        <h3>Real-time Smart Classifier</h3>
                        <p>Our algorithms analyze complaints on the fly to auto-assign categories and priority levels, eliminating clerical delays.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon-wrapper cyan"><i className="fa-solid fa-clone"></i></div>
                        <h3>Duplicate Prevention</h3>
                        <p>Prevents redundant filings for the same issue in the same ward by merging reports and escalating priority instead.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon-wrapper pink"><i className="fa-solid fa-clock-rotate-left"></i></div>
                        <h3>Automated SLA Escalation</h3>
                        <p>Rigorous time-bound monitoring automatically escalates unaddressed issues to higher officials, enforcing accountability.</p>
                    </div>
                </div>
            </div>
        </section>
    );
};
