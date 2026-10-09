import React, { useEffect } from 'react';

export const ToastContainer = ({ toasts, removeToast }) => {
    return (
        <div className="toast-container" id="toast-container">
            {toasts.map((toast) => (
                <ToastItem 
                    key={toast.id} 
                    toast={toast} 
                    onClose={() => removeToast(toast.id)} 
                />
            ))}
        </div>
    );
};

const ToastItem = ({ toast, onClose }) => {
    useEffect(() => {
        // Auto dismiss after 3.5 seconds
        const timer = setTimeout(() => {
            onClose();
        }, 3500);

        return () => clearTimeout(timer);
    }, [onClose]);

    let iconClass = 'fa-circle-info';
    if (toast.type === 'success') iconClass = 'fa-circle-check';
    if (toast.type === 'error') iconClass = 'fa-triangle-exclamation';

    return (
        <div className={`toast toast-${toast.type}`} style={{ opacity: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <i className={`fa-solid ${iconClass} toast-icon`}></i>
                <div className="toast-message">{toast.message}</div>
            </div>
            <button 
                onClick={onClose}
                aria-label="Close notification"
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '4px 6px',
                    marginLeft: '8px',
                    fontSize: '0.85rem',
                    borderRadius: '4px',
                    lineHeight: 1
                }}
            >
                <i className="fa-solid fa-xmark"></i>
            </button>
        </div>
    );
};
