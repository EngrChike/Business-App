import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Crown, 
  Globe, 
  LogOut, 
  ChevronDown, 
  Loader2, 
  AlertTriangle, 
  Package, 
  Receipt, 
  Warehouse, 
  ShoppingCart, 
  BarChart3, 
  Users, 
  TrendingUp, 
  Wallet, 
  Boxes,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx'; 
import { useAuth } from '../context/AuthContext.jsx'; 
import { supabase } from '../api/supabaseClient.js'; 

// Sub-views
import BulkStock from '../views/admin/BulkStock.jsx';
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
  bulkstock: BulkStock,
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
    bulkStockCount: 0, 
    lowBulkStockCount: 0,
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
      
      const bulkStockQuery = supabase.from('bulk_inventory').select('*', { count: 'exact', head: true });
      const lowBulkStockQuery = supabase.from('bulk_inventory').select('*', { count: 'exact', head: true }).lte('package_quantity', 3);

      const [salesRes, expenseRes, inventoryRes, bulkStockRes, lowBulkStockRes] = await Promise.all([
        salesQuery,
        expenseQuery,
        inventoryQuery,
        bulkStockQuery,
        lowBulkStockQuery
      ]);

      const salesData = salesRes.data || [];
      const expenseData = expenseRes.data || [];
      const lowStock = inventoryRes.count || 0;
      const bulkCount = bulkStockRes.count || 0;
      const lowBulkCount = lowBulkStockRes.count || 0;

      const revenue = salesData
        .filter(s => s.payment_status === 'paid')
        .reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);

      const expenses = expenseData.reduce((sum, e) => sum + Number(e.amount), 0);

      setStats({
        totalRevenue: revenue,
        bulkStockCount: bulkCount,
        lowBulkStockCount: lowBulkCount,
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
      <div className="min-h-screen bg-[#F4F3ED] flex flex-col items-center justify-center font-sans gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <div className="text-xs font-black text-slate-500 tracking-widest uppercase">
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
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <p className="text-red-600 font-extrabold mb-4 text-sm">View component could not be resolved cleanly.</p>
          <button 
            onClick={handleBackToMenu} 
            className="bg-slate-950 text-white px-6 py-3 rounded-2xl text-xs uppercase font-black tracking-wider hover:bg-slate-800 transition-all active:scale-95 shadow-md"
          >
            Return to Dashboard
          </button>
        </div>
      );
    }
    
    return <Component onBack={handleBackToMenu} branchId={branchId} refreshMetrics={fetchAdminMetrics} />;
  }

  const netBalance = stats.totalRevenue - stats.totalExpenses;

  return (
    <div className="min-h-screen bg-[#F4F3ED] text-slate-900 p-4 md:p-8 font-sans antialiased selection:bg-indigo-600 selection:text-white">
      <div className="max-w-5xl mx-auto">
        
        {/* EXECUTIVE HEADER */}
        <div className="flex justify-between items-center mb-8 mt-2 relative">
          <div>
            <p className="text-indigo-600 font-black text-[10px] uppercase tracking-[0.2em] mb-1 flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>Global Head Office Terminal</span>
            </p>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-950">
              Executive <span className="text-indigo-600">HQ Station</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-3" ref={dropdownRef}>
            {/* Language Switcher Button */}
            <button 
              type="button"
              onClick={() => toggleLanguage()} 
              className="bg-white/90 border border-slate-200/80 px-4 py-2.5 rounded-2xl hover:bg-slate-100/80 transition-all active:scale-95 shadow-sm hidden sm:flex items-center gap-2 font-black text-xs text-slate-700 tracking-wider"
            >
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              <span>{language === 'en' ? '🇬🇧 EN' : '🇫🇷 FR'}</span>
            </button>

            {/* User Profile Capsule Trigger */}
            <button 
              type="button"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2.5 bg-white border border-slate-200/80 p-1.5 pr-4 rounded-full hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
            >
              <div className="h-9 w-9 rounded-full bg-slate-950 text-amber-400 font-black text-sm flex items-center justify-center uppercase shadow-inner border border-slate-800">
                {user?.user_metadata?.full_name?.charAt(0) || 'A'}
              </div>
              <div className="text-left hidden md:block">
                <p className="text-xs font-bold leading-tight text-slate-900 truncate max-w-[120px]">
                  {user?.user_metadata?.full_name || 'Administrator'}
                </p>
                <p className="text-[10px] font-medium text-slate-400 capitalize">Master Control</p>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Floating Executive Profile Dropdown Menu */}
            {isProfileOpen && (
              <div className="absolute right-0 top-16 w-64 bg-white/95 backdrop-blur-md border border-slate-100 rounded-[28px] shadow-xl p-4 z-50 animate-fade-in">
                <div className="pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 mb-1 text-emerald-600">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-black uppercase tracking-wider">Terminal Level: Global Admin</span>
                  </div>
                  <p className="text-xs font-black text-slate-900 truncate">{user?.user_metadata?.full_name || 'Administrator'}</p>
                  <p className="text-[11px] font-medium text-slate-400 truncate mt-0.5">{user?.email}</p>
                </div>
                
                <div className="pt-2 flex flex-col gap-1">
                  <button 
                    type="button"
                    onClick={() => {
                      toggleLanguage();
                      setIsProfileOpen(false); 
                    }}
                    className="sm:hidden flex w-full text-left px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100/70 rounded-xl transition-colors items-center gap-2.5"
                  >
                    <Globe className="w-4 h-4 text-slate-500" />
                    <span>{language === 'en' ? 'Passer en Français (FR)' : 'Switch to English (EN)'}</span>
                  </button>
                  
                  <button 
                    type="button"
                    onClick={() => signOut()} 
                    className="w-full text-left px-3 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50/80 rounded-xl transition-colors flex items-center gap-2.5"
                  >
                    <LogOut className="w-4 h-4 text-red-500" />
                    <span>{t('sign_out') || 'Sign Out'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* METRICS SUMMARY CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-8">
          {/* Card 1: Net Balance */}
          <div className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100 flex flex-col justify-between min-h-[110px] relative overflow-hidden group hover:border-emerald-200 transition-colors">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total HQ Net Balance</p>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl md:text-2xl font-black text-emerald-600 tracking-tight mt-2">
              {netBalance.toLocaleString()} <span className="text-[10px] font-bold text-slate-400">FCFA</span>
            </p>
          </div>

          {/* Card 2: HQ Expenses */}
          <div className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100 flex flex-col justify-between min-h-[110px] relative overflow-hidden group hover:border-red-200 transition-colors">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total HQ Expenses</p>
              <div className="w-8 h-8 rounded-xl bg-red-50 text-red-500 flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-2">
              -{stats.totalExpenses.toLocaleString()} <span className="text-[10px] font-bold text-slate-400">FCFA</span>
            </p>
          </div>

          {/* Card 3: Active Bulk Batches */}
          <div className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100 flex flex-col justify-between min-h-[110px] relative overflow-hidden group hover:border-indigo-200 transition-colors">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Bulk Batches</p>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Boxes className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-2">
              {stats.bulkStockCount} <span className="text-[10px] font-semibold text-slate-400 normal-case">Batches</span>
            </p>
          </div>
        </div>

        {/* MAIN MODULE NAVIGATION GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Module 1: Global Inventory Master */}
          <button 
            type="button"
            onClick={() => setView('inventory')} 
            className={`group relative p-6 md:p-8 rounded-[28px] overflow-hidden transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] shadow-sm text-left border ${
              stats.lowStockCount > 0 
                ? 'bg-gradient-to-br from-red-500 via-red-600 to-rose-700 text-white border-transparent shadow-red-500/20' 
                : 'bg-white text-slate-900 border-slate-100 hover:border-indigo-200'
            }`}
          >
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div className="flex justify-between items-start mb-6">
                <div className={`p-3.5 rounded-2xl w-fit transition-transform group-hover:scale-110 ${
                  stats.lowStockCount > 0 ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-800'
                }`}>
                  <Package className="w-6 h-6" />
                </div>
                <ArrowUpRight className={`w-5 h-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${
                  stats.lowStockCount > 0 ? 'text-white/70' : 'text-slate-400'
                }`} />
              </div>
              
              <div>
                <h3 className="text-lg font-black tracking-tight">Global Inventory Master</h3>
                <p className={`text-[11px] mt-1 font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  stats.lowStockCount > 0 ? 'text-white/90 animate-pulse' : 'text-slate-400'
                }`}>
                  {stats.lowStockCount > 0 ? (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{stats.lowStockCount} Cooked Items Low</span>
                    </>
                  ) : (
                    'Monitor System Stock'
                  )}
                </p>
              </div>
            </div>
          </button>

          {/* Module 2: HQ & Branch Costs */}
          <button 
            type="button"
            onClick={() => setView('expenses')} 
            className="bg-white border border-slate-100 hover:border-red-200 p-6 md:p-8 rounded-[28px] transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] text-left group shadow-sm"
          >
            <div className="flex flex-col h-full justify-between">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3.5 rounded-2xl w-fit bg-red-50 text-red-500 transition-transform group-hover:scale-110">
                  <Receipt className="w-6 h-6" />
                </div>
                <ArrowUpRight className="w-5 h-5 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight text-slate-900">HQ & Branch Costs</h3>
                <p className="text-slate-400 text-[11px] mt-1 font-bold uppercase tracking-wider">Log Corporate Expenses</p>
              </div>
            </div>
          </button>

          {/* Module 3: Bulk Stock Inventory (Dynamic Critical Alert State) */}
          <button 
            type="button"
            onClick={() => setView('bulkstock')} 
            className={`p-6 md:p-8 rounded-[28px] transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] text-left group shadow-sm border ${
              stats.lowBulkStockCount > 0 
                ? 'bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 text-white border-transparent shadow-amber-500/20' 
                : 'bg-white text-slate-900 border-slate-100 hover:border-amber-200'
            }`}
          >
            <div className="flex flex-col h-full justify-between">
              <div className="flex justify-between items-start mb-6">
                <div className={`p-3.5 rounded-2xl w-fit transition-transform group-hover:scale-110 ${
                  stats.lowBulkStockCount > 0 ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-600'
                }`}>
                  <Warehouse className="w-6 h-6" />
                </div>
                <ArrowUpRight className={`w-5 h-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${
                  stats.lowBulkStockCount > 0 ? 'text-white/70' : 'text-slate-400'
                }`} />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight">Bulk Stock Inventory</h3>
                <p className={`text-[11px] mt-1 font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  stats.lowBulkStockCount > 0 ? 'text-white/95 animate-pulse' : 'text-slate-400'
                }`}>
                  {stats.lowBulkStockCount > 0 ? (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{stats.lowBulkStockCount} Raw Ingredients Critical</span>
                    </>
                  ) : (
                    'Manage Wholesale Packages'
                  )}
                </p>
              </div>
            </div>
          </button>

          {/* Module 4: Master Sales Counter */}
          <button 
            type="button"
            onClick={() => setView('sales')} 
            className="bg-white border border-slate-100 hover:border-blue-200 p-6 md:p-8 rounded-[28px] transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] text-left group shadow-sm"
          >
            <div className="flex flex-col h-full justify-between">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3.5 rounded-2xl w-fit bg-blue-50 text-blue-600 transition-transform group-hover:scale-110">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <ArrowUpRight className="w-5 h-5 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight text-slate-900">Master Sales Counter</h3>
                <p className="text-slate-400 text-[11px] mt-1 font-bold uppercase tracking-wider">Open Administrative Register</p>
              </div>
            </div>
          </button>

          {/* Module 5: Staff Audits & Closeouts */}
          <button 
            type="button"
            onClick={() => setView('performance')} 
            className="bg-white border border-slate-100 hover:border-indigo-200 p-6 md:p-8 rounded-[28px] transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] text-left group shadow-sm"
          >
            <div className="flex flex-col h-full justify-between">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3.5 rounded-2xl w-fit bg-indigo-50 text-indigo-600 transition-transform group-hover:scale-110">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <ArrowUpRight className="w-5 h-5 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight text-slate-900">Staff Audits & Closeouts</h3>
                <p className="text-slate-400 text-[11px] mt-1 font-bold uppercase tracking-wider">Cross-Reference Active Shifts</p>
              </div>
            </div>
          </button>

          {/* Module 6: Corporate Roster */}
          <button 
            type="button"
            onClick={() => setView('staff')} 
            className="bg-white border border-slate-100 hover:border-purple-200 p-6 md:p-8 rounded-[28px] transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] text-left group shadow-sm"
          >
            <div className="flex flex-col h-full justify-between">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3.5 rounded-2xl w-fit bg-purple-50 text-purple-600 transition-transform group-hover:scale-110">
                  <Users className="w-6 h-6" />
                </div>
                <ArrowUpRight className="w-5 h-5 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight text-slate-900">Corporate Roster</h3>
                <p className="text-slate-400 text-[11px] mt-1 font-bold uppercase tracking-wider">Manage Active Staff Clusters</p>
              </div>
            </div>
          </button>

          {/* Module 7: Global System Analytics (Full-Width Span) */}
          <button 
            type="button"
            onClick={() => setView('reports')} 
            className="bg-white border border-slate-100 hover:border-emerald-200 p-6 md:p-8 rounded-[28px] transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] text-left md:col-span-2 group shadow-sm"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-600 transition-transform group-hover:scale-110 shrink-0">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight text-slate-900">Global System Analytics</h3>
                  <p className="text-slate-400 text-[11px] mt-0.5 font-bold uppercase tracking-wider">Core Venture Performance Engine</p>
                </div>
              </div>

              <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-4 py-2.5 rounded-2xl border border-indigo-100/60 w-fit sm:flex items-center gap-1.5 hidden group-hover:bg-indigo-600 group-hover:text-white transition-all">
                <span>Review Deep Financials</span>
                <ArrowUpRight className="w-4 h-4" />
              </span>
            </div>
          </button>

        </div>

        <div className="h-16"></div>
      </div>
    </div>
  );
}