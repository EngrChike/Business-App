import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../api/supabaseClient.js';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Safe initial session verification
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (session) {
          setUser(session.user);
        }
      } catch (err) {
        console.error("AuthContext Initialization Exception:", err.message);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // 2. Real-time broadcast listener for sign-in/sign-out updates
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  // Prevent root-level rendering deadlocks while validating sessions
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-black text-[10px] uppercase tracking-[0.25em] text-slate-500">Securing Gateway Context...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, authenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be executed directly within an AuthProvider wrapper boundary');
  }
  return context;
};