import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx'; // Plugs directly into your global context engine
import { supabase } from '../api/supabaseClient.js'; 

// Sub-views
import Debtors from '../views/admin/Debtors.jsx';
import Expenses from '../views/admin/Expenses.jsx';
import Inventory from '../views/admin/Inventory.jsx';
import Reports from '../views/admin/Reports.jsx';
import StaffManagement from '../views/admin/StaffManagement.jsx';
import StaffPerformance from '../views/admin/StaffPerformance.jsx';
import Sales from '../views/staff/Sales.jsx';

export default function AdminDashboard() {
  const { language, toggleLanguage, t } = useLanguage(); // Shared context hooks instead of local translation instances
  const [view, setView] = useState('menu');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  // User Profile State
  const [userProfile, setUserProfile] = useState({
    name: 'Don Chike',
    email: 'admin@elite.com'
  });

  // CEO Metrics State
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalDebt: 0,
    lowStockCount: 0,
    totalExpenses: 0
  });

  useEffect(() => {
    if (view === 'menu') fetchCEOMetrics();
    fetchUserSession();

    // Close dropdown if user clicks outside of it
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [view]);

  const fetchUserSession = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserProfile({
        name: user.user_metadata?.full_name || 'Onyema Chikezie',
        email: user.email
      });
    }
  };

  const fetchCEOMetrics = async () => {
    try {
      const today = new Date();
      today.setHours(0,0,0,0);

      // 1. Fetch Today's Sales & Debt
      const { data: salesData } = await supabase
        .from('sales')
        .select('total_amount, payment_status')
        .gte('created_at', today.toISOString());

      // 2. Fetch Today's Expenses
      const { data: expenseData } = await supabase
        .from('expenses')
        .select('amount')
        .gte('created_at', today.toISOString());

      // 3. Fetch Low Stock Items
      const { count: lowStock } = await supabase
        .from('inventory')
        .select('*', { count: 'exact', head: true })
        .lt('stock_quantity', 5);

      if (salesData) {
        const revenue = salesData
          .filter(s => s.payment_status === 'paid')
          .reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
        
        const debt = salesData
          .filter(s => s.payment_status === 'debt')
          .reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);

        const expenses = expenseData?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

        setStats({
          totalRevenue: revenue,
          totalDebt: debt,
          lowStockCount: lowStock || 0,
          totalExpenses: expenses
        });
      }
    } catch (error) {
      console.error("Metrics engine connection failed:", error.message);
    }
  };

  // --- ROUTING MATRIX ENGINE ---
  if (view !== 'menu') {
    const Component = {
      inventory: Inventory,
      reports: Reports,
      sales: Sales,
      staff: StaffManagement,
      debtors: Debtors,
      performance: StaffPerformance,
      expenses: Expenses
    }[view];
    
    if (!Component) {
      return (
        <div className="p-8 text-center bg-[#F4F3ED] min-h-screen flex flex-col justify-center items-center font-sans">
          <p className="text-[#FF5A50] font-bold mb-4">View component could not be resolved cleanly.</p>
          <button onClick={() => setView('menu')} className="bg-[#1C1B1F] text-white px-6 py-3 rounded-2xl text-xs uppercase font-bold tracking-wider">Return to Dashboard</button>
        </div>
      );
    }
    return <Component onBack={() => setView('menu')} />;
  }

  return (
    <div className="min-h-screen bg-[#F4F3ED] text-[#111111] p-4 md:p-8 font-sans antialiased">
      <div className="max-w-5xl mx-auto">
        
        {/* --- PREMIUM CEO HEADER WITH ACCOUNT DROPDOWN --- */}
        <div className="flex justify-between items-center mb-8 mt-4 relative">
          <div>
            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">
              {t('executive_suite')}
            </p>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-[#111111]">
              Don Chike <span className="text-[#3F51B5]">Elite</span>
            </h1>
          </div>
          
          {/* HEADER CONTROLS */}
          <div className="flex items-center gap-3" ref={dropdownRef}>
            <button 
              onClick={() => toggleLanguage()} 
              className="bg-white border border-slate-200 px-3.5 py-2.5 rounded-2xl hover:bg-slate-50 transition-all active:scale-95 shadow-sm hidden sm:block"
            >
              <span className="font-bold text-xs tracking-tight text-slate-700">
                {language === 'en' ? '🇬🇧 EN' : '🇫🇷 FR'}
              </span>
            </button>

            {/* INTERACTIVE PROFILE AVATAR TRIGGER */}
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 bg-white border border-slate-200 p-1.5 pr-4 rounded-full hover:bg-slate-50 transition-all active:scale-98 shadow-sm"
            >
              <div className="h-9 w-9 rounded-full bg-[#3F51B5] text-white font-black text-sm flex items-center justify-center uppercase shadow-inner">
                {userProfile.name.charAt(0)}
              </div>
              <div className="text-left hidden md:block">
                <p className="text-xs font-bold leading-tight text-slate-800">{userProfile.name}</p>
                <p className="text-[10px] font-medium text-slate-400">Administrator</p>
              </div>
              <span className="text-xs text-slate-400 ml-1">▼</span>
            </button>

            {/* MODERN ACCORDION / POPUP CARD DROP MENU */}
            {isProfileOpen && (
              <div className="absolute right-0 top-16 w-64 bg-white border border-slate-100 rounded-[24px] shadow-xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="pb-3 border-b border-slate-100">
                  <p className="text-xs font-black text-slate-800 truncate">{userProfile.name}</p>
                  <p className="text-[11px] font-medium text-slate-400 truncate mt-0.5">{userProfile.email}</p>
                </div>
                
                <div className="pt-2 flex flex-col gap-1">
                  {/* MOBILE COMPLIANT NATIVE LANGUAGE SWITCH */}
                  <button 
                    onClick={() => {
                      toggleLanguage();
                      setIsProfileOpen(false); // Instantly closes drop panel on responsive taps
                    }}
                    className="sm:hidden flex w-full text-left px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors items-center gap-2"
                  >
                    <span>🌐</span> {language === 'en' ? 'Passer en Français (FR)' : 'Switch to English (EN)'}
                  </button>
                  
                  <button 
                    onClick={() => supabase.auth.signOut()} 
                    className="w-full text-left px-3 py-2.5 text-xs font-bold text-[#FF5A50] hover:bg-red-50 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <span>🚪</span> {t('sign_out')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* --- LUXURY METRICS PILLS --- */}
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-8">
          <div className="bg-white p-4 rounded-[24px] shadow-sm border border-slate-100 flex flex-col justify-between min-h-[100px]">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('true_balance')}</p>
            <p className="text-base md:text-xl font-extrabold text-emerald-600 tracking-tight">
              {(stats.totalRevenue - stats.totalExpenses).toLocaleString()} <span className="text-[9px] font-bold text-slate-400 block sm:inline">FCFA</span>
            </p>
          </div>

          <div className="bg-white p-4 rounded-[24px] shadow-sm border border-slate-100 flex flex-col justify-between min-h-[100px]">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('daily_expenses')}</p>
            <p className="text-base md:text-xl font-extrabold text-slate-800 tracking-tight">
              -{stats.totalExpenses.toLocaleString()} <span className="text-[9px] font-bold text-slate-400 block sm:inline">FCFA</span>
            </p>
          </div>

          <div className={`p-4 rounded-[24px] transition-all flex flex-col justify-between min-h-[100px] border ${
            stats.lowStockCount > 0 
              ? 'bg-[#FFEBEA] border-[#FFD0CD] animate-pulse' 
              : 'bg-white border-slate-100 shadow-sm'
          }`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${stats.lowStockCount > 0 ? 'text-[#FF5A50]' : 'text-slate-400'}`}>{t('stock_alerts')}</p>
            <p className={`text-base md:text-xl font-extrabold tracking-tight ${stats.lowStockCount > 0 ? 'text-[#FF5A50]' : 'text-slate-800'}`}>
              {stats.lowStockCount} <span className="text-[10px] font-medium opacity-60 normal-case">{t('items')}</span>
            </p>
          </div>
        </div>

        {/* --- RE-ARCHITECTED MODERN NAVIGATION GRID --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Inventory Card */}
          <button 
            onClick={() => setView('inventory')} 
            className={`group relative p-6 md:p-8 rounded-[28px] overflow-hidden transition-all hover:scale-[1.01] active:scale-98 shadow-sm text-left border ${
              stats.lowStockCount > 0 
                ? 'bg-gradient-to-br from-[#FF5A50] to-[#E53935] text-white border-transparent' 
                : 'bg-white text-[#111111] border-slate-100'
            }`}
          >
            <div className="relative z-10 flex flex-col h-full justify-between">
              <span className="text-2xl bg-slate-100 group-hover:scale-110 transition-transform p-3 rounded-2xl w-fit inline-block mb-4 shadow-sm dark:bg-white/10">📦</span>
              <div>
                <h3 className="text-lg font-extrabold tracking-tight">{t('gestion_stock')}</h3>
                <p className={`text-[11px] mt-0.5 font-medium uppercase tracking-wider ${stats.lowStockCount > 0 ? 'text-white/80' : 'text-slate-400'}`}>{t('global_stock')}</p>
              </div>
            </div>
          </button>

          {/* Expense Management Card */}
          <button 
            onClick={() => setView('expenses')} 
            className="bg-white border border-slate-100 p-6 md:p-8 rounded-[28px] transition-all hover:scale-[1.01] active:scale-98 text-left group shadow-sm"
          >
            <div className="flex flex-col h-full justify-between">
              <span className="text-2xl bg-red-50 p-3 rounded-2xl w-fit inline-block mb-4 shadow-sm">💸</span>
              <div>
                <h3 className="text-lg font-extrabold tracking-tight text-slate-900">{t('business_expenses')}</h3>
                <p className="text-slate-400 text-[11px] mt-0.5 font-medium uppercase tracking-wider">{t('log_costs')}</p>
              </div>
            </div>
          </button>

          {/* Debtor Ledger */}
          <button 
            onClick={() => setView('debtors')} 
            className="bg-white border border-slate-100 p-6 md:p-8 rounded-[28px] transition-all hover:scale-[1.01] active:scale-98 text-left group shadow-sm"
          >
            <div className="flex flex-col h-full justify-between">
              <span className="text-2xl bg-amber-50 p-3 rounded-2xl w-fit inline-block mb-4 shadow-sm">💳</span>
              <div>
                <h3 className="text-lg font-extrabold tracking-tight text-slate-900">{t('debtor_ledger')}</h3>
                <p className="text-slate-400 text-[11px] mt-0.5 font-medium uppercase tracking-wider">{t('unpaid_tabs')}</p>
              </div>
            </div>
          </button>

          {/* Sales Terminal */}
          <button 
            onClick={() => setView('sales')} 
            className="bg-white border border-slate-100 p-6 md:p-8 rounded-[28px] transition-all hover:scale-[1.01] active:scale-98 text-left group shadow-sm"
          >
            <div className="flex flex-col h-full justify-between">
              <span className="text-2xl bg-blue-50 p-3 rounded-2xl w-fit inline-block mb-4 shadow-sm">🛒</span>
              <div>
                <h3 className="text-lg font-extrabold tracking-tight text-slate-900">{t('sales_terminal')}</h3>
                <p className="text-slate-400 text-[11px] mt-0.5 font-medium uppercase tracking-wider">{t('register_counters')}</p>
              </div>
            </div>
          </button>

          {/* Staff Management Access Hub */}
          <button 
            onClick={() => setView('staff')} 
            className="bg-white border border-slate-100 p-6 md:p-8 rounded-[28px] transition-all hover:scale-[1.01] active:scale-98 text-left group shadow-sm"
          >
            <div className="flex flex-col h-full justify-between">
              <span className="text-2xl bg-purple-50 p-3 rounded-2xl w-fit inline-block mb-4 shadow-sm">🔑</span>
              <div>
                <h3 className="text-lg font-extrabold tracking-tight text-slate-900">{t('staff_access')}</h3>
                <p className="text-slate-400 text-[11px] mt-0.5 font-medium uppercase tracking-wider">{t('account_provisioning')}</p>
              </div>
            </div>
          </button>

          {/* Staff Performance Metrics */}
          <button 
            onClick={() => setView('performance')} 
            className="bg-white border border-slate-100 p-6 md:p-8 rounded-[28px] transition-all hover:scale-[1.01] active:scale-98 text-left group shadow-sm"
          >
            <div className="flex flex-col h-full justify-between">
              <span className="text-2xl bg-indigo-50 p-3 rounded-2xl w-fit inline-block mb-4 shadow-sm">📊</span>
              <div>
                <h3 className="text-lg font-extrabold tracking-tight text-slate-900">{t('staff_performance')}</h3>
                <p className="text-slate-400 text-[11px] mt-0.5 font-medium uppercase tracking-wider">{t('shift_closeouts')}</p>
              </div>
            </div>
          </button>

          {/* Business Intelligence / Profit Intel */}
          <button 
            onClick={() => setView('reports')} 
            className="bg-white border border-slate-100 p-6 md:p-8 rounded-[28px] transition-all hover:scale-[1.01] active:scale-98 text-left md:col-span-2 group shadow-sm"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <span className="text-2xl bg-emerald-50 p-3 rounded-2xl w-fit inline-block shadow-sm">📈</span>
                <div>
                  <h3 className="text-lg font-extrabold tracking-tight text-slate-900">{t('profit_engine')}</h3>
                  <p className="text-slate-400 text-[11px] mt-0.5 font-medium uppercase tracking-wider">{t('growth_analytics')}</p>
                </div>
              </div>
              <span className="text-xs font-bold text-[#3F51B5] bg-indigo-50/50 px-4 py-2 rounded-xl border border-indigo-100/50 w-fit sm:inline-block hidden">
                {t('review_financials')}
              </span>
            </div>
          </button>

        </div>

        {/* Padding Bottom spacer */}
        <div className="h-16"></div>
        
      </div>
    </div>
  );
}