import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

const SPECIALIZATIONS = [
    { value: 'Roads', label: '🛣️ Roads & Infrastructure (Potholes, Asphalt, Footpaths)' },
    { value: 'Streetlights', label: '💡 Streetlights & Electrical (Poles, Wiring, Luminaires)' },
    { value: 'Water Supply', label: '💧 Water Supply & Plumbing (Pipelines, Leaks, Valve joints)' },
    { value: 'Sanitation', label: '🧹 Sanitation & Waste Management (Garbage, Drains, Sewage)' },
    { value: 'Health', label: '🏥 Public Health & Environment (Vector control, Hazards)' },
    { value: 'General', label: '🏛️ General Civic Maintenance (Parks, Public Assets)' },
];

export const AddTechnicianModal = ({ isOpen, onClose, onTechnicianAdded, showToast, user }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [specialization, setSpecialization] = useState('Roads');
    const [ward, setWard] = useState('');
    const [district, setDistrict] = useState('');
    const [taluk, setTaluk] = useState('');
    const [panchayat, setPanchayat] = useState('');
    const [password, setPassword] = useState('password123');
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && user) {
            setWard(user.panchayat || user.ward || '');
            setDistrict(user.district || '');
            setTaluk(user.taluk || '');
            setPanchayat(user.panchayat || '');
        }
    }, [isOpen, user]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();

        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();
        const cleanPhone = phone.trim();

        if (!cleanName) {
            showToast('Please enter the technician full name.', 'warning');
            return;
        }

        if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
            showToast('Please enter a valid official email address (e.g. name@domain.com).', 'warning');
            return;
        }

        if (!cleanPhone) {
            showToast('Please enter the technician contact phone number.', 'warning');
            return;
        }

        try {
            setSubmitting(true);
            const res = await api.addTechnician({
                name: cleanName,
                email: cleanEmail,
                phone: cleanPhone,
                specialization,
                ward: ward.trim() || user?.panchayat || user?.ward || 'General Ward',
                district: district.trim() || user?.district || '',
                taluk: taluk.trim() || user?.taluk || '',
                panchayat: panchayat.trim() || user?.panchayat || '',
                password: password.trim() || 'password123'
            });

            if (res.success) {
                showToast(`👷 Field Technician ${res.technician.name} successfully deployed!`, 'success');
                if (onTechnicianAdded) {
                    onTechnicianAdded(res.technician);
                }
                // Reset form
                setName('');
                setEmail('');
                setPhone('');
                setSpecialization('Roads');
                setPassword('password123');
                onClose();
            }
        } catch (err) {
            const errorMsg = err.data?.message || err.data?.error || err.message || 'Failed to add technician.';
            showToast(errorMsg, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
                <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
                    <i className="fa-solid fa-xmark"></i>
                </button>

                <div className="modal-header">
                    <div className="modal-logo-icon">
                        <i className="fa-solid fa-helmet-safety"></i>
                    </div>
                    <h3>Onboard Field Technician</h3>
                    <p>Register on-duty municipal worker for autonomous task dispatching.</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                        {/* Technician Full Name */}
                        <div className="form-group">
                            <label htmlFor="tech-name">
                                Full Name <span style={{ color: 'var(--danger)' }}>*</span>
                            </label>
                            <div className="input-with-icon">
                                <i className="fa-solid fa-user"></i>
                                <input
                                    type="text"
                                    id="tech-name"
                                    className="form-control"
                                    placeholder="e.g. Ramesh Gowda"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {/* Phone Number */}
                        <div className="form-group">
                            <label htmlFor="tech-phone">
                                Mobile Contact <span style={{ color: 'var(--danger)' }}>*</span>
                            </label>
                            <div className="input-with-icon">
                                <i className="fa-solid fa-phone"></i>
                                <input
                                    type="tel"
                                    id="tech-phone"
                                    className="form-control"
                                    placeholder="+91 98450 12345"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginTop: '12px' }}>
                        {/* Email Address */}
                        <div className="form-group">
                            <label htmlFor="tech-email">
                                Official Email Address <span style={{ color: 'var(--danger)' }}>*</span>
                            </label>
                            <div className="input-with-icon">
                                <i className="fa-solid fa-envelope"></i>
                                <input
                                    type="email"
                                    id="tech-email"
                                    className="form-control"
                                    placeholder="e.g. ramesh.roads@nivaran.gov"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {/* Specialization Division */}
                        <div className="form-group">
                            <label htmlFor="tech-specialization">
                                Department Division <span style={{ color: 'var(--danger)' }}>*</span>
                            </label>
                            <div className="input-with-icon">
                                <i className="fa-solid fa-wrench"></i>
                                <select
                                    id="tech-specialization"
                                    className="form-control"
                                    value={specialization}
                                    onChange={(e) => setSpecialization(e.target.value)}
                                    required
                                    style={{ cursor: 'pointer' }}
                                >
                                    {SPECIALIZATIONS.map(spec => (
                                        <option key={spec.value} value={spec.value}>
                                            {spec.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginTop: '12px' }}>
                        {/* Assigned Ward / Panchayat */}
                        <div className="form-group">
                            <label htmlFor="tech-ward">
                                Ward / Gram Panchayat Jurisdiction
                            </label>
                            <div className="input-with-icon">
                                <i className="fa-solid fa-location-dot"></i>
                                <input
                                    type="text"
                                    id="tech-ward"
                                    className="form-control"
                                    placeholder="e.g. Shiruru / Ward 4"
                                    value={ward}
                                    onChange={(e) => setWard(e.target.value)}
                                />
                            </div>
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                                Grievances in this location matching specialization will auto-dispatch here.
                            </span>
                        </div>

                        {/* Initial Login Password */}
                        <div className="form-group">
                            <label htmlFor="tech-password">
                                Initial Login Password
                            </label>
                            <div className="input-with-icon" style={{ position: 'relative' }}>
                                <i className="fa-solid fa-lock"></i>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="tech-password"
                                    className="form-control"
                                    placeholder="password123"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: '12px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer'
                                    }}
                                    aria-label="Toggle password visibility"
                                >
                                    <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                </button>
                            </div>
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                                Technician uses this password to log in and upload repair proof.
                            </span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '28px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '20px' }}>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={onClose}
                            disabled={submitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={submitting}
                            style={{ minWidth: '180px' }}
                        >
                            {submitting ? (
                                <>
                                    <i className="fa-solid fa-spinner fa-spin"></i> Onboarding...
                                </>
                            ) : (
                                <>
                                    <i className="fa-solid fa-user-plus"></i> Deploy Technician
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
