// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../api/supabaseClient';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // Or whatever state tracks 'admin'/'manager'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for auth changes (Login / Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setUser(session.user);
        // Fetch user role from your profiles table here if needed
        // const currentRole = session.user.user_metadata?.role; 
        // setRole(currentRole);
      } else {
        // 🔴 CRITICAL: Clear EVERYTHING when there is no active session
        setUser(null);
        setRole(null); 
        localStorage.clear(); // Clear any cached role strings from the browser
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Your Logout Function
  const logout = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      
      // 🔴 FORCE CLEAR ALL REACT STATE IMMEDIATELY
      setUser(null);
      setRole(null);
      localStorage.clear(); // Wipes out ghost data from the browser storage
      
    } catch (error) {
      console.error("Error during logout:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);