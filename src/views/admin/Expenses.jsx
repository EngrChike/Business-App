// src/components/Expenses.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, 
  ShieldCheck, 
  Building2, 
  MapPin, 
  Trash2, 
  PlusCircle, 
  Receipt, 
  Tag, 
  Coins, 
  Loader2 
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { supabase } from '../../api/supabaseClient';
import { useAuth } from '../../context/AuthContext';

export default function Expenses({ onBack, branchId: dashboardBranchId, userRole: dashboardUserRole, refreshMetrics }) {
  const { user, selectedBranch, role: authRole } = useAuth();
  const { t } = useLanguage();

  const [expensesLog, setExpensesLog] = useState([]);
  const [branches, setBranches] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [effectiveRole, setEffectiveRole] = useState('staff');

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'Logistics'
  });

  const expenseCategories = ['Logistics', 'Utilities', 'Restock', 'Staff Welfare', 'Rent', 'Others'];

  // 1. Core query engine
  const fetchExpenses = useCallback(async (branchId) => {
    setLoading(true);
    try {
      const shiftBoundary = new Date();
      if (shiftBoundary.getHours() < 6) {
        shiftBoundary.setDate(shiftBoundary.getDate() - 1);
      }
      shiftBoundary.setHours(6, 0, 0, 0);

      let query = supabase
        .from('expenses')
        .select('*')
        .gte('created_at', shiftBoundary.toISOString());

      if (!branchId || branchId === 'HEADQUARTERS') {
        query = query.is('branch_id', null);
      } else {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (!error) setExpensesLog(data || []);
    } catch (err) {
      console.error("Failed to query historical expenses ledger:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Identity and routing handshake on component mount
  useEffect(() => {
    const initializeSecurityContext = async () => {
      try {
        setLoadingSession(true);
        const userRoleResolved = dashboardUserRole || authRole || 'manager';
        setEffectiveRole(userRoleResolved);

        if (userRoleResolved === 'admin') {
          const { data: branchData } = await supabase.from('branches').select('id, name');
          setBranches(branchData || []);
          
          const initialAdminBranch = dashboardBranchId || selectedBranch || 'HEADQUARTERS';
          setSelectedBranchId(initialAdminBranch);
          await fetchExpenses(initialAdminBranch);
        } 
        else {
          const resolvedBranch = dashboardBranchId || selectedBranch;
          if (resolvedBranch) {
            setSelectedBranchId(resolvedBranch);
            await fetchExpenses(resolvedBranch);
          } else {
            setSelectedBranchId('HEADQUARTERS');
            await fetchExpenses('HEADQUARTERS');
          }
        }
      } catch (err) {
        console.error("Handshake fail inside expense module:", err);
      } finally {
        setLoadingSession(false);
      }
    };

    initializeSecurityContext();
  }, [dashboardBranchId, dashboardUserRole, selectedBranch, authRole, fetchExpenses]);

  const handleBranchSwitch = async (branchId) => {
    setSelectedBranchId(branchId);
    await fetchExpenses(branchId);
  };

  // 3. Payload submission handler
  const handleSubmitExpense = async (e) => {
    e.preventDefault();
    if (loading) return;

    const targetBranchPayloadId = (!selectedBranchId || selectedBranchId === 'HEADQUARTERS') ? null : selectedBranchId;

    const payoutPayload = {
      description: formData.description.trim(),
      amount: parseFloat(formData.amount) || 0,
      category: formData.category,
      branch_id: targetBranchPayloadId,
      staff_id: user?.id || null,
      status: 'Completed'
    };

    setLoading(true);

    try {
      const { error } = await supabase.from('expenses').insert([payoutPayload]);
      
      if (error) {
        console.error("Supabase Database Rejection Details:", error);
        alert(`Database Error: ${error.message}\nDetails: ${error.details || 'Check column layout rules'}`);
        return;
      }

      setFormData({ description: '', amount: '', category: 'Logistics' });
      await fetchExpenses(selectedBranchId);
      
      if (typeof refreshMetrics === 'function') {
        await refreshMetrics();
      }

      alert("Expenditure verified and logged perfectly.");
    } catch (err) {
      console.error("Critical component execution error:", err);
      alert(`System Error: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExpense = async (id) => {
    const verify = window.confirm("Are you sure you want to delete this expense record entry permanently?");
    if (!verify) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (!error) {
        await fetchExpenses(selectedBranchId);
        if (typeof refreshMetrics === 'function') {
          await refreshMetrics();
        }
      }
    } catch (err) {
      console.error("Failed to delete requested item row:", err);
    } finally {
      setLoading(false);
    }
  };

  const totalDailyExpenditure = expensesLog.reduce((sum, item) => sum + (item.amount || 0), 0);
  
  const currentActiveBranchName = selectedBranchId === 'HEADQUARTERS' 
    ? 'Headquarters (General)' 
    : (branches.find(b => b.id === selectedBranchId)?.name || 'Assigned Location');

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-xs font-black uppercase text-slate-400 tracking-widest gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
        <span>Verifying Expense Registry Clearing Matrix...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-24 font-sans max-w-2xl mx-auto antialiased">
      
      {/* HEADER CONTROLS */}
      <div className="flex justify-between items-center mb-6 border-b border-slate-200/80 pb-4 mt-2">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack} 
            className="inline-flex items-center gap-1.5 text-rose-500 font-extrabold uppercase text-xs hover:text-rose-700 transition-colors py-1 px-2 rounded-lg hover:bg-rose-50"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('back') || 'Back'}</span>
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <h1 className="text-lg font-black uppercase italic tracking-tight text-slate-900 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-rose-500 not-italic" />
            <span>Expense Registry Console</span>
          </h1>
        </div>
        
        <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-600 font-extrabold uppercase bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm tracking-wide">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
          <span>Mode: {effectiveRole}</span>
        </span>
      </div>

      {/* DYNAMIC ADMIN DROPDOWN */}
      {effectiveRole === 'admin' && (
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1 mb-0.5">
              <Building2 className="w-3 h-3 text-slate-400" />
              <span>Target Expense Destination</span>
            </label>
            <p className="text-xs text-slate-500 font-medium">Route this transaction entry to any location ledger profile.</p>
          </div>
          <div className="w-full sm:w-auto relative">
            <select
              value={selectedBranchId}
              onChange={(e) => handleBranchSwitch(e.target.value)}
              className="p-3 bg-slate-100 rounded-xl font-bold text-xs uppercase tracking-wide border-none text-slate-800 focus:ring-2 focus:ring-slate-900 w-full sm:w-auto min-w-[220px] cursor-pointer outline-none"
            >
              <option value="HEADQUARTERS">🏢 Headquarters (General Corporate)</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>📍 {b.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* EXPENSE ENTRY FORM */}
      <form onSubmit={handleSubmitExpense} className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-200/80 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-rose-500" />
            <span>Log Outgoing Expenditure ({currentActiveBranchName})</span>
          </h2>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div className="sm:col-span-2">
            <input 
              type="text"
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all" 
              placeholder="What was this payout for? (e.g. Generator fuel, office supplies)"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              required
              disabled={loading}
            />
          </div>
          <div>
            <div className="relative">
              <select
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 cursor-pointer transition-all"
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
                disabled={loading}
              >
                {expenseCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input 
            type="number" 
            min="1"
            className="p-4 bg-rose-50/50 border border-rose-100 rounded-2xl font-black text-sm text-rose-900 placeholder:text-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 flex-1 transition-all" 
            placeholder="Amount Spent (FCFA)"
            value={formData.amount}
            onChange={e => setFormData({...formData, amount: e.target.value})}
            required
            disabled={loading}
          />
          <button 
            type="submit" 
            disabled={loading}
            className="bg-slate-900 hover:bg-slate-950 text-white px-7 py-4 sm:py-0 rounded-2xl font-black uppercase text-xs tracking-wider transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4 text-rose-400" />
                <span>Log Cost Payout</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* TODAY'S LEDGER LOG */}
      <div className="bg-white rounded-[32px] border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-5 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
          <h2 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <span>Today's Ledger:</span>
            <span className="text-slate-700 font-black">{currentActiveBranchName}</span>
          </h2>
          <span className="bg-rose-500 text-white px-3 py-0.5 rounded-full text-[10px] font-extrabold shadow-sm">
            {expensesLog.length}
          </span>
        </div>

        <div className="p-5 divide-y divide-slate-100 max-h-72 overflow-y-auto pr-2">
          {expensesLog.length === 0 ? (
            <p className="text-slate-400 text-xs italic py-6 text-center">No structural expenditure payouts logged here today.</p>
          ) : (
            expensesLog.map(item => (
              <div key={item.id} className="flex justify-between items-center py-3.5 first:pt-0 last:pb-0 group">
                <div className="pr-4">
                  <p className="font-bold text-sm text-slate-800 uppercase tracking-tight">{item.description}</p>
                  <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-md mt-1">
                    <Tag className="w-2.5 h-2.5" />
                    <span>{item.category}</span>
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <p className="font-black text-slate-900 text-sm">
                    -{item.amount?.toLocaleString()} <span className="text-[10px] text-slate-400 font-bold">FCFA</span>
                  </p>
                  <button 
                    onClick={() => handleDeleteExpense(item.id)}
                    className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-100 sm:opacity-0 group-hover:opacity-100 focus:opacity-100 active:scale-95"
                    title="Delete Entry"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-5 bg-rose-50/40 border-t border-rose-100/60 flex justify-between items-center">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Accumulated Section Outflow</span>
          <span className="text-xl font-black text-rose-600 tracking-tight">
            {totalDailyExpenditure.toLocaleString()} <span className="text-[10px] font-bold text-slate-400">FCFA</span>
          </span>
        </div>
      </div>

    </div>
  );
}