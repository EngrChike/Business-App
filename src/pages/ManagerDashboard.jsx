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
  Loader2 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext.jsx';
import { supabase } from '../api/supabaseClient';

import Sales from '../views/staff/Sales';
import Inventory from '../views/admin/Inventory';
import Expenses from '../views/admin/Expenses';
import BulkStock from '../views/admin/BulkStock'; // Linked Bulk Stock Vault view

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
    lowBulkStockCount: 0, // TRACKS THE NEW BULK ALERT LEVEL
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

      // Fetch bulk stock exceptions concurrently
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
          .lte('package_quantity', 3) // Captures items with 3, 2, 1, or 0 packages remaining
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

  // Sleek Glassmorphic Syncing Loader
  if (loadingContext) {
    return (
      <div className="min-h-screen bg-[#F4F3ED] flex items-center justify-center font-sans antialiased p-6">
        <div className="bg-white/80 backdrop-blur-md border border-slate-200/80 p-8 rounded-[32px] shadow-xl shadow-slate-200/50 flex flex-col items-center max-w-sm w-full text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-4" />
          <p className="text-xs font-black text-slate-800 uppercase tracking-widest mb-1">
            Synchronizing Executive Ledger
          </p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Updating operational counters...
          </p>
        </div>
      </div>
    );
  }

  // --- APPLICATION INTERFACE VIEWS ROUTING ---
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
    <div className="min-h-screen bg-[#F4F3ED] text-[#111111] p-4 md:p-8 font-sans antialiased">
      <div className="max-w-2xl mx-auto">
        
        {/* EXECUTIVE HUB HEADER */}
        <div className="flex justify-between items-start mb-8 mt-2">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase italic">
              Executive Dashboard Control
            </h1>
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-indigo-700 bg-indigo-50 border border-indigo-100/80 px-3 py-1 rounded-full tracking-wider inline-flex mt-2 shadow-sm">
              <MapPin className="w-3.5 h-3.5 text-indigo-600" />
              <span>Operational Counter: {branchName}</span>
            </div>
          </div>

          <button 
            onClick={signOut} 
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 rounded-2xl font-bold text-xs uppercase tracking-wide transition-all shadow-sm active:scale-95 text-slate-700"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t('sign_out') || 'Exit'}</span>
          </button>
        </div>

        {/* METRICS METERS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          
          {/* Shift Inflow */}
          <div className="bg-white p-6 rounded-[28px] border border-slate-200/60 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[9px] font-black tracking-widest text-emerald-600 uppercase">Shift Inflow</span>
              <div className="w-7 h-7 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-xl font-black text-slate-900">
              {metrics.revenue.toLocaleString()} <span className="text-[10px] text-slate-400 font-bold">FCFA</span>
            </p>
            <span className="text-[10px] text-slate-400 font-bold mt-1 block">
              {metrics.salesCount} processing bills logs
            </span>
          </div>

          {/* Shift Outflow */}
          <div className="bg-white p-6 rounded-[28px] border border-slate-200/60 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[9px] font-black tracking-widest text-rose-500 uppercase">Shift Outflow</span>
              <div className="w-7 h-7 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center">
                <TrendingDown className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-xl font-black text-slate-900">
              {metrics.expenses.toLocaleString()} <span className="text-[10px] text-slate-400 font-bold">FCFA</span>
            </p>
            <span className="text-[10px] text-slate-400 font-bold mt-1 block">
              Operational expenditures
            </span>
          </div>

          {/* Net Flow Balance */}
          <div className={`p-6 rounded-[28px] border shadow-sm relative overflow-hidden transition-all ${
            netBalance >= 0 ? 'bg-white border-slate-200/60' : 'bg-rose-50/40 border-rose-200/80'
          }`}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase">Net Flow Balance</span>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                netBalance >= 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-100 text-rose-600'
              }`}>
                <Wallet className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className={`text-xl font-black ${netBalance >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
              {netBalance.toLocaleString()} <span className="text-[10px] opacity-60 font-bold">FCFA</span>
            </p>
            <span className="text-[10px] text-slate-400 font-bold mt-1 block">
              Live cash register weight
            </span>
          </div>
        </div>

        {/* CRITICAL RETAIL STOCK NOTIFICATION */}
        {metrics.lowStockCount > 0 && (
          <div 
            onClick={() => setCurrentView('inventory')} 
            className="bg-amber-500 hover:bg-amber-600 cursor-pointer p-4 rounded-2xl text-white font-bold text-xs uppercase tracking-wider flex justify-between items-center mb-3 shadow-md transition-all active:scale-[0.99] border border-amber-400"
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-white" />
              <span>Storage Warning: {metrics.lowStockCount} item variants critically low!</span>
            </div>
            <span className="bg-white text-amber-600 px-3 py-1 rounded-xl text-[10px] font-black shrink-0 shadow-sm inline-flex items-center gap-1">
              Refill Logistics <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        )}

        {/* CRITICAL BULK VAULT STOCK NOTIFICATION */}
        {metrics.lowBulkStockCount > 0 && (
          <div 
            onClick={() => setCurrentView('bulk_stock')} 
            className="bg-rose-600 hover:bg-rose-700 cursor-pointer p-4 rounded-2xl text-white font-bold text-xs uppercase tracking-wider flex justify-between items-center mb-6 shadow-md shadow-rose-500/20 transition-all active:scale-[0.99] border border-rose-500"
          >
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 text-white animate-pulse" />
              <span>Bulk Storage Alert: {metrics.lowBulkStockCount} lines low on packages!</span>
            </div>
            <span className="bg-white text-rose-600 px-3 py-1 rounded-xl text-[10px] font-black shrink-0 shadow-sm inline-flex items-center gap-1">
              Refill Vault <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        )}

        {/* APPLICATION BUTTON CONSOLE */}
        <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 px-1">
          Management Hub Applications
        </h2>
        
        <div className="grid grid-cols-1 gap-3.5">
          
          {/* BULK STORAGE VAULT ENTRY CARD */}
          <button 
            onClick={() => setCurrentView('bulk_stock')} 
            className="w-full p-5 bg-white border border-slate-200/80 hover:border-indigo-400/80 rounded-[24px] shadow-sm hover:shadow-md flex justify-between items-center group transition-all text-left relative overflow-hidden border-l-4 border-l-indigo-600 active:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                <Warehouse className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">
                  Bulk Supply Storage Vault
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Monitor central storage balance metrics and record item packages extracted.
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all shrink-0 ml-2">
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

          {/* SALES PROCESSING TERMINAL */}
          <button 
            onClick={() => setCurrentView('sales')} 
            className="w-full p-5 bg-white border border-slate-200/80 hover:border-emerald-400/80 rounded-[24px] shadow-sm hover:shadow-md flex justify-between items-center group transition-all text-left border-l-4 border-l-emerald-500 active:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900 uppercase tracking-tight group-hover:text-emerald-600 transition-colors">
                  Sales Processing Terminal
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Register client transactions, cash receipts, and manage tab debts.
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-all shrink-0 ml-2">
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

          {/* INVENTORY INTELLIGENCE */}
          <button 
            onClick={() => setCurrentView('inventory')} 
            className="w-full p-5 bg-white border border-slate-200/80 hover:border-amber-400/80 rounded-[24px] shadow-sm hover:shadow-md flex justify-between items-center group transition-all text-left border-l-4 border-l-amber-500 active:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-50 border border-amber-100 rounded-2xl flex items-center justify-center text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-colors shrink-0">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900 uppercase tracking-tight group-hover:text-amber-600 transition-colors">
                  Inventory Intelligence
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Log logistics entry refills, analyze item counts, and configure prices.
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-amber-50 group-hover:text-amber-600 transition-all shrink-0 ml-2">
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

          {/* EXPENSE REGISTRY CONSOLE */}
          <button 
            onClick={() => setCurrentView('expenses')} 
            className="w-full p-5 bg-white border border-slate-200/80 hover:border-rose-400/80 rounded-[24px] shadow-sm hover:shadow-md flex justify-between items-center group transition-all text-left border-l-4 border-l-rose-500 active:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition-colors shrink-0">
                <Receipt className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900 uppercase tracking-tight group-hover:text-rose-600 transition-colors">
                  Expense Registry Console
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Track branch overhead payouts, shop utilities, and custom supply purchases.
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-rose-50 group-hover:text-rose-600 transition-all shrink-0 ml-2">
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

        </div>

      </div>
    </div>
  );
}