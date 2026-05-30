// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../api/supabaseClient.js';

const AuthContext = createContext(null);

// ⏱️ CONFIGURATION: Set the maximum inactivity time limit here
// 10 * 60 * 1000 = 10 Minutes (Change the 10 to any number of minutes you want)
const INACTIVITY_LIMIT = 5 * 60 * 1000; 

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ role: null, branch_id: null, is_active: true });
  const [selectedBranch, setSelectedBranch] = useState(null); 
  const [loading, setLoading] = useState(true);

  // Reference pointer to track the active background countdown timer
  const inactivityTimeoutRef = useRef(null);

  /**
   * Fetches backend profile database keys with an instant high-priority administrative 
   * email override bypass to break circular RLS lookup loop locks.
   */
  const fetchUserProfileMetadata = async (userId, userEmail) => {
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
        const sanitizedRole = data.role ? String(data.role).toLowerCase().trim() : 'staff';
        
        return {
          role: sanitizedRole,
          branch_id: data.branch_id || null,
          is_active: data.is_active !== false 
        };
      }
    } catch (err) {
      console.error("Failed to read user profile table gracefully:", err);
    }
    
    return { role: 'staff', branch_id: null, is_active: true };
  };

  /**
   * Centralized application-wide sign-out engine.
   * Clears state instantly to prevent protected route leakage.
   */
  const signOut = async () => {
    setLoading(true);
    // Clear inactivity timer immediately on intentional sign-out execution
    if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
    
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Error executing application sign out:", err);
    } finally {
      // 🔴 TOTAL HARD CLEAR: Wipes react states and browser storage caches
      localStorage.clear();
      sessionStorage.clear();
      setUser(null);
      setProfile({ role: null, branch_id: null, is_active: true });
      setSelectedBranch(null);
      setLoading(false);
    }
  };

  // --- 🔄 INACTIVITY TIMER ENGINE ---
  const resetInactivityTimer = () => {
    // Drop the previous running countdown
    if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);

    // Only set countdown loop if an authorized user is actively logged into the terminal
    if (user) {
      inactivityTimeoutRef.current = setTimeout(() => {
        console.warn("Inactivity limit breached. Triggering structural auto-logout sequence.");
        signOut();
        alert("🔒 Session Expired: You have been logged out due to inactivity.");
      }, INACTIVITY_LIMIT);
    }
  };

  // Listen for user interactions to reset the inactivity countdown clock
  useEffect(() => {
    const interactionEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

    if (user) {
      resetInactivityTimer();
      
      interactionEvents.forEach(eventType => {
        window.addEventListener(eventType, resetInactivityTimer);
      });
    }

    return () => {
      if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
      interactionEvents.forEach(eventType => {
        window.removeEventListener(eventType, resetInactivityTimer);
      });
    };
  }, [user]);


  // --- 🛡️ CORE AUTH TRACKER & LIFE CYCLE ENGINE ---
  useEffect(() => {
    let isMounted = true;

    // ⚡ FIXED LOADING LOOP: Explicitly check for an active recovery session right at startup
    const checkInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
          if (isMounted) {
            setUser(null);
            setLoading(false); // Explicitly kill the loading freeze if the session is dead
          }
          return;
        }
        
        if (session?.user && isMounted) {
          const meta = await fetchUserProfileMetadata(session.user.id, session.user.email);
          if (isMounted) {
            if (meta.is_active === false) {
              await signOut();
            } else {
              setUser(session.user);
              setProfile(meta);
              setSelectedBranch(meta.branch_id || null);
            }
          }
        }
      } catch (err) {
        console.error("Initial session clearance crash:", err);
      } finally {
        if (isMounted) setLoading(false); // Safety gate guarantee
      }
    };

    checkInitialSession();

    // Unified Auth event listener handling changes, token refreshes, and drops
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      
      // Only flicker loading for valid logins/transitions to prevent stuck loops during background token checks
      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
        setLoading(true);
      }

      try {
        if (session?.user) {
          const meta = await fetchUserProfileMetadata(session.user.id, session.user.email);
          
          if (isMounted) {
            if (meta.is_active === false) {
              // Instantly evict suspended users
              await supabase.auth.signOut();
              localStorage.clear();
              sessionStorage.clear();
              setUser(null);
              setProfile({ role: null, branch_id: null, is_active: true });
              setSelectedBranch(null);
            } else {
              setUser(session.user);
              setProfile(meta);
              
              setSelectedBranch(prevBranch => {
                if (event === 'SIGNED_IN' || prevBranch === null) {
                  return meta.branch_id || null;
                }
                return prevBranch;
              });
            }
          }
        } else {
          // Clean state wipe if session dropped completely or token expired while user was away
          if (isMounted) {
            localStorage.clear();
            sessionStorage.clear();
            setUser(null);
            setProfile({ role: null, branch_id: null, is_active: true });
            setSelectedBranch(null);
          }
        }
      } catch (err) {
        console.error("Auth System Event Synchronization Error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      if (subscription) subscription.unsubscribe();
    };
  }, []); 

  const contextValue = useMemo(() => ({
    user, 
    role: profile.role, 
    branchId: profile.branch_id,   
    branch_id: profile.branch_id,  
    isActive: profile.is_active, 
    selectedBranch,               
    setSelectedBranch,            
    authenticated: !!user,
    loading,                      
    signOut                       
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