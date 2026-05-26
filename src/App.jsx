// src/App.jsx
import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx'; 
import Login from './views/shared/Login.jsx'; 
import AdminDashboard from './pages/AdminDashboard.jsx'; 
import { ManagerDashboard } from './pages/ManagerDashboard.jsx'; // ✅ Just one clean, named import
import StaffDashboard from './pages/StaffDashboard.jsx'; 
import OfflineSyncManager from './components/OfflineSyncManager.jsx';
import { supabase } from './api/supabaseClient.js'; 
import './index.css';

function AppContent() {
  const { authenticated, role, selectedBranch, isActive, loading } = useAuth();
  const [forceAdminBypass, setForceAdminBypass] = useState(false);
  const [checkingLocalToken, setCheckingLocalToken] = useState(true);

  // ⚡ INSTANT SUPABASE TOKEN BACKUP CHANNEL
  useEffect(() => {
    async function verifyLocalSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const email = session?.user?.email?.toLowerCase() || '';
        
        if (email === 'donchike21@gmail.com' || email.includes('admin')) {
          setForceAdminBypass(true);
        }
      } catch (err) {
        console.error("Local storage sync error:", err);
      } finally {
        setCheckingLocalToken(false);
      }
    }
    verifyLocalSession();
  }, [authenticated]);

  const cleanRole = role ? String(role).toLowerCase().trim() : '';

  // 1. ASYNCHRONOUS INITIALIZATION & STRUCTURAL RESOLUTION LOCK
  if (loading || checkingLocalToken || (authenticated && !cleanRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F3ED]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 animate-pulse">
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
    if (!selectedBranch) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F4F3ED] p-4">
          <div className="bg-white p-6 md:p-8 rounded-[40px] shadow-sm max-w-sm text-center border border-slate-100">
            <span className="text-3xl block mb-2">⚠️</span>
            <h2 className="text-lg font-extrabold text-slate-900 uppercase tracking-tight">Access Restricted</h2>
            <p className="text-slate-400 text-xs mt-2 leading-relaxed font-medium">
              Your terminal profile has no assigned operational location session. Please contact your manager to map your branch credentials.
            </p>
            
            <div className="mt-6 flex gap-3">
              <button 
                onClick={() => window.location.reload()} 
                className="w-1/2 bg-slate-900 text-white py-3 rounded-2xl font-black text-[10px] uppercase tracking-wider hover:opacity-90 transition-all"
              >
                Retry Setup
              </button>
              <button 
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.reload();
                }} 
                className="w-1/2 bg-red-500 text-white py-3 rounded-2xl font-black text-[10px] uppercase tracking-wider hover:opacity-90 transition-all"
              >
                Sign Out
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
      <div className="bg-white p-6 md:p-8 rounded-[40px] shadow-sm max-w-sm text-center border border-slate-100">
        <span className="text-3xl block mb-2">🔒</span>
        <h2 className="text-lg font-extrabold text-slate-900 uppercase tracking-tight">Configuration Issue</h2>
        <p className="text-slate-400 text-xs mt-2 leading-relaxed font-medium">
          Your credentials are authenticated, but your access role configuration ("{role || 'resolving...'}") is unrecognizable. Please contact your administrator.
        </p>
        <div className="mt-5 pt-2 border-t border-slate-100">
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.reload();
            }}
            className="w-full bg-slate-900 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest"
          >
            Reset Session Terminal
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