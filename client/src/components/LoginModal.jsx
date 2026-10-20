import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

export const LoginModal = ({ isOpen, onClose, onGotoSignup, showToast }) => {
    // Auth mode: 'otp' | 'password'
    const [authMode, setAuthMode] = useState('otp');
    
    // Password state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    
    // OTP state
    const [otpEmail, setOtpEmail] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [otpCountdown, setOtpCountdown] = useState(0);
    const [demoOtpNotice, setDemoOtpNotice] = useState('');

    const [submitting, setSubmitting] = useState(false);
    const googleButtonRef = useRef(null);

    const { login, googleLogin, sendOtp, verifyOtp } = useAuth();

    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

    // Handle Google Sign-In credential response
    const handleGoogleCredentialResponse = async (response) => {
        if (!response || !response.credential) {
            showToast('Failed to receive Google credential.', 'error');
            return;
        }

        try {
            setSubmitting(true);
            const data = await googleLogin(response.credential);
            showToast(`Welcome, ${data.user.name}! Signed in with Google.`, 'success');
            onClose();
        } catch (err) {
            showToast(err.message || 'Google sign-in failed. Please try again.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // Initialize Google Identity Services
    useEffect(() => {
        if (!isOpen) return;

        if (window.google?.accounts?.id && googleClientId) {
            try {
                window.google.accounts.id.initialize({
                    client_id: googleClientId,
                    callback: handleGoogleCredentialResponse,
                    auto_select: false,
                    cancel_on_tap_outside: true,
                });

                if (googleButtonRef.current) {
                    googleButtonRef.current.innerHTML = '';
                    window.google.accounts.id.renderButton(googleButtonRef.current, {
                        theme: 'outline',
                        size: 'large',
                        width: '100%',
                        text: 'continue_with',
                        shape: 'pill',
                        logo_alignment: 'left'
                    });
                }
            } catch (err) {
                console.error('Failed to initialize Google Sign-In:', err);
            }
        }
    }, [isOpen, googleClientId, authMode]);

    // OTP Countdown Timer
    useEffect(() => {
        let timer;
        if (otpCountdown > 0) {
            timer = setInterval(() => {
                setOtpCountdown((prev) => (prev > 0 ? prev - 1 : 0));
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [otpCountdown]);

    if (!isOpen) return null;

    // Direct Google Button click handler (if standard GSI button didn't render or for custom prompt)
    const handleCustomGoogleClick = () => {
        if (!googleClientId) {
            showToast('Google Client ID not yet set in environment. Use the Gmail OTP login below!', 'info');
            setAuthMode('otp');
            return;
        }

        if (window.google?.accounts?.id) {
            window.google.accounts.id.prompt((notification) => {
                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                    showToast('Opening Google Sign-In prompt...', 'info');
                }
            });
        } else {
            showToast('Google Identity SDK is loading. Please try again in a moment.', 'warning');
        }
    };

    // Send OTP to email
    const handleSendOtp = async (e) => {
        e?.preventDefault();
        const cleanEmail = otpEmail.trim().toLowerCase();

        if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
            showToast('Please enter a valid Gmail / Email address.', 'warning');
            return;
        }

        try {
            setSubmitting(true);
            setDemoOtpNotice('');
            const res = await sendOtp(cleanEmail);

            setOtpSent(true);
            setOtpCountdown(60);

            if (res.demoOtp) {
                setDemoOtpNotice(res.demoOtp);
                showToast(`OTP generated: ${res.demoOtp} (Enter code below to sign in)`, 'info');
            } else {
                showToast(`Verification code sent to ${cleanEmail}. Check your inbox!`, 'success');
            }
        } catch (err) {
            showToast(err.message || 'Failed to send OTP. Please try again.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // Verify OTP and complete login
    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        const cleanEmail = otpEmail.trim().toLowerCase();
        const cleanOtp = otpCode.trim();

        if (!cleanEmail || !cleanOtp) {
            showToast('Please enter the 6-digit OTP code sent to your email.', 'warning');
            return;
        }

        try {
            setSubmitting(true);
            const data = await verifyOtp(cleanEmail, cleanOtp);
            showToast(`Welcome, ${data.user.name}! Successfully authenticated.`, 'success');
            onClose();
        } catch (err) {
            showToast(err.message || 'Invalid or expired OTP code.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // Password login
    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        const cleanEmail = email.trim();
        const cleanPassword = password;

        if (!cleanEmail || !cleanPassword) {
            showToast('Email and password are required', 'error');
            return;
        }

        try {
            setSubmitting(true);
            const data = await login(cleanEmail, cleanPassword);
            showToast(`Welcome back, ${data.user.name}!`, 'success');
            onClose();
        } catch (err) {
            showToast(err.message || 'Login failed. Please check credentials.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal-card" style={{ maxWidth: '440px', padding: '28px' }}>
                <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
                    <i className="fa-solid fa-xmark"></i>
                </button>

                <div className="modal-header" style={{ marginBottom: '20px' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))',
                        border: '1px solid rgba(168, 85, 247, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 12px auto'
                    }}>
                        <i className="fa-solid fa-shield-halved" style={{ fontSize: '1.4rem', color: '#818cf8' }}></i>
                    </div>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 4px 0' }}>Sign In to Nivaran</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                        Autonomous AI Civic Governance & Grievance Redressal
                    </p>
                </div>

                {/* Google Sign-In Section */}
                <div style={{ marginBottom: '16px' }}>
                    {googleClientId ? (
                        <div ref={googleButtonRef} style={{ width: '100%', minHeight: '44px', display: 'flex', justifyContent: 'center' }}></div>
                    ) : (
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={handleCustomGoogleClick}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                padding: '10px 16px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                borderRadius: '10px',
                                color: '#f3f4f6',
                                fontWeight: 600,
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            {/* Official Google G Logo SVG */}
                            <svg width="18" height="18" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                            </svg>
                            Continue with Google
                        </button>
                    )}
                </div>

                {/* Divider */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    margin: '18px 0',
                    color: 'var(--text-muted)',
                    fontSize: '0.78rem',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                }}>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.08)' }}></div>
                    <span style={{ padding: '0 12px' }}>or choose sign in method</span>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.08)' }}></div>
                </div>

                {/* Method Switcher Tabs */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '6px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    padding: '4px',
                    borderRadius: '10px',
                    marginBottom: '18px',
                    border: '1px solid rgba(255, 255, 255, 0.06)'
                }}>
                    <button
                        type="button"
                        onClick={() => { setAuthMode('otp'); setDemoOtpNotice(''); }}
                        style={{
                            padding: '8px 12px',
                            background: authMode === 'otp' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                            border: authMode === 'otp' ? '1px solid rgba(99, 102, 241, 0.4)' : 'none',
                            borderRadius: '8px',
                            color: authMode === 'otp' ? '#ffffff' : 'var(--text-muted)',
                            fontSize: '0.82rem',
                            fontWeight: authMode === 'otp' ? 600 : 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <i className="fa-solid fa-envelope-circle-check"></i> Gmail OTP
                    </button>
                    <button
                        type="button"
                        onClick={() => { setAuthMode('password'); setDemoOtpNotice(''); }}
                        style={{
                            padding: '8px 12px',
                            background: authMode === 'password' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                            border: authMode === 'password' ? '1px solid rgba(99, 102, 241, 0.4)' : 'none',
                            borderRadius: '8px',
                            color: authMode === 'password' ? '#ffffff' : 'var(--text-muted)',
                            fontSize: '0.82rem',
                            fontWeight: authMode === 'password' ? 600 : 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <i className="fa-solid fa-key"></i> Password
                    </button>
                </div>

                {/* MODE 1: GMAIL / EMAIL OTP */}
                {authMode === 'otp' && (
                    <div>
                        {!otpSent ? (
                            /* Step 1: Request OTP */
                            <form onSubmit={handleSendOtp}>
                                <div className="form-group" style={{ marginBottom: '16px' }}>
                                    <label htmlFor="otp-email" style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                                        Your Gmail / Official Email Address
                                    </label>
                                    <div className="input-with-icon" style={{ position: 'relative' }}>
                                        <i className="fa-solid fa-envelope" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}></i>
                                        <input
                                            type="email"
                                            id="otp-email"
                                            className="form-control"
                                            placeholder="e.g. yourname@gmail.com"
                                            value={otpEmail}
                                            onChange={(e) => setOtpEmail(e.target.value)}
                                            required
                                            style={{ paddingLeft: '36px' }}
                                            autoFocus
                                        />
                                    </div>
                                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                                        A 6-digit login code will be sent to your inbox.
                                    </span>
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-primary btn-block"
                                    disabled={submitting}
                                    style={{
                                        width: '100%',
                                        padding: '11px',
                                        borderRadius: '10px',
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    {submitting ? (
                                        <>
                                            <i className="fa-solid fa-spinner fa-spin"></i> Sending OTP...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-paper-plane"></i> Send Verification OTP
                                        </>
                                    )}
                                </button>
                            </form>
                        ) : (
                            /* Step 2: Verify OTP */
                            <form onSubmit={handleVerifyOtp}>
                                <div style={{
                                    background: 'rgba(99, 102, 241, 0.1)',
                                    border: '1px solid rgba(99, 102, 241, 0.25)',
                                    borderRadius: '10px',
                                    padding: '12px 14px',
                                    marginBottom: '16px',
                                    fontSize: '0.82rem',
                                    color: '#c7d2fe',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <i className="fa-solid fa-envelope-open-text" style={{ color: '#818cf8', fontSize: '1.1rem' }}></i>
                                        <span>Code sent to <strong>{otpEmail}</strong></span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => { setOtpSent(false); setOtpCode(''); setDemoOtpNotice(''); }}
                                        style={{ background: 'none', border: 'none', color: '#a5b4fc', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.78rem' }}
                                    >
                                        Change
                                    </button>
                                </div>

                                {demoOtpNotice && (
                                    <div style={{
                                        background: 'rgba(16, 185, 129, 0.15)',
                                        border: '1px solid rgba(16, 185, 129, 0.4)',
                                        borderRadius: '8px',
                                        padding: '10px 14px',
                                        marginBottom: '14px',
                                        fontSize: '0.8rem',
                                        color: '#6ee7b7',
                                        textAlign: 'center'
                                    }}>
                                        💡 Test / Demo OTP: <strong style={{ letterSpacing: '2px', fontSize: '1.1rem' }}>{demoOtpNotice}</strong>
                                    </div>
                                )}

                                <div className="form-group" style={{ marginBottom: '16px' }}>
                                    <label htmlFor="otp-code" style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                                        Enter 6-Digit Verification Code
                                    </label>
                                    <div className="input-with-icon" style={{ position: 'relative' }}>
                                        <i className="fa-solid fa-shield" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}></i>
                                        <input
                                            type="text"
                                            id="otp-code"
                                            className="form-control"
                                            placeholder="123456"
                                            maxLength="6"
                                            value={otpCode}
                                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                            required
                                            style={{
                                                paddingLeft: '36px',
                                                letterSpacing: '6px',
                                                fontSize: '1.25rem',
                                                fontWeight: 700,
                                                textAlign: 'center',
                                                fontFamily: 'monospace'
                                            }}
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-primary btn-block"
                                    disabled={submitting || otpCode.length < 6}
                                    style={{
                                        width: '100%',
                                        padding: '11px',
                                        borderRadius: '10px',
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    {submitting ? (
                                        <>
                                            <i className="fa-solid fa-spinner fa-spin"></i> Verifying...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-arrow-right-to-bracket"></i> Verify & Sign In
                                        </>
                                    )}
                                </button>

                                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
                                    {otpCountdown > 0 ? (
                                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                            Resend code in <strong>{otpCountdown}s</strong>
                                        </span>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleSendOtp}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: 'var(--primary, #818cf8)',
                                                fontSize: '0.8rem',
                                                fontWeight: 600,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <i className="fa-solid fa-rotate-right"></i> Resend OTP Code
                                        </button>
                                    )}
                                </div>
                            </form>
                        )}
                    </div>
                )}

                {/* MODE 2: CLASSIC PASSWORD */}
                {authMode === 'password' && (
                    <form onSubmit={handlePasswordSubmit}>
                        <div className="form-group" style={{ marginBottom: '14px' }}>
                            <label htmlFor="login-email" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Email Address</label>
                            <input 
                                type="email" 
                                id="login-email" 
                                placeholder="you@example.com" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required 
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: '16px' }}>
                            <label htmlFor="login-password" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Password</label>
                            <input 
                                type="password" 
                                id="login-password" 
                                placeholder="••••••••" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required 
                            />
                        </div>
                        <button type="submit" className="btn btn-primary btn-block" disabled={submitting} style={{ width: '100%', padding: '11px', borderRadius: '10px', fontWeight: 600 }}>
                            {submitting ? 'Signing In...' : 'Sign In with Password'}
                        </button>
                        
                        {/* Quick Demo Fill Buttons */}
                        <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '14px' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', textAlign: 'center' }}>
                                Quick Demo Credentials:
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ fontSize: '0.75rem', padding: '6px 8px' }}
                                    onClick={() => { setEmail('gunda@gmail.com'); setPassword('123456'); }}
                                >
                                    🏛️ PDO (Corporator)
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ fontSize: '0.75rem', padding: '6px 8px' }}
                                    onClick={() => { setEmail('shettynandeesh94@gmail.com'); setPassword('123456'); }}
                                >
                                    🛡️ Admin (Nandeesh)
                                </button>
                            </div>
                        </div>
                    </form>
                )}

                <div className="modal-footer" style={{ marginTop: '18px', textAlign: 'center', fontSize: '0.84rem' }}>
                    Don't have an account?{' '}
                    <a href="#" onClick={(e) => { e.preventDefault(); onGotoSignup(); }} style={{ color: 'var(--primary, #818cf8)', fontWeight: 600 }}>
                        Register here
                    </a>
                </div>
            </div>
        </div>
    );
};
