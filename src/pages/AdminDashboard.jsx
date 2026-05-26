// src/pages/AdminDashboard.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx'; 
import { useAuth } from '../context/AuthContext.jsx'; 
import { supabase } from '../api/supabaseClient.js'; 

// Sub-views
import Debtors from '../views/admin/Debtors.jsx';
import Expenses from '../views/admin/Expenses.jsx';
import Inventory from '../views/admin/Inventory.jsx';
import Reports from '../views/admin/Reports.jsx';
import StaffManagement from '../views/admin/StaffManagement.jsx';
import StaffPerformance from '../views/admin/StaffPerformance.jsx';
import Sales from '../views/staff/Sales.jsx';

function BranchOperations({ onBack, t }) {
  const [branches, setBranches] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [newBranchName, setNewBranchName] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState({ text: '', isError: false });

  const loadBranchAndProfileData = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data: branchData, error: bError } = await supabase
        .from('branches')
        .select('*')
        .order('name', { ascending: true });
      if (bError) throw bError;

      const { data: profileData, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .order('name', { ascending: true });
      if (pError) throw pError;

      setBranches(branchData || []);
      setProfiles(profileData || []);
    } catch (err) {
      setActionMessage({ text: `Sync error: ${err.message}`, isError: true });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBranchAndProfileData();
  }, [loadBranchAndProfileData]);

  const handleCreateBranch = async (e) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;

    try {
      setLoading(true);
      setActionMessage({ text: '', isError: false });
      
      const { error } = await supabase
        .from('branches')
        .insert([{ name: newBranchName.trim() }]);

      if (error) throw error;

      setActionMessage({ text: 'Branch registered successfully!', isError: false });
      setNewBranchName('');
      await loadBranchAndProfileData();
    } catch (err) {
      setActionMessage({ text: `Failed to save branch: ${err.message}`, isError: true });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignBranch = async (profileId, branchId) => {
    try {
      setActionMessage({ text: '', isError: false });
      const targetBranchValue = branchId === "unassigned" ? null : branchId;

      const { error } = await supabase
        .from('profiles')
        .update({ branch_id: targetBranchValue })
        .eq('id', profileId);

      if (error) throw error;

      setActionMessage({ text: 'Staff shift branch updated successfully!', isError: false });
      await loadBranchAndProfileData();
    } catch (err) {
      setActionMessage({ text: `Assignment failed: ${err.message}`, isError: true });
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F3ED] text-[#111111] p-4 md:p-8 font-sans antialiased">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8 mt-4">
          <div>
            <button onClick={onBack} className="text-[#3F51B5] font-bold text-xs uppercase tracking-widest flex items-center gap-2 mb-1 hover:opacity-80">
              ← {t('back') || 'Back to Menu'}
            </button>
            <h1 className="text-2xl font-black tracking-tight">
              {t('branch_operations') || 'Branch Operations'}
            </h1>
          </div>
        </div>

        {actionMessage.text && (
          <div className={`p-4 rounded-2xl mb-6 text-xs font-bold uppercase text-center tracking-wider border ${
            actionMessage.isError ? 'bg-red-50 text-[#FF5A50] border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
          }`}>
            {actionMessage.isError ? '❌' : '✅'} {actionMessage.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm h-fit">
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider mb-4">Location Matrix</h2>
            <form onSubmit={handleCreateBranch} className="space-y-3 mb-6">
              <input 
                type="text" 
                placeholder="Branch Name (e.g. Owerri Central)" 
                className="w-full p-4 bg-slate-50 text-slate-800 rounded-xl text-xs font-bold outline-none border border-transparent focus:border-[#3F51B5] focus:bg-white transition-all shadow-inner"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                disabled={loading}
                required
              />
              <button 
                type="submit"
                disabled={loading || !newBranchName.trim()}
                className="w-full bg-[#3F51B5] text-white text-[10px] tracking-widest font-black py-4 rounded-xl uppercase transition-all shadow-md hover:opacity-90 active:scale-95 disabled:opacity-40"
              >
                Create Branch
              </button>
            </form>

            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4 mb-2">Visible Operating Branches</h3>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {branches.length === 0 ? (
                <p className="text-xs text-slate-400 italic font-medium">No custom branches mapped.</p>
              ) : (
                branches.map((b) => (
                  <div key={b.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">{b.name}</span>
                    <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">Active</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm md:col-span-2">
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider mb-1">Corporate Staff Mapping</h2>
            <p className="text-xs text-slate-400 font-medium mb-4">Assign active shift locations to profiles. Mismatched selections will be blocked at login.</p>

            <div className="space-y-2 overflow-y-auto max-h-[400px] pr-1">
              {profiles.filter(p => p.role !== 'admin').length === 0 ? (
                <p className="text-xs text-slate-400 italic font-medium p-4 text-center">No staff member accounts found under this scope.</p>
              ) : (
                profiles.filter(p => p.role !== 'admin').map((staff) => (
                  <div key={staff.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">{staff.name || 'Anonymous Staff'}</h4>
                      <p className="text-[10px] font-medium text-slate-400 lowercase mt-0.5">{staff.email || 'No email attached'}</p>
                      <span className="text-[9px] font-black text-[#3F51B5] uppercase bg-indigo-50 px-1.5 py-0.5 rounded-md mt-1 inline-block">Role: {staff.role || 'staff'}</span>
                    </div>

                    <div className="min-w-[160px]">
                      <select
                        value={staff.branch_id || 'unassigned'}
                        onChange={(e) => handleAssignBranch(staff.id, e.target.value)}
                        className="w-full p-2.5 bg-white text-slate-700 rounded-xl text-xs font-bold outline-none border border-slate-200 focus:border-[#3F51B5] transition-all cursor-pointer shadow-sm"
                      >
                        <option value="unassigned">🛑 Unassigned (Locked)</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>📍 {b.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { language, toggleLanguage, t } = useLanguage(); 
  const { user, loading: authLoading } = useAuth(); 
  const [view, setView] = useState('menu');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [userProfile, setUserProfile] = useState({
    name: 'Executive Admin',
    email: '',
    role: 'admin',
    branch_id: null
  });

  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalDebt: 0,
    lowStockCount: 0,
    totalExpenses: 0
  });

  const fetchUserSession = useCallback(async () => {
    if (authLoading) return;
    if (user) {
      setUserProfile({
        name: user.user_metadata?.full_name || 'Onyema Chikezie',
        email: user.email,
        role: 'admin',
        branch_id: null
      });
    }
  }, [user, authLoading]);

  const fetchCEOMetrics = useCallback(async () => {
    try {
      const today = new Date();
      today.setHours(0,0,0,0);

      // Corporate level views query global system cross-sections cleanly
      const salesQuery = supabase.from('sales').select('total_amount, payment_status').gte('created_at', today.toISOString());
      const expenseQuery = supabase.from('expenses').select('amount').eq('status', 'approved').gte('created_at', today.toISOString());
      const inventoryQuery = supabase.from('inventory').select('*', { count: 'exact', head: true }).lt('stock_quantity', 5);

      const [salesRes, expenseRes, inventoryRes] = await Promise.all([
        salesQuery,
        expenseQuery,
        inventoryQuery
      ]);

      const salesData = salesRes.data || [];
      const expenseData = expenseRes.data || [];
      const lowStock = inventoryRes.count || 0;

      const revenue = salesData
        .filter(s => s.payment_status === 'paid')
        .reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
      
      const debt = salesData
        .filter(s => s.payment_status === 'debt')
        .reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);

      const expenses = expenseData.reduce((sum, e) => sum + Number(e.amount), 0);

      setStats({
        totalRevenue: revenue,
        totalDebt: debt,
        lowStockCount: lowStock,
        totalExpenses: expenses
      });
    } catch (error) {
      console.error("Metrics connection engine fault:", error.message);
    }
  }, []);

  useEffect(() => {
    fetchUserSession();
  }, [fetchUserSession]);

  useEffect(() => {
    if (view === 'menu' && !authLoading) {
      fetchCEOMetrics();
    }

    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [view, authLoading, fetchCEOMetrics]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F4F3ED] flex items-center justify-center font-sans">
        <div className="text-xs font-bold text-slate-500 animate-pulse tracking-widest uppercase">
          Initializing Management Workspace Module...
        </div>
      </div>
    );
  }

  if (view !== 'menu') {
    if (view === 'branches') {
      return <BranchOperations onBack={() => setView('menu')} t={t} />;
    }

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
        
        {/* --- PREMIUM EXECUTIVE HEADER --- */}
        <div className="flex justify-between items-center mb-8 mt-4 relative">
          <div>
            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">
              {t('executive_suite') || 'Executive Suite'}
            </p>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-[#111111]">
              Don Chike <span className="text-[#3F51B5]">Elite</span>
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
              <div className="h-9 w-9 rounded-full bg-[#3F51B5] text-white font-black text-sm flex items-center justify-center uppercase shadow-inner">
                {userProfile.name.charAt(0)}
              </div>
              <div className="text-left hidden md:block">
                <p className="text-xs font-bold leading-tight text-slate-800">{userProfile.name}</p>
                <p className="text-[10px] font-medium text-slate-400 capitalize">{userProfile.role}</p>
              </div>
              <span className="text-xs text-slate-400 ml-1">▼</span>
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 top-16 w-64 bg-white border border-slate-100 rounded-[24px] shadow-xl p-4 z-50">
                <div className="pb-3 border-b border-slate-100">
                  <p className="text-xs font-black text-slate-800 truncate">{userProfile.name}</p>
                  <p className="text-[11px] font-medium text-slate-400 truncate mt-0.5">{userProfile.email}</p>
                  <p className="text-[9px] font-black text-indigo-600 uppercase tracking-wider mt-1">Clearance: GLOBAL {userProfile.role}</p>
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
                    onClick={() => supabase.auth.signOut()} 
                    className="w-full text-left px-3 py-2.5 text-xs font-bold text-[#FF5A50] hover:bg-red-50 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <span>🚪</span> {t('sign_out') || 'Sign Out'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* --- LUXURY METRICS PILLS --- */}
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-8">
          <div className="bg-white p-4 rounded-[24px] shadow-sm border border-slate-100 flex flex-col justify-between min-h-[100px]">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('true_balance') || 'True Balance'}</p>
            <p className="text-base md:text-xl font-extrabold text-emerald-600 tracking-tight">
              {(stats.totalRevenue - stats.totalExpenses).toLocaleString()} <span className="text-[9px] font-bold text-slate-400 block sm:inline">FCFA</span>
            </p>
          </div>

          <div className="bg-white p-4 rounded-[24px] shadow-sm border border-slate-100 flex flex-col justify-between min-h-[100px]">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('daily_expenses') || 'Daily Expenses'}</p>
            <p className="text-base md:text-xl font-extrabold text-slate-800 tracking-tight">
              -{stats.totalExpenses.toLocaleString()} <span className="text-[9px] font-bold text-slate-400 block sm:inline">FCFA</span>
            </p>
          </div>

          <div className={`p-4 rounded-[24px] transition-all flex flex-col justify-between min-h-[100px] border ${
            stats.lowStockCount > 0 ? 'bg-[#FFEBEA] border-[#FFD0CD] animate-pulse' : 'bg-white border-slate-100 shadow-sm'
          }`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${stats.lowStockCount > 0 ? 'text-[#FF5A50]' : 'text-slate-400'}`}>{t('stock_alerts') || 'Stock Alerts'}</p>
            <p className={`text-base md:text-xl font-extrabold tracking-tight ${stats.lowStockCount > 0 ? 'text-[#FF5A50]' : 'text-slate-800'}`}>
              {stats.lowStockCount} <span className="text-[10px] font-medium opacity-60 normal-case">{t('items') || 'Items'}</span>
            </p>
          </div>
        </div>

        {/* --- NAVIGATION GRID --- */}
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
                <h3 className="text-lg font-extrabold tracking-tight">{t('gestion_stock') || 'Stock Management'}</h3>
                <p className={`text-[11px] mt-0.5 font-medium uppercase tracking-wider ${stats.lowStockCount > 0 ? 'text-white/80' : 'text-slate-400'}`}>{t('global_stock') || 'Global Stock'}</p>
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
                <h3 className="text-lg font-extrabold tracking-tight text-slate-900">{t('business_expenses') || 'Expenses'}</h3>
                <p className="text-slate-400 text-[11px] mt-0.5 font-medium uppercase tracking-wider">{t('log_costs') || 'Log Costs'}</p>
              </div>
            </div>
          </button>

          <button 
            onClick={() => setView('debtors')} 
            className="bg-white border border-slate-100 p-6 md:p-8 rounded-[28px] transition-all hover:scale-[1.01] active:scale-98 text-left group shadow-sm"
          >
            <div className="flex flex-col h-full justify-between">
              <span className="text-2xl bg-amber-50 p-3 rounded-2xl w-fit inline-block mb-4 shadow-sm">💳</span>
              <div>
                <h3 className="text-lg font-extrabold tracking-tight text-slate-900">{t('debtor_ledger') || 'Debtor Ledger'}</h3>
                <p className="text-slate-400 text-[11px] mt-0.5 font-medium uppercase tracking-wider">{t('unpaid_tabs') || 'Unpaid Tabs'}</p>
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
                <h3 className="text-lg font-extrabold tracking-tight text-slate-900">{t('sales_terminal') || 'Sales Terminal'}</h3>
                <p className="text-slate-400 text-[11px] mt-0.5 font-medium uppercase tracking-wider">{t('register_counters') || 'Register'}</p>
              </div>
            </div>
          </button>

          <button 
            onClick={() => setView('staff')} 
            className="bg-white border border-slate-100 p-6 md:p-8 rounded-[28px] transition-all hover:scale-[1.01] active:scale-98 text-left group shadow-sm"
          >
            <div className="flex flex-col h-full justify-between">
              <span className="text-2xl bg-purple-50 p-3 rounded-2xl w-fit inline-block mb-4 shadow-sm">🔑</span>
              <div>
                <h3 className="text-lg font-extrabold tracking-tight text-slate-900">{t('staff_access') || 'Staff Access'}</h3>
                <p className="text-slate-400 text-[11px] mt-0.5 font-medium uppercase tracking-wider">{t('account_provisioning') || 'Account Provisioning'}</p>
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
                <h3 className="text-lg font-extrabold tracking-tight text-slate-900">{t('staff_performance') || 'Performance'}</h3>
                <p className="text-slate-400 text-[11px] mt-0.5 font-medium uppercase tracking-wider">{t('shift_closeouts') || 'Closeouts'}</p>
              </div>
            </div>
          </button>

          {/* BRANCH OPERATIONS ACCESS TAB */}
          <button 
            onClick={() => setView('branches')} 
            className="bg-white border border-slate-100 p-6 md:p-8 rounded-[28px] transition-all hover:scale-[1.01] active:scale-98 text-left md:col-span-2 group shadow-sm"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <span className="text-2xl bg-[#FFEBEA]/40 p-3 rounded-2xl w-fit inline-block shadow-sm">🏢</span>
                <div>
                  <h3 className="text-lg font-extrabold tracking-tight text-slate-900">{t('branch_operations') || 'Branch Operations'}</h3>
                  <p className="text-slate-400 text-[11px] mt-0.5 font-medium uppercase tracking-wider">Configure locations & assign staff parameters</p>
                </div>
              </div>
              <span className="text-xs font-bold text-[#3F51B5] bg-indigo-50/50 px-4 py-2 rounded-xl border border-indigo-100/50 w-fit sm:inline-block hidden">
                Manage Branches
              </span>
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
                  <h3 className="text-lg font-extrabold tracking-tight text-slate-900">{t('profit_engine') || 'Profit Engine'}</h3>
                  <p className="text-slate-400 text-[11px] mt-0.5 font-medium uppercase tracking-wider">{t('growth_analytics') || 'Analytics'}</p>
                </div>
              </div>
              <span className="text-xs font-bold text-[#3F51B5] bg-indigo-50/50 px-4 py-2 rounded-xl border border-indigo-100/50 w-fit sm:inline-block hidden">
                {t('review_financials') || 'Review Financials'}
              </span>
            </div>
          </button>
        </div>

        <div className="h-16"></div>
      </div>
    </div>
  );
} 