// src/views/admin/StaffPerformance.jsx
import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  ShieldCheck, 
  ClipboardList, 
  Globe, 
  MapPin, 
  ChevronRight, 
  Loader2, 
  Calendar, 
  User, 
  Wallet, 
  AlertCircle, 
  Receipt, 
  Printer, 
  Clock,
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { supabase } from '../../api/supabaseClient';

export default function StaffPerformance({ onBack }) {
  const { t } = useLanguage();
  const [salesData, setSalesData] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState("all");
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

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

      setUserProfile(profile);
      const userIsAdmin = profile?.role === 'admin' || user.email?.includes('admin');
      setIsAdmin(userIsAdmin);

      // Load branches directories for admin filters
      if (userIsAdmin) {
        const { data: branchList } = await supabase.from('branches').select('id, name').order('name');
        setBranches(branchList || []);
      } else if (profile?.branch_id) {
        setSelectedBranchId(profile.branch_id);
      }

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
    
    // Filter out sales before parsing if a specific branch scope is targeted
    const filteredSales = salesData.filter(sale => {
      if (selectedBranchId === "all") return true;
      return sale.branch_id === selectedBranchId;
    });

    filteredSales.forEach(sale => {
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
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 font-sans antialiased pb-24">
      <div className="max-w-xl mx-auto space-y-6">
        
        {/* DYNAMIC NAVIGATION HEADER */}
        <div className="flex flex-col gap-4 mt-2">
          <div className="flex justify-between items-center gap-2">
            <button 
              onClick={handleBackNavigation} 
              className="inline-flex items-center gap-1.5 text-indigo-600 font-extrabold text-xs tracking-wider uppercase hover:text-indigo-700 transition-colors py-1 px-2.5 rounded-lg hover:bg-indigo-50 active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{navLayer === 'months' ? (t('back_main_console') || 'Main Console') : t('back')}</span>
            </button>
            <div className="text-right">
              <p className="text-slate-400 font-extrabold text-[10px] uppercase tracking-widest mb-0.5">
                {t('perf_intel_tag') || 'Performance Intel'}
              </p>
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-tight bg-white border border-slate-200/80 px-3 py-1 rounded-full shadow-xs inline-flex items-center gap-1.5">
                {isAdmin ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>{t('ceo_oversight_title') || 'CEO Oversight Hub'}</span>
                  </>
                ) : (
                  <>
                    <ClipboardList className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>{t('shift_metrics_title') || 'Shift Log Metrics'}</span>
                  </>
                )}
              </h2>
            </div>
          </div>

          {/* GLOBAL BRANCH SELECTOR FILTER CONTROL */}
          {isAdmin && navLayer === 'months' && (
            <div className="relative">
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full bg-white border border-slate-200/80 text-slate-800 font-extrabold text-xs rounded-2xl px-4 py-3.5 pr-10 shadow-xs outline-none tracking-wide focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all appearance-none cursor-pointer"
              >
                <option value="all">Across All Branches (Global Archive)</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>Station: {b.name}</option>
                ))}
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <Globe className="w-4 h-4" />
              </div>
            </div>
          )}
        </div>

        {/* LOADING STATE */}
        {loading && (
          <div className="text-center py-24 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">
              {t('syncing_ledgers_msg') || 'Synchronizing Corporate Ledgers...'}
            </p>
          </div>
        )}

        {/* LAYER 1: MONTHLY MATRIX */}
        {!loading && navLayer === 'months' && (
          <div className="space-y-4">
            <div className="mb-2 ml-1">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>{t('historical_ledgers_label') || 'Historical Month Ledgers'}</span>
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
                  className="w-full bg-white border border-slate-200/80 hover:border-indigo-300 p-6 rounded-[28px] flex justify-between items-center transition-all hover:shadow-md active:scale-[0.99] shadow-xs group"
                >
                  <div className="text-left">
                    <p className="text-base font-extrabold tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">{month}</p>
                    <p className="text-[11px] text-slate-400 font-medium tracking-wide mt-0.5">
                      {Object.keys(groupedRegistry[month]).length} {t('shift_windows_logged') || 'Operational Shift Windows Logged'}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                </button>
              ))
            )}
          </div>
        )}

        {/* LAYER 2: SHIFT BOXES WITHIN MONTH */}
        {!loading && navLayer === 'days' && (
          <div className="space-y-3">
            <div className="mb-4 ml-1">
              <span className="text-[9px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1 rounded-md uppercase tracking-wider inline-flex items-center gap-1">
                <Calendar className="w-3 h-3 text-indigo-600" />
                <span>{t('target_scope_badge') || 'Active Target Scope'}</span>
              </span>
              <h3 className="text-xl font-black text-slate-900 mt-2.5 tracking-tight">{selectedMonth}</h3>
            </div>
            {currentMonthDays.map(dayKey => {
              const formattedDate = new Date(dayKey).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
              return (
                <button
                  key={dayKey}
                  onClick={() => { setSelectedDay(dayKey); setNavLayer('staff'); }}
                  className="w-full bg-white border border-slate-200/80 hover:border-indigo-300 p-5 rounded-[22px] flex justify-between items-center transition-all active:scale-[0.99] shadow-xs text-left group"
                >
                  <div>
                    <p className="text-sm font-extrabold text-slate-900 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">{formattedDate}</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5 inline-flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{t('operational_window_desc') || 'Standard Operational Window: 06:00 AM - 06:00 AM'}</span>
                    </p>
                  </div>
                  <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-xl uppercase tracking-wider group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    {t('view_run_btn') || 'View Run'}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* LAYER 3: STAFF SHIFTS */}
        {!loading && navLayer === 'staff' && (
          <div className="space-y-3">
            <div className="mb-4 ml-1">
              <span className="text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1 rounded-md uppercase tracking-wider inline-flex items-center gap-1">
                <Calendar className="w-3 h-3 text-emerald-600" />
                <span>{t('target_date_badge') || 'Target Date Selection'}</span>
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
                  className="w-full bg-white border border-slate-200/80 hover:border-indigo-300 p-5 rounded-[22px] flex justify-between items-center transition-all active:scale-[0.99] shadow-xs text-left group"
                >
                  <div className="truncate max-w-[60%]">
                    <p className="text-sm font-extrabold text-slate-900 tracking-tight truncate uppercase group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                      <User className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="truncate">{name}</span>
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                      {staffSales.length} {t('active_ledger_runs_label') || 'Active Ledger Runs'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-emerald-600 tracking-tight">
                      {totalVolume.toLocaleString()} <span className="text-[9px] text-slate-400 font-bold">FCFA</span>
                    </p>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                      {t('gross_turnover_label') || 'Gross Turnover'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* LAYER 4: ACCOUNT CLOSING REPORT */}
        {!loading && navLayer === 'summary' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="ml-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {t('shift_closeout_title') || 'Shift Closeout Summary'}
              </p>
              <h2 className="text-xl font-black text-slate-900 truncate tracking-tight mt-0.5 uppercase flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600" />
                <span>{selectedStaffName}</span>
              </h2>
              <p className="text-[11px] text-slate-400 font-semibold tracking-wide mt-0.5">
                {t('window_label') || 'Window'}: {new Date(selectedDay).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>

            {/* HIGH END REVENUE ACCENT DISPLAY HERO */}
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-900 p-8 rounded-[32px] shadow-sm relative overflow-hidden text-center text-white border border-indigo-500/30">
              <p className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center justify-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-indigo-300" />
                <span>{t('cash_to_handover_label') || 'Cash to Hand Over'}</span>
              </p>
              <p className="text-4xl font-black tracking-tight">
                {cashToHandOver.toLocaleString()} <span className="text-sm font-medium opacity-70 ml-0.5">FCFA</span>
              </p>
              <div className="absolute -right-2 -bottom-4 text-white/5 select-none pointer-events-none">
                <Wallet className="w-32 h-32" />
              </div>
            </div>

            {/* UNPAID TABS HIGHLIGHT */}
            <div className="bg-white border border-slate-200/80 p-5 rounded-[24px] shadow-xs flex justify-between items-center">
              <div>
                <p className="text-rose-600 text-[10px] font-black uppercase tracking-widest mb-0.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                  <span>{t('unpaid_tabs_balance_label') || 'Unpaid Tabs Balance (Debts Logged)'}</span>
                </p>
                <p className="text-lg font-black text-slate-900 tracking-tight">
                  {pendingDebts.toLocaleString()} <span className="text-[11px] text-slate-400 font-bold">FCFA</span>
                </p>
              </div>
              <div className="w-9 h-9 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200/80 flex items-center justify-center font-black">
                <AlertCircle className="w-5 h-5 text-rose-500" />
              </div>
            </div>

            {/* ITEMIZED RUN ACTIVITY LOG */}
            <div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-indigo-600" />
                <span>{t('itemized_receipts_label') || 'Itemized Ledger Receipts'}</span>
              </h3>
              <div className="bg-white rounded-[28px] border border-slate-200/80 shadow-xs overflow-hidden divide-y divide-slate-100">
                {activeTargetSales.map(sale => (
                  <div key={sale.id} className="p-5 flex justify-between items-center hover:bg-slate-50/50 transition-colors">
                    <div>
                      <p className="text-sm font-extrabold text-slate-900 tracking-tight uppercase">
                        {sale.inventory?.name || t('product_item_fallback') || 'Product Item'}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                        {t('client_label') || 'Client'}: {sale.customer_name || t('direct_retail_fallback') || 'Direct Retail Counter'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-black tracking-tight ${sale.payment_status === 'paid' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {Math.floor(sale.total_amount || sale.total_price || 0).toLocaleString()} <span className="text-[9px] font-bold opacity-60">FCFA</span>
                      </p>
                      <p className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md mt-1 inline-block ${
                        sale.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80' : 'bg-rose-50 text-rose-600 border border-rose-200/80'
                      }`}>
                        {sale.payment_status === 'paid' ? (t('payment_status_paid') || 'paid') : (t('payment_status_debt') || 'debt')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ACTION PRINT TRIGGER */}
            <button 
              onClick={() => window.print()} 
              className="w-full bg-slate-900 hover:bg-slate-950 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-wider shadow-xs hover:shadow active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4 text-indigo-400" />
              <span>{t('print_summary_btn') || 'Print Shift Receipt Summary'}</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
}