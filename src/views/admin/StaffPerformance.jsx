import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.jsx'; // Multilingual context hook
import { supabase } from '../../api/supabaseClient';

export default function StaffPerformance({ onBack }) {
  const { t } = useLanguage();
  const [salesData, setSalesData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [navLayer, setNavLayer] = useState('months'); 
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedStaffName, setSelectedStaffName] = useState(''); 

  useEffect(() => {
    initializePerformanceHub();
  }, []);

  const initializePerformanceHub = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUser(user);

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      const userIsAdmin = profile?.role === 'admin' || user.email?.includes('admin');
      setIsAdmin(userIsAdmin);

      let query = supabase
        .from('sales')
        .select('*, inventory(name)')
        .order('created_at', { ascending: false });

      if (!userIsAdmin) {
        query = query.or(`staff_id.eq.${user.id},created_by.eq.${user.id}`);
      }

      const { data: sales, error } = await query;
      if (error) throw error;

      const enrichedSales = (sales || []).map(sale => {
        const resolvedIdentity = sale.staff_name || sale.staff_email || 'System Terminal';
        return {
          ...sale,
          resolved_staff_name: resolvedIdentity.trim()
        };
      });

      setSalesData(enrichedSales);
    } catch (err) {
      console.error("Performance Hub Initialization Error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const processGroupedData = () => {
    const registry = {};
    salesData.forEach(sale => {
      const rawDate = new Date(sale.created_at);
      const shiftedDate = new Date(rawDate.getTime() - (6 * 60 * 60 * 1000)); // 6:00 AM Rule

      const monthKey = shiftedDate.toLocaleString('default', { month: 'long', year: 'numeric' }); 
      const dayKey = shiftedDate.toISOString().split('T')[0]; 
      const staffName = sale.resolved_staff_name;

      if (!registry[monthKey]) registry[monthKey] = {};
      if (!registry[monthKey][dayKey]) registry[monthKey][dayKey] = {};
      if (!registry[monthKey][dayKey][staffName]) {
        registry[monthKey][dayKey][staffName] = [];
      }
      registry[monthKey][dayKey][staffName].push(sale);
    });
    return registry;
  };

  const groupedRegistry = processGroupedData();

  const handleBackNavigation = () => {
    if (navLayer === 'summary') setNavLayer('staff');
    else if (navLayer === 'staff') setNavLayer('days');
    else if (navLayer === 'days') setNavLayer('months');
    else onBack();
  };

  const currentMonthDays = selectedMonth ? Object.keys(groupedRegistry[selectedMonth] || {}).sort().reverse() : [];
  const currentDayStaff = (selectedMonth && selectedDay) ? Object.keys(groupedRegistry[selectedMonth][selectedDay] || {}) : [];
  const activeTargetSales = (selectedMonth && selectedDay && selectedStaffName) 
    ? groupedRegistry[selectedMonth][selectedDay][selectedStaffName] || [] 
    : [];

  const cashToHandOver = activeTargetSales
    .filter(s => s.payment_status === 'paid')
    .reduce((sum, s) => sum + (Number(s.total_amount) || Number(s.total_price) || 0), 0);

  const pendingDebts = activeTargetSales
    .filter(s => s.payment_status === 'debt')
    .reduce((sum, s) => sum + (Number(s.total_amount) || Number(s.total_price) || 0), 0);

  return (
    <div className="min-h-screen bg-[#F4F3ED] text-[#111111] p-4 md:p-8 font-sans antialiased pb-24">
      <div className="max-w-xl mx-auto">
        
        {/* --- PREMIUM DYNAMIC NAVIGATION HEADER --- */}
        <div className="flex justify-between items-center mb-8 mt-2">
          <button 
            onClick={handleBackNavigation} 
            className="text-[#3F51B5] font-bold text-xs tracking-wider uppercase hover:opacity-80 transition-all active:scale-95"
          >
            {navLayer === 'months' ? (t('back_main_console') || '← Main Console') : t('back')}
          </button>
          <div className="text-right">
            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-0.5">
              {t('perf_intel_tag') || 'Performance Intel'}
            </p>
            <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-tight bg-white border border-slate-200 px-3 py-1 rounded-full shadow-sm">
              {isAdmin 
                ? (t('ceo_oversight_title') || '👑 CEO Oversight Hub') 
                : (t('shift_metrics_title') || '📋 Shift Log Metrics')}
            </h2>
          </div>
        </div>

        {/* LOADING INDICATOR STATE */}
        {loading && (
          <div className="text-center py-24 flex flex-col items-center justify-center gap-3">
            <div className="h-6 w-6 border-2 border-[#3F51B5] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">
              {t('syncing_ledgers_msg') || 'Synchronizing Corporate Ledgers...'}
            </p>
          </div>
        )}

        {/* --- LAYER 1: MONTHLY MATRIX --- */}
        {!loading && navLayer === 'months' && (
          <div className="space-y-4">
            <div className="mb-2 ml-1">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {t('historical_ledgers_label') || 'Historical Month Ledgers'}
              </h3>
            </div>
            {Object.keys(groupedRegistry).length === 0 ? (
              <div className="text-center py-16 bg-white rounded-[28px] border border-dashed border-slate-200 text-slate-400 text-xs font-bold uppercase tracking-wider">
                {t('no_history_found') || 'No Logged Operational History Found'}
              </div>
            ) : (
              Object.keys(groupedRegistry).map(month => (
                <button
                  key={month}
                  onClick={() => { setSelectedMonth(month); setNavLayer('days'); }}
                  className="w-full bg-white border border-slate-100 hover:border-slate-200 p-6 rounded-[28px] flex justify-between items-center transition-all hover:scale-[1.01] active:scale-99 shadow-sm group"
                >
                  <div className="text-left">
                    <p className="text-base font-extrabold tracking-tight text-slate-900 group-hover:text-[#3F51B5] transition-colors">{month}</p>
                    <p className="text-[11px] text-slate-400 font-medium tracking-wide mt-0.5">
                      {Object.keys(groupedRegistry[month]).length} {t('shift_windows_logged') || 'Operational Shift Windows Logged'}
                    </p>
                  </div>
                  <span className="text-slate-300 group-hover:text-[#3F51B5] font-bold transition-colors text-sm">➔</span>
                </button>
              ))
            )}
          </div>
        )}

        {/* --- LAYER 2: SHIFT BOXES WITHIN MONTH --- */}
        {!loading && navLayer === 'days' && (
          <div className="space-y-3">
            <div className="mb-4 ml-1">
              <span className="text-[9px] font-black bg-indigo-50 text-[#3F51B5] border border-indigo-100/50 px-3 py-1 rounded-md uppercase tracking-wider">
                {t('target_scope_badge') || 'Active Target Scope'}
              </span>
              <h3 className="text-xl font-black text-slate-900 mt-2.5 tracking-tight">{selectedMonth}</h3>
            </div>
            {currentMonthDays.map(dayKey => {
              const formattedDate = new Date(dayKey).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
              return (
                <button
                  key={dayKey}
                  onClick={() => { setSelectedDay(dayKey); setNavLayer('staff'); }}
                  className="w-full bg-white border border-slate-100 p-5 rounded-[22px] flex justify-between items-center transition-all hover:scale-[1.01] active:scale-99 shadow-sm text-left"
                >
                  <div>
                    <p className="text-sm font-extrabold text-slate-800 uppercase tracking-tight">{formattedDate}</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                      {t('operational_window_desc') || 'Standard Operational Window: 06:00 AM - 06:00 AM'}
                    </p>
                  </div>
                  <span className="text-[10px] font-extrabold text-[#3F51B5] bg-indigo-50/60 border border-indigo-100/50 px-3 py-1.5 rounded-xl uppercase tracking-wider">
                    {t('view_run_btn') || 'View Run'}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* --- LAYER 3: STAFF SHIFTS --- */}
        {!loading && navLayer === 'staff' && (
          <div className="space-y-3">
            <div className="mb-4 ml-1">
              <span className="text-[9px] font-black bg-emerald-50 text-emerald-600 border border-emerald-100/50 px-3 py-1 rounded-md uppercase tracking-wider">
                {t('target_date_badge') || 'Target Date Selection'}
              </span>
              <h3 className="text-lg font-black text-slate-900 mt-2.5 tracking-tight">
                {new Date(selectedDay).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </h3>
            </div>
            {currentDayStaff.map(name => {
              const staffSales = groupedRegistry[selectedMonth][selectedDay][name];
              const totalVolume = staffSales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
              return (
                <button
                  key={name}
                  onClick={() => { setSelectedStaffName(name); setNavLayer('summary'); }}
                  className="w-full bg-white border border-slate-100 p-5 rounded-[22px] flex justify-between items-center transition-all hover:scale-[1.01] active:scale-99 shadow-sm text-left"
                >
                  <div className="truncate max-w-[65%]">
                    <p className="text-sm font-extrabold text-slate-900 tracking-tight truncate uppercase">{name}</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                      {staffSales.length} {t('active_ledger_runs_label') || 'Active Ledger Runs'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-emerald-600 tracking-tight">
                      {totalVolume.toLocaleString()} <span className="text-[9px] text-slate-400 font-bold">FCFA</span>
                    </p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                      {t('gross_turnover_label') || 'Gross Turnover'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* --- LAYER 4: ACCOUNT CLOSING REPORT --- */}
        {!loading && navLayer === 'summary' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="mb-6 ml-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {t('shift_closeout_title') || 'Shift Closeout Summary'}
              </p>
              <h2 className="text-xl font-black text-slate-900 truncate tracking-tight mt-1 uppercase">{selectedStaffName}</h2>
              <p className="text-[11px] text-slate-400 font-semibold tracking-wide mt-0.5">
                {t('window_label') || 'Window'}: {new Date(selectedDay).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>

            {/* HIGH END REVENUE ACCENT DISPLAY HERO */}
            <div className="bg-gradient-to-br from-[#3F51B5] to-[#2A3B93] p-8 rounded-[32px] shadow-md mb-4 relative overflow-hidden text-center text-white border border-indigo-200">
              <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest mb-1">
                {t('cash_to_handover_label') || 'Cash to Hand Over'}
              </p>
              <p className="text-4xl font-black tracking-tight">
                {cashToHandOver.toLocaleString()} <span className="text-sm font-medium opacity-60 ml-0.5">FCFA</span>
              </p>
              <div className="absolute -right-4 -bottom-6 text-white/5 text-6xl font-black rotate-12 select-none pointer-events-none">CASH</div>
            </div>

            {/* UNPAID TABS HIGHLIGHT */}
            <div className="bg-white border border-slate-100 p-5 rounded-[24px] shadow-sm mb-6 flex justify-between items-center">
              <div>
                <p className="text-[#FF5A50] text-[10px] font-bold uppercase tracking-widest mb-0.5">
                  {t('unpaid_tabs_balance_label') || 'Unpaid Tabs Balance (Debts Logged)'}
                </p>
                <p className="text-lg font-black text-slate-900 tracking-tight">
                  {pendingDebts.toLocaleString()} <span className="text-[11px] text-slate-400 font-bold">FCFA</span>
                </p>
              </div>
              <div className="w-9 h-9 rounded-full bg-red-50 text-[#FF5A50] border border-red-100/50 flex items-center justify-center font-black text-xs">!</div>
            </div>

            {/* ITEMIZED RUN ACTIVITY LOG */}
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">
              {t('itemized_receipts_label') || 'Itemized Ledger Receipts'}
            </h3>
            <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
              {activeTargetSales.map(sale => (
                <div key={sale.id} className="p-5 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-extrabold text-slate-800 tracking-tight uppercase">
                      {sale.inventory?.name || t('product_item_fallback') || 'Product Item'}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                      {t('client_label') || 'Client'}: {sale.customer_name || t('direct_retail_fallback') || 'Direct Retail Counter'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-black tracking-tight ${sale.payment_status === 'paid' ? 'text-emerald-600' : 'text-[#FF5A50]'}`}>
                      {Math.floor(sale.total_amount || sale.total_price || 0).toLocaleString()} <span className="text-[9px] font-bold opacity-50">FCFA</span>
                    </p>
                    <p className={`text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-md mt-1 inline-block ${
                      sale.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-[#FF5A50]'
                    }`}>
                      {sale.payment_status === 'paid' ? (t('payment_status_paid') || 'paid') : (t('payment_status_debt') || 'debt')}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* ACTION PRINT TRIGGER */}
            <button 
              onClick={() => window.print()} 
              className="mt-6 w-full bg-[#1C1B1F] text-white py-4.5 rounded-2xl font-bold uppercase text-xs tracking-widest shadow-sm active:scale-[0.99] hover:opacity-90 transition-all"
            >
              {t('print_summary_btn') || 'Print Shift Receipt Summary 📄'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}