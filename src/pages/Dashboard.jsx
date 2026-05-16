import React, { useState, useEffect } from 'react';
import { supabase } from '../api/supabaseClient';
import AdminDashboard from './AdminDashboard';
import StaffDashboard from './StaffDashboard';

export default function Dashboard() {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
          
          // Default to 'staff' if profile data role is not explicitly set
          setRole(data?.role || 'staff');
        }
      } catch (error) {
        console.error("Failed to cleanly resolve user security role:", error.message);
        setRole('staff'); // Safe fallback position so the application doesn't break
      } finally {
        setLoading(false); // Guarantees loading turns off even if the network fails
      }
    }
    getProfile();
  }, []);

  // --- PREMIUM SYSTEM LOADER OVERLAY ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          {/* Elite Branding Color Spinner */}
          <div className="w-10 h-10 border-4 border-[#3F51B5] border-t-transparent rounded-full animate-spin"></div>
          <p className="font-black text-[10px] uppercase tracking-widest text-slate-400">Verifying Security Access Clearance...</p>
        </div>
      </div>
    );
  }

  // --- PRIVILEGE ROUTING SWITCHER ---
  return role === 'admin' ? <AdminDashboard /> : <StaffDashboard />;
}