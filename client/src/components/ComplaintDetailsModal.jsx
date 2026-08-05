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

    // Expense form states
    const [expenseItem, setExpenseItem] = useState('');
    const [expenseCost, setExpenseCost] = useState('');
    const [expenseNote, setExpenseNote] = useState('');
    const [addingExpense, setAddingExpense] = useState(false);
    const [budgetWarning, setBudgetWarning] = useState('');

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

    const handleAddExpense = async (e) => {
        e.preventDefault();
        if (!expenseItem || !expenseCost || Number(expenseCost) <= 0) {
            showToast('Please provide a valid item name and positive cost amount.', 'error');
            return;
        }

        setAddingExpense(true);
        try {
            const res = await api.addComplaintExpense(complaintId, expenseItem, Number(expenseCost), expenseNote);
            showToast(res.message || 'Expense added successfully!', 'success');
            setComplaint(res.complaint);
            if (res.warning) {
                setBudgetWarning(res.warning);
            } else {
                setBudgetWarning('');
            }
            setExpenseItem('');
            setExpenseCost('');
            setExpenseNote('');
            refreshDashboard();
        } catch (err) {
            showToast(err.message || 'Failed to add expense', 'error');
        } finally {
            setAddingExpense(false);
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
                                <i className="fa-solid fa-location-dot"></i> {complaint.ward} | Category: {complaint.category || 'General'} | Department: {complaint.department?.name || 'Unassigned'}
                            </p>
                        </div>
                        
                        <div className="modal-body-grid">
                            {/* Details & Description */}
                            <div className="details-left">
                                <div className="detail-section">
                                    <h4>Description</h4>
                                    <p className="detail-description-text">{complaint.description}</p>
                                </div>

                                {/* Resolution Expense & Cost Breakdown */}
                                <div className="detail-section">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <h4>Resolution Expenditure & Cost Breakdown</h4>
                                        <span className="expense-total-pill">
                                            Total Spent: ₹{(complaint.resolutionCost || 0).toLocaleString('en-IN')}
                                        </span>
                                    </div>
                                    <p className="detail-card-desc">
                                        Public financial transparency breakdown logged by the assigned department for resolving this issue.
                                    </p>

                                    {budgetWarning && (
                                        <div className="budget-alert-box">
                                            <i className="fa-solid fa-triangle-exclamation"></i>
                                            <div>{budgetWarning}</div>
                                        </div>
                                    )}

                                    {complaint.resolutionExpenses && complaint.resolutionExpenses.length > 0 ? (
                                        <table className="expense-table">
                                            <thead>
                                                <tr>
                                                    <th>Item / Service</th>
                                                    <th>Cost (₹)</th>
                                                    <th>Note</th>
                                                    <th>Date</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {complaint.resolutionExpenses.map((exp, idx) => (
                                                    <tr key={idx}>
                                                        <td><strong>{exp.item}</strong></td>
                                                        <td>₹{exp.cost.toLocaleString('en-IN')}</td>
                                                        <td>{exp.note || '-'}</td>
                                                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                            {new Date(exp.addedAt).toLocaleDateString()}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="empty-expenses-box">
                                            <i className="fa-solid fa-receipt"></i>
                                            <p>No resolution expenses recorded yet for this complaint.</p>
                                        </div>
                                    )}

                                    {/* Add Expense Form for Corporator / Admin */}
                                    {user && (user.role === 'corporator' || user.role === 'admin') && (
                                        <div className="add-expense-card" style={{ marginTop: '15px' }}>
                                            <h5><i className="fa-solid fa-plus-circle"></i> Record Resolution Expense</h5>
                                            <form onSubmit={handleAddExpense} className="expense-form-grid">
                                                <input 
                                                    type="text"
                                                    placeholder="Item (e.g., Pipe replacement)"
                                                    value={expenseItem}
                                                    onChange={(e) => setExpenseItem(e.target.value)}
                                                    required
                                                />
                                                <input 
                                                    type="number"
                                                    placeholder="Cost (₹)"
                                                    value={expenseCost}
                                                    onChange={(e) => setExpenseCost(e.target.value)}
                                                    required
                                                    min="1"
                                                />
                                                <input 
                                                    type="text"
                                                    placeholder="Notes / Vendor details (optional)"
                                                    value={expenseNote}
                                                    onChange={(e) => setExpenseNote(e.target.value)}
                                                    style={{ gridColumn: 'span 2' }}
                                                />
                                                <button 
                                                    type="submit" 
                                                    className="btn btn-secondary btn-block" 
                                                    style={{ gridColumn: 'span 2' }}
                                                    disabled={addingExpense}
                                                >
                                                    {addingExpense ? 'Saving...' : 'Add Expense Line'}
                                                </button>
                                            </form>
                                        </div>
                                    )}
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
                                        <span className="detail-meta-label">Department:</span>
                                        <span className="detail-meta-val">
                                            {complaint.department?.name || 'Unassigned'}
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
