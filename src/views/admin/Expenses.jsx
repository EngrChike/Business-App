// src/components/Expenses.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { supabase } from '../../api/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { saveExpenseOffline } from '../../utils/offlineStorage.js'; 

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

  // 1. Core query engine (Differentiates between specific locations and HQ)
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

      // HQ entries are identified by a NULL branch_id in the database
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

        // ADMIN FLOW: Unlock full dropdown matrix
        if (userRoleResolved === 'admin') {
          const { data: branchData } = await supabase.from('branches').select('id, name');
          setBranches(branchData || []);
          
          const initialAdminBranch = dashboardBranchId || selectedBranch || 'HEADQUARTERS';
          setSelectedBranchId(initialAdminBranch);
          await fetchExpenses(initialAdminBranch);
        } 
        
        // MANAGER FLOW: Lock boundaries down to dashboard context
        else {
          if (dashboardBranchId) {
            setSelectedBranchId(dashboardBranchId);
            await fetchExpenses(dashboardBranchId);
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

    const targetBranchPayloadId = selectedBranchId === 'HEADQUARTERS' ? null : selectedBranchId;

    const payoutPayload = {
      description: formData.description.trim(),
      amount: parseFloat(formData.amount) || 0,
      category: formData.category,
      branch_id: targetBranchPayloadId,
      created_by: user?.id,
      staff_email: user?.email || 'N/A'
    };

    setLoading(true);
    try {
      if (!navigator.onLine) {
        await saveExpenseOffline(payoutPayload);
        const tempItem = {
          id: 'temp_exp_' + Date.now(),
          ...payoutPayload,
          created_at: new Date().toISOString(),
          description: `${payoutPayload.description} (En attente de sync ⏳)`
        };
        setExpensesLog(prev => [tempItem, ...prev]);
        setFormData({ description: '', amount: '', category: 'Logistics' });
        alert("⚠️ Mode Hors-ligne : Payout safe in secondary memory!");
        if (typeof refreshMetrics === 'function') refreshMetrics();
        return;
      }

      const { error } = await supabase.from('expenses').insert([payoutPayload]);
      if (error) throw error;

      setFormData({ description: '', amount: '', category: 'Logistics' });
      await fetchExpenses(selectedBranchId);
      
      if (typeof refreshMetrics === 'function') {
        await refreshMetrics();
      }

      alert("Expenditure verified and logged perfectly.");
    } catch (err) {
      console.error("Primary pool push blocked:", err);
      try {
        await saveExpenseOffline(payoutPayload);
        alert("📡 Réseau instable. Transaction sécurisée localement.");
        if (typeof refreshMetrics === 'function') refreshMetrics();
       } catch (storeErr) {
         alert("Critical storage error: " + storeErr.message);
       }
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

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs font-black uppercase text-slate-400 tracking-widest">
        Verifying Expense Registry Clearing Matrix...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-24 font-sans max-w-2xl mx-auto">
      
      {/* HEADER CONTROLS */}
      <div className="flex justify-between items-center mb-6 border-b border-slate-200 pb-4 mt-2">
        <div className="flex items-center">
          <button onClick={onBack} className="text-red-500 font-black uppercase text-xs mr-4">← {t('back') || 'Back'}</button>
          <h1 className="text-xl font-black uppercase italic tracking-tight">Expense Registry Console</h1>
        </div>
        <span className="text-[10px] text-slate-400 font-black uppercase bg-white px-3 py-1.5 rounded-xl border tracking-wide">
          🛡️ Mode: {effectiveRole}
        </span>
      </div>

      {/* DYNAMIC ADMIN DROPDOWN (Hidden automatically from managers) */}
      {effectiveRole === 'admin' && (
        <div className="bg-white p-4 rounded-3xl border shadow-sm mb-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-0.5">Target Expense Destination</label>
            <p className="text-xs text-slate-500 font-medium">Route this transaction entry to any location ledger profile.</p>
          </div>
          <select
            value={selectedBranchId}
            onChange={(e) => handleBranchSwitch(e.target.value)}
            className="p-3 bg-slate-100 rounded-xl font-bold text-xs uppercase tracking-wide border-none text-slate-800 focus:ring-2 focus:ring-slate-900 w-full sm:w-auto min-w-[200px]"
          >
            <option value="HEADQUARTERS">🏢 Headquarters (General Corporate)</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>📍 {b.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* EXPENSE ENTRY FORM */}
      <form onSubmit={handleSubmitExpense} className="bg-white p-6 rounded-[35px] shadow-sm border mb-6">
        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
          Log Outgoing Expenditure ({selectedBranchId === 'HEADQUARTERS' ? 'Headquarters' : 'Selected Location'})
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div className="sm:col-span-2">
            <input 
              type="text"
              className="w-full p-4 bg-gray-50 rounded-2xl font-bold border-none text-sm focus:ring-2 focus:ring-red-500" 
              placeholder="What was this payout for? (e.g., Generator fuel, office supplies)"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              required
              disabled={loading}
            />
          </div>
          <div>
            <select
              className="w-full p-4 bg-gray-50 rounded-2xl font-bold border-none text-sm focus:ring-2 focus:ring-red-500 text-slate-700"
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

        <div className="flex gap-3">
          <input 
            type="number" 
            min="1"
            className="p-4 bg-red-50/60 rounded-2xl font-black border-none text-sm focus:ring-2 focus:ring-red-500 flex-1" 
            placeholder="Amount Spent (FCFA)"
            value={formData.amount}
            onChange={e => setFormData({...formData, amount: e.target.value})}
            required
            disabled={loading}
          />
          <button 
            type="submit" 
            disabled={loading}
            className="bg-slate-900 text-white px-8 rounded-2xl font-black uppercase text-xs hover:bg-black transition-all active:scale-95"
          >
            {loading ? "Processing..." : "Log Cost Payout"}
          </button>
        </div>
      </form>

      {/* TODAY'S LEDGER LOG */}
      <div className="bg-white rounded-[35px] border shadow-sm overflow-hidden">
        <div className="p-5 bg-slate-50/50 border-b flex justify-between items-center">
          <h2 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider">
            Today's Ledger: {selectedBranchId === 'HEADQUARTERS' ? 'Headquarters' : 'Selected Location'}
          </h2>
          <div className="bg-red-500 text-white px-3 py-0.5 rounded-full text-[10px] font-extrabold">{expensesLog.length}</div>
        </div>

        <div className="p-5 divide-y divide-slate-100 max-h-72 overflow-y-auto pr-2">
          {expensesLog.length === 0 ? (
            <p className="text-slate-400 text-xs italic py-4 text-center">No structural expenditure payouts logged here today.</p>
          ) : (
            expensesLog.map(item => (
              <div key={item.id} className="flex justify-between items-center py-3.5 first:pt-0 last:pb-0 group">
                <div>
                  <p className="font-bold text-sm text-slate-800 uppercase tracking-tight">{item.description}</p>
                  <span className="text-[9px] font-black uppercase text-red-500 bg-red-50 px-2 py-0.5 rounded-md mt-1 inline-block">
                    {item.category}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-black text-slate-900 text-sm">-{item.amount?.toLocaleString()} <span className="text-[10px] text-slate-400 font-bold">FCFA</span></p>
                  <button 
                    onClick={() => handleDeleteExpense(item.id)}
                    className="text-slate-300 hover:text-red-500 transition-colors text-xs p-1 opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="Delete Entry"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-5 bg-red-50/30 border-t flex justify-between items-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Accumulated Section Outflow</span>
          <span className="text-xl font-black text-red-500 tracking-tight">{totalDailyExpenditure.toLocaleString()} <span className="text-[10px] font-bold text-slate-400">FCFA</span></span>
        </div>
      </div>

    </div>
  );
}