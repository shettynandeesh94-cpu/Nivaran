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

    // Extension Request states (Corporator)
    const [extDays, setExtDays] = useState('3');
    const [extReason, setExtReason] = useState('');
    const [submittingExt, setSubmittingExt] = useState(false);

    // Admin Clarification states (Admin)
    const [adminMsg, setAdminMsg] = useState('');
    const [adminAddDays, setAdminAddDays] = useState('3');
    const [approveExtCheck, setApproveExtCheck] = useState(true);
    const [sendingClarification, setSendingClarification] = useState(false);

    // AI Before vs After Resolution Verification states
    const [resolutionImage, setResolutionImage] = useState(null);
    const [isVerifying, setIsVerifying] = useState(false);

    // Fetch Details on Open/ID change
    useEffect(() => {
        if (!isOpen || !complaintId) return;

        const fetchDetails = async () => {
            setLoading(true);
            try {
                const data = await api.getComplaintById(complaintId);
                setComplaint(data);
                setStatusValue(data.status);
                setResolutionImage(data.resolutionAttachment || null);
                if (data.extensionRequest?.daysRequested) {
                    setAdminAddDays(data.extensionRequest.daysRequested.toString());
                }
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

    const handleRequestExtension = async (e) => {
        e.preventDefault();
        if (!extDays || Number(extDays) <= 0 || !extReason.trim()) {
            showToast('Please provide valid days and reason for extension request', 'error');
            return;
        }

        setSubmittingExt(true);
        try {
            const res = await api.requestComplaintExtension(complaintId, Number(extDays), extReason.trim());
            showToast(res.message || 'Extension request submitted to Admin', 'success');
            setComplaint(res.complaint);
            setExtReason('');
            refreshDashboard();
        } catch (err) {
            showToast(err.message || 'Failed to submit extension request', 'error');
        } finally {
            setSubmittingExt(false);
        }
    };

    const handleSendAdminClarification = async (e) => {
        e.preventDefault();
        if (!adminMsg.trim()) {
            showToast('Clarification message for citizen is required', 'error');
            return;
        }

        setSendingClarification(true);
        try {
            const res = await api.sendAdminClarification(complaintId, adminMsg.trim(), Number(adminAddDays), approveExtCheck);
            showToast(res.message || 'Clarification note sent to citizen!', 'success');
            setComplaint(res.complaint);
            setStatusValue(res.complaint.status);
            setAdminMsg('');
            refreshDashboard();
        } catch (err) {
            showToast(err.message || 'Failed to send admin clarification', 'error');
        } finally {
            setSendingClarification(false);
        }
    };

    const handleResolutionFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showToast('Please select a valid image file (JPG, PNG, WEBP)', 'error');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            showToast('Resolution image file size should be under 5MB', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setResolutionImage(reader.result);
            showToast('Resolution photo attached. Click "Run AI Verification" to verify and auto-close.', 'info');
        };
        reader.readAsDataURL(file);
    };

    const handleAutoVerifyAndResolve = async () => {
        if (!resolutionImage) {
            showToast('Please upload or select the Resolution (After) photo first.', 'error');
            return;
        }

        setIsVerifying(true);
        showToast('🤖 AI Vision is conducting forensic Before vs. After inspection...', 'info');

        try {
            const res = await api.autoVerifyAndResolveComplaint(complaintId, resolutionImage);
            if (res.isResolved) {
                showToast('✅ Issue Verified by AI! Complaint autonomously marked as RESOLVED.', 'success');
            } else {
                showToast('⚠️ AI Verification Flagged Incomplete Repair: Problem appears unresolved or photo is invalid.', 'warning');
            }
            setComplaint(res.complaint);
            setStatusValue(res.complaint.status);
            refreshDashboard();
        } catch (err) {
            showToast(err.message || 'Error running AI Resolution Verification', 'error');
        } finally {
            setIsVerifying(false);
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

                                {/* Official Admin Delay & Clarification Update (Visible to Citizen & All) */}
                                {complaint.adminDelayNote && complaint.adminDelayNote.message && (
                                    <div className="detail-section">
                                        <div className="admin-delay-card">
                                            <div className="admin-delay-header">
                                                <i className="fa-solid fa-bullhorn" style={{ color: 'var(--secondary)', fontSize: '1.2rem' }}></i>
                                                <div>
                                                    <h5 style={{ margin: 0 }}>Official Admin Update & Delay Clarification</h5>
                                                    <span className="admin-delay-date">
                                                        Sent by {complaint.adminDelayNote.sentBy?.name || 'Municipal Admin'} on {new Date(complaint.adminDelayNote.sentAt).toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="admin-delay-message">{complaint.adminDelayNote.message}</p>
                                            {complaint.adminDelayNote.extendedDays > 0 && (
                                                <div className="admin-delay-badge">
                                                    <i className="fa-solid fa-clock-rotate-left"></i> Revised Resolution Window: +{complaint.adminDelayNote.extendedDays} Days Approved
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Autonomous AI Before vs After Visual Verification Section */}
                                <div className="detail-section">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <h4>
                                            <i className="fa-solid fa-wand-magic-sparkles" style={{ color: 'var(--secondary)', marginRight: '6px' }}></i> 
                                            Visual Evidence & AI Auto-Verification
                                        </h4>
                                        {complaint.resolutionVerification?.isVerified ? (
                                            <span className="ai-verified-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                                                <i className="fa-solid fa-circle-check"></i> AI Auto-Verified
                                            </span>
                                        ) : complaint.aiAnalysis?.source ? (
                                            <span className="ai-verified-badge">
                                                <i className="fa-solid fa-robot"></i> AI Inspected
                                            </span>
                                        ) : null}
                                    </div>

                                    {/* Side-by-Side Before vs After Grid */}
                                    <div className="before-after-grid">
                                        {/* BEFORE Photo Box */}
                                        <div className="before-after-card">
                                            <div className="before-after-header">
                                                <span className="before-tag"><i className="fa-solid fa-triangle-exclamation"></i> BEFORE (Citizen Grievance)</span>
                                            </div>
                                            {complaint.attachment ? (
                                                <img 
                                                    src={complaint.attachment} 
                                                    alt="Before defect" 
                                                    className="before-after-img"
                                                    onClick={() => window.open(complaint.attachment, '_blank')}
                                                    title="Click to view full image"
                                                />
                                            ) : (
                                                <div className="before-after-empty">
                                                    <i className="fa-solid fa-image" style={{ opacity: 0.4, fontSize: '1.5rem' }}></i>
                                                    <span>No initial photo</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* AFTER Photo Box */}
                                        <div className="before-after-card">
                                            <div className="before-after-header">
                                                <span className="after-tag"><i className="fa-solid fa-circle-check"></i> AFTER (Repair Proof)</span>
                                            </div>
                                            {resolutionImage ? (
                                                <div style={{ position: 'relative' }}>
                                                    <img 
                                                        src={resolutionImage} 
                                                        alt="After repair proof" 
                                                        className="before-after-img"
                                                        onClick={() => window.open(resolutionImage, '_blank')}
                                                        title="Click to view full image"
                                                    />
                                                    {complaint.status !== 'RESOLVED' && (
                                                        <label className="change-photo-btn">
                                                            <i className="fa-solid fa-camera"></i> Change Photo
                                                            <input type="file" accept="image/*" onChange={handleResolutionFileChange} style={{ display: 'none' }} />
                                                        </label>
                                                    )}
                                                </div>
                                            ) : (
                                                <label className="after-upload-dropzone">
                                                    <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: '1.8rem', color: 'var(--secondary)' }}></i>
                                                    <span style={{ fontWeight: 600, marginTop: '6px' }}>Upload Resolution Photo</span>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Click to browse or take camera photo</span>
                                                    <input type="file" accept="image/*" onChange={handleResolutionFileChange} style={{ display: 'none' }} />
                                                </label>
                                            )}
                                        </div>
                                    </div>

                                    {/* Additional Community Photos & Angles if multiple citizens reported the same spot */}
                                    {complaint.additionalEvidence && complaint.additionalEvidence.length > 0 && (
                                        <div style={{ marginTop: '12px', background: 'rgba(255, 255, 255, 0.02)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <i className="fa-solid fa-users" style={{ color: 'var(--secondary)' }}></i>
                                                Additional Evidence Uploaded by Neighbors ({complaint.additionalEvidence.length} other photos):
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                                                {complaint.additionalEvidence.map((ev, idx) => (
                                                    <div key={idx} style={{ flexShrink: 0, textAlign: 'center' }}>
                                                        <img 
                                                            src={ev.attachment} 
                                                            alt={`Neighbor report ${idx+1}`} 
                                                            style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '6px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)' }}
                                                            onClick={() => window.open(ev.attachment, '_blank')}
                                                            title={`Uploaded on ${new Date(ev.reportedAt).toLocaleDateString()}`}
                                                        />
                                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                                            Angle #{idx + 2}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Button: AI Before/After Auto-Verification (Eliminating Human Supervisor) */}
                                    {complaint.status !== 'RESOLVED' && (
                                        <div className="ai-verification-trigger-box" style={{ marginTop: '12px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                                <div>
                                                    <strong style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <i className="fa-solid fa-brain" style={{ color: 'var(--secondary)' }}></i> Autonomous Resolution Engine
                                                    </strong>
                                                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                                        Gemini Vision compares Before vs. After photos to verify repair authenticity and auto-close ticket.
                                                    </p>
                                                </div>
                                                <button 
                                                    type="button" 
                                                    className="btn btn-primary"
                                                    onClick={handleAutoVerifyAndResolve}
                                                    disabled={isVerifying || !resolutionImage}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '180px', justifyContent: 'center' }}
                                                >
                                                    {isVerifying ? (
                                                        <>
                                                            <i className="fa-solid fa-circle-notch fa-spin"></i>
                                                            <span>AI Inspecting...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <i className="fa-solid fa-shield-halved"></i>
                                                            <span>Run AI Verification & Auto-Resolve</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* AI Forensic Verification Report Card */}
                                    {complaint.resolutionVerification && complaint.resolutionVerification.status && (
                                        <div className={`ai-verification-report-card ${complaint.resolutionVerification.isVerified ? 'verified' : 'rejected'}`}>
                                            <div className="ai-report-header">
                                                <div className="ai-report-badge">
                                                    {complaint.resolutionVerification.isVerified ? (
                                                        <><i className="fa-solid fa-circle-check"></i> Autonomous AI Verification: RESOLVED</>
                                                    ) : (
                                                        <><i className="fa-solid fa-circle-xmark"></i> AI Verification: REJECTED (Unresolved)</>
                                                    )}
                                                </div>
                                                {complaint.resolutionVerification.confidenceScore && (
                                                    <span className="ai-confidence-pill">
                                                        {complaint.resolutionVerification.confidenceScore}% Confidence Score
                                                    </span>
                                                )}
                                            </div>
                                            <p className="ai-report-summary">{complaint.resolutionVerification.summary}</p>
                                            {complaint.resolutionVerification.beforeAfterComparison && (
                                                <div className="ai-report-comparison">
                                                    <strong>Forensic Analysis:</strong> {complaint.resolutionVerification.beforeAfterComparison}
                                                </div>
                                            )}
                                            <div className="ai-report-footer">
                                                <span><i className="fa-solid fa-robot"></i> Verified by: {complaint.resolutionVerification.verifiedBy || 'AI_VISION_AUTO_ENGINE'}</span>
                                                <span><i className="fa-solid fa-clock"></i> {new Date(complaint.resolutionVerification.verifiedAt || complaint.updatedAt).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* AI Initial Inspection Tags & GPS */}
                                    {complaint.aiAnalysis && (
                                        <div className="modal-ai-insights" style={{ marginTop: '10px' }}>
                                            <div className="modal-ai-header">
                                                <span className="ai-robot-badge">
                                                    <i className="fa-solid fa-wand-magic-sparkles"></i> Initial Vision Classification
                                                </span>
                                                {complaint.aiAnalysis.confidenceScore && (
                                                    <span className="ai-confidence-badge">
                                                        {complaint.aiAnalysis.confidenceScore}% Initial Confidence
                                                    </span>
                                                )}
                                                {complaint.aiAnalysis.estimatedCost > 0 && (
                                                    <span className="ai-cost-badge">
                                                        Auto-Estimated Cost: ₹{complaint.aiAnalysis.estimatedCost.toLocaleString('en-IN')}
                                                    </span>
                                                )}
                                            </div>
                                            {complaint.aiAnalysis.detectedTags && complaint.aiAnalysis.detectedTags.length > 0 && (
                                                <div className="ai-tags-list" style={{ marginTop: '6px' }}>
                                                    {complaint.aiAnalysis.detectedTags.map((tag, idx) => (
                                                        <span key={idx} className="ai-tag-chip">
                                                            #{tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* GPS Tag */}
                                    {complaint.location?.latitude && (
                                        <div className="modal-gps-tag" style={{ marginTop: '8px' }}>
                                            <i className="fa-solid fa-location-crosshairs"></i> GPS: {complaint.location.latitude.toFixed(4)}°, {complaint.location.longitude.toFixed(4)}° ({complaint.ward})
                                        </div>
                                    )}
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

                            {/* Admin & Corporator Control Sidebar */}
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
                                        <span className="detail-meta-label">Assigned Technician:</span>
                                        <span className="detail-meta-val">
                                            {complaint.assignedTo ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' }}>
                                                    <span style={{ fontWeight: 600, color: 'var(--secondary)' }}>
                                                        <i className="fa-solid fa-user-gear"></i> {complaint.assignedTo.name}
                                                    </span>
                                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                                        {complaint.assignedTo.specialization || 'Field Worker'} • {complaint.assignedTo.phone || ''}
                                                    </span>
                                                    {complaint.autoDispatched && (
                                                        <span style={{ fontSize: '0.68rem', background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', padding: '1px 6px', borderRadius: '4px', marginTop: '2px' }}>
                                                            ⚡ Auto-Dispatched
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-muted">Unassigned</span>
                                            )}
                                        </span>
                                    </div>
                                    <div className="detail-meta-item">
                                        <span className="detail-meta-label">Complaint ID:</span>
                                        <span className="detail-meta-val" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                            {complaint._id}
                                        </span>
                                    </div>
                                </div>

                                {/* Corporator: Request SLA Time Extension */}
                                {user && (user.role === 'corporator' || user.role === 'admin') && (
                                    <div className="detail-sidebar-card">
                                        <h4><i className="fa-solid fa-hourglass-half"></i> Request SLA Time Extension</h4>
                                        <p className="detail-card-desc">Request extra days from Admin if ground work requires delay.</p>
                                        
                                        {complaint.extensionRequest && complaint.extensionRequest.status === 'PENDING' ? (
                                            <div className="budget-alert-box" style={{ background: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.4)', color: 'var(--status-progress)' }}>
                                                <i className="fa-solid fa-clock"></i>
                                                <div>
                                                    Extension request of +{complaint.extensionRequest.daysRequested} days is <strong>PENDING</strong> Admin review.
                                                    <div style={{ fontSize: '0.75rem', marginTop: '2px', opacity: 0.8 }}>
                                                        Reason: "{complaint.extensionRequest.reason}"
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <form onSubmit={handleRequestExtension}>
                                                <div className="form-group">
                                                    <label>Extra Days Requested</label>
                                                    <input 
                                                        type="number" 
                                                        min="1" 
                                                        max="30" 
                                                        value={extDays} 
                                                        onChange={(e) => setExtDays(e.target.value)} 
                                                        required 
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>Justification Reason</label>
                                                    <textarea 
                                                        rows="2" 
                                                        placeholder="Explain why extra time is required..." 
                                                        value={extReason} 
                                                        onChange={(e) => setExtReason(e.target.value)} 
                                                        required 
                                                        style={{ fontSize: '0.85rem' }}
                                                    ></textarea>
                                                </div>
                                                <button type="submit" className="btn btn-secondary btn-block btn-sm" disabled={submittingExt}>
                                                    {submittingExt ? 'Submitting...' : 'Request Extension from Admin'}
                                                </button>
                                            </form>
                                        )}
                                    </div>
                                )}

                                {/* Admin Action: Send Clarification Note & Approve SLA Extension */}
                                {user && user.role === 'admin' && (
                                    <div className="detail-sidebar-card" style={{ borderColor: 'rgba(99, 102, 241, 0.4)', background: 'linear-gradient(135deg, var(--bg-card), rgba(99, 102, 241, 0.05))' }}>
                                        <h4><i className="fa-solid fa-paper-plane" style={{ color: 'var(--secondary)' }}></i> Admin Citizen Update</h4>
                                        <p className="detail-card-desc">Send official delay note to citizen & approve SLA extension.</p>
                                        
                                        <form onSubmit={handleSendAdminClarification}>
                                            <div className="form-group">
                                                <label>Clarification Message for Citizen</label>
                                                <textarea 
                                                    rows="3" 
                                                    placeholder="Explain the delay to the citizen..." 
                                                    value={adminMsg} 
                                                    onChange={(e) => setAdminMsg(e.target.value)} 
                                                    required 
                                                    style={{ fontSize: '0.85rem' }}
                                                ></textarea>
                                            </div>
                                            
                                            <div className="form-group">
                                                <label>Extend SLA Deadline (Days)</label>
                                                <input 
                                                    type="number" 
                                                    min="0" 
                                                    max="30" 
                                                    value={adminAddDays} 
                                                    onChange={(e) => setAdminAddDays(e.target.value)} 
                                                />
                                            </div>

                                            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <input 
                                                    type="checkbox" 
                                                    id="approve-ext-check" 
                                                    checked={approveExtCheck} 
                                                    onChange={(e) => setApproveExtCheck(e.target.checked)} 
                                                />
                                                <label htmlFor="approve-ext-check" style={{ marginBottom: 0, cursor: 'pointer', fontSize: '0.82rem' }}>
                                                    Approve Extension & Reset Status to In Progress
                                                </label>
                                            </div>

                                            <button type="submit" className="btn btn-primary btn-block" disabled={sendingClarification}>
                                                {sendingClarification ? 'Sending Note...' : 'Send Update & Extend SLA'}
                                            </button>
                                        </form>
                                    </div>
                                )}

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
