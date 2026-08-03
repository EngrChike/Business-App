// src/components/Reports.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, 
  Receipt, 
  Printer, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Loader2, 
  ClipboardList,
  Calendar,
  X,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { supabase } from '../../api/supabaseClient';

export default function Reports({ onBack }) {
  const { t } = useLanguage();
  const [salesData, setSalesData] = useState([]);
  const [expenseData, setExpenseData] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState("all");
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Grouping Logic Tools
  const getMonthKey = (dateValue) => {
    const d = new Date(dateValue);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const currentMonthKey = getMonthKey(new Date());

  // Print & Folder Modal States
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printStartMonth, setPrintStartMonth] = useState("");
  const [printEndMonth, setPrintEndMonth] = useState("");
  const [isPrintingMode, setIsPrintingMode] = useState(false);
  
  // Folder Expansion State (Default: Current Month is open)
  const [expandedMonths, setExpandedMonths] = useState([currentMonthKey]);

  const toggleMonth = (monthKey) => {
    setExpandedMonths(prev => 
      prev.includes(monthKey) 
        ? prev.filter(m => m !== monthKey) 
        : [...prev, monthKey]
    );
  };

  const fetchLedgers = useCallback(async (branchFilter, profile, currentIsAdmin) => {
    setLoading(true);
    try {
      let salesQuery = supabase.from('sales').select('*, inventory(name, bought_price)').order('created_at', { ascending: false });
      let expenseQuery = supabase.from('expenses').select('*').order('created_at', { ascending: false });

      if (branchFilter !== "all") {
        salesQuery = salesQuery.eq('branch_id', branchFilter);
        expenseQuery = expenseQuery.eq('branch_id', branchFilter);
      } else if (!currentIsAdmin && profile?.branch_id) {
        salesQuery = salesQuery.eq('branch_id', profile.branch_id);
        expenseQuery = expenseQuery.eq('branch_id', profile.branch_id);
      }

      const [{ data: sales, error: salesErr }, { data: expenses, error: expErr }] = await Promise.all([
        salesQuery,
        expenseQuery
      ]);

      if (salesErr) throw salesErr;
      if (expErr) throw expErr;

      setSalesData(sales || []);
      setExpenseData(expenses || []);
    } catch (err) {
      console.error("Ledger retrieval crash:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const fetchProfileAndMetadata = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('role, branch_id')
          .eq('id', user.id)
          .single();

        if (profileErr) throw profileErr;

        const userIsAdmin = profile?.role === 'admin' || user.email?.includes('admin');
        setIsAdmin(userIsAdmin);
        setUserProfile(profile);

        let initialBranchFilter = "all";

        if (userIsAdmin) {
          const { data: branchList } = await supabase.from('branches').select('id, name').order('name');
          setBranches(branchList || []);
        } else if (profile?.branch_id) {
          initialBranchFilter = profile.branch_id;
          setSelectedBranchId(profile.branch_id);
        }

        await fetchLedgers(initialBranchFilter, profile, userIsAdmin);

      } catch (err) {
        console.error("Profile metadata resolution crash:", err.message);
        setLoading(false);
      }
    };

    fetchProfileAndMetadata();
  }, [fetchLedgers]);

  useEffect(() => {
    if (userProfile) {
      fetchLedgers(selectedBranchId, userProfile, isAdmin);
    }
  }, [selectedBranchId, userProfile, isAdmin, fetchLedgers]);

  const handleSettle = async (sale) => {
    if (!isAdmin) {
      alert(t('access_denied_msg') || "Operational Access Denied: Only Admin can resolve accounts.");
      return;
    }

    const currentAmount = Number(sale.total_amount || 0);
    const originalPrice = Number(sale.total_price || sale.total_amount || 0); 
    const clientIdentity = sale.customer_name || t('walking_customer') || "Walking Customer";
    
    const isComplete = window.confirm(
      `Debtor: ${clientIdentity}\nRemaining Balance: ${currentAmount.toLocaleString()} FCFA\nOriginal Value: ${originalPrice.toLocaleString()} FCFA\n\nIs this current payment COMPLETE? \n[Click OK for FULL SETTLEMENT, Cancel for a PARTIAL payment installment]`
    );

    let updateData = {};

    if (isComplete) {
      const confirmFull = window.confirm(
        `Are you sure you want to fully settle this account? Press OK to confirm.`
      );
      if (!confirmFull) return;

      updateData = { 
        payment_status: 'paid', 
        is_verified: true,
        total_amount: originalPrice
      };
    } else {
      const userInput = window.prompt(
        `Enter the installment amount paid by ${clientIdentity} (Remaining balance: ${currentAmount.toLocaleString()} FCFA):`
      );

      if (userInput === null || userInput.trim() === "") return;

      const amountPaid = Number(userInput);

      if (isNaN(amountPaid) || amountPaid <= 0) {
        alert("Invalid amount. Please enter a valid number greater than 0.");
        return;
      }

      if (amountPaid > currentAmount) {
        alert(`Error: Amount paid (${amountPaid.toLocaleString()} FCFA) cannot be higher than the remaining balance (${currentAmount.toLocaleString()} FCFA).`);
        return;
      }

      const remainingBalance = currentAmount - amountPaid;

      if (remainingBalance === 0) {
        const confirmFullPartial = window.confirm(
          `This amount completely clears the remaining balance. Press OK to switch account to PAID.`
        );
        if (!confirmFullPartial) return;
        
        updateData = { 
          payment_status: 'paid', 
          is_verified: true,
          total_amount: originalPrice
        };
      } else {
        const confirmPartial = window.confirm(
          `Confirm collection of ${amountPaid.toLocaleString()} FCFA.\nNew outstanding balance will be: ${remainingBalance.toLocaleString()} FCFA.\n\nPress OK to update log.`
        );
        if (!confirmPartial) return;

        updateData = { 
          total_amount: remainingBalance
        };
      }
    }
    
    try {
      setLoading(true);
      const { error } = await supabase
        .from('sales')
        .update(updateData)
        .eq('id', sale.id);
      
      if (error) throw error;
      
      await fetchLedgers(selectedBranchId, userProfile, isAdmin);
    } catch (err) { 
      alert(err.message); 
    } finally {
      setLoading(false);
    }
  };

  const formatMonthName = (monthKey) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  };

  const allTransactions = [...salesData, ...expenseData.map(e => ({...e, isExpense: true}))]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const groupedTransactions = allTransactions.reduce((acc, curr) => {
    const key = getMonthKey(curr.created_at);
    if (!acc[key]) acc[key] = [];
    acc[key].push(curr);
    return acc;
  }, {});

  const availableMonths = Object.keys(groupedTransactions).sort((a, b) => b.localeCompare(a));

  const filteredMonthKeys = availableMonths.filter(monthKey => {
    if (!isPrintingMode) return true;
    let include = true;
    if (printStartMonth) include = include && monthKey >= printStartMonth;
    if (printEndMonth) include = include && monthKey <= printEndMonth;
    return include;
  });

  const displayedTransactions = filteredMonthKeys.flatMap(key => groupedTransactions[key]);
  
  const totalRevenue = displayedTransactions.filter(t => !t.isExpense && t.payment_status === 'paid').reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
  const totalDebt = displayedTransactions.filter(t => !t.isExpense && t.payment_status === 'debt').reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
  const totalExpenses = displayedTransactions.filter(t => t.isExpense).reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;

  const handlePrintAction = () => {
    setIsPrintingMode(true);
    setIsPrintModalOpen(false);
    // Delay ensures React conditionally renders all print-selected folders as open before browser triggers print dialog
    setTimeout(() => {
      window.print();
      setIsPrintingMode(false);
    }, 600);
  };

  const cleanTranslation = (key, fallback) => {
    const raw = t(key) || fallback;
    return raw.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').replace(/[📄✅❌💰🌐📍⏳✓]/g, '').trim();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-800 pb-24 max-w-6xl mx-auto antialiased">
      
      {/* HEADER HUB */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b border-slate-200/80 pb-5 print:hidden">
        <div>
          <button 
            onClick={onBack} 
            className="inline-flex items-center gap-1.5 text-indigo-600 font-extrabold uppercase text-xs hover:text-indigo-700 transition-colors py-1 px-2.5 rounded-lg hover:bg-indigo-50 mb-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('back')}</span>
          </button>
          <h1 className="text-xl md:text-2xl font-black italic uppercase tracking-tight text-slate-900 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-indigo-600 not-italic shrink-0" />
            <span>{t('service_ops') || "Service Operations"}</span>
          </h1>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
            Audit & Compliance Ledger
          </p>
        </div>
        
        <div className="w-full md:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {isAdmin && (
            <div className="relative flex-1 sm:w-72">
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full bg-white border border-slate-200 text-slate-800 font-extrabold text-xs rounded-2xl px-4 py-3 shadow-xs outline-none tracking-wide focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all uppercase cursor-pointer"
              >
                <option value="all">Global Consolidated (All Branches)</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>Station: {b.name}</option>
                ))}
              </select>
            </div>
          )}

          <button 
            onClick={() => setIsPrintModalOpen(true)}
            className="bg-slate-900 hover:bg-slate-950 text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider shadow-xs hover:shadow active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4 text-indigo-400" />
            <span>{cleanTranslation('print_summary_btn', 'Print Statement')}</span>
          </button>
        </div>
      </div>

      {/* PRINT RANGE MODAL */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-white rounded-[32px] shadow-2xl p-8 w-full max-w-md relative">
            <button 
              onClick={() => setIsPrintModalOpen(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">Select Print Range</h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Filter by Month</p>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">From Month</label>
                <select 
                  value={printStartMonth} 
                  onChange={(e) => setPrintStartMonth(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-extrabold text-sm rounded-xl px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">Start of Records</option>
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{formatMonthName(m)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">To Month</label>
                <select 
                  value={printEndMonth} 
                  onChange={(e) => setPrintEndMonth(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-extrabold text-sm rounded-xl px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">Current Month</option>
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{formatMonthName(m)}</option>
                  ))}
                </select>
              </div>
            </div>

            <button 
              onClick={handlePrintAction}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg hover:shadow-indigo-500/25 active:scale-[0.98] transition-all flex justify-center items-center gap-2"
            >
              <Printer className="w-5 h-5" />
              <span>Confirm & Print</span>
            </button>
          </div>
        </div>
      )}

      {/* PRINT HEADER DOCUMENTATION */}
      <div className="hidden print:block mb-8 text-center border-b border-slate-200 pb-6">
        <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">DonChike Cosmetics</h1>
        <h2 className="text-lg font-bold text-slate-700 mt-1">Official Audit & Ledger Statement</h2>
        <p className="text-sm font-bold text-slate-500 mt-2">
          {printStartMonth ? formatMonthName(printStartMonth) : 'Start'} — {printEndMonth ? formatMonthName(printEndMonth) : 'Present'}
        </p>
      </div>

      {loading && (
        <div className="min-h-[280px] bg-white rounded-[32px] border border-slate-200/80 p-12 flex flex-col items-center justify-center text-xs font-black uppercase text-slate-400 tracking-widest gap-3 shadow-xs my-6 print:hidden">
          <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
          <span>{t('loading') || "Loading Ledger Audit Data..."}</span>
        </div>
      )}

      {/* GLOBAL METRICS FOR SELECTED RANGE */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-[28px] shadow-xs border border-slate-200/80 flex flex-col justify-between min-h-[136px] transition-all hover:border-slate-300">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Verified Inflow</span>
              <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight text-slate-900">{totalRevenue.toLocaleString()}</span>
              <span className="text-xs font-extrabold text-slate-400 ml-1.5">FCFA</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[28px] shadow-xs border border-slate-200/80 flex flex-col justify-between min-h-[136px] transition-all hover:border-slate-300">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Operational Outflow</span>
              <div className="p-2 bg-rose-50 rounded-xl text-rose-600">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight text-rose-600">-{totalExpenses.toLocaleString()}</span>
              <span className="text-xs font-extrabold text-slate-400 ml-1.5">FCFA</span>
            </div>
          </div>

          <div className="bg-rose-50/60 p-6 rounded-[28px] shadow-xs border border-rose-100 flex flex-col justify-between min-h-[136px] transition-all hover:border-rose-200">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Uncollected Debt</span>
              <span className="bg-rose-600 text-white text-[9px] font-black tracking-wider px-2.5 py-1 rounded-lg uppercase flex items-center gap-1 shadow-xs">
                <AlertTriangle className="w-3 h-3" />
                <span className="hidden sm:inline">{cleanTranslation('critical_stock', 'ACTION REQ')}</span>
              </span>
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight text-rose-600">{totalDebt.toLocaleString()}</span>
              <span className="text-xs font-extrabold text-rose-400 ml-1.5">FCFA</span>
            </div>
          </div>

          <div className="bg-emerald-50/60 p-6 rounded-[28px] shadow-xs border border-emerald-100 flex flex-col justify-between min-h-[136px] transition-all hover:border-emerald-200">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Net Disposable Profit</span>
              <div className="p-2 bg-emerald-100/70 rounded-xl text-emerald-700">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight text-emerald-800">{netProfit.toLocaleString()}</span>
              <span className="text-xs font-extrabold text-emerald-600 opacity-80 ml-1.5">FCFA</span>
            </div>
          </div>
        </div>
      )}

      {/* MONTHLY ACCORDION FOLDERS */}
      {!loading && filteredMonthKeys.length > 0 ? (
        <div className="space-y-4">
          {filteredMonthKeys.map((monthKey) => {
            const monthData = groupedTransactions[monthKey];
            
            // Check if folder is expanded. During printing, expand them all.
            const isExpanded = isPrintingMode || expandedMonths.includes(monthKey);
            
            const monthRev = monthData.filter(t => !t.isExpense && t.payment_status === 'paid').reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
            const monthExp = monthData.filter(t => t.isExpense).reduce((sum, e) => sum + Number(e.amount || 0), 0);
            const monthNet = monthRev - monthExp;

            return (
              <div key={monthKey} className={`bg-white rounded-[24px] border transition-colors shadow-xs overflow-hidden break-inside-avoid ${isExpanded ? 'border-indigo-200 shadow-sm' : 'border-slate-200/80 hover:border-slate-300'}`}>
                
                {/* FOLDER BUTTON HEADER */}
                <div 
                  onClick={() => toggleMonth(monthKey)}
                  className="p-5 lg:px-6 bg-slate-50/50 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 cursor-pointer hover:bg-slate-100/50 transition-colors group select-none"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl border shadow-xs transition-colors ${isExpanded ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-white border-slate-200 text-slate-400 group-hover:border-slate-300 group-hover:text-slate-600'}`}>
                      {isExpanded ? <FolderOpen className="w-5 h-5" /> : <Folder className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                        {formatMonthName(monthKey)}
                      </h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{monthData.length} Transactions</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-row items-center justify-between w-full lg:w-auto gap-6 lg:gap-8">
                    <div className="flex items-center gap-4 text-xs font-black tracking-tight">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-slate-400 uppercase tracking-widest">Inflow</span>
                        <span className="text-emerald-600">+{monthRev.toLocaleString()}</span>
                      </div>
                      <div className="w-px h-6 bg-slate-200"></div>
                      <div className="flex flex-col">
                        <span className="text-[9px] text-slate-400 uppercase tracking-widest">Outflow</span>
                        <span className="text-rose-600">-{monthExp.toLocaleString()}</span>
                      </div>
                      <div className="w-px h-6 bg-slate-200"></div>
                      <div className="flex flex-col">
                        <span className="text-[9px] text-slate-400 uppercase tracking-widest">Net</span>
                        <span className={monthNet >= 0 ? "text-slate-900" : "text-rose-600"}>{monthNet.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* FOLDER CHEVRON ICON */}
                    <div className="text-slate-300 group-hover:text-indigo-600 transition-colors print:hidden">
                      {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {/* EXPANDED FOLDER CONTENT (TABLE) */}
                {isExpanded && (
                  <div className="border-t border-slate-100 overflow-x-auto print:block">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-white">
                          <th className="p-5">Date & Time</th>
                          <th className="p-5">Type</th>
                          <th className="p-5">Entity Description</th>
                          <th className="p-5 text-right">Value Amount</th>
                          <th className="p-5 text-center print:hidden">Ledger Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {monthData.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-5 text-xs font-bold text-slate-700 whitespace-nowrap">
                              {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} 
                              <span className="block text-[10px] text-slate-400 font-semibold mt-0.5">
                                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </td>
                            <td className="p-5">
                              <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg tracking-wider border ${
                                item.isExpense ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-indigo-50 border-indigo-100 text-indigo-600'
                              }`}>
                                {item.isExpense ? 'EXPENSE' : 'SALE'}
                              </span>
                            </td>
                            <td className="p-5 font-extrabold text-slate-800 text-sm tracking-tight">
                              {item.isExpense 
                                ? (t(`cat_${item.category?.toLowerCase().replace(' ', '_')}`) || item.category) 
                                : (item.inventory?.name || t('product_item_fallback') || 'Product Item')
                              }
                              {!item.isExpense && (
                                <span className="block text-[10px] text-slate-400 font-bold normal-case mt-0.5">
                                  {t('client_label') || 'Client'}: {item.customer_name || t('walking_customer') || 'Walking Customer'}
                                </span>
                              )}
                              {!item.isExpense && item.payment_status === 'debt' && Number(item.total_amount) < Number(item.total_price) && (
                                <span className="mt-1.5 inline-flex items-center gap-1.5 text-[10px] text-indigo-700 font-black bg-indigo-50 border border-indigo-100/80 px-2.5 py-1 rounded-xl">
                                  <Clock className="w-3 h-3 text-indigo-600 shrink-0" />
                                  <span>Collected: {(Number(item.total_price) - Number(item.total_amount)).toLocaleString()} / Total: {Number(item.total_price).toLocaleString()} FCFA</span>
                                </span>
                              )}
                            </td>
                            <td className={`p-5 text-right font-black text-sm tracking-tight ${item.isExpense ? 'text-rose-600' : 'text-slate-900'}`}>
                              {item.isExpense ? '-' : '+'}{Math.floor(item.amount || item.total_amount || 0).toLocaleString()}
                            </td>
                            <td className="p-5 text-center print:hidden">
                              {item.payment_status === 'debt' ? (
                                isAdmin ? (
                                  <button 
                                    onClick={() => handleSettle(item)} 
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black px-3.5 py-2 rounded-xl shadow-xs active:scale-95 transition-all uppercase tracking-wider inline-flex items-center gap-1.5"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>{cleanTranslation('clear_total_balance_btn', 'Settle Account')}</span>
                                  </button>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-rose-600 font-black text-[10px] uppercase tracking-wider bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-xl">
                                    <AlertTriangle className="w-3 h-3 text-rose-500" />
                                    <span>{t('payment_status_debt') || "Debt"}</span>
                                  </span>
                                )
                              ) : (
                                <div className="inline-flex items-center justify-center gap-1.5 text-emerald-600 font-black text-xs uppercase tracking-wide bg-emerald-50/80 border border-emerald-100 px-3 py-1.5 rounded-xl">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span>Secure</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        !loading && (
          <div className="bg-white rounded-[32px] border border-slate-200/80 p-12 text-center shadow-xs">
            <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-black text-slate-900 tracking-tight mb-1">No Ledger Records Found</h3>
            <p className="text-sm font-bold text-slate-500">There are no transactions in the selected date range.</p>
          </div>
        )
      )}
    </div>
  );
}