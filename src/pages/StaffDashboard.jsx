// src/pages/StaffDashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx'; 
import { useAuth } from '../context/AuthContext.jsx'; // Added to listen to the user's assigned branch identity
import { supabase } from '../api/supabaseClient';
import Sales from '../views/staff/Sales.jsx'; 

export default function StaffDashboard() {
  const { language, toggleLanguage, t } = useLanguage(); 
  const { branchId } = useAuth(); // Safely reads the branch assigned to this staff member by Admin
  const [view, setView] = useState('menu');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  const [staffProfile, setStaffProfile] = useState({
    name: 'Active Staff',
    email: 'staff@elite.com',
    branchName: 'Loading assigned branch...'
  });

  useEffect(() => {
    fetchStaffSessionAndBranch();

    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [branchId]);

  const fetchStaffSessionAndBranch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      let assignedBranchName = 'No Branch Assigned';
      
      // If the staff member has a branch_id, look up its actual name for the header display
      if (branchId) {
        const { data: branchData } = await supabase
          .from('branches')
          .select('name')
          .eq('id', branchId)
          .maybeSingle();
        if (branchData) {
          assignedBranchName = branchData.name;
        }
      }

      setStaffProfile({
        name: user.user_metadata?.full_name || 'Staff Terminal',
        email: user.email,
        branchName: assignedBranchName
      });
    }
  };

  // ROUTING NAVIGATION PATHS
  if (view === 'sales') {
    // Passes the branchId constraint down to Sales so transactions are logged to the correct branch counter
    return <Sales branchId={branchId} onBack={() => setView('menu')} />;
  }

  return (
    <div className="min-h-screen bg-[#F4F3ED] text-[#111111] p-4 md:p-8 font-sans antialiased">
      <div className="max-w-md mx-auto">
        
        {/* --- PREMIUM STAFF HEADER --- */}
        <div className="flex justify-between items-center mb-10 mt-4 relative">
          <div>
            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">
              {staffProfile.branchName} 📍
            </p>
            <h1 className="text-2xl font-black tracking-tight text-[#111111]">
              Service <span className="text-[#3F51B5]">Pro</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-3" ref={dropdownRef}>
            <button 
              type="button"
              onClick={() => toggleLanguage()} 
              className="bg-white border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
            >
              <span className="font-bold text-xs tracking-tight text-slate-700">
                {language === 'en' ? '🇬🇧 EN' : '🇫🇷 FR'}
              </span>
            </button>

            <div className="relative">
              <button 
                type="button"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center justify-center h-10 w-10 rounded-full bg-[#1C1B1F] text-white font-black text-sm uppercase shadow-md active:scale-95 transition-all"
              >
                {staffProfile.name.charAt(0)}
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 top-12 w-60 bg-white border border-slate-100 rounded-[22px] shadow-xl p-4 z-50">
                  <div className="pb-3 border-b border-slate-100">
                    <p className="text-xs font-black text-slate-800 truncate">{staffProfile.name}</p>
                    <p className="text-[10px] font-medium text-slate-400 truncate mt-0.5">{staffProfile.email}</p>
                    <span className="inline-flex items-center gap-1 mt-2 text-[9px] font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                      📍 {staffProfile.branchName}
                    </span>
                  </div>
                  
                  <div className="pt-2 flex flex-col gap-1">
                    <button 
                      type="button"
                      onClick={() => toggleLanguage()}
                      className="flex w-full text-left px-2 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
                    >
                      🌐 {language === 'en' ? 'Changer en Français' : 'Switch to English'}
                    </button>

                    <button 
                      type="button"
                      onClick={() => supabase.auth.signOut()} 
                      className="w-full text-left px-2 py-2 text-xs font-bold text-[#FF5A50] hover:bg-red-50 rounded-xl transition-colors flex items-center gap-2"
                    >
                      <span>🚪</span> {t('sign_out')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* --- NAVIGATION LINKS --- */}
        <div className="space-y-4">
          {/* New Sale Button */}
          <button 
            type="button"
            onClick={() => setView('sales')} 
            className="w-full bg-white border border-slate-100 p-6 rounded-[28px] shadow-sm text-left flex justify-between items-center group transition-all hover:scale-[1.01] active:scale-98"
          >
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-slate-900">{t('sales_terminal')}</h2>
              <p className="text-slate-400 text-[11px] font-medium uppercase tracking-wider mt-0.5">{t('register_counters')}</p>
            </div>
            <span className="text-2xl bg-indigo-50 p-3 rounded-2xl group-hover:scale-110 transition-transform shadow-sm">🛒</span>
          </button>
        </div>

        <div className="h-16"></div>
      </div>
    </div>
  );
}