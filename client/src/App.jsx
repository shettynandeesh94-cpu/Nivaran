import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { LandingView } from './components/LandingView';
import { Dashboard } from './components/Dashboard';
import { LoginModal } from './components/LoginModal';
import { SignupModal } from './components/SignupModal';
import { ComplaintDetailsModal } from './components/ComplaintDetailsModal';
import { ToastContainer } from './components/ToastContainer';

const MainApp = () => {
  const { user, loading } = useAuth();
  
  // Views and Tabs
  const [view, setView] = useState('landing'); // 'landing' or 'dashboard'
  const [activeTab, setActiveTab] = useState('tab-overview');
  
  // Modals state
  const [loginOpen, setLoginOpen] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedComplaintId, setSelectedComplaintId] = useState(null);
  
  // Refresh coordinator for dashboard fetch
  const [refreshKey, setRefreshKey] = useState(0);

  // Toasts state
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const triggerRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleOpenDetails = (id) => {
    setSelectedComplaintId(id);
    setDetailsOpen(true);
  };

  // Sync auth state to view transition
  React.useEffect(() => {
    if (!loading) {
      if (user) {
        setView('dashboard');
      } else {
        setView('landing');
      }
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div style={{
        display: 'flex', 
        height: '100vh', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#0b0f19',
        color: '#f8fafc'
      }}>
        <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '3rem', color: 'var(--primary)' }}></i>
      </div>
    );
  }

  return (
    <>
      {/* Glowing Accents */}
      <div className="bg-glow bg-glow-1"></div>
      <div className="bg-glow bg-glow-2"></div>

      {/* Shared Navigation Header */}
      <Navbar 
        setView={setView} 
        onOpenLogin={() => setLoginOpen(true)}
        onOpenSignup={() => setSignupOpen(true)}
        switchTab={setActiveTab}
      />

      {/* Main Core Views Router */}
      <main className="main-content">
        {view === 'landing' ? (
          <LandingView 
            setView={setView} 
            onOpenLogin={() => setLoginOpen(true)} 
            switchTab={setActiveTab}
          />
        ) : (
          <Dashboard 
            activeTab={activeTab} 
            switchTab={setActiveTab} 
            onOpenDetails={handleOpenDetails}
            showToast={showToast}
            refreshKey={refreshKey}
            triggerRefresh={triggerRefresh}
          />
        )}
      </main>

      {/* Authentication Modals */}
      <LoginModal 
        isOpen={loginOpen} 
        onClose={() => setLoginOpen(false)}
        onGotoSignup={() => {
          setLoginOpen(false);
          setSignupOpen(true);
        }}
        showToast={showToast}
      />

      <SignupModal 
        isOpen={signupOpen} 
        onClose={() => setSignupOpen(false)}
        onGotoLogin={() => {
          setSignupOpen(false);
          setLoginOpen(true);
        }}
        showToast={showToast}
      />

      {/* Detailed view Modal */}
      <ComplaintDetailsModal 
        isOpen={detailsOpen}
        onClose={() => {
          setDetailsOpen(false);
          setSelectedComplaintId(null);
        }}
        complaintId={selectedComplaintId}
        showToast={showToast}
        refreshDashboard={triggerRefresh}
      />

      {/* Animated feedback cards overlay */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
