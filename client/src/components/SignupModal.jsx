import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { karnatakaLocations } from '../data/karnatakaLocations';
import { SearchableSelect } from './SearchableSelect';

export const SignupModal = ({ isOpen, onClose, onGotoLogin, showToast }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('citizen');
    
    // Cascading location state
    const [district, setDistrict] = useState('');
    const [taluk, setTaluk] = useState('');
    const [customTaluk, setCustomTaluk] = useState('');
    const [panchayat, setPanchayat] = useState('');
    const [customPanchayat, setCustomPanchayat] = useState('');
    
    const { signup } = useAuth();

    // Derived lists
    const districtList = useMemo(() => {
        return Object.keys(karnatakaLocations).sort((a, b) => a.localeCompare(b));
    }, []);

    const talukList = useMemo(() => {
        if (!district || !karnatakaLocations[district]) return [];
        return Object.keys(karnatakaLocations[district]).sort((a, b) => a.localeCompare(b));
    }, [district]);

    const panchayatList = useMemo(() => {
        if (!district || !taluk || taluk === '__OTHER__' || !karnatakaLocations[district]?.[taluk]) return [];
        return [...karnatakaLocations[district][taluk]].sort((a, b) => a.localeCompare(b));
    }, [district, taluk]);

    if (!isOpen) return null;

    const handleDistrictChange = (selected) => {
        setDistrict(selected);
        setTaluk('');
        setCustomTaluk('');
        setPanchayat('');
        setCustomPanchayat('');
    };

    const handleTalukChange = (selected) => {
        setTaluk(selected);
        if (selected !== '__OTHER__') {
            setCustomTaluk('');
        }
        setPanchayat('');
        setCustomPanchayat('');
    };

    const handlePanchayatChange = (selected) => {
        setPanchayat(selected);
        if (selected !== '__OTHER__') {
            setCustomPanchayat('');
        }
    };

    const effectiveTaluk = taluk === '__OTHER__' ? customTaluk.trim() : taluk;
    const effectivePanchayat = panchayat === '__OTHER__' ? customPanchayat.trim() : panchayat;

    const handleSubmit = async (e) => {
        e.preventDefault();

        const cleanName = name.trim();
        const cleanEmail = email.trim();
        const cleanPassword = password;
        
        if (!cleanName || !cleanEmail || !cleanPassword || !role) {
            showToast('Please fill in all personal details', 'error');
            return;
        }

        if (!district) {
            showToast('Please select your District', 'error');
            return;
        }

        if (!effectiveTaluk) {
            showToast('Please select or specify your Taluk', 'error');
            return;
        }

        if (!effectivePanchayat) {
            showToast('Please select or specify your Gram Panchayat', 'error');
            return;
        }

        const effectiveWard = effectivePanchayat || `${effectiveTaluk} Rural`;

        try {
            await signup({
                name: cleanName,
                email: cleanEmail,
                password: cleanPassword,
                role,
                district,
                taluk: effectiveTaluk,
                panchayat: effectivePanchayat,
                ward: effectiveWard
            });
            showToast('Registration successful! Please sign in.', 'success');
            setName('');
            setEmail('');
            setPassword('');
            setRole('citizen');
            setDistrict('');
            setTaluk('');
            setCustomTaluk('');
            setPanchayat('');
            setCustomPanchayat('');
            onGotoLogin();
        } catch (err) {
            showToast(err.message || 'Registration failed.', 'error');
        }
    };

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal-card" style={{ maxWidth: '540px' }}>
                <button className="modal-close-btn" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
                <div className="modal-header">
                    <i className="fa-solid fa-shield-halved modal-logo-icon"></i>
                    <h3>Join Nivaran</h3>
                    <p>Panchayati Raj & Civic Grievance Redressal Portal</p>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="signup-name">Full Name</label>
                        <input 
                            type="text" 
                            id="signup-name" 
                            placeholder="e.g. Ramesh Gowda" 
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
                    
                    <div className="form-group">
                        <label htmlFor="signup-role">Account Type</label>
                        <select 
                            id="signup-role" 
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            required
                        >
                            <option value="citizen">Citizen (ಗ್ರಾಮಸ್ಥ)</option>
                            <option value="corporator">Panchayat Development Officer (PDO)</option>
                            <option value="admin">Administrator / Taluk & District Officer</option>
                        </select>
                    </div>

                    {/* Hierarchical Location Section with Embedded Search Bars */}
                    <div style={{
                        marginTop: '1.25rem',
                        marginBottom: '1.5rem',
                        padding: '1.1rem',
                        background: 'rgba(99, 102, 241, 0.04)',
                        border: '1px solid rgba(99, 102, 241, 0.18)',
                        borderRadius: '12px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="fa-solid fa-location-dot" style={{ color: '#818cf8' }}></i>
                                <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#e2e8f0', letterSpacing: '0.02em' }}>
                                    Jurisdiction / ಸ್ಥಳೀಯ ವ್ಯಾಪ್ತಿ
                                </span>
                            </div>
                            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                🔍 Searchable Dropdowns
                            </span>
                        </div>

                        {/* Step 1: District with Searchbar */}
                        <SearchableSelect
                            id="signup-district"
                            label="1. District"
                            kannadaLabel="ಜಿಲ್ಲೆ"
                            placeholder="Type to search district..."
                            options={districtList}
                            value={district}
                            onChange={handleDistrictChange}
                            required={true}
                        />

                        {/* Step 2: Taluk with Searchbar */}
                        <SearchableSelect
                            id="signup-taluk"
                            label="2. Taluk"
                            kannadaLabel="ತಾಲೂಕು"
                            placeholder={district ? "Type to search taluk..." : "Select District First"}
                            options={talukList}
                            value={taluk}
                            onChange={handleTalukChange}
                            disabled={!district}
                            required={true}
                            allowOther={true}
                            otherValue={customTaluk}
                            onOtherChange={setCustomTaluk}
                            otherPlaceholder="Enter custom taluk name..."
                        />

                        {/* Step 3: Gram Panchayat with Searchbar */}
                        <SearchableSelect
                            id="signup-panchayat"
                            label="3. Gram Panchayat"
                            kannadaLabel="ಗ್ರಾಮ ಪಂಚಾಯತಿ"
                            placeholder={effectiveTaluk ? "Type to search Gram Panchayat..." : "Select Taluk First"}
                            options={panchayatList}
                            value={panchayat}
                            onChange={handlePanchayatChange}
                            disabled={!district || (!taluk && !customTaluk)}
                            required={true}
                            allowOther={true}
                            otherValue={customPanchayat}
                            onOtherChange={setCustomPanchayat}
                            otherPlaceholder="Enter Gram Panchayat or Village name..."
                        />

                        {/* Active Selection Breadcrumb */}
                        {district && (
                            <div style={{
                                marginTop: '12px',
                                padding: '10px 14px',
                                background: 'rgba(255, 255, 255, 0.04)',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                                borderRadius: '8px',
                                fontSize: '0.8rem',
                                color: '#a5b4fc',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                flexWrap: 'wrap'
                            }}>
                                <i className="fa-solid fa-map-pin" style={{ color: '#6366f1' }}></i>
                                <span>Karnataka</span>
                                <i className="fa-solid fa-chevron-right" style={{ fontSize: '0.65rem', opacity: 0.6 }}></i>
                                <strong>{district}</strong>
                                {effectiveTaluk && (
                                    <>
                                        <i className="fa-solid fa-chevron-right" style={{ fontSize: '0.65rem', opacity: 0.6 }}></i>
                                        <strong>{effectiveTaluk}</strong>
                                    </>
                                )}
                                {effectivePanchayat && (
                                    <>
                                        <i className="fa-solid fa-chevron-right" style={{ fontSize: '0.65rem', opacity: 0.6 }}></i>
                                        <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{effectivePanchayat} GP</span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <button type="submit" className="btn btn-primary btn-block" style={{ padding: '12px' }}>
                        Register Account
                    </button>
                    <div className="modal-footer">
                        Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); onGotoLogin(); }}>Sign In</a>
                    </div>
                </form>
            </div>
        </div>
    );
};
