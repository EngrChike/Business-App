// src/pages/StaffDashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  MapPin, 
  Globe, 
  User, 
  LogOut, 
  ShoppingCart, 
  ChevronRight, 
  Store, 
  Sparkles 
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx'; 
import { useAuth } from '../context/AuthContext.jsx'; 
import { supabase } from '../api/supabaseClient';
import Sales from '../views/staff/Sales.jsx'; 

export default function StaffDashboard() {
  const { language, toggleLanguage, t } = useLanguage(); 
  const { branchId, signOut } = useAuth(); // Reads assigned branch identity & centralized sign out handler
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
        name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Staff Terminal',
        email: user.email,
        branchName: assignedBranchName
      });
    }
  };

  // ROUTING NAVIGATION PATHS
  if (view === 'sales') {
    return <Sales branchId={branchId} onBack={() => setView('menu')} />;
  }

  return (
    <div className="min-h-screen bg-[#F4F3ED] text-[#111111] p-4 md:p-8 font-sans antialiased">
      <div className="max-w-md mx-auto">
        
        {/* --- EXECUTIVE STAFF HEADER --- */}
        <div className="flex justify-between items-center mb-8 mt-2 relative">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-indigo-700 bg-indigo-50 border border-indigo-100/80 px-2.5 py-0.5 rounded-full tracking-wider mb-1.5 shadow-sm">
              <MapPin className="w-3 h-3 text-indigo-600" />
              <span>{staffProfile.branchName}</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-1.5">
              <span>Service</span>
              <span className="text-indigo-600 flex items-center gap-1">
                Pro <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500" />
              </span>
            </h1>
          </div>
          
          <div className="flex items-center gap-2.5" ref={dropdownRef}>
            {/* Language Switcher */}
            <button 
              type="button"
              onClick={() => toggleLanguage()} 
              className="inline-flex items-center gap-1.5 bg-white border border-slate-200/80 px-3 py-2 rounded-2xl hover:bg-slate-50 transition-all active:scale-95 shadow-sm text-slate-700"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-600" />
              <span className="font-extrabold text-xs tracking-tight uppercase">
                {language === 'en' ? 'EN' : 'FR'}
              </span>
            </button>

            {/* Profile Avatar & Dropdown */}
            <div className="relative">
              <button 
                type="button"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center justify-center h-10 w-10 rounded-2xl bg-slate-950 text-white font-black text-sm uppercase shadow-md hover:bg-indigo-600 active:scale-95 transition-all border border-slate-800"
              >
                {staffProfile.name.charAt(0)}
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 top-12 w-64 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-[24px] shadow-xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="pb-3 border-b border-slate-100">
                    <p className="text-xs font-black text-slate-900 truncate">{staffProfile.name}</p>
                    <p className="text-[10px] font-medium text-slate-400 truncate mt-0.5">{staffProfile.email}</p>
                    <div className="inline-flex items-center gap-1 mt-2 text-[9px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                      <Store className="w-3 h-3 text-indigo-600" />
                      <span>{staffProfile.branchName}</span>
                    </div>
                  </div>
                  
                  <div className="pt-2 flex flex-col gap-1">
                    <button 
                      type="button"
                      onClick={() => toggleLanguage()}
                      className="flex items-center gap-2.5 w-full text-left px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
                    >
                      <Globe className="w-4 h-4 text-slate-400" />
                      <span>{language === 'en' ? 'Changer en Français' : 'Switch to English'}</span>
                    </button>

                    <button 
                      type="button"
                      onClick={() => signOut()} 
                      className="flex items-center gap-2.5 w-full text-left px-3 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      <span>{t('sign_out') || 'Sign Out'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* --- NAVIGATION TERMINAL ACTION CONSOLE --- */}
        <div className="space-y-4">
          <button 
            type="button"
            onClick={() => setView('sales')} 
            className="w-full bg-white border border-slate-200/80 hover:border-indigo-400/80 p-6 rounded-[28px] shadow-sm hover:shadow-md text-left flex justify-between items-center group transition-all active:scale-[0.99] border-l-4 border-l-indigo-600"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shrink-0">
                <ShoppingCart className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-base font-black tracking-tight text-slate-900 uppercase group-hover:text-indigo-600 transition-colors">
                  {t('sales_terminal') || 'Sales Terminal'}
                </h2>
                <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mt-0.5">
                  {t('register_counters') || 'Register Transactions'}
                </p>
              </div>
            </div>

            <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all shrink-0 ml-2">
              <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        </div>

        <div className="h-16"></div>
      </div>
    </div>
  );
}