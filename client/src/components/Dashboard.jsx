import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { SmartEngine } from '../utils/smartEngine';

// --- SUB-COMPONENT: REAL-TIME INDIVIDUAL CELL COUNTDOWN TIMER ---
const SlaCountdownCell = ({ deadline, status }) => {
    const [text, setText] = useState('Calculating...');
    const [breached, setBreached] = useState(false);

    useEffect(() => {
        if (status === 'RESOLVED') {
            setText('Completed');
            setBreached(false);
            return;
        }

        const updateTimer = () => {
            const deadlineDate = new Date(deadline);
            const now = new Date();
            const diffMs = deadlineDate - now;
            
            if (diffMs <= 0) {
                setText('Breached (ESCALATED)');
                setBreached(true);
            } else {
                const totalSecs = Math.floor(diffMs / 1000);
                const hours = Math.floor(totalSecs / 3600);
                const mins = Math.floor((totalSecs % 3600) / 60);
                const secs = totalSecs % 60;
                setText(`${hours}h ${mins}m ${secs}s`);
                setBreached(false);
            }
        };

        updateTimer();
        const intervalId = setInterval(updateTimer, 1000);
        return () => clearInterval(intervalId);
    }, [deadline, status]);

    return (
        <span className={`sla-timer ${breached ? 'breached' : 'active'}`}>
            {text}
        </span>
    );
};

// --- MAIN COMPONENT: DASHBOARD ---
export const Dashboard = ({ activeTab, switchTab, onOpenDetails, showToast, refreshKey, triggerRefresh }) => {
    const { user } = useAuth();
    
    // Data states
    const [complaints, setComplaints] = useState([]);
    const [filteredComplaints, setFilteredComplaints] = useState([]);
    const [stats, setStats] = useState({ total: 0, pending: 0, resolved: 0, escalated: 0 });

    // Budget states
    const [departments, setDepartments] = useState([]);
    const [budgetRequests, setBudgetRequests] = useState([]);
    const [reqDeptId, setReqDeptId] = useState('');
    const [reqAmount, setReqAmount] = useState('');
    const [reqReason, setReqReason] = useState('');
    const [submittingReq, setSubmittingReq] = useState(false);
    const [adminNotesMap, setAdminNotesMap] = useState({});

    // File complaint states
    const [title, setTitle] = useState('');
    const [ward, setWard] = useState('');
    const [description, setDescription] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [smartPredict, setSmartPredict] = useState({ category: 'General', priority: 'LOW', slaText: '15 Days (360 hrs)' });

    const handleImageFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showToast('Please select a valid image file (JPG, PNG, WEBP)', 'error');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            showToast('Image file size should be under 5MB', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setAttachment(reader.result);
        };
        reader.readAsDataURL(file);
    };

    // Filters states
    const [searchQuery, setSearchQuery] = useState('');
    const [filterWard, setFilterWard] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterPriority, setFilterPriority] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    // Fetch dashboard listings
    useEffect(() => {
        const loadComplaints = async () => {
            try {
                const data = await api.getComplaints();
                setComplaints(data);
                
                // Calculate Stats
                const computed = {
                    total: data.length,
                    pending: data.filter(c => c.status === 'OPEN' || c.status === 'IN_PROGRESS').length,
                    resolved: data.filter(c => c.status === 'RESOLVED').length,
                    escalated: data.filter(c => c.status === 'ESCALATED').length
                };
                setStats(computed);
            } catch (err) {
                showToast(err.message || 'Failed to fetch complaints dashboard', 'error');
            }
        };

        loadComplaints();
    }, [refreshKey, showToast]);

    // Fetch Departments and Budget Requests when budget tab is active or on refresh
    const loadBudgetData = async () => {
        try {
            const depts = await api.getDepartmentBudgets();
            setDepartments(depts);

            const reqs = await api.getBudgetRequests();
            setBudgetRequests(reqs);
        } catch (err) {
            console.error('Error fetching budget data:', err);
        }
    };

    useEffect(() => {
        if (activeTab === 'tab-budget' || activeTab === 'tab-overview') {
            loadBudgetData();
        }
    }, [activeTab, refreshKey]);

    // Live Smart Engine Trigger inside textbox change
    const handleDescriptionChange = (val) => {
        setDescription(val);
        const prediction = SmartEngine.analyzeText(val);
        setSmartPredict(prediction);
    };

    // Pre-populate user details inside create form
    useEffect(() => {
        if (activeTab === 'tab-new-complaint' && user) {
            setWard(user.ward || '');
            handleDescriptionChange('');
            setTitle('');
        }
    }, [activeTab, user]);

    // Handle Form Submit (New Complaint)
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        
        if (!title.trim() || !ward || !description.trim()) {
            showToast('All fields are required', 'error');
            return;
        }

        try {
            const data = await api.createComplaint(title.trim(), description.trim(), ward, attachment);
            
            if (data.message.includes('Similar open complaint already exists')) {
                showToast(data.message, 'info');
            } else {
                showToast('Complaint submitted successfully with photo proof!', 'success');
            }

            // Clean form and route
            setTitle('');
            setDescription('');
            setAttachment(null);
            switchTab('tab-overview');
            triggerRefresh();
        } catch (err) {
            showToast(err.message || 'Error submitting complaint', 'error');
        }
    };

    // Handle Budget Request Submit (Corporator / Department)
    const handleBudgetRequestSubmit = async (e) => {
        e.preventDefault();
        if (!reqDeptId || !reqAmount || Number(reqAmount) <= 0 || !reqReason.trim()) {
            showToast('Please select department, valid amount, and detailed reason.', 'error');
            return;
        }

        setSubmittingReq(true);
        try {
            const res = await api.createBudgetRequest(reqDeptId, Number(reqAmount), reqReason.trim());
            showToast(res.message || 'Budget request submitted to Admin!', 'success');
            setReqAmount('');
            setReqReason('');
            setReqDeptId('');
            loadBudgetData();
        } catch (err) {
            showToast(err.message || 'Failed to submit budget request', 'error');
        } finally {
            setSubmittingReq(false);
        }
    };

    // Handle Budget Request Action (Admin)
    const handleActionBudgetRequest = async (requestId, status) => {
        try {
            const note = adminNotesMap[requestId] || '';
            const res = await api.actionBudgetRequest(requestId, status, note);
            showToast(res.message || `Budget request ${status.toLowerCase()} successfully!`, 'success');
            loadBudgetData();
        } catch (err) {
            showToast(err.message || 'Error processing budget request', 'error');
        }
    };

    // Combined multi-filtering hook
    useEffect(() => {
        const query = searchQuery.toLowerCase().trim();
        
        const filtered = complaints.filter(c => {
            const matchesSearch = !query || 
                c.title.toLowerCase().includes(query) || 
                c.description.toLowerCase().includes(query) || 
                (c.category && c.category.toLowerCase().includes(query));

            const matchesWard = !filterWard || c.ward === filterWard;
            const matchesCategory = !filterCategory || c.category === filterCategory;
            const matchesPriority = !filterPriority || c.priority === filterPriority;
            const matchesStatus = !filterStatus || c.status === filterStatus;

            return matchesSearch && matchesWard && matchesCategory && matchesPriority && matchesStatus;
        });

        setFilteredComplaints(filtered);
    }, [complaints, searchQuery, filterWard, filterCategory, filterPriority, filterStatus]);

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
        <section id="view-dashboard" className="dashboard-section">
            <div className="dashboard-layout">
                {/* Sidebar */}
                <aside className="sidebar">
                    <div className="profile-panel">
                        <div className="avatar-glow">
                            <i className="fa-solid fa-user-tie"></i>
                        </div>
                        <h4>{user ? user.name : 'Loading...'}</h4>
                        <div className="ward-tag">
                            <i className="fa-solid fa-location-dot"></i> <span>{user?.ward || 'General / All'}</span>
                        </div>
                    </div>

                    <nav className="sidebar-nav">
                        <button 
                            className={`nav-tab-btn ${activeTab === 'tab-overview' ? 'active' : ''}`}
                            onClick={() => switchTab('tab-overview')}
                        >
                            <i className="fa-solid fa-chart-pie"></i> Overview
                        </button>
                        
                        {user?.role === 'citizen' && (
                            <button 
                                className={`nav-tab-btn ${activeTab === 'tab-new-complaint' ? 'active' : ''}`}
                                onClick={() => switchTab('tab-new-complaint')}
                            >
                                <i className="fa-solid fa-circle-plus"></i> Submit Complaint
                            </button>
                        )}
                        
                        <button 
                            className={`nav-tab-btn ${activeTab === 'tab-all-complaints' ? 'active' : ''}`}
                            onClick={() => switchTab('tab-all-complaints')}
                        >
                            <i className="fa-solid fa-list-check"></i> Complaints Board
                        </button>

                        <button 
                            className={`nav-tab-btn ${activeTab === 'tab-budget' ? 'active' : ''}`}
                            onClick={() => switchTab('tab-budget')}
                        >
                            <i className="fa-solid fa-coins"></i> Department & Budgets
                        </button>
                    </nav>
                </aside>

                {/* Main Work Area */}
                <div className="dashboard-main">
                    
                    {/* View: Overview */}
                    {activeTab === 'tab-overview' && (
                        <div id="tab-overview">
                            <div className="dashboard-header-row">
                                <div>
                                    <h2 className="dashboard-title">Dashboard Overview</h2>
                                    <p className="dashboard-subtitle">Monitor civic complaints status and SLA timers.</p>
                                </div>
                                {user?.role === 'citizen' && (
                                    <button className="btn btn-primary" onClick={() => switchTab('tab-new-complaint')}>
                                        <i className="fa-solid fa-plus"></i> File Complaint
                                    </button>
                                )}
                            </div>

                            {/* Mini Stats Widgets */}
                            <div className="stats-row">
                                <div className="mini-stat-card">
                                    <div className="mini-stat-info">
                                        <span className="mini-stat-label">Total Filed</span>
                                        <span className="mini-stat-value">{stats.total}</span>
                                    </div>
                                    <div className="mini-stat-icon purple"><i className="fa-solid fa-folder-open"></i></div>
                                </div>
                                <div className="mini-stat-card">
                                    <div className="mini-stat-info">
                                        <span className="mini-stat-label">Pending Review</span>
                                        <span className="mini-stat-value">{stats.pending}</span>
                                    </div>
                                    <div className="mini-stat-icon warning"><i className="fa-solid fa-hourglass-half"></i></div>
                                </div>
                                <div className="mini-stat-card">
                                    <div className="mini-stat-info">
                                        <span className="mini-stat-label">Resolved</span>
                                        <span className="mini-stat-value">{stats.resolved}</span>
                                    </div>
                                    <div className="mini-stat-icon success"><i className="fa-solid fa-circle-check"></i></div>
                                </div>
                                <div className="mini-stat-card">
                                    <div className="mini-stat-info">
                                        <span className="mini-stat-label">Escalated</span>
                                        <span className="mini-stat-value">{stats.escalated}</span>
                                    </div>
                                    <div className="mini-stat-icon danger"><i className="fa-solid fa-triangle-exclamation"></i></div>
                                </div>
                            </div>

                            {/* Recent Complaints Panel */}
                            <div className="content-panel" style={{ marginTop: '20px' }}>
                                <h3 className="panel-title">
                                    {user?.role === 'citizen' ? 'My Recent Submissions' : 'Recent Ward Grievances'}
                                </h3>
                                <div className="table-container">
                                    <table className="complaint-table">
                                        <thead>
                                            <tr>
                                                <th>Complaint</th>
                                                <th>Category</th>
                                                <th>Ward</th>
                                                <th>Priority</th>
                                                <th>Status</th>
                                                <th>SLA Deadline</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {complaints.length === 0 ? (
                                                <tr>
                                                    <td colSpan="7" className="text-center text-muted">No complaints found.</td>
                                                </tr>
                                            ) : (
                                                complaints.slice(0, 5).map(c => (
                                                    <tr key={c._id}>
                                                        <td className="complaint-title-cell">
                                                            <div>{c.title}</div>
                                                            <div className="complaint-desc-cell">{c.description}</div>
                                                        </td>
                                                        <td>
                                                            <span className="ward-tag" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                                                <i className="fa-solid fa-folder"></i> {c.category || 'General'}
                                                            </span>
                                                        </td>
                                                        <td><i className="fa-solid fa-location-dot text-muted"></i> {c.ward}</td>
                                                        <td><span className={`badge ${getPriorityClass(c.priority)}`}>{c.priority}</span></td>
                                                        <td><span className={`badge ${getStatusClass(c.status)}`}>{c.status}</span></td>
                                                        <td><SlaCountdownCell deadline={c.deadline} status={c.status} /></td>
                                                        <td>
                                                            <button 
                                                                className="btn btn-secondary btn-sm"
                                                                onClick={() => onOpenDetails(c._id)}
                                                            >
                                                                <i className="fa-solid fa-eye"></i> View
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* View: New Complaint */}
                    {activeTab === 'tab-new-complaint' && user?.role === 'citizen' && (
                        <div id="tab-new-complaint">
                            <div className="dashboard-header-row">
                                <div>
                                    <h2 className="dashboard-title">File a Grievance</h2>
                                    <p className="dashboard-subtitle">Our smart classifier will parse your description in real-time.</p>
                                </div>
                            </div>

                            <div className="form-container-grid">
                                {/* Left Form */}
                                <div className="content-panel">
                                    <form onSubmit={handleFormSubmit}>
                                        <div className="form-group">
                                            <label htmlFor="complaint-title">Grievance Title</label>
                                            <input 
                                                type="text" 
                                                id="complaint-title" 
                                                placeholder="e.g. Broken water pipeline, garbage accumulation" 
                                                value={title}
                                                onChange={(e) => setTitle(e.target.value)}
                                                required 
                                            />
                                        </div>
                                        
                                        <div className="form-group">
                                            <label htmlFor="complaint-ward">Select Ward</label>
                                            <select 
                                                id="complaint-ward" 
                                                value={ward}
                                                onChange={(e) => setWard(e.target.value)}
                                                required
                                            >
                                                <option value="">-- Choose Ward --</option>
                                                <option value="Kadri South">Kadri South</option>
                                                <option value="Kadri North">Kadri North</option>
                                                <option value="Bejai">Bejai</option>
                                                <option value="Bendoor">Bendoor</option>
                                                <option value="Lalbagh">Lalbagh</option>
                                            </select>
                                        </div>

                                        <div className="form-group">
                                            <label htmlFor="complaint-description">Description & Details</label>
                                            <textarea 
                                                id="complaint-description" 
                                                rows="5" 
                                                placeholder="Provide a detailed description. Use keywords like 'burst', 'accident', 'overflow', or 'urgent' to trigger high priority." 
                                                value={description}
                                                onChange={(e) => handleDescriptionChange(e.target.value)}
                                                required
                                            ></textarea>
                                        </div>

                                        <div className="form-group">
                                            <label htmlFor="complaint-image">
                                                <i className="fa-solid fa-camera" style={{ color: 'var(--secondary)', marginRight: '6px' }}></i>
                                                Attach Photo Proof <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>(Recommended for faster resolution)</span>
                                            </label>
                                            <div className="image-upload-wrapper">
                                                <input 
                                                    type="file" 
                                                    id="complaint-image" 
                                                    accept="image/*" 
                                                    onChange={handleImageFileChange}
                                                    style={{ display: 'none' }}
                                                />
                                                <label htmlFor="complaint-image" className="image-dropzone-btn">
                                                    <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: '1.4rem', color: 'var(--secondary)' }}></i>
                                                    <span>{attachment ? 'Change Photo Proof' : 'Click to Upload Photo Proof of Issue'}</span>
                                                </label>
                                            </div>

                                            {attachment && (
                                                <div className="image-preview-container">
                                                    <img src={attachment} alt="Issue Preview" className="image-preview-img" />
                                                    <button 
                                                        type="button" 
                                                        className="btn btn-secondary btn-sm remove-image-btn"
                                                        onClick={() => setAttachment(null)}
                                                    >
                                                        <i className="fa-solid fa-trash"></i> Remove Photo
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <button type="submit" className="btn btn-primary btn-block btn-lg">
                                            Submit Grievance <i className="fa-solid fa-paper-plane icon-right"></i>
                                        </button>
                                    </form>
                                </div>

                                {/* Right: Smart Preview Panel */}
                                <div className="content-panel smart-preview-panel">
                                    <div className="smart-panel-header">
                                        <i className="fa-solid fa-microchip-ai brain-icon"></i>
                                        <h4>Nivaran Smart Engine Preview</h4>
                                    </div>
                                    <p className="smart-panel-desc">Real-time keyword matching parses your description to predict routing:</p>
                                    
                                    <div className="preview-metrics">
                                        <div className="preview-metric">
                                            <span className="preview-label">Category Classification</span>
                                            <span className="preview-value">{smartPredict.category}</span>
                                        </div>
                                        <div className="preview-metric">
                                            <span className="preview-label">Priority Assessment</span>
                                            <span className={`preview-value badge ${getPriorityClass(smartPredict.priority)}`}>
                                                {smartPredict.priority}
                                            </span>
                                        </div>
                                        <div className="preview-metric">
                                            <span className="preview-label">Target SLA Window</span>
                                            <span className="preview-value">{smartPredict.slaText}</span>
                                        </div>
                                    </div>

                                    <div className="smart-disclaimer">
                                        <i className="fa-solid fa-circle-info"></i>
                                        <span>If a similar issue is already open in your ward, our engine will automatically merge the files to avoid congestion and escalate priority.</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* View: Complaints Board */}
                    {activeTab === 'tab-all-complaints' && (
                        <div id="tab-all-complaints">
                            <div className="dashboard-header-row">
                                <div>
                                    <h2 className="dashboard-title">Complaints Board</h2>
                                    <p className="dashboard-subtitle">Browse and filter grievances across wards.</p>
                                </div>
                            </div>

                            {/* Filters Panel */}
                            <div className="filters-panel">
                                <div className="search-box-wrapper">
                                    <i className="fa-solid fa-magnifying-glass search-icon"></i>
                                    <input 
                                        type="text" 
                                        placeholder="Search by title, description or category..." 
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <div className="filters-row">
                                    <select value={filterWard} onChange={(e) => setFilterWard(e.target.value)}>
                                        <option value="">All Wards</option>
                                        <option value="Kadri South">Kadri South</option>
                                        <option value="Kadri North">Kadri North</option>
                                        <option value="Bejai">Bejai</option>
                                        <option value="Bendoor">Bendoor</option>
                                        <option value="Lalbagh">Lalbagh</option>
                                    </select>
                                    <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                                        <option value="">All Categories</option>
                                        <option value="Water Supply">Water Supply</option>
                                        <option value="Roads">Roads</option>
                                        <option value="Sanitation">Sanitation</option>
                                        <option value="Streetlights">Streetlights</option>
                                        <option value="Health">Health</option>
                                        <option value="NREGA/MGNREGA">NREGA/MGNREGA</option>
                                        <option value="Agriculture">Agriculture</option>
                                        <option value="General">General</option>
                                    </select>
                                    <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
                                        <option value="">All Priorities</option>
                                        <option value="LOW">Low</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="HIGH">High</option>
                                    </select>
                                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                                        <option value="">All Statuses</option>
                                        <option value="OPEN">Open</option>
                                        <option value="IN_PROGRESS">In Progress</option>
                                        <option value="ESCALATED">Escalated</option>
                                        <option value="RESOLVED">Resolved</option>
                                    </select>
                                </div>
                            </div>

                            {/* Board Table */}
                            <div className="content-panel" style={{ marginTop: '20px' }}>
                                <div className="table-container">
                                    <table className="complaint-table">
                                        <thead>
                                            <tr>
                                                <th>Complaint</th>
                                                <th>Category</th>
                                                <th>Ward</th>
                                                <th>Priority</th>
                                                <th>Status</th>
                                                <th>SLA Deadline</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredComplaints.length === 0 ? (
                                                <tr>
                                                    <td colSpan="7" className="text-center text-muted">No complaints found.</td>
                                                </tr>
                                            ) : (
                                                filteredComplaints.map(c => (
                                                    <tr key={c._id}>
                                                        <td className="complaint-title-cell">
                                                            <div>{c.title}</div>
                                                            <div className="complaint-desc-cell">{c.description}</div>
                                                        </td>
                                                        <td>
                                                            <span className="ward-tag" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                                                <i className="fa-solid fa-folder"></i> {c.category || 'General'}
                                                            </span>
                                                        </td>
                                                        <td><i className="fa-solid fa-location-dot text-muted"></i> {c.ward}</td>
                                                        <td><span className={`badge ${getPriorityClass(c.priority)}`}>{c.priority}</span></td>
                                                        <td><span className={`badge ${getStatusClass(c.status)}`}>{c.status}</span></td>
                                                        <td><SlaCountdownCell deadline={c.deadline} status={c.status} /></td>
                                                        <td>
                                                            <button 
                                                                className="btn btn-secondary btn-sm"
                                                                onClick={() => onOpenDetails(c._id)}
                                                            >
                                                                <i className="fa-solid fa-eye"></i> View
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* View: Department & Budgets */}
                    {activeTab === 'tab-budget' && (
                        <div id="tab-budget">
                            <div className="dashboard-header-row">
                                <div>
                                    <h2 className="dashboard-title">Department Budgets & Resolution Finances</h2>
                                    <p className="dashboard-subtitle">Track resolution expenditures, department balances, and request budget top-ups from Admin.</p>
                                </div>
                                <button className="btn btn-secondary" onClick={loadBudgetData}>
                                    <i className="fa-solid fa-rotate"></i> Refresh Budgets
                                </button>
                            </div>

                            {/* Department Budget Cards */}
                            <div className="dept-budget-grid">
                                {departments.map(dept => {
                                    const remaining = dept.budget - (dept.spentBudget || 0);
                                    const pct = Math.min(100, Math.round(((dept.spentBudget || 0) / (dept.budget || 1)) * 100));
                                    const isLow = remaining < 20000;

                                    return (
                                        <div className={`dept-card ${isLow ? 'low-budget' : ''}`} key={dept._id}>
                                            <div className="dept-card-header">
                                                <h4><i className="fa-solid fa-building-columns"></i> {dept.name}</h4>
                                                <span className={`budget-status-pill ${isLow ? 'danger' : 'success'}`}>
                                                    {isLow ? 'Low Funds' : 'Active'}
                                                </span>
                                            </div>
                                            <p className="dept-officer"><i className="fa-solid fa-user-shield"></i> Officer: {dept.officerName || 'Dept Officer'}</p>

                                            <div className="dept-metrics-row">
                                                <div>
                                                    <span className="metric-lbl">Total Allocated</span>
                                                    <span className="metric-val">₹{dept.budget.toLocaleString('en-IN')}</span>
                                                </div>
                                                <div>
                                                    <span className="metric-lbl">Spent on Issues</span>
                                                    <span className="metric-val spent">₹{(dept.spentBudget || 0).toLocaleString('en-IN')}</span>
                                                </div>
                                                <div>
                                                    <span className="metric-lbl">Remaining</span>
                                                    <span className={`metric-val ${remaining < 0 ? 'negative' : 'positive'}`}>
                                                        ₹{remaining.toLocaleString('en-IN')}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="budget-progress-container">
                                                <div className="budget-progress-bar" style={{ width: `${pct}%`, background: pct > 85 ? 'var(--status-escalated)' : 'var(--secondary)' }}></div>
                                            </div>
                                            <div className="progress-lbl">{pct}% Utilized</div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Corporator / Department Action: Submit Budget Request */}
                            {user && (user.role === 'corporator' || user.role === 'admin') && (
                                <div className="content-panel" style={{ marginTop: '25px' }}>
                                    <h3 className="panel-title"><i className="fa-solid fa-hand-holding-dollar"></i> Request Additional Budget from Admin</h3>
                                    <p className="dashboard-subtitle">Submit a funding request to the Admin when issue resolution expenses exceed department budget.</p>

                                    <form onSubmit={handleBudgetRequestSubmit} className="budget-request-form">
                                        <div className="form-group">
                                            <label>Select Department</label>
                                            <select 
                                                value={reqDeptId} 
                                                onChange={(e) => setReqDeptId(e.target.value)}
                                                required
                                            >
                                                <option value="">-- Choose Department --</option>
                                                {departments.map(d => (
                                                    <option key={d._id} value={d._id}>{d.name} (Remaining: ₹{(d.budget - (d.spentBudget || 0)).toLocaleString('en-IN')})</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="form-group">
                                            <label>Required Amount (₹)</label>
                                            <input 
                                                type="number" 
                                                placeholder="e.g. 50000" 
                                                value={reqAmount}
                                                onChange={(e) => setReqAmount(e.target.value)}
                                                required 
                                                min="100"
                                            />
                                        </div>

                                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                            <label>Reason / Expense Justification</label>
                                            <textarea 
                                                rows="3" 
                                                placeholder="Explain what materials, labor, or equipment require additional funding..." 
                                                value={reqReason}
                                                onChange={(e) => setReqReason(e.target.value)}
                                                required
                                            ></textarea>
                                        </div>

                                        <button 
                                            type="submit" 
                                            className="btn btn-primary btn-block" 
                                            style={{ gridColumn: 'span 2' }}
                                            disabled={submittingReq}
                                        >
                                            {submittingReq ? 'Submitting Request...' : 'Submit Funding Request to Admin'}
                                        </button>
                                    </form>
                                </div>
                            )}

                            {/* Budget Requests Management Table */}
                            <div className="content-panel" style={{ marginTop: '25px' }}>
                                <h3 className="panel-title"><i className="fa-solid fa-clock-rotate-left"></i> Budget Requests Log & Approvals</h3>
                                
                                <div className="table-container">
                                    <table className="complaint-table">
                                        <thead>
                                            <tr>
                                                <th>Department</th>
                                                <th>Requested By</th>
                                                <th>Amount (₹)</th>
                                                <th>Reason</th>
                                                <th>Status</th>
                                                <th>Submitted Date</th>
                                                {user?.role === 'admin' && <th>Admin Actions</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {budgetRequests.length === 0 ? (
                                                <tr>
                                                    <td colSpan={user?.role === 'admin' ? 7 : 6} className="text-center text-muted">No budget requests submitted yet.</td>
                                                </tr>
                                            ) : (
                                                budgetRequests.map(br => (
                                                    <tr key={br._id}>
                                                        <td><strong>{br.department?.name || 'Department'}</strong></td>
                                                        <td>{br.requestedBy?.name || 'Officer'}</td>
                                                        <td><strong style={{ color: 'var(--secondary)' }}>₹{br.amount.toLocaleString('en-IN')}</strong></td>
                                                        <td>{br.reason}</td>
                                                        <td>
                                                            <span className={`badge ${br.status === 'APPROVED' ? 'badge-status-resolved' : br.status === 'REJECTED' ? 'badge-status-escalated' : 'badge-status-progress'}`}>
                                                                {br.status}
                                                            </span>
                                                        </td>
                                                        <td style={{ fontSize: '0.85rem' }}>{new Date(br.createdAt).toLocaleDateString()}</td>

                                                        {user?.role === 'admin' && (
                                                            <td>
                                                                {br.status === 'PENDING' ? (
                                                                    <div style={{ display: 'flex', gap: '6px', flexDirection: 'column' }}>
                                                                        <input 
                                                                            type="text"
                                                                            placeholder="Admin note (optional)"
                                                                            value={adminNotesMap[br._id] || ''}
                                                                            onChange={(e) => setAdminNotesMap({ ...adminNotesMap, [br._id]: e.target.value })}
                                                                            style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                                                                        />
                                                                        <div style={{ display: 'flex', gap: '6px' }}>
                                                                            <button 
                                                                                className="btn btn-primary btn-sm"
                                                                                onClick={() => handleActionBudgetRequest(br._id, 'APPROVED')}
                                                                            >
                                                                                <i className="fa-solid fa-check"></i> Approve
                                                                            </button>
                                                                            <button 
                                                                                className="btn btn-secondary btn-sm"
                                                                                onClick={() => handleActionBudgetRequest(br._id, 'REJECTED')}
                                                                                style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}
                                                                            >
                                                                                <i className="fa-solid fa-xmark"></i> Reject
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                                        Processed ({br.adminNote || 'No notes'})
                                                                    </span>
                                                                )}
                                                            </td>
                                                        )}
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                    
                </div>
            </div>
        </section>
    );
};
