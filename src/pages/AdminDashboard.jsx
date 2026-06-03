import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx'; 
import { useAuth } from '../context/AuthContext.jsx'; 
import { supabase } from '../api/supabaseClient.js'; 

// Sub-views
import BulkStock from '../views/admin/BulkStock.jsx'; // Swapped view module reference
import Expenses from '../views/admin/Expenses.jsx';
import Inventory from '../views/admin/Inventory.jsx';
import Reports from '../views/admin/Reports.jsx';
import StaffManagement from '../views/admin/StaffManagement.jsx';
import StaffPerformance from '../views/admin/StaffPerformance.jsx';
import Sales from '../views/staff/Sales.jsx';

// Static View Dictionary
const VIEW_COMPONENTS = {
  inventory: Inventory,
  reports: Reports,
  sales: Sales,
  staff: StaffManagement,
  bulkstock: BulkStock, // Remapped cleanly to capture bulk warehouse files
  performance: StaffPerformance,
  expenses: Expenses
};

export default function AdminDashboard() {
  const { language, toggleLanguage, t } = useLanguage(); 
  const { user, branchId, loading: authLoading, signOut } = useAuth();
  const [view, setView] = useState('menu');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [stats, setStats] = useState({
    totalRevenue: 0,
    bulkStockCount: 0, // Swapped variable
    lowStockCount: 0,
    totalExpenses: 0
  });

  const handleBackToMenu = useCallback(() => {
    setView('menu');
  }, []);

  const fetchAdminMetrics = useCallback(async () => {
    try {
      const today = new Date();
      today.setHours(0,0,0,0);

      const salesQuery = supabase.from('sales').select('total_amount, payment_status').gte('created_at', today.toISOString());
      const expenseQuery = supabase.from('expenses').select('amount').gte('created_at', today.toISOString());
      const inventoryQuery = supabase.from('inventory').select('*', { count: 'exact', head: true }).lt('stock_quantity', 5);
      
      // Query exact batch counts inside the new Bulk Stock ledger
      const bulkStockQuery = supabase.from('bulk_inventory').select('*', { count: 'exact', head: true });

      const [salesRes, expenseRes, inventoryRes, bulkStockRes] = await Promise.all([
        salesQuery,
        expenseQuery,
        inventoryQuery,
        bulkStockQuery
      ]);

      const salesData = salesRes.data || [];
      const expenseData = expenseRes.data || [];
      const lowStock = inventoryRes.count || 0;
      const bulkCount = bulkStockRes.count || 0;

      const revenue = salesData
        .filter(s => s.payment_status === 'paid')
        .reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);

      const expenses = expenseData.reduce((sum, e) => sum + Number(e.amount), 0);

      setStats({
        totalRevenue: revenue,
        bulkStockCount: bulkCount,
        lowStockCount: lowStock,
        totalExpenses: expenses
      });
    } catch (error) {
      console.error("Global HQ metrics engine data failure:", error.message);
    }
  }, []);

  useEffect(() => {
    if (view === 'menu' && !authLoading) {
      fetchAdminMetrics();
    }

    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [view, authLoading, fetchAdminMetrics]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F4F3ED] flex items-center justify-center font-sans">
        <div className="text-xs font-bold text-slate-500 animate-pulse tracking-widest uppercase">
          Loading Global HQ Operational Parameters...
        </div>
      </div>
    );
  }

  if (view !== 'menu') {
    const Component = VIEW_COMPONENTS[view];
    
    if (!Component) {
      return (
        <div className="p-8 text-center bg-[#F4F3ED] min-h-screen flex flex-col justify-center items-center font-sans">
          <p className="text-[#FF5A50] font-bold mb-4">View component could not be resolved cleanly.</p>
          <button onClick={handleBackToMenu} className="bg-[#1C1B1F] text-white px-6 py-3 rounded-2xl text-xs uppercase font-bold tracking-wider">Return to Dashboard</button>
        </div>
      );
    }
    
    return <Component onBack={handleBackToMenu} branchId={branchId} refreshMetrics={fetchAdminMetrics} />;
  }

  return (
    <div className="min-h-screen bg-[#F4F3ED] text-[#111111] p-4 md:p-8 font-sans antialiased">
      <div className="max-w-5xl mx-auto">
        
        {/* EXECUTIVE HEADER */}
        <div className="flex justify-between items-center mb-8 mt-4 relative">
          <div>
            <p className="text-[#3F51B5] font-bold text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1">
              👑 Global Head Office Terminal
            </p>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-[#111111]">
              Executive <span className="text-slate-600">HQ Station</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-3" ref={dropdownRef}>
            <button 
              onClick={() => toggleLanguage()} 
              className="bg-white border border-slate-200 px-3.5 py-2.5 rounded-2xl hover:bg-slate-50 transition-all active:scale-95 shadow-sm hidden sm:block"
            >
              <span className="font-bold text-xs tracking-tight text-slate-700">
                {language === 'en' ? '🇬🇧 EN' : '🇫🇷 FR'}
              </span>
            </button>

            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 bg-white border border-slate-200 p-1.5 pr-4 rounded-full hover:bg-slate-50 transition-all active:scale-98 shadow-sm"
            >
              <div className="h-9 w-9 rounded-full bg-slate-800 text-white font-black text-sm flex items-center justify-center uppercase shadow-inner">
                {user?.user_metadata?.full_name?.charAt(0) || 'A'}
              </div>
              <div className="text-left hidden md:block">
                <p className="text-xs font-bold leading-tight text-slate-800">{user?.user_metadata?.full_name || 'Administrator'}</p>
                <p className="text-[10px] font-medium text-slate-400 capitalize">Master Control</p>
              </div>
              <span className="text-xs text-slate-400 ml-1">▼</span>
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 top-16 w-64 bg-white border border-slate-100 rounded-[24px] shadow-xl p-4 z-50">
                <div className="pb-3 border-b border-slate-100">
                  <p className="text-xs font-black text-slate-800 truncate">{user?.user_metadata?.full_name || 'Administrator'}</p>
                  <p className="text-[11px] font-medium text-slate-400 truncate mt-0.5">{user?.email}</p>
                  <p className="text-[9px] font-black text-emerald-600 uppercase tracking-wider mt-1">Terminal Level: Global Admin</p>
                </div>
                
                <div className="pt-2 flex flex-col gap-1">
                  <button 
                    onClick={() => {
                      toggleLanguage();
                      setIsProfileOpen(false); 
                    }}
                    className="sm:hidden flex w-full text-left px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors items-center gap-2"
                  >
                    <span>🌐</span> {language === 'en' ? 'Passer en Français (FR)' : 'Switch to English (EN)'}
                  </button>
                  
                  <button 
                    onClick={() => signOut()} 
                    className="w-full text-left px-3 py-2.5 text-xs font-bold text-[#FF5A50] hover:bg-red-50 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <span>🚪</span> {t('sign_out') || 'Sign Out'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* METRICS PILLS */}
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-8">
          <div className="bg-white p-4 rounded-[24px] shadow-sm border border-slate-100 flex flex-col justify-between min-h-[100px]">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total HQ Net Balance</p>
            <p className="text-base md:text-xl font-extrabold text-emerald-600 tracking-tight">
              {(stats.totalRevenue - stats.totalExpenses).toLocaleString()} <span className="text-[9px] font-bold text-slate-400 block sm:inline">FCFA</span>
            </p>
          </div>

          <div className="bg-white p-4 rounded-[24px] shadow-sm border border-slate-100 flex flex-col justify-between min-h-[100px]">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total HQ Expenses</p>
            <p className="text-base md:text-xl font-extrabold text-slate-800 tracking-tight">
              -{stats.totalExpenses.toLocaleString()} <span className="text-[9px] font-bold text-slate-400 block sm:inline">FCFA</span>
            </p>
          </div>

          <div className="bg-white border-slate-100 p-4 rounded-[24px] shadow-sm flex flex-col justify-between min-h-[100px]">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Bulk Batches</p>
            <p className="text-base md:text-xl font-extrabold tracking-tight text-slate-800">
              {stats.bulkStockCount} <span className="text-[10px] font-medium opacity-60 normal-case">Batches</span>
            </p>
          </div>
        </div>

        {/* NAVIGATION GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button 
            onClick={() => setView('inventory')} 
            className={`group relative p-6 md:p-8 rounded-[28px] overflow-hidden transition-all hover:scale-[1.01] active:scale-98 shadow-sm text-left border ${
              stats.lowStockCount > 0 ? 'bg-gradient-to-br from-[#FF5A50] to-[#E53935] text-white border-transparent' : 'bg-white text-[#111111] border-slate-100'
            }`}
          >
            <div className="relative z-10 flex flex-col h-full justify-between">
              <span className="text-2xl bg-slate-100 group-hover:scale-110 transition-transform p-3 rounded-2xl w-fit inline-block mb-4 shadow-sm">📦</span>
              <div>
                <h3 className="text-lg font-extrabold tracking-tight">Global Inventory Master</h3>
                <p className={`text-[11px] mt-0.5 font-medium uppercase tracking-wider ${stats.lowStockCount > 0 ? 'text-white/80' : 'text-slate-400'}`}>Monitor System Stock</p>
              </div>
            </div>
          </button>

          <button 
            onClick={() => setView('expenses')} 
            className="bg-white border border-slate-100 p-6 md:p-8 rounded-[28px] transition-all hover:scale-[1.01] active:scale-98 text-left group shadow-sm"
          >
            <div className="flex flex-col h-full justify-between">
              <span className="text-2xl bg-red-50 p-3 rounded-2xl w-fit inline-block mb-4 shadow-sm">💸</span>
              <div>
                <h3 className="text-lg font-extrabold tracking-tight text-slate-900">HQ & Branch Costs</h3>
                <p className="text-slate-400 text-[11px] mt-0.5 font-medium uppercase tracking-wider">Log Corporate Expenses</p>
              </div>
            </div>
          </button>

          {/* TRANSFORMATION MODULE: Swapped Debtor Ledger with Bulk Stock Supply Framework */}
          <button 
            onClick={() => setView('bulkstock')} 
            className="bg-white border border-slate-100 p-6 md:p-8 rounded-[28px] transition-all hover:scale-[1.01] active:scale-98 text-left group shadow-sm"
          >
            <div className="flex flex-col h-full justify-between">
              <span className="text-2xl bg-amber-50 p-3 rounded-2xl w-fit inline-block mb-4 shadow-sm">🏭</span>
              <div>
                <h3 className="text-lg font-extrabold tracking-tight text-slate-900">Bulk Stock Inventory</h3>
                <p className="text-slate-400 text-[11px] mt-0.5 font-medium uppercase tracking-wider">Manage Wholesale Packages</p>
              </div>
            </div>
          </button>

          <button 
            onClick={() => setView('sales')} 
            className="bg-white border border-slate-100 p-6 md:p-8 rounded-[28px] transition-all hover:scale-[1.01] active:scale-98 text-left group shadow-sm"
          >
            <div className="flex flex-col h-full justify-between">
              <span className="text-2xl bg-blue-50 p-3 rounded-2xl w-fit inline-block mb-4 shadow-sm">🛒</span>
              <div>
                <h3 className="text-lg font-extrabold tracking-tight text-slate-900">Master Sales Counter</h3>
                <p className="text-slate-400 text-[11px] mt-0.5 font-medium uppercase tracking-wider">Open Administrative Register</p>
              </div>
            </div>
          </button>

          <button 
            onClick={() => setView('performance')} 
            className="bg-white border border-slate-100 p-6 md:p-8 rounded-[28px] transition-all hover:scale-[1.01] active:scale-98 text-left group shadow-sm"
          >
            <div className="flex flex-col h-full justify-between">
              <span className="text-2xl bg-indigo-50 p-3 rounded-2xl w-fit inline-block mb-4 shadow-sm">📊</span>
              <div>
                <h3 className="text-lg font-extrabold tracking-tight text-slate-900">Staff Audits & Closeouts</h3>
                <p className="text-slate-400 text-[11px] mt-0.5 font-medium uppercase tracking-wider">Cross-Reference Active Shifts</p>
              </div>
            </div>
          </button>

          <button 
            onClick={() => setView('staff')} 
            className="bg-white border border-slate-100 p-6 md:p-8 rounded-[28px] transition-all hover:scale-[1.01] active:scale-98 text-left group shadow-sm"
          >
            <div className="flex flex-col h-full justify-between">
              <span className="text-2xl bg-[#FFEBEA]/40 p-3 rounded-2xl w-fit inline-block shadow-sm">🏢</span>
              <div>
                <h3 className="text-lg font-extrabold tracking-tight text-slate-900">Corporate Roster</h3>
                <p className="text-slate-400 text-[11px] mt-0.5 font-medium uppercase tracking-wider">Manage Active Staff Clusters</p>
              </div>
            </div>
          </button>

          <button 
            onClick={() => setView('reports')} 
            className="bg-white border border-slate-100 p-6 md:p-8 rounded-[28px] transition-all hover:scale-[1.01] active:scale-98 text-left md:col-span-2 group shadow-sm"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <span className="text-2xl bg-emerald-50 p-3 rounded-2xl w-fit inline-block shadow-sm">📈</span>
                <div>
                  <h3 className="text-lg font-extrabold tracking-tight text-slate-900">Global System Analytics</h3>
                  <p className="text-slate-400 text-[11px] mt-0.5 font-medium uppercase tracking-wider">Core Venture Performance Engine</p>
                </div>
              </div>
              <span className="text-xs font-bold text-[#3F51B5] bg-indigo-50/50 px-4 py-2 rounded-xl border border-indigo-100/50 w-fit sm:inline-block hidden">
                Review Deep Financials
              </span>
            </div>
          </button>
        </div>

        <div className="h-16"></div>
      </div>
    </div>
  );
}