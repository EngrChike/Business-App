import React, { createContext, useContext, useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { supabase } from '../api/supabaseClient.js';

const AuthContext = createContext(null);

// ⏱️ CONFIGURATION: Set the maximum inactivity time limit (5 Minutes)
const INACTIVITY_LIMIT = 5 * 60 * 1000; 

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ role: null, branch_id: null, is_active: true });
  const [selectedBranch, setSelectedBranch] = useState(null); 
  const [loading, setLoading] = useState(true);

  // Reference pointers for background timers & event throttling
  const inactivityTimeoutRef = useRef(null);
  const lastActivityTimestamp = useRef(Date.now());

  /**
   * Mobile Device Refresh Interceptor
   * Runs once on launch. Clears sub-view history keys on mobile reloads.
   */
  useEffect(() => {
    const isMobileDevice = window.innerWidth <= 768 || /Mobi|Android|iPhone/i.test(navigator.userAgent);
    
    if (isMobileDevice) {
      console.log("Mobile reload detected. Resetting navigation tracking keys.");
      
      const viewTrackingKeys = ['activeView', 'currentView', 'selectedView', 'viewState', 'activeTab', 'currentTab'];
      viewTrackingKeys.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });

      if (window.location.hash && window.location.hash !== '#/' && window.location.hash !== '#') {
        window.location.hash = '#/';
      }
    }
  }, []);

  /**
   * Fetches backend profile data with administrative bypass rule
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
      console.error("Failed to read user profile metadata:", err);
    }
    
    return { role: 'staff', branch_id: null, is_active: true };
  };

  /**
   * Centralized application-wide sign-out engine.
   */
  const signOut = useCallback(async () => {
    setLoading(true);
    if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
    
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Error executing sign out:", err);
    } finally {
      localStorage.clear();
      sessionStorage.clear();
      setUser(null);
      setProfile({ role: null, branch_id: null, is_active: true });
      setSelectedBranch(null);
      setLoading(false);
    }
  }, []);

  // --- 🔄 THROTTLED INACTIVITY TIMER ENGINE ---
  const resetInactivityTimer = useCallback(() => {
    const now = Date.now();
    // Throttle checks to once every 2 seconds to keep 60fps performance on high-frequency touch/move events
    if (now - lastActivityTimestamp.current < 2000 && inactivityTimeoutRef.current) {
      return;
    }
    lastActivityTimestamp.current = now;

    if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);

    if (user) {
      inactivityTimeoutRef.current = setTimeout(async () => {
        console.warn("Inactivity limit breached. Triggering auto-logout sequence.");
        await signOut();
        setTimeout(() => {
          alert("🔒 Session Expired: You have been logged out due to inactivity.");
        }, 100);
      }, INACTIVITY_LIMIT);
    }
  }, [user, signOut]);

  // Attach touch & mouse event listeners for active session tracking
  useEffect(() => {
    const interactionEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart', 'touchmove', 'pointerdown'];

    if (user) {
      resetInactivityTimer();
      interactionEvents.forEach(eventType => {
        window.addEventListener(eventType, resetInactivityTimer, { passive: true });
      });
    }

    return () => {
      if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
      interactionEvents.forEach(eventType => {
        window.removeEventListener(eventType, resetInactivityTimer);
      });
    };
  }, [user, resetInactivityTimer]);

  // --- 🛡️ UNIFIED AUTH LIFECYCLE ENGINE ---
  useEffect(() => {
    let isMounted = true;

    // Single source of truth auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
        setLoading(true);
      }

      try {
        if (session?.user) {
          const meta = await fetchUserProfileMetadata(session.user.id, session.user.email);
          
          if (isMounted) {
            if (meta.is_active === false) {
              await signOut();
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
          if (isMounted) {
            setUser(null);
            setProfile({ role: null, branch_id: null, is_active: true });
            setSelectedBranch(null);
          }
        }
      } catch (err) {
        console.error("Auth Event Synchronization Error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      if (subscription) subscription.unsubscribe();
    };
  }, [signOut]); 

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
  }), [user, profile, selectedBranch, loading, signOut]);

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