import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext.jsx'; // Global translation link
import { supabase } from '../../api/supabaseClient';

export default function Expenses({ onBack }) {
  const { t } = useLanguage(); // Initialize the translation engine parser
  const [expenses, setExpenses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  
  // Executive Filter Control System
  const [activeFilterBranch, setActiveFilterBranch] = useState('all'); 
  
  const [formData, setFormData] = useState({ 
    category: 'Transport', 
    amount: '', 
    description: '',
    branch_id: 'general' // Defaults to general corporate overhead
  });

  // Dynamically translated UI categories
  const categories = useMemo(() => [
    { value: 'Transport', label: t('cat_transport') || 'Transport' },
    { value: 'Electricity', label: t('cat_electricity') || 'Electricity' },
    { value: 'Staff Lunch', label: t('cat_staff_lunch') || 'Staff Lunch' },
    { value: 'Repairs', label: t('cat_repairs') || 'Repairs' },
    { value: 'Cleaning', label: t('cat_cleaning') || 'Cleaning' },
    { value: 'Security', label: t('cat_security') || 'Security' },
    { value: 'Other', label: t('cat_other') || 'Other' }
  ], [t]);

  // Derived current branch location name from local cache
  const currentBranchName = useMemo(() => {
    if (!userProfile?.branch_id) return 'Local counter';
    const match = branches.find(b => b.id === userProfile.branch_id);
    return match ? match.name : 'Local counter';
  }, [branches, userProfile]);

  // Secured isolated database fetching pipeline
  const fetchExpenses = useCallback(async (profile, userIsAdmin) => {
    const targetProfile = profile || userProfile;
    const targetIsAdmin = userIsAdmin !== undefined ? userIsAdmin : isAdmin;
    
    try {
      let query = supabase
        .from('expenses')
        .select('*, branches(name)')
        .order('created_at', { ascending: false });

      // SECURITY ENFORCEMENT: Enforce hard server-side filtering for non-admins
      if (!targetIsAdmin) {
        if (targetProfile?.branch_id) {
          query = query.eq('branch_id', targetProfile.branch_id);
        } else {
          // Fallback context: Force empty block array if profile mapping configuration is corrupted
          setExpenses([]);
          return;
        }
      }
        
      const { data, error } = await query;
      if (error) throw error;
      setExpenses(data || []);
    } catch (err) {
      console.error("Error reading expenses records securely:", err.message);
    }
  }, [userProfile, isAdmin]);

  const initializeExpensesModule = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Pull security profiles for role routing
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      setUserProfile(profile);
      const userIsAdmin = profile?.role === 'admin' || user.email?.includes('admin');
      setIsAdmin(userIsAdmin);

      // Fetch active branches directory lists
      const { data: branchData, error: branchError } = await supabase
        .from('branches')
        .select('id, name')
        .order('name');
      
      if (branchError) throw branchError;
      setBranches(branchData || []);

      // Autofill non-admin form state to force staff branch assignment lockdown
      if (!userIsAdmin && profile?.branch_id) {
        setFormData(prev => ({ ...prev, branch_id: profile.branch_id }));
      } else {
        setFormData(prev => ({ ...prev, branch_id: 'general' }));
      }

      // Pass parameter dependencies inline to bypass stale closure states during initiation
      await fetchExpenses(profile, userIsAdmin);
    } catch (err) {
      console.error("Error initializing expenses ledger:", err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchExpenses]);

  useEffect(() => { 
    initializeExpensesModule(); 
  }, [initializeExpensesModule]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || loading) return;
    
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Process corporate overhead selection vs explicit location uuid targets
      const targetBranchId = formData.branch_id === 'general' ? null : formData.branch_id;

      const { error } = await supabase.from('expenses').insert([{
        category: formData.category,
        description: formData.description.trim(),
        amount: parseFloat(formData.amount),
        staff_id: user.id,
        branch_id: targetBranchId
      }]);

      if (error) throw error;

      // Clean up inputs securely
      setFormData(prev => ({
        category: 'Transport',
        amount: '',
        description: '',
        branch_id: isAdmin ? 'general' : (userProfile?.branch_id || 'general')
      }));
      
      await fetchExpenses();
    } catch (err) {
      console.error("Failed recording expenditure transaction:", err.message);
      alert("Error logging expense: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter dataset dynamically based on executive interactive dashboard tabs (Admins Only)
  const filteredExpenses = expenses.filter(exp => {
    if (!isAdmin) return true; // Already isolated via query constraint on server side
    if (activeFilterBranch === 'all') return true;
    if (activeFilterBranch === 'general') return exp.branch_id === null;
    return exp.branch_id === activeFilterBranch;
  });

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 pb-24 font-sans antialiased">
      <div className="max-w-4xl mx-auto">
        <button 
          onClick={onBack} 
          className="text-blue-600 font-black mb-6 uppercase text-xs tracking-widest block hover:opacity-80 transition-all"
        >
          {t('back')}
        </button>
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <h1 className="text-2xl font-black uppercase italic tracking-tight text-slate-900">
            {t('business_expenses') || 'Business Expenses'}
          </h1>
          <span className={`text-[10px] font-black border px-3 py-1 rounded-full uppercase tracking-widest shadow-sm ${
            isAdmin ? 'bg-slate-900 text-emerald-400 border-slate-800' : 'bg-white text-slate-700 border-slate-200'
          }`}>
            {isAdmin ? '👑 Global Ledger View' : `📍 Location Safe Lock: ${currentBranchName}`}
          </span>
        </div>

        {/* ADMIN OVERVIEW FILTER TERMINAL INTERACTIVE TABS */}
        {isAdmin && (
          <div className="mb-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveFilterBranch('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm border ${
                activeFilterBranch === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              🌐 Global Consolidated
            </button>
            <button
              type="button"
              onClick={() => setActiveFilterBranch('general')}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm border ${
                activeFilterBranch === 'general' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              💼 General Corporate Overhead
            </button>
            {branches.map(b => (
              <button
                key={b.id}
                type="button"
                onClick={() => setActiveFilterBranch(b.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm border ${
                  activeFilterBranch === b.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                📍 {b.name}
              </button>
            ))}
          </div>
        )}

        {/* LOG EXPENSE FORM */}
        <form onSubmit={handleSubmit} className="bg-white p-6 md:p-8 rounded-[40px] shadow-sm border border-slate-100 mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Category Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">Expense Type</label>
              <select 
                disabled={loading}
                className="p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm h-[54px] outline-none focus:bg-slate-100/80 transition-all text-slate-800 disabled:opacity-60"
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
              >
                {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            {/* Branch Assignment Selector Control */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">Location Destination</label>
              <select
                className="p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm h-[54px] outline-none text-slate-800 disabled:opacity-60 disabled:bg-slate-100"
                value={formData.branch_id}
                disabled={!isAdmin || loading}
                onChange={e => setFormData({...formData, branch_id: e.target.value})}
              >
                {!isAdmin && userProfile?.branch_id ? (
                  <option value={userProfile.branch_id}>📍 Current Branch Station</option>
                ) : (
                  <>
                    <option value="general">💼 General / Corporate Overhead</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>📍 {b.name}</option>
                    ))}
                  </>
                )}
              </select>
            </div>

            {/* Amount input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">Sum Outflow</label>
              <input 
                type="number" 
                min="0.01"
                step="any"
                disabled={loading}
                placeholder={`${t('amount_label') || 'Amount'} (FCFA)`} 
                className="p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm h-[54px] outline-none focus:bg-slate-100/80 transition-all text-slate-800 disabled:opacity-60"
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: e.target.value})}
                required
              />
            </div>

            {/* Description input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">Audit Note</label>
              <input 
                type="text" 
                disabled={loading}
                placeholder={`${t('description_label') || 'Description'} (${t('optional_label') || 'Optional'})`} 
                className="p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm h-[54px] outline-none focus:bg-slate-100/80 transition-all text-slate-800 disabled:opacity-60"
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full mt-6 bg-red-500 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-md hover:bg-red-600 disabled:opacity-50 active:scale-[0.98] transition-all"
          >
            {loading ? 'Processing Transaction...' : (t('log_expense_btn') || 'Log Business Expense') + ' 💸'}
          </button>
        </form>

        {/* EXPENSE LOG LIST ARCHIVE */}
        <div className="space-y-3">
          {loading && expenses.length === 0 ? (
            <div className="text-center py-12 text-slate-400 font-bold uppercase tracking-widest text-xs animate-pulse">
              Syncing Expenses Vault...
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-[32px] border border-dashed border-slate-200 text-slate-400 text-xs font-bold uppercase tracking-wider">
              No expenditures recorded under this filter target context
            </div>
          ) : (
            filteredExpenses.map(exp => {
              const matchedCat = categories.find(c => c.value === exp.category);
              return (
                <div key={exp.id} className="bg-white p-5 rounded-3xl border border-slate-100 flex justify-between items-center hover:shadow-sm transition-all">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black text-red-500 uppercase tracking-wider">
                        {matchedCat ? matchedCat.label : exp.category}
                      </span>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-tight ${
                        exp.branch_id ? 'bg-blue-50 text-blue-600 border border-blue-100/50' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {exp.branches?.name ? `📍 ${exp.branches.name}` : '💼 General Corporate'}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-800">
                      {exp.description || (t('no_description') || 'No description')}
                    </p>
                    <p className="text-[9px] text-slate-400 mt-0.5">
                      {new Date(exp.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <p className="text-lg font-black text-slate-900 tracking-tight whitespace-nowrap">
                    -{exp.amount?.toLocaleString()} <span className="text-[10px] font-bold text-slate-400">FCFA</span>
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}