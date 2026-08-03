// src/pages/ManagerDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Warehouse, 
  ShoppingCart, 
  Package, 
  Receipt, 
  LogOut, 
  MapPin, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ShieldAlert, 
  AlertTriangle, 
  ChevronRight, 
  Loader2,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext.jsx';
import { supabase } from '../api/supabaseClient';

import Sales from '../views/staff/Sales';
import Inventory from '../views/admin/Inventory';
import Expenses from '../views/admin/Expenses';
import BulkStock from '../views/admin/BulkStock';

export default function ManagerDashboard() {
  const { user, signOut, branchId, role } = useAuth();
  const { t } = useLanguage();

  const [currentView, setCurrentView] = useState('home'); 
  const [loadingContext, setLoadingContext] = useState(true);
  const [branchName, setBranchName] = useState('Assigned Branch Station');
  
  const [metrics, setMetrics] = useState({
    revenue: 0,
    expenses: 0,
    lowStockCount: 0,
    lowBulkStockCount: 0,
    salesCount: 0
  });

  const fetchDashboardMetrics = useCallback(async (targetBranchId) => {
    if (!targetBranchId) return;
    try {
      const shiftTime = new Date();
      if (shiftTime.getHours() < 6) {
        shiftTime.setDate(shiftTime.getDate() - 1);
      }
      shiftTime.setHours(6, 0, 0, 0);
      const isoShiftStr = shiftTime.toISOString();

      const [salesRes, expensesRes, inventoryRes, bulkInventoryRes] = await Promise.all([
        supabase
          .from('sales')
          .select('total_amount')
          .eq('branch_id', targetBranchId)
          .gte('created_at', isoShiftStr),
        supabase
          .from('expenses')
          .select('amount')
          .eq('branch_id', targetBranchId)
          .gte('created_at', isoShiftStr),
        supabase
          .from('inventory')
          .select('stock_quantity')
          .eq('branch_id', targetBranchId)
          .lt('stock_quantity', 5),
        supabase
          .from('bulk_inventory')
          .select('package_quantity')
          .eq('branch_id', targetBranchId)
          .lte('package_quantity', 3)
      ]);

      const dailyRevenue = (salesRes.data || []).reduce((sum, s) => sum + (s.total_amount || 0), 0);
      const dailyExpenses = (expensesRes.data || []).reduce((sum, e) => sum + (e.amount || 0), 0);
      const lowStockItemsCount = (inventoryRes.data || []).length;
      const lowBulkStockCount = (bulkInventoryRes.data || []).length;

      setMetrics({
        revenue: dailyRevenue,
        expenses: dailyExpenses,
        lowStockCount: lowStockItemsCount,
        lowBulkStockCount: lowBulkStockCount,
        salesCount: (salesRes.data || []).length
      });
    } catch (err) {
      console.error("Failed to re-calculate dashboard status layers:", err);
    }
  }, []);

  useEffect(() => {
    const initializeDashboard = async () => {
      if (!user || !branchId) {
        setLoadingContext(false);
        return;
      }
      
      try {
        setLoadingContext(true);
        
        const { data: branchData, error } = await supabase
          .from('branches')
          .select('name')
          .eq('id', branchId)
          .maybeSingle();

        if (!error && branchData) {
          setBranchName(branchData.name);
        }

        await fetchDashboardMetrics(branchId);
      } catch (err) {
        console.error("Dashboard terminal loading error:", err);
      } finally {
        setLoadingContext(false);
      }
    };

    initializeDashboard();
  }, [user, branchId, fetchDashboardMetrics]);

  const triggerMetricsRefresh = async () => {
    if (branchId) {
      await fetchDashboardMetrics(branchId);
    }
  };

  // Modern Glassmorphic Sync Loader
  if (loadingContext) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center font-sans antialiased p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.15),transparent_50%)]" />
        <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/60 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full text-center relative z-10">
          <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-4 border border-indigo-500/20">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
          </div>
          <p className="text-xs font-black text-slate-100 uppercase tracking-widest mb-1.5 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Synchronizing Ledger
          </p>
          <p className="text-[11px] font-medium text-slate-400">
            Updating active metrics...
          </p>
        </div>
      </div>
    );
  }

  // Application Routing Views
  if (currentView === 'sales') {
    return <Sales onBack={() => setCurrentView('home')} branchId={branchId} refreshMetrics={triggerMetricsRefresh} />;
  }
  if (currentView === 'inventory') {
    return <Inventory onBack={() => setCurrentView('home')} branchId={branchId} userRole={role} refreshMetrics={triggerMetricsRefresh} />;
  }
  if (currentView === 'expenses') {
    return <Expenses onBack={() => setCurrentView('home')} branchId={branchId} userRole={role} refreshMetrics={triggerMetricsRefresh} />;
  }
  if (currentView === 'bulk_stock') {
    return <BulkStock onBack={() => setCurrentView('home')} refreshMetrics={triggerMetricsRefresh} />;
  }

  const netBalance = metrics.revenue - metrics.expenses;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans antialiased relative selection:bg-indigo-500 selection:text-white">
      {/* Background Subtle Radial Accent Glows */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950" />

      <div className="max-w-3xl mx-auto relative z-10">
        
        {/* EXECUTIVE HEADER CONTROL */}
        <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8 pt-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Executive Terminal</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white uppercase italic">
              Manager Control Center
            </h1>
            <div className="flex items-center gap-2 text-[11px] font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-1.5 rounded-full tracking-wide inline-flex mt-2 backdrop-blur-md">
              <MapPin className="w-3.5 h-3.5 text-indigo-400" />
              <span>Counter: {branchName}</span>
            </div>
          </div>

          <button 
            onClick={signOut} 
            className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900/80 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/40 text-slate-300 hover:text-rose-400 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all duration-200 shadow-sm active:scale-95"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('sign_out') || 'Exit System'}</span>
          </button>
        </header>

        {/* METRICS METERS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          
          {/* Shift Inflow */}
          <div className="bg-slate-900/80 backdrop-blur-xl p-5 rounded-3xl border border-slate-800/80 shadow-lg relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-black tracking-widest text-emerald-400 uppercase">Shift Inflow</span>
              <div className="w-8 h-8 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/20">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-white tracking-tight">
              {metrics.revenue.toLocaleString()} <span className="text-xs text-slate-400 font-bold">FCFA</span>
            </p>
            <span className="text-[10px] text-slate-400 font-semibold mt-2 block">
              {metrics.salesCount} processing bills logged
            </span>
          </div>

          {/* Shift Outflow */}
          <div className="bg-slate-900/80 backdrop-blur-xl p-5 rounded-3xl border border-slate-800/80 shadow-lg relative overflow-hidden group hover:border-rose-500/30 transition-all duration-300">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-black tracking-widest text-rose-400 uppercase">Shift Outflow</span>
              <div className="w-8 h-8 bg-rose-500/10 text-rose-400 rounded-xl flex items-center justify-center border border-rose-500/20">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-white tracking-tight">
              {metrics.expenses.toLocaleString()} <span className="text-xs text-slate-400 font-bold">FCFA</span>
            </p>
            <span className="text-[10px] text-slate-400 font-semibold mt-2 block">
              Operational expenditures
            </span>
          </div>

          {/* Net Flow Balance */}
          <div className={`p-5 rounded-3xl border backdrop-blur-xl shadow-lg relative overflow-hidden transition-all duration-300 ${
            netBalance >= 0 
              ? 'bg-slate-900/80 border-slate-800/80 hover:border-indigo-500/30' 
              : 'bg-rose-950/20 border-rose-500/30'
          }`}>
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Net Balance</span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
                netBalance >= 0 
                  ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' 
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}>
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <p className={`text-2xl font-black tracking-tight ${netBalance >= 0 ? 'text-indigo-400' : 'text-rose-400'}`}>
              {netBalance.toLocaleString()} <span className="text-xs opacity-60 font-bold">FCFA</span>
            </p>
            <span className="text-[10px] text-slate-400 font-semibold mt-2 block">
              Live cash register weight
            </span>
          </div>
        </div>

        {/* NOTIFICATIONS SECTION */}
        <div className="space-y-3 mb-8">
          {/* CRITICAL RETAIL STOCK ALERT */}
          {metrics.lowStockCount > 0 && (
            <div 
              onClick={() => setCurrentView('inventory')} 
              className="group bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/30 cursor-pointer p-4 rounded-2xl text-amber-200 font-bold text-xs uppercase tracking-wider flex justify-between items-center shadow-lg backdrop-blur-md transition-all active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 border border-amber-500/30">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <span>Storage Warning: {metrics.lowStockCount} items critically low!</span>
              </div>
              <span className="bg-amber-500 text-slate-950 px-3 py-1.5 rounded-xl text-[10px] font-black shrink-0 shadow-md inline-flex items-center gap-1.5 group-hover:bg-amber-400 transition-colors">
                Refill Logistics <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          )}

          {/* CRITICAL BULK VAULT ALERT */}
          {metrics.lowBulkStockCount > 0 && (
            <div 
              onClick={() => setCurrentView('bulk_stock')} 
              className="group bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/30 cursor-pointer p-4 rounded-2xl text-rose-200 font-bold text-xs uppercase tracking-wider flex justify-between items-center shadow-lg backdrop-blur-md transition-all active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-400 border border-rose-500/30">
                  <ShieldAlert className="w-4 h-4 animate-pulse" />
                </div>
                <span>Bulk Storage Alert: {metrics.lowBulkStockCount} lines low on packages!</span>
              </div>
              <span className="bg-rose-500 text-white px-3 py-1.5 rounded-xl text-[10px] font-black shrink-0 shadow-md inline-flex items-center gap-1.5 group-hover:bg-rose-400 transition-colors">
                Refill Vault <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          )}
        </div>

        {/* MANAGEMENT NAVIGATION CONSOLE */}
        <div className="mb-4 flex items-center justify-between px-1">
          <h2 className="text-[11px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
            <span>Management Console</span>
          </h2>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">4 Modules Active</span>
        </div>
        
        <div className="grid grid-cols-1 gap-4">
          
          {/* BULK STORAGE VAULT */}
          <button 
            onClick={() => setCurrentView('bulk_stock')} 
            className="w-full p-5 bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 rounded-3xl shadow-lg flex justify-between items-center group transition-all duration-300 text-left backdrop-blur-xl relative overflow-hidden active:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              <div className="w-13 h-13 p-3.5 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-300 shrink-0 flex items-center justify-center">
                <Warehouse className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-sm text-white uppercase tracking-tight group-hover:text-indigo-400 transition-colors flex items-center gap-2">
                  Bulk Supply Storage Vault
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400" />
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  Monitor central bulk metrics and record extracted packages.
                </p>
              </div>
            </div>
            <div className="w-9 h-9 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 group-hover:bg-indigo-500 group-hover:text-white group-hover:border-indigo-400 transition-all duration-300 shrink-0 ml-2">
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

          {/* SALES TERMINAL */}
          <button 
            onClick={() => setCurrentView('sales')} 
            className="w-full p-5 bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 rounded-3xl shadow-lg flex justify-between items-center group transition-all duration-300 text-left backdrop-blur-xl relative overflow-hidden active:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              <div className="w-13 h-13 p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-300 shrink-0 flex items-center justify-center">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-sm text-white uppercase tracking-tight group-hover:text-emerald-400 transition-colors flex items-center gap-2">
                  Sales Processing Terminal
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-400" />
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  Register client transactions, cash receipts, and manage tab debts.
                </p>
              </div>
            </div>
            <div className="w-9 h-9 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 group-hover:bg-emerald-500 group-hover:text-white group-hover:border-emerald-400 transition-all duration-300 shrink-0 ml-2">
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

          {/* INVENTORY INTELLIGENCE */}
          <button 
            onClick={() => setCurrentView('inventory')} 
            className="w-full p-5 bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 rounded-3xl shadow-lg flex justify-between items-center group transition-all duration-300 text-left backdrop-blur-xl relative overflow-hidden active:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              <div className="w-13 h-13 p-3.5 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform duration-300 shrink-0 flex items-center justify-center">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-sm text-white uppercase tracking-tight group-hover:text-amber-400 transition-colors flex items-center gap-2">
                  Inventory Intelligence
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-amber-400" />
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  Log logistics entry refills, analyze item counts, and configure prices.
                </p>
              </div>
            </div>
            <div className="w-9 h-9 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 group-hover:bg-amber-500 group-hover:text-white group-hover:border-amber-400 transition-all duration-300 shrink-0 ml-2">
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

          {/* EXPENSE REGISTRY */}
          <button 
            onClick={() => setCurrentView('expenses')} 
            className="w-full p-5 bg-slate-900/80 border border-slate-800 hover:border-rose-500/50 rounded-3xl shadow-lg flex justify-between items-center group transition-all duration-300 text-left backdrop-blur-xl relative overflow-hidden active:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              <div className="w-13 h-13 p-3.5 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/20 group-hover:scale-105 transition-transform duration-300 shrink-0 flex items-center justify-center">
                <Receipt className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-sm text-white uppercase tracking-tight group-hover:text-rose-400 transition-colors flex items-center gap-2">
                  Expense Registry Console
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-rose-400" />
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  Track branch overhead payouts, shop utilities, and custom supply purchases.
                </p>
              </div>
            </div>
            <div className="w-9 h-9 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 group-hover:bg-rose-500 group-hover:text-white group-hover:border-rose-400 transition-all duration-300 shrink-0 ml-2">
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

        </div>

      </div>
    </div>
  );
}