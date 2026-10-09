import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { karnatakaLocations } from '../data/karnatakaLocations';

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

    const handleDistrictChange = (e) => {
        const selected = e.target.value;
        setDistrict(selected);
        setTaluk('');
        setCustomTaluk('');
        setPanchayat('');
        setCustomPanchayat('');
    };

    const handleTalukChange = (e) => {
        const selected = e.target.value;
        setTaluk(selected);
        if (selected !== '__OTHER__') {
            setCustomTaluk('');
        }
        setPanchayat('');
        setCustomPanchayat('');
    };

    const handlePanchayatChange = (e) => {
        const selected = e.target.value;
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

                    {/* Hierarchical Location Section */}
                    <div style={{
                        marginTop: '1.25rem',
                        marginBottom: '1.5rem',
                        padding: '1rem',
                        background: 'rgba(99, 102, 241, 0.04)',
                        border: '1px solid rgba(99, 102, 241, 0.15)',
                        borderRadius: '12px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <i className="fa-solid fa-location-dot" style={{ color: '#818cf8' }}></i>
                            <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#e2e8f0', letterSpacing: '0.02em' }}>
                                Jurisdiction / ಸ್ಥಳೀಯ ವ್ಯಾಪ್ತಿ
                            </span>
                        </div>

                        {/* Step 1: District */}
                        <div className="form-group" style={{ marginBottom: '12px' }}>
                            <label htmlFor="signup-district" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                1. District (ಜಿಲ್ಲೆ) <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <select 
                                id="signup-district" 
                                value={district}
                                onChange={handleDistrictChange}
                                required
                            >
                                <option value="">-- Select District ({districtList.length} Available) --</option>
                                {districtList.map((d) => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                        </div>

                        {/* Step 2: Taluk */}
                        <div className="form-group" style={{ marginBottom: '12px' }}>
                            <label htmlFor="signup-taluk" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                2. Taluk (ತಾಲೂಕು) <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <select 
                                id="signup-taluk" 
                                value={taluk}
                                onChange={handleTalukChange}
                                disabled={!district}
                                required
                            >
                                <option value="">
                                    {district ? `-- Select Taluk (${talukList.length} in ${district}) --` : '-- Select District First --'}
                                </option>
                                {talukList.map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                                {district && (
                                    <option value="__OTHER__">➕ Other / Enter Custom Taluk...</option>
                                )}
                            </select>

                            {taluk === '__OTHER__' && (
                                <input 
                                    type="text" 
                                    placeholder="Enter your Taluk name" 
                                    value={customTaluk}
                                    onChange={(e) => setCustomTaluk(e.target.value)}
                                    style={{ marginTop: '8px' }}
                                    required 
                                />
                            )}
                        </div>

                        {/* Step 3: Gram Panchayat */}
                        <div className="form-group" style={{ marginBottom: '6px' }}>
                            <label htmlFor="signup-panchayat" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                3. Gram Panchayat (ಗ್ರಾಮ ಪಂಚಾಯತಿ) <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <select 
                                id="signup-panchayat" 
                                value={panchayat}
                                onChange={handlePanchayatChange}
                                disabled={!district || (!taluk && !customTaluk)}
                                required
                            >
                                <option value="">
                                    {effectiveTaluk 
                                        ? `-- Select Gram Panchayat (${panchayatList.length} listed) --` 
                                        : '-- Select Taluk First --'}
                                </option>
                                {panchayatList.map((gp) => (
                                    <option key={gp} value={gp}>{gp}</option>
                                ))}
                                {effectiveTaluk && (
                                    <option value="__OTHER__">➕ Other / Enter Custom Gram Panchayat...</option>
                                )}
                            </select>

                            {panchayat === '__OTHER__' && (
                                <input 
                                    type="text" 
                                    placeholder="Enter your Gram Panchayat or Village name" 
                                    value={customPanchayat}
                                    onChange={(e) => setCustomPanchayat(e.target.value)}
                                    style={{ marginTop: '8px' }}
                                    required 
                                />
                            )}
                        </div>

                        {/* Active Selection Breadcrumb */}
                        {district && (
                            <div style={{
                                marginTop: '10px',
                                padding: '8px 12px',
                                background: 'rgba(255, 255, 255, 0.04)',
                                borderRadius: '8px',
                                fontSize: '0.78rem',
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
