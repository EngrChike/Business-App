import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.jsx'; // Connected to your global toggle engine
import { supabase } from '../../api/supabaseClient';

export default function Reports({ onBack }) {
  const { t } = useLanguage();
  const [salesData, setSalesData] = useState([]);
  const [expenseData, setExpenseData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetchProfileAndLedgers();
  }, []);

  const fetchProfileAndLedgers = async () => {
    setLoading(true);
    try {
      // 1. Authenticate user session
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 2. Pull profile metadata role permissions
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const userIsAdmin = profile?.role === 'admin' || user.email?.includes('admin');
      setIsAdmin(userIsAdmin);

      // 3. Gather transaction databases
      const { data: sales } = await supabase
        .from('sales')
        .select('*, inventory(name, bought_price)')
        .order('created_at', { ascending: false });
      
      const { data: expenses } = await supabase
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false });

      setSalesData(sales || []);
      setExpenseData(expenses || []);
    } catch (err) {
      console.error("Ledger retrieval crash:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSettle = async (sale) => {
    // Structural guard double-check
    if (!isAdmin) {
      alert(t('access_denied_msg') || "❌ Operational Access Denied: Only Admin can resolve accounts.");
      return;
    }

    const currentAmount = Number(sale.total_amount || sale.total_price || 0);
    const clientIdentity = sale.customer_name || t('walking_customer') || "Walking Customer";
    
    // 1. Ask if the money is complete
    const isComplete = window.confirm(
      `💰 Debtor: ${clientIdentity}\nBalance Due: ${currentAmount.toLocaleString()} FCFA\n\nIs the payment COMPLETE? \n[Click OK for YES, Cancel for PARTIAL payment]`
    );

    let updateData = {};

    if (isComplete) {
      // --- FULL SETTLEMENT WORKFLOW ---
      const confirmFull = window.confirm(
        `Are you sure you want to fully settle this debt? Press OK to confirm.`
      );
      if (!confirmFull) return;

      updateData = { payment_status: 'paid', is_verified: true };
    } {
      // --- PARTIAL SETTLEMENT WORKFLOW ---
      const userInput = window.prompt(
        `Enter the amount paid by ${clientIdentity} (Current total: ${currentAmount.toLocaleString()} FCFA):`
      );

      // If user clicked cancel on prompt or left it empty
      if (userInput === null || userInput.trim() === "") return;

      const amountPaid = Number(userInput);

      if (isNaN(amountPaid) || amountPaid <= 0) {
        alert("❌ Invalid amount. Please enter a valid number greater than 0.");
        return;
      }

      if (amountPaid > currentAmount) {
        alert(`❌ Error: Amount paid (${amountPaid.toLocaleString()} FCFA) cannot be higher than the remaining balance (${currentAmount.toLocaleString()} FCFA).`);
        return;
      }

      const remainingBalance = currentAmount - amountPaid;

      // Calculate state changes
      if (remainingBalance === 0) {
        const confirmFullPartial = window.confirm(
          `This amount will fully clear the debt. Press OK to confirm.`
        );
        if (!confirmFullPartial) return;
        updateData = { payment_status: 'paid', is_verified: true, total_amount: 0, total_price: 0 };
      } else {
        const confirmPartial = window.confirm(
          `Confirm payment of ${amountPaid.toLocaleString()} FCFA.\nNew remaining balance will be: ${remainingBalance.toLocaleString()} FCFA.\n\nPress OK to confirm.`
        );
        if (!confirmPartial) return;

        // Keep status as debt but drop the remaining balance calculation down
        updateData = { 
          total_amount: remainingBalance,
          total_price: remainingBalance
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
      
      // Hot reload metrics without full page refresh
      const { data: refreshedSales } = await supabase
        .from('sales')
        .select('*, inventory(name, bought_price)')
        .order('created_at', { ascending: false });
        
      setSalesData(refreshedSales || []);
    } catch (err) { 
      alert(err.message); 
    } finally {
      setLoading(false);
    }
  };

  // Metric Calculation Aggregations
  const totalRevenue = salesData.filter(s => s.payment_status === 'paid').reduce((sum, s) => sum + Number(s.total_amount || s.total_price || 0), 0);
  const totalDebt = salesData.filter(s => s.payment_status === 'debt').reduce((sum, s) => sum + Number(s.total_amount || s.total_price || 0), 0);
  const totalExpenses = expenseData.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;

  return (
    <div className="min-h-screen bg-[#F4F3ED] p-4 md:p-8 font-sans text-[#1C1B1F] pb-24">
      <div className="max-w-6xl mx-auto">
        
        {/* --- DYNAMIC HEADER HUB --- */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <button 
              onClick={onBack} 
              className="text-[#3F51B5] font-bold text-xs tracking-wider uppercase mb-1 flex items-center gap-1 hover:opacity-80 transition-opacity"
            >
              {t('back')}
            </button>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-[#111111]">
              {t('service_ops') || "Service Operations"}
            </h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Audit & Compliance Ledger
            </p>
          </div>
          
          <button 
            onClick={() => window.print()}
            className="w-full sm:w-auto bg-[#1C1B1F] text-[#F4F3ED] px-6 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-sm hover:opacity-90 transition-all active:scale-98"
          >
            📥 {t('print_summary_btn') ? t('print_summary_btn').replace('📄', '') : "Print Statement"}
          </button>
        </div>

        {/* LOADING ENGINE MASK */}
        {loading && (
          <div className="text-center py-16 flex flex-col items-center justify-center gap-2">
            <div className="h-5 w-5 border-2 border-[#3F51B5] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t('loading')}</p>
          </div>
        )}

        {/* --- EXECUTIVE HIGH-FIDELITY METRICS GRID --- */}
        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            
            {/* Box 1: Inflows */}
            <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 flex flex-col justify-between min-h-[128px]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Verified Inflow</span>
              <div>
                <span className="text-2xl font-black tracking-tight text-slate-900">{totalRevenue.toLocaleString()}</span>
                <span className="text-xs font-bold text-slate-400 ml-1">FCFA</span>
              </div>
            </div>

            {/* Box 2: Expenses Outflows */}
            <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 flex flex-col justify-between min-h-[128px]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Operational Outflow</span>
              <div>
                <span className="text-2xl font-black tracking-tight text-slate-800">-{totalExpenses.toLocaleString()}</span>
                <span className="text-xs font-bold text-slate-400 ml-1">FCFA</span>
              </div>
            </div>

            {/* Box 3: Debts Warning Panel */}
            <div className="bg-[#FFEBEA] p-6 rounded-[24px] flex flex-col justify-between min-h-[128px] border border-[#FFD0CD]">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-[#FF5A50] uppercase tracking-widest">Uncollected Debt</span>
                <span className="bg-[#FF5A50] text-white text-[8px] font-black tracking-wider px-2 py-0.5 rounded-md uppercase">
                  {t('critical_stock') || "ACTION REQ"}
                </span>
              </div>
              <div>
                <span className="text-2xl font-black tracking-tight text-[#FF5A50]">{totalDebt.toLocaleString()}</span>
                <span className="text-xs font-bold text-[#FF5A50] opacity-70 ml-1">FCFA</span>
              </div>
            </div>

            {/* Box 4: Disposable Margin */}
            <div className="bg-[#E8F5E9] p-6 rounded-[24px] border border-[#C8E6C9] flex flex-col justify-between min-h-[128px]">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Net Disposable Profit</span>
              <div>
                <span className="text-2xl font-black tracking-tight text-emerald-700">{netProfit.toLocaleString()}</span>
                <span className="text-xs font-bold text-emerald-600 opacity-70 ml-1">FCFA</span>
              </div>
            </div>

          </div>
        )}

        {/* --- UNIFIED TRANSACTION LEDGER REGISTRY --- */}
        {!loading && (
          <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 bg-white border-b border-slate-50 flex justify-between items-center">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Transaction Registry</span>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Live Audit Active</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/50">
                    <th className="p-5">Date & Time</th>
                    <th className="p-5">Type</th>
                    <th className="p-5">Entity Description</th>
                    <th className="p-5 text-right">Value Amount</th>
                    <th className="p-5 text-center">Ledger Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {[...salesData, ...expenseData.map(e => ({...e, isExpense: true}))]
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                    .map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                        
                        {/* TIMESTAMP COLUMN */}
                        <td className="p-5 text-xs font-semibold text-slate-600">
                          {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} 
                          <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        
                        {/* TAG BADGE */}
                        <td className="p-5">
                          <span className={`text-[9px] font-black px-2.5 py-1 rounded-md tracking-wider ${
                            item.isExpense ? 'bg-red-50 text-[#FF5A50]' : 'bg-indigo-50 text-[#3F51B5]'
                          }`}>
                            {item.isExpense ? 'EXPENSE' : 'SALE'}
                          </span>
                        </td>

                        {/* ENTITY DESCRIPTION DESC */}
                        <td className="p-5 font-bold text-slate-800 text-sm tracking-tight">
                          {item.isExpense 
                            ? (t(`cat_${item.category?.toLowerCase().replace(' ', '_')}`) || item.category) 
                            : (item.inventory?.name || t('product_item_fallback') || 'Product Item')
                          }
                          {!item.isExpense && (
                            <span className="block text-[10px] text-slate-400 font-medium normal-case mt-0.5">
                              {t('client_label') || 'Client'}: {item.customer_name || t('walking_customer') || 'Walking Customer'}
                            </span>
                          )}
                        </td>

                        {/* FINANCIAL VALUE */}
                        <td className={`p-5 text-right font-black text-sm tracking-tight ${item.isExpense ? 'text-[#FF5A50]' : 'text-slate-900'}`}>
                          {item.isExpense ? '-' : '+'}{Math.floor(item.amount || item.total_amount || item.total_price || 0).toLocaleString()}
                        </td>

                        {/* RECONCILIATION CTAS */}
                        <td className="p-5 text-center">
                          {item.payment_status === 'debt' ? (
                            isAdmin ? (
                              <button 
                                onClick={() => handleSettle(item)} 
                                className="bg-[#3F51B5] text-white text-[10px] font-bold px-4 py-2 rounded-xl shadow-sm hover:opacity-90 active:scale-95 transition-all uppercase tracking-wider"
                              >
                                {t('clear_total_balance_btn') ? t('clear_total_balance_btn').replace('✅', '') : "Settle Account"}
                              </button>
                            ) : (
                              <span className="text-[#FF5A50] font-bold text-[10px] uppercase tracking-wider bg-red-50 px-2.5 py-1 rounded-md">
                                {t('payment_status_debt') || "Debt"}
                              </span>
                            )
                          ) : (
                            <div className="flex items-center justify-center gap-1 text-emerald-600 font-bold text-xs uppercase tracking-wide">
                              <span>✓</span> Secure
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}