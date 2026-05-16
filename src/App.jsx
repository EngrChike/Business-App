import React, { useState, useEffect } from 'react';
import { supabase } from './api/supabaseClient';
import Dashboard from './pages/Dashboard';

// Confirmed path based on your Explorer screenshot
import Login from './views/shared/Login.jsx'; 

import './index.css'; 

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check current session on app load
    const getInitialSession = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      loading === true && setLoading(false);
    };

    getInitialSession();

    // 2. Listen for login/logout changes in real-time
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- LOADING VIEW ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-black text-[10px] uppercase tracking-widest text-slate-400">Loading System...</p>
        </div>
      </div>
    );
  }

  // --- MAIN NAVIGATION ---
  return (
    <div className="App min-h-screen bg-slate-50">
      {!session ? (
        /* Show Login if no user is authenticated */
        <Login />
      ) : (
        /* Show the role-based Dashboard Switcher if logged in */
        <Dashboard />
      )}
    </div>
  );
}