// src/App.jsx
import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx'; 
import Login from './views/shared/Login.jsx'; 
import AdminDashboard from './pages/AdminDashboard.jsx'; 
import ManagerDashboard from './pages/ManagerDashboard.jsx'; 
import StaffDashboard from './pages/StaffDashboard.jsx'; 
import OfflineSyncManager from './components/OfflineSyncManager.jsx';
import { supabase } from './api/supabaseClient.js'; 
import './index.css';

// 🎨 MODERN SVG ICON COMPONENTS
const AlertTriangleIcon = () => (
  <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
);

const LockShieldIcon = () => (
  <svg className="w-6 h-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

const LogOutIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
  </svg>
);

const SpinnerIcon = () => (
  <svg className="w-8 h-8 animate-spin text-slate-900 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-15" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3.5" />
    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

function AppContent() {
  const { authenticated, role, selectedBranch, isActive, loading: authLoading } = useAuth();
  const [forceAdminBypass, setForceAdminBypass] = useState(false);
  const [checkingLocalToken, setCheckingLocalToken] = useState(true);
  const [fallbackTriggered, setFallbackTriggered] = useState(false);

  // 💾 BACKUP SESSION CACHE TO PREVENT REFRESH FREEZES
  useEffect(() => {
    if (role) {
      localStorage.setItem('monbilan_terminal_role_cache', String(role).toLowerCase().trim());
    }
  }, [role]);

  // ⏱️ ANTI-FREEZE FAIL-SAFE ROUTING TIMER (1.5 Second Threshold)
  useEffect(() => {
    let emergencyTimer;
    if (authLoading || checkingLocalToken) {
      emergencyTimer = setTimeout(() => {
        console.warn("Terminal initialization exceeded threshold. Disengaging lock screen.");
        setFallbackTriggered(true);
        setCheckingLocalToken(false);
      }, 1500);
    }
    return () => clearTimeout(emergencyTimer);
  }, [authLoading, checkingLocalToken]);

  // 📱 REFRESH SUB-STATE PURGE
  useEffect(() => {
    const nestedNavigationKeys = [
      'activeView', 'currentView', 'selectedView', 'viewState', 
      'activeTab', 'currentTab', 'dashboard_tab', 'admin_view'
    ];
    
    nestedNavigationKeys.forEach(key => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
  }, []);

  // ⚡ INSTANT SUPABASE VALIDATION LAYER
  useEffect(() => {
    if (!authenticated) {
      setForceAdminBypass(false);
      setCheckingLocalToken(false);
      return;
    }

    async function verifyLocalSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const email = session?.user?.email?.toLowerCase() || '';
        
        if (email === 'donchike21@gmail.com' || email.includes('admin')) {
          setForceAdminBypass(true);
        } else {
          setForceAdminBypass(false);
        }
      } catch (err) {
        console.error("Local storage verification error:", err);
        setForceAdminBypass(false);
      } finally {
        setCheckingLocalToken(false);
      }
    }
    verifyLocalSession();
  }, [authenticated]);

  // Determine structural identity using live context strings or cached fallbacks
  const storedRoleFallback = localStorage.getItem('monbilan_terminal_role_cache') || '';
  const cleanRole = role ? String(role).toLowerCase().trim() : storedRoleFallback;

  // Evaluate structural lock status
  const displayingSecurityLayer = (authLoading || checkingLocalToken) && !fallbackTriggered && !cleanRole;

  // 1. ASYNCHRONOUS INITIALIZATION & STRUCTURAL RESOLUTION LOCK
  if (displayingSecurityLayer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F3ED]">
        <div className="text-center">
          <SpinnerIcon />
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 animate-pulse">
            Syncing Terminal Security Layer...
          </p>
        </div>
      </div>
    );
  }

  // 2. SECURITY TERMINAL GATEWAY
  if (!authenticated || isActive === false) {
    return <Login />;
  }

  // 3. ADMINISTRATIVE CORPORATE ROUTING
  if (cleanRole === 'admin' || forceAdminBypass) {
    return <AdminDashboard />;
  }

  // 4. DISTINCT MANAGER COGNITIVE COMMAND BASE ROUTING
  if (cleanRole === 'manager') {
    return <ManagerDashboard />;
  }

  // 5. STANDARD STAFF ROUTING CONTROLS
  if (cleanRole === 'staff') {
    // 🛡️ REFRESH FIX: Only display restriction screen if loading sequence is entirely finalized
    if (!selectedBranch && !authLoading && !fallbackTriggered) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F4F3ED] p-4">
          <div className="bg-white p-6 md:p-8 rounded-[32px] shadow-xl shadow-slate-200/50 max-w-sm text-center border border-slate-100/80 transition-all">
            
            {/* Modern Icon Badge */}
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-100 shadow-inner">
              <AlertTriangleIcon />
            </div>

            <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-tight">Access Restricted</h2>
            <p className="text-slate-500 text-xs mt-2 leading-relaxed font-medium">
              Your terminal profile has no assigned operational location session. Please contact your manager to map your branch credentials.
            </p>
            
            {/* Modernized Buttons */}
            <div className="mt-6 flex gap-3">
              <button 
                onClick={() => window.location.reload()} 
                className="w-1/2 inline-flex items-center justify-center gap-1.5 bg-slate-900 text-white py-3 px-4 rounded-xl font-black text-[10px] uppercase tracking-wider hover:bg-slate-800 active:scale-[0.97] transition-all duration-200 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
              >
                <RefreshIcon />
                <span>Retry Setup</span>
              </button>

              <button 
                onClick={async () => {
                  await supabase.auth.signOut();
                  localStorage.removeItem('monbilan_terminal_role_cache');
                  window.location.reload();
                }} 
                className="w-1/2 inline-flex items-center justify-center gap-1.5 bg-rose-500 text-white py-3 px-4 rounded-xl font-black text-[10px] uppercase tracking-wider hover:bg-rose-600 active:scale-[0.97] transition-all duration-200 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
              >
                <LogOutIcon />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return <StaffDashboard />;
  }

  // 6. DIAGNOSTIC UNMAPPED STRUCTURAL FALLBACK
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F3ED] p-4">
      <div className="bg-white p-6 md:p-8 rounded-[32px] shadow-xl shadow-slate-200/50 max-w-sm text-center border border-slate-100/80 transition-all">
        
        {/* Modern Lock Badge */}
        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-200/60 shadow-inner">
          <LockShieldIcon />
        </div>

        <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-tight">Configuration Issue</h2>
        <p className="text-slate-500 text-xs mt-2 leading-relaxed font-medium">
          Your credentials are authenticated, but your access role configuration ("{role || 'resolving...'}") is unrecognizable. Please contact your administrator.
        </p>

        <div className="mt-6 pt-3 border-t border-slate-100">
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              localStorage.removeItem('monbilan_terminal_role_cache');
              window.location.reload();
            }}
            className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 text-white py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 active:scale-[0.97] transition-all duration-200 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
          >
            <LogOutIcon />
            <span>Reset Session Terminal</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <div className="App min-h-screen bg-[#F4F3ED]">
        <OfflineSyncManager />
        <AppContent />
      </div>
    </AuthProvider>
  );
}