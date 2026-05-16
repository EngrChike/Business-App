import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx'; // Global layout language connection
import { supabase } from '../api/supabaseClient';
import Sales from '../views/staff/Sales';
import DebtorBox from '../views/admin/Debtors'; 

export default function StaffDashboard() {
  const { language, toggleLanguage, t } = useLanguage(); // Pull global state functions
  const [view, setView] = useState('menu');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  // Staff Member Profile State
  const [staffProfile, setStaffProfile] = useState({
    name: 'Active Staff',
    email: 'staff@elite.com'
  });

  useEffect(() => {
    fetchStaffSession();

    // Close dropdown window if user clicks outside of it
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchStaffSession = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setStaffProfile({
        name: user.user_metadata?.full_name || 'Staff Terminal',
        email: user.email
      });
    }
  };

  if (view !== 'menu') {
    const Component = view === 'sales' ? Sales : DebtorBox;
    return <Component onBack={() => setView('menu')} />;
  }

  return (
    <div className="min-h-screen bg-[#F4F3ED] text-[#111111] p-4 md:p-8 font-sans antialiased">
      <div className="max-w-md mx-auto">
        
        {/* --- PREMIUM STAFF HEADER WITH USER ACCOUNT PROFILES --- */}
        <div className="flex justify-between items-center mb-10 mt-4 relative">
          <div>
            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">
              {t('service_ops')}
            </p>
            <h1 className="text-2xl font-black tracking-tight text-[#111111]">
              Service <span className="text-[#3F51B5]">Pro</span>
            </h1>
          </div>
          
          {/* INTERACTIVE CONTROLS CONTAINER */}
          <div className="flex items-center gap-3" ref={dropdownRef}>
            
            {/* INLINE LANGUAGE TOGGLE FOR STAFF */}
            <button 
              onClick={() => toggleLanguage()} 
              className="bg-white border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
            >
              <span className="font-bold text-xs tracking-tight text-slate-700">
                {language === 'en' ? '🇬🇧 EN' : '🇫🇷 FR'}
              </span>
            </button>

            {/* PROFILE AVATAR DROPDOWN */}
            <div className="relative">
              <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center justify-center h-10 w-10 rounded-full bg-[#1C1B1F] text-white font-black text-sm uppercase shadow-md active:scale-95 transition-all"
              >
                {staffProfile.name.charAt(0)}
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 top-12 w-60 bg-white border border-slate-100 rounded-[22px] shadow-xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="pb-3 border-b border-slate-100">
                    <p className="text-xs font-black text-slate-800 truncate">{staffProfile.name}</p>
                    <p className="text-[10px] font-medium text-slate-400 truncate mt-0.5">{staffProfile.email}</p>
                    <span className="inline-flex items-center gap-1 mt-2 text-[9px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                      <span className="h-1 w-1 rounded-full bg-emerald-500"></span> {t('active_shift')}
                    </span>
                  </div>
                  
                  <div className="pt-2 flex flex-col gap-1">
                    <button 
                      onClick={() => toggleLanguage()}
                      className="flex w-full text-left px-2 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
                    >
                      🌐 {language === 'en' ? 'Changer en Français' : 'Switch to English'}
                    </button>

                    <button 
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

        {/* --- LUXURY CARD NAVIGATION LINKS --- */}
        <div className="space-y-4">
          
          {/* New Sale Button */}
          <button 
            onClick={() => setView('sales')} 
            className="w-full bg-white border border-slate-100 p-6 rounded-[28px] shadow-sm text-left flex justify-between items-center group transition-all hover:scale-[1.01] active:scale-98"
          >
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-slate-900">{t('sales_terminal')}</h2>
              <p className="text-slate-400 text-[11px] font-medium uppercase tracking-wider mt-0.5">{t('register_counters')}</p>
            </div>
            <span className="text-2xl bg-indigo-50 p-3 rounded-2xl group-hover:scale-110 transition-transform shadow-sm">🛒</span>
          </button>

          {/* Debtors Button */}
          <button 
            onClick={() => setView('debtors')} 
            className="w-full bg-white border border-slate-100 p-6 rounded-[28px] shadow-sm text-left flex justify-between items-center group transition-all hover:scale-[1.01] active:scale-98"
          >
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-slate-900">{t('debtor_ledger')}</h2>
              <p className="text-slate-400 text-[11px] font-medium uppercase tracking-wider mt-0.5">{t('unpaid_tabs')}</p>
            </div>
            <span className="text-2xl bg-amber-50 p-3 rounded-2xl group-hover:scale-110 transition-transform shadow-sm">📝</span>
          </button>

        </div>

        {/* Padding Bottom spacer */}
        <div className="h-16"></div>

      </div>
    </div>
  );
}