import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { supabase } from '../api/supabaseClient.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ role: null, branch_id: null, is_active: true });
  const [selectedBranch, setSelectedBranch] = useState(null); // Tracks active operational terminal location
  const [loading, setLoading] = useState(true);

  /**
   * Fetches backend profile database keys with an instant high-priority administrative 
   * email override bypass to break circular RLS lookup loop locks.
   */
  const fetchUserProfileMetadata = async (userId, userEmail) => {
    // ⚡ MASTER OVERRIDE KEY: Force admin parameters if logged in as root admin email
    if (userEmail?.toLowerCase() === 'donchike21@gmail.com') {
      return {
        role: 'admin',
        branch_id: null,
        is_active: true
      };
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, branch_id, is_active')
        .eq('id', userId)
        .maybeSingle(); 

      if (!error && data) {
        // ⚡ TYPE SANITIZATION: Cast the enum value explicitly to a clean lowercase string
        const sanitizedRole = data.role ? String(data.role).toLowerCase().trim() : 'staff';
        
        return {
          role: sanitizedRole,
          branch_id: data.branch_id || null,
          is_active: data.is_active !== false // Defaults to true if null, strictly false if set to false
        };
      }
    } catch (err) {
      console.error("Failed to read user profile table gracefully:", err);
    }
    
    // Safe standard fallback values if network drops or profiles are unmapped
    return { role: 'staff', branch_id: null, is_active: true };
  };

  /**
   * Centralized application-wide sign-out engine.
   * Clears state instantly to prevent protected route leakage.
   */
  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Error executing application sign out:", err);
    } finally {
      setUser(null);
      setProfile({ role: null, branch_id: null, is_active: true });
      setSelectedBranch(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // ⚡ UNIFIED AUTH ENGINE: Tracks initialization, logins, logouts, and token refreshes cleanly
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      
      // Turn the loading state back on during transitions to prevent data race condition flickers
      setLoading(true);

      try {
        if (session?.user) {
          // Fetch backend profile data exactly once per session change, tracking root email signature
          const meta = await fetchUserProfileMetadata(session.user.id, session.user.email);
          
          if (isMounted) {
            // 🛡️ MANAGER & STAFF ACCESS LOCKOUT GUARD: Instantly evict suspended users
            if (meta.is_active === false) {
              await supabase.auth.signOut();
              setUser(null);
              setProfile({ role: null, branch_id: null, is_active: true });
              setSelectedBranch(null);
            } else {
              // Safe data assignment for authorized staff, manager, or admin accounts
              setUser(session.user);
              setProfile(meta);
              
              // 🔄 STATE PRESERVATION RULE: Only auto-assign branch layout during fresh logins
              // This stops automated background token refreshes from resetting an admin's chosen active branch switch.
              if (event === 'SIGNED_IN' || selectedBranch === null) {
                if (meta.branch_id) {
                  setSelectedBranch(meta.branch_id);
                } else if (meta.role === 'admin') {
                  setSelectedBranch(null);
                }
              }
            }
          }
        } else {
          // Clean state wipe on sign out or expired session tokens
          if (isMounted) {
            setUser(null);
            setProfile({ role: null, branch_id: null, is_active: true });
            setSelectedBranch(null);
          }
        }
      } catch (err) {
        console.error("Auth System Event Synchronization Error:", err);
      } finally {
        // Drop the loading gate only after all auth data has been perfectly resolved
        if (isMounted) setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      if (subscription) subscription.unsubscribe();
    };
  }, [selectedBranch]);

  // 🚀 PERFORMANCE MEMOIZATION: Prevents app-wide component tree re-rendering cycles
  const contextValue = useMemo(() => ({
    user, 
    role: profile.role, 
    branchId: profile.branch_id,   // Casing format for newer module files
    branch_id: profile.branch_id,  // Fallback for dashboard clearance sub-components
    isActive: profile.is_active, 
    selectedBranch,               // EXPOSED SECURELY TO THE ROUTER SWITCHER
    setSelectedBranch,            // Exposed function so Admin can switch active counters
    authenticated: !!user,
    loading,                      // CORRECTLY EXPORTED: Prevents App.jsx layout routing page flickers
    signOut                       // Exposed global sign-out handle
  }), [user, profile, selectedBranch, loading]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be executed within an AuthProvider wrapper boundary');
  }
  return context;
};