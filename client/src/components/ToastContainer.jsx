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
        // Auto dismiss after 4.5 seconds
        const timer = setTimeout(() => {
            onClose();
        }, 4500);

        return () => clearTimeout(timer);
    }, [onClose]);

    let iconClass = 'fa-circle-info';
    if (toast.type === 'success') iconClass = 'fa-circle-check';
    if (toast.type === 'error') iconClass = 'fa-triangle-exclamation';

    return (
        <div className={`toast toast-${toast.type}`} style={{ opacity: 1 }}>
            <i className={`fa-solid ${iconClass} toast-icon`}></i>
            <div className="toast-message">{toast.message}</div>
        </div>
    );
};
