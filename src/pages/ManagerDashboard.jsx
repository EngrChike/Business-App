// src/pages/ManagerDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext.jsx';
import { supabase } from '../api/supabaseClient';

import Sales from '../views/staff/Sales';
import Inventory from '../views/admin/Inventory';
import Expenses from '../views/admin/Expenses';

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

      const [salesRes, expensesRes, inventoryRes] = await Promise.all([
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
          .lt('stock_quantity', 5)
      ]);

      const dailyRevenue = (salesRes.data || []).reduce((sum, s) => sum + (s.total_amount || 0), 0);
      const dailyExpenses = (expensesRes.data || []).reduce((sum, e) => sum + (e.amount || 0), 0);
      const lowStockItemsCount = (inventoryRes.data || []).length;

      setMetrics({
        revenue: dailyRevenue,
        expenses: dailyExpenses,
        lowStockCount: lowStockItemsCount,
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

  if (loadingContext) {
    return (
      <div className="min-h-screen bg-[#F4F3ED] flex items-center justify-center font-sans">
        <div className="text-center font-bold text-slate-400 animate-pulse text-xs uppercase tracking-widest">
          Synchronizing Core Executive Ledger Channels...
        </div>
      </div>
    );
  }

  // ROUTING MATRICES - Injection points optimized to link seamlessly with Expenses.jsx
  if (currentView === 'sales') {
    return <Sales onBack={() => setCurrentView('home')} branchId={branchId} refreshMetrics={triggerMetricsRefresh} />;
  }
  if (currentView === 'inventory') {
    return <Inventory onBack={() => setCurrentView('home')} branchId={branchId} userRole={role} refreshMetrics={triggerMetricsRefresh} />;
  }
  if (currentView === 'expenses') {
    return <Expenses onBack={() => setCurrentView('home')} branchId={branchId} userRole={role} refreshMetrics={triggerMetricsRefresh} />;
  }

  const netBalance = metrics.revenue - metrics.expenses;

  return (
    <div className="min-h-screen bg-[#F4F3ED] text-[#111111] p-4 md:p-8 font-sans antialiased">
      <div className="max-w-2xl mx-auto">
        
        {/* EXECUTIVE HUB HEADER */}
        <div className="flex justify-between items-center mb-8 mt-2">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase italic">Don Chike Executive Control</h1>
            <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-3 py-1 rounded-md tracking-wider inline-block mt-1">
              📍 Operational Counter: {branchName}
            </span>
          </div>
          <button 
            onClick={signOut} 
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-red-50 hover:text-red-500 rounded-xl font-bold text-xs uppercase tracking-wide transition-all shadow-sm"
          >
            {t('sign_out') || 'Exit'}
          </button>
        </div>

        {/* METRICS METERS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm">
            <span className="text-[9px] font-black tracking-widest text-emerald-500 uppercase block mb-1">Shift Inflow</span>
            <p className="text-xl font-black text-slate-900">{metrics.revenue.toLocaleString()} <span className="text-[10px] text-slate-400">FCFA</span></p>
            <span className="text-[10px] text-slate-400 font-bold mt-1 block">{metrics.salesCount} processing bills logs</span>
          </div>

          <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm">
            <span className="text-[9px] font-black tracking-widest text-[#FF5A50] uppercase block mb-1">Shift Outflow</span>
            <p className="text-xl font-black text-slate-900">{metrics.expenses.toLocaleString()} <span className="text-[10px] text-slate-400">FCFA</span></p>
            <span className="text-[10px] text-slate-400 font-bold mt-1 block">Operational expenditures</span>
          </div>

          <div className={`p-6 rounded-[28px] border shadow-sm ${netBalance >= 0 ? 'bg-white border-slate-100' : 'bg-red-50/50 border-red-100'}`}>
            <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase block mb-1">Net Flow Balance</span>
            <p className={`text-xl font-black ${netBalance >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
              {netBalance.toLocaleString()} <span className="text-[10px] opacity-60">FCFA</span>
            </p>
            <span className="text-[10px] text-slate-400 font-bold mt-1 block">Live cash register weight</span>
          </div>
        </div>

        {/* CRITICAL STOCK NOTIFICATION */}
        {metrics.lowStockCount > 0 && (
          <div onClick={() => setCurrentView('inventory')} className="bg-orange-500 hover:bg-orange-600 cursor-pointer p-4 rounded-2xl text-white font-bold text-xs uppercase tracking-wider flex justify-between items-center mb-6 shadow-md transition-all">
            <span>⚠️ Storage Warning: {metrics.lowStockCount} item variants are critically low!</span>
            <span className="bg-white text-orange-600 px-2.5 py-1 rounded-lg text-[10px] font-black">Refill Logistics →</span>
          </div>
        )}

        {/* APPLICATION BUTTON CONSOLE */}
        <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 px-1">Management Hub Applications</h2>
        <div className="grid grid-cols-1 gap-3">
          <button onClick={() => setCurrentView('sales')} className="w-full p-5 bg-white border border-slate-100 hover:border-indigo-200 rounded-[24px] shadow-sm flex justify-between items-center group transition-all">
            <div className="text-left">
              <h3 className="font-black text-sm text-slate-800 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">Sales Processing Terminal</h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Register client transactions, cash receipts, and manage tab debts.</p>
            </div>
            <span className="text-xl group-hover:translate-x-1 transition-transform">💰</span>
          </button>

          <button onClick={() => setCurrentView('inventory')} className="w-full p-5 bg-white border border-slate-100 hover:border-indigo-200 rounded-[24px] shadow-sm flex justify-between items-center group transition-all">
            <div className="text-left">
              <h3 className="font-black text-sm text-slate-800 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">Inventory Intelligence</h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Log logistics entry refills, analyze item counts, and configure prices.</p>
            </div>
            <span className="text-xl group-hover:translate-x-1 transition-transform">📦</span>
          </button>

          <button onClick={() => setCurrentView('expenses')} className="w-full p-5 bg-white border border-slate-100 hover:border-red-200 rounded-[24px] shadow-sm flex justify-between items-center group transition-all">
            <div className="text-left">
              <h3 className="font-black text-sm text-slate-800 uppercase tracking-tight group-hover:text-[#FF5A50] transition-colors">Expense Registry Console</h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Track branch overhead payouts, shop utilities, and custom supply purchases.</p>
            </div>
            <span className="text-xl group-hover:translate-x-1 transition-transform">🛑</span>
          </button>
        </div>

      </div>
    </div>
  );
}