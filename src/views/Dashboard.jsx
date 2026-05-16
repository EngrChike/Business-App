import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx'; // Global layout localization engine
import { supabase } from '../api/supabaseClient';
import AdminDashboard from './AdminDashboard';
import StaffDashboard from './StaffDashboard';

export default function Dashboard() {
  const { t } = useLanguage();
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Check for admin keyword in email as an immediate safeguard bypass
          if (user.email?.includes('admin')) {
            setRole('admin');
            return;
          }

          const { data } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
          
          // Default to 'staff' if profile data role is not explicitly found
          setRole(data?.role || 'staff');
        }
      } catch (error) {
        console.error("Failed to cleanly resolve corporate profile security role:", error.message);
        setRole('staff'); // Safe fallback position
      } finally {
        setLoading(false);
      }
    }
    getProfile();
  }, []);

  // --- PREMIUM SYSTEM LOADER OVERLAY ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F3ED]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-3 border-[#3F51B5] border-t-transparent rounded-full animate-spin"></div>
          <p className="font-black text-[10px] uppercase tracking-widest text-slate-400 animate-pulse">
            {t('syncing_ledgers_msg') || 'Verifying Security Access Clearance...'}
          </p>
        </div>
      </div>
    );
  }

  // --- PRIVILEGE ROUTING SWITCHER ---
  return role === 'admin' ? <AdminDashboard /> : <StaffDashboard />;
}