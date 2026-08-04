import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export const ComplaintDetailsModal = ({ isOpen, onClose, complaintId, showToast, refreshDashboard }) => {
    const { user } = useAuth();
    const [complaint, setComplaint] = useState(null);
    const [loading, setLoading] = useState(true);
    const [statusValue, setStatusValue] = useState('OPEN');
    const [countdownText, setCountdownText] = useState('Calculating...');
    const [isBreached, setIsBreached] = useState(false);

    // Fetch Details on Open/ID change
    useEffect(() => {
        if (!isOpen || !complaintId) return;

        const fetchDetails = async () => {
            setLoading(true);
            try {
                const data = await api.getComplaintById(complaintId);
                setComplaint(data);
                setStatusValue(data.status);
            } catch (err) {
                showToast(err.message || 'Error loading details', 'error');
                onClose();
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [isOpen, complaintId]);

    // Live Countdown Timer Loop
    useEffect(() => {
        if (!complaint || complaint.status === 'RESOLVED') {
            setCountdownText(complaint?.status === 'RESOLVED' ? 'Completed' : 'Calculating...');
            setIsBreached(false);
            return;
        }

        const updateTimer = () => {
            const deadline = new Date(complaint.deadline);
            const now = new Date();
            const diffMs = deadline - now;
            
            if (diffMs <= 0) {
                setCountdownText('Breached (ESCALATED)');
                setIsBreached(true);
            } else {
                const totalSecs = Math.floor(diffMs / 1000);
                const hours = Math.floor(totalSecs / 3600);
                const mins = Math.floor((totalSecs % 3600) / 60);
                const secs = totalSecs % 60;
                setCountdownText(`${hours}h ${mins}m ${secs}s`);
                setIsBreached(false);
            }
        };

        updateTimer();
        const intervalId = setInterval(updateTimer, 1000);

        return () => clearInterval(intervalId);
    }, [complaint]);

    if (!isOpen) return null;

    const handleUpdateStatus = async () => {
        try {
            const data = await api.updateComplaintStatus(complaintId, statusValue);
            showToast('Complaint status updated successfully!', 'success');
            setComplaint(data.complaint);
            refreshDashboard();
        } catch (err) {
            showToast(err.message || 'Error updating status', 'error');
        }
    };

    const getPriorityClass = (priority) => {
        if (priority === 'HIGH') return 'badge-high';
        if (priority === 'MEDIUM') return 'badge-medium';
        return 'badge-low';
    };

    const getStatusClass = (status) => {
        if (status === 'IN_PROGRESS') return 'badge-status-progress';
        if (status === 'RESOLVED') return 'badge-status-resolved';
        if (status === 'ESCALATED') return 'badge-status-escalated';
        return 'badge-status-open';
    };

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal-card modal-lg">
                <button className="modal-close-btn" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
                
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                        <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: 'var(--secondary)' }}></i>
                        <p style={{ marginTop: '15px', color: 'var(--text-secondary)' }}>Loading details...</p>
                    </div>
                ) : complaint ? (
                    <>
                        <div className="modal-header">
                            <div className="modal-details-title-row">
                                <span className={`badge ${getPriorityClass(complaint.priority)}`}>{complaint.priority}</span>
                                <span className={`badge ${getStatusClass(complaint.status)}`}>{complaint.status}</span>
                            </div>
                            <h3>{complaint.title}</h3>
                            <p className="text-muted">
                                <i className="fa-solid fa-location-dot"></i> {complaint.ward} | Category: {complaint.category || 'General'}
                            </p>
                        </div>
                        
                        <div className="modal-body-grid">
                            {/* Details & Description */}
                            <div className="details-left">
                                <div className="detail-section">
                                    <h4>Description</h4>
                                    <p className="detail-description-text">{complaint.description}</p>
                                </div>
                                
                                {/* SLA Timeline */}
                                <div className="detail-section">
                                    <h4>SLA Timeline</h4>
                                    <div className="sla-progress-box">
                                        <div className="sla-time-info">
                                            <div>
                                                <span className="detail-meta-label">Submitted On:</span>
                                                <span className="detail-meta-val">
                                                    {new Date(complaint.createdAt).toLocaleString()}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="detail-meta-label">Resolution Deadline:</span>
                                                <span className="detail-meta-val">
                                                    {new Date(complaint.deadline).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="sla-countdown-wrapper">
                                            <span className="detail-meta-label">Time Remaining:</span>
                                            <span className={`sla-countdown-timer ${isBreached ? 'breached' : 'active'}`}>
                                                {countdownText}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Admin Action Panel / Sidebar */}
                            <div className="details-right">
                                <div className="detail-sidebar-card">
                                    <h4>Filing Details</h4>
                                    <div className="detail-meta-item">
                                        <span className="detail-meta-label">Submitted By:</span>
                                        <span className="detail-meta-val">
                                            {complaint.createdBy?.name || 'Citizen'}
                                        </span>
                                    </div>
                                    <div className="detail-meta-item">
                                        <span className="detail-meta-label">Complaint ID:</span>
                                        <span className="detail-meta-val" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                            {complaint._id}
                                        </span>
                                    </div>
                                </div>

                                {/* Corporator Status Control */}
                                {user && (user.role === 'corporator' || user.role === 'admin') && (
                                    <div className="detail-sidebar-card">
                                        <h4>Update Resolution Status</h4>
                                        <p className="detail-card-desc">Move the complaint state based on real-world resolution progress.</p>
                                        
                                        <div className="form-group">
                                            <select 
                                                value={statusValue}
                                                onChange={(e) => setStatusValue(e.target.value)}
                                            >
                                                <option value="OPEN">Open (New)</option>
                                                <option value="IN_PROGRESS">In Progress</option>
                                                <option value="RESOLVED">Resolved (Fixed)</option>
                                                <option value="ESCALATED">Escalated (Overdue)</option>
                                            </select>
                                        </div>
                                        <button 
                                            className="btn btn-primary btn-block"
                                            onClick={handleUpdateStatus}
                                        >
                                            Update Status
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--status-escalated)' }}>
                        <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '2rem' }}></i>
                        <p style={{ marginTop: '15px' }}>Complaint details not found.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
