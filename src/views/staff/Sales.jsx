// src/views/staff/Sales.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext.jsx'; 
import { supabase } from '../../api/supabaseClient';
import { useAuth } from "../../context/AuthContext"; 
import { saveSaleOffline } from '../../utils/offlineStorage.js';

export default function Sales({ onBack, branchId: dashboardBranchId, refreshMetrics }) {
  const { user } = useAuth();
  const { t } = useLanguage(); 
  
  const [userBranch, setUserBranch] = useState(null); 
  const [branches, setBranches] = useState([]);       
  const [userRole, setUserRole] = useState("staff"); 
  const [checkingBranch, setCheckingBranch] = useState(true);
  const [inventory, setInventory] = useState([]);
  const [dailySales, setDailySales] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [confirmation, setConfirmation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef(null);

  const fetchInv = useCallback(async (branchId) => {
    const activeBranchId = branchId || userBranch?.id;
    if (!activeBranchId) return;
    
    try {
      const cacheKey = `monbilan_cached_inventory_${activeBranchId}`;
      if (!navigator.onLine) {
        const offlineCache = localStorage.getItem(cacheKey);
        if (offlineCache) setInventory(JSON.parse(offlineCache));
        return;
      }

      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .eq('branch_id', activeBranchId)
        .gt('stock_quantity', 0)
        .order('name', { ascending: true });
        
      if (error) throw error;
      setInventory(data || []);
      localStorage.setItem(cacheKey, JSON.stringify(data || []));
    } catch (err) {
      console.error("Inventory Fetch Error:", err.message);
    }
  }, [userBranch?.id]);

  const fetchDailySales = useCallback(async (branchId, role) => {
    const activeBranchId = branchId || userBranch?.id;
    const activeRole = role || userRole;
    if (!user || !activeBranchId) return;
    
    try {
      const targetShiftBoundary = new Date();
      if (targetShiftBoundary.getHours() < 6) {
        targetShiftBoundary.setDate(targetShiftBoundary.getDate() - 1);
      }
      targetShiftBoundary.setHours(6, 0, 0, 0);

      let query = supabase
        .from('sales')
        .select(`
          id, 
          total_amount, 
          quantity, 
          created_at,
          inventory ( name )
        `)
        .eq('branch_id', activeBranchId)
        .gte('created_at', targetShiftBoundary.toISOString())
        .order('created_at', { ascending: false });

      if (activeRole !== 'manager' && activeRole !== 'admin') {
        query = query.eq('seller_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setDailySales(data || []);
    } catch (err) {
      console.error("Daily Sales Fetch Error:", err.message);
    }
  }, [user, userBranch?.id, userRole]);

  useEffect(() => {
    const resolveStaffBranch = async () => {
      if (!user) return;
      try {
        setCheckingBranch(true);

        if (dashboardBranchId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, branches(name)')
            .eq('id', user.id)
            .single();

          const assumedRole = profile?.role || 'manager';
          setUserRole(assumedRole);

          const branchPayload = {
            id: dashboardBranchId,
            name: profile?.branches?.name || 'Active Operating Location'
          };
          setUserBranch(branchPayload);

          await Promise.all([
            fetchInv(dashboardBranchId),
            fetchDailySales(dashboardBranchId, assumedRole)
          ]);
          return;
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('branch_id, role, branches(name)')
          .eq('id', user.id)
          .single();

        if (!error && profile) {
          const fetchedRole = profile.role || 'staff';
          setUserRole(fetchedRole);

          if (fetchedRole === 'admin') {
            const { data: allBranches, error: bError } = await supabase
              .from('branches')
              .select('*')
              .order('name', { ascending: true });

            if (!bError && allBranches && allBranches.length > 0) {
              setBranches(allBranches);
              const defaultBranch = { id: allBranches[0].id, name: allBranches[0].name };
              setUserBranch(defaultBranch);
              
              await Promise.all([
                fetchInv(allBranches[0].id),
                fetchDailySales(allBranches[0].id, fetchedRole)
              ]);
            }
          } else if (profile.branch_id) {
            const branchPayload = {
              id: profile.branch_id,
              name: profile.branches?.name || 'Assigned Location'
            };
            setUserBranch(branchPayload);
            
            await Promise.all([
              fetchInv(profile.branch_id),
              fetchDailySales(profile.branch_id, fetchedRole)
            ]);
          }
        }
      } catch (err) {
        console.error("Branch check failure, attempting fallback:", err);
      } finally {
        setCheckingBranch(false);
      }
    };

    resolveStaffBranch();
  }, [user, dashboardBranchId, fetchInv, fetchDailySales]);

  const handleAdminBranchSwitch = async (branchId) => {
    const targetBranch = branches.find(b => b.id === branchId);
    if (!targetBranch) return;

    const switchedPayload = { id: targetBranch.id, name: targetBranch.name };
    setUserBranch(switchedPayload);
    setInventory([]);
    setDailySales([]);

    await Promise.all([
      fetchInv(targetBranch.id),
      fetchDailySales(targetBranch.id, userRole)
    ]);
  };

  useEffect(() => { 
    if (!userBranch?.id) return;

    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    }

    const handleAutoSyncRefresh = () => {
      fetchInv();
      fetchDailySales();
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener('sales-synced', handleAutoSyncRefresh);
    window.addEventListener('online', handleAutoSyncRefresh);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener('sales-synced', handleAutoSyncRefresh);
      window.removeEventListener('online', handleAutoSyncRefresh);
    };
  }, [userBranch?.id, fetchInv, fetchDailySales]);

  const handleProcess = () => {
    const prod = inventory.find(i => i.id === selectedProduct);
    if (!prod) return alert(t('alert_select_product') || "Select a product first");
    
    if (parseInt(quantity) > prod.stock_quantity) {
      return alert(`${t('low_stock_warning') || 'Insufficient Stock! Only'} ${prod.stock_quantity} ${t('units_left') || 'items left.'}`);
    }

    setConfirmation({
      product_id: prod.id,
      name: prod.name,
      quantity: parseInt(quantity) || 1,
      total: (prod.selling_price || 0) * (parseInt(quantity) || 1),
      status: 'paid' 
    });
  };

  const executeLocalStateDeduction = useCallback(() => {
    if (!userBranch?.id || !confirmation) return;
    
    setInventory(prev => {
      const parsedUpdatedInv = prev.map(item => {
        if (item.id === confirmation.product_id) {
          return { ...item, stock_quantity: Math.max(0, item.stock_quantity - confirmation.quantity) };
        }
        return item;
      }).filter(item => item.stock_quantity > 0);
      
      const cacheKey = `monbilan_cached_inventory_${userBranch.id}`;
      localStorage.setItem(cacheKey, JSON.stringify(parsedUpdatedInv));
      return parsedUpdatedInv;
    });

    const localVisualLogItem = {
      id: 'local_temp_' + Date.now(),
      total_amount: confirmation.total,
      quantity: confirmation.quantity,
      created_at: new Date().toISOString(),
      inventory: { name: `${confirmation.name} (En attente de sync ⏳)` }
    };
    
    setDailySales(prev => [localVisualLogItem, ...prev]);
    clearFormFields();
  }, [confirmation, userBranch?.id]);

  const finalize = async () => {
    if (!confirmation || !user || !userBranch?.id || loading) return;
    setLoading(true);

    const activeStaffName = user.user_metadata?.full_name || user.full_name || user.email || 'System Terminal';
    
    const salePayload = {
      product_id: confirmation.product_id,
      quantity: confirmation.quantity,
      total_amount: confirmation.total,
      total_price: confirmation.total,
      seller_id: user.id,
      staff_id: user.id,
      created_by: user.id, 
      staff_email: user.email,
      staff_name: activeStaffName.trim(), 
      payment_status: 'paid',
      customer_name: t('cash_customer') || "Cash Customer", 
      customer_phone: "N/A",
      is_verified: false,
      branch_id: userBranch.id 
    };

    try {
      if (!navigator.onLine) {
        await saveSaleOffline(salePayload);
        executeLocalStateDeduction();
        if (typeof refreshMetrics === 'function') refreshMetrics();
        alert("⚠️ Mode Hors-ligne : Vente enregistrée en local !");
        return;
      }

      const { error: saleError } = await supabase.from('sales').insert([salePayload]);
      if (saleError) throw saleError;

      const prod = inventory.find(i => i.id === confirmation.product_id);
      if (prod) {
        const { error: stockError } = await supabase
          .from('inventory')
          .update({ stock_quantity: Math.max(0, prod.stock_quantity - confirmation.quantity) })
          .eq('id', prod.id);

        if (stockError) throw stockError;
      }

      await fetchInv();
      await fetchDailySales();
      clearFormFields();
      
      if (typeof refreshMetrics === 'function') {
        await refreshMetrics();
      }

      alert(t('alert_sale_recorded') || "Sale Recorded Successfully!");
    } catch (error) {
      console.error("Online push failed, falling back to local database engine:", error);
      try {
        await saveSaleOffline(salePayload);
        executeLocalStateDeduction();
        if (typeof refreshMetrics === 'function') refreshMetrics();
        alert("📡 Réseau instable. Transaction sécurisée localement.");
      } catch (fallbackErr) {
        alert("Critical storage error: " + fallbackErr.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const clearFormFields = () => {
    setConfirmation(null);
    setSelectedProduct("");
    setQuantity(1);
  };

  const totalDayRevenue = dailySales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
  const staffDisplayName = user?.user_metadata?.full_name || 'Staff Terminal';

  if (checkingBranch) {
    return (
      <div className="min-h-screen bg-[#FDFDFB] flex items-center justify-center font-sans">
        <div className="text-center font-bold text-neutral-400 animate-pulse text-xs uppercase tracking-[0.25em]">
          Securing Premium Terminal Context...
        </div>
      </div>
    );
  }

  if (!userBranch) {
    return (
      <div className="min-h-screen bg-[#FDFDFB] flex items-center justify-center p-4 font-sans">
        <div className="bg-white p-10 max-w-sm rounded-[40px] shadow-xl border border-neutral-100 text-center">
          <span className="text-4xl block mb-4">🔒</span>
          <h2 className="text-sm font-black text-neutral-900 uppercase tracking-[0.15em] mb-3">Terminal Access Locked</h2>
          <p className="text-xs font-medium text-neutral-400 leading-relaxed mb-8 px-2">
            Your profile has not been assigned to an active operating location. Please contact administration.
          </p>
          <button onClick={() => supabase.auth.signOut()} className="w-full py-4 bg-red-950 text-white font-bold rounded-2xl text-[11px] uppercase tracking-widest shadow-lg hover:bg-red-900 active:scale-95 transition-all">
            Log Out Securely
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F3ED] text-[#1A1A1A] p-4 md:p-8 font-sans antialiased pb-24 selection:bg-neutral-900 selection:text-white">
      <div className="max-w-xl mx-auto">
        
        {/* HEADER SECTION */}
        <div className="flex justify-between items-center mb-8 mt-4 relative">
          <div className="flex-1 mr-2">
            <button onClick={onBack} className="text-neutral-500 font-extrabold text-[10px] tracking-[0.2em] uppercase mb-2 flex items-center gap-1 hover:text-neutral-900 transition-colors">
              <span>←</span> {t('back')}
            </button>
            <h1 className="text-2xl font-black tracking-tight text-neutral-900 uppercase">
              {t('sales_entry') || 'Sales Entry'}
            </h1>
            
            <div className="flex flex-wrap gap-2 items-center mt-3 w-full">
              {userRole === 'admin' ? (
                <div className="relative inline-block">
                  <select
                    value={userBranch.id}
                    onChange={(e) => handleAdminBranchSwitch(e.target.value)}
                    className="appearance-none bg-neutral-950 text-[#D4AF37] text-[10px] font-black uppercase tracking-[0.15em] pl-4 pr-10 py-2.5 rounded-xl outline-none border border-neutral-800 cursor-pointer shadow-xl focus:border-[#D4AF37] max-w-[240px] truncate transition-all"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id} className="bg-white text-neutral-900 font-bold">
                        {`👑 Switch: ${b.name}`}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#D4AF37]">
                    <span className="text-[8px]">▼</span>
                  </div>
                </div>
              ) : (
                <span className="text-[10px] font-black uppercase text-neutral-800 bg-white border border-neutral-200/60 px-3 py-2 rounded-xl tracking-widest shadow-sm">
                  📍 {userBranch.name}
                </span>
              )}
              
              {userRole === 'manager' && (
                <span className="text-[10px] font-black uppercase text-neutral-900 bg-amber-100/70 border border-amber-200 px-3 py-1.5 rounded-xl tracking-widest shadow-sm">
                  👑 Manager View
                </span>
              )}
            </div>
          </div>

          {/* USER PROFILE AVATAR */}
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center justify-center h-12 w-12 rounded-full bg-neutral-950 text-[#D4AF37] font-black text-sm uppercase shadow-xl border border-neutral-800 active:scale-95 transition-all"
            >
              {staffDisplayName.charAt(0)}
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 top-14 w-64 bg-white border border-neutral-100 rounded-[24px] shadow-2xl p-5 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
                <div className="pb-3 border-b border-neutral-100">
                  <p className="text-xs font-black text-neutral-900 truncate tracking-wide">{staffDisplayName}</p>
                  <p className="text-[10px] font-medium text-neutral-400 truncate mt-0.5">{user?.email}</p>
                  <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mt-2 bg-amber-50 px-2 py-0.5 rounded inline-block">{`Role: ${userRole}`}</p>
                </div>
                <div className="pt-3">
                  <button 
                    onClick={() => supabase.auth.signOut()} 
                    className="w-full text-left px-2 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-all flex items-center gap-2"
                  >
                    <span>🚪</span> {t('sign_out')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* INPUT BOUTIQUE FORM CARD */}
        <div className="bg-white p-6 md:p-10 rounded-[32px] shadow-xl border border-neutral-100/60 mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-neutral-800 via-neutral-950 to-neutral-800"></div>
          
          <label className="block text-[10px] font-black text-neutral-400 uppercase mb-3 tracking-[0.2em]">
            {t('choose_item') || 'Choose Premium Item'}
          </label>
          <div className="relative mb-5">
            <select 
              className="w-full p-4.5 bg-neutral-50/80 border border-neutral-200/80 rounded-2xl font-bold outline-none text-neutral-800 text-sm focus:bg-white focus:border-neutral-950 transition-all appearance-none cursor-pointer" 
              value={selectedProduct} 
              onChange={(e) => setSelectedProduct(e.target.value)}
            >
              <option value="" className="text-neutral-400">{`-- ${t('select_item_option') || 'Select Item'} --`}</option>
              {inventory.map(item => (
                <option key={item.id} value={item.id} className="text-neutral-900 font-medium">
                  {`${item.name} (${item.stock_quantity} left) — ${item.selling_price?.toLocaleString()} FCFA`}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-neutral-500">
              <span className="text-[10px]">▼</span>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-[10px] font-black text-neutral-400 uppercase mb-3 tracking-[0.2em] text-center">
              {t('qty_label') || 'Quantity Selection'}
            </label>
            <div className="flex justify-center max-w-[180px] mx-auto relative">
              <input 
                type="number" 
                min="1" 
                className="w-full py-4 px-6 bg-neutral-50/80 border border-neutral-200/80 rounded-2xl font-black text-center text-neutral-900 text-base outline-none focus:bg-white focus:border-neutral-950 transition-all shadow-inner" 
                value={quantity} 
                onChange={e => setQuantity(e.target.value)} 
              />
            </div>
          </div>

          {/* UNIQUE LUXURY SUBMIT BUTTON */}
          <button 
            onClick={handleProcess} 
            className="w-full py-5 bg-gradient-to-b from-neutral-900 to-neutral-950 text-white rounded-2xl font-black uppercase text-xs tracking-[0.25em] shadow-xl hover:from-neutral-800 hover:to-neutral-900 active:scale-[0.98] transition-all duration-150 border border-neutral-800 relative group overflow-hidden"
          >
            <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" style={{ animationDuration: '2s' }}></span>
            {t('confirm_order_btn') || 'Confirm Order'}
          </button>
        </div>

        {/* PERFORMANCE SUMMARY CARD */}
        <div className="bg-white rounded-[32px] border border-neutral-100 shadow-xl overflow-hidden">
          <div className="p-6 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/60">
            <h2 className="font-black text-[10px] text-neutral-400 uppercase tracking-[0.2em] truncate mr-2">
              {userRole === 'manager' || userRole === 'admin' 
                ? `${t('branch_sales_today') || 'Total Branch Sales Today'} [${userBranch.name.toUpperCase()}]`
                : (t('sales_shift_today') || 'Your Sales Shift Today')}
            </h2>
            <div className="bg-neutral-950 text-[#D4AF37] px-3 py-1 rounded-full text-[10px] font-black border border-neutral-800 shadow-sm flex-shrink-0">
              {dailySales.length}
            </div>
          </div>

          <div className="p-6 divide-y divide-neutral-100 max-h-64 overflow-y-auto pr-3 scrollbar-thin">
            {dailySales.length === 0 ? (
              <p className="text-neutral-400 text-xs italic py-8 text-center tracking-wide">
                {t('no_transactions_shift') || 'No transactions completed yet this shift.'}
              </p>
            ) : (
              dailySales.map((sale) => (
                <div key={sale.id} className="flex justify-between items-center py-4 first:pt-0 last:pb-0 group transition-all">
                  <div>
                    <p className="font-extrabold text-sm text-neutral-800 group-hover:text-neutral-900 transition-colors">{sale.inventory?.name || "Product Item"}</p>
                    <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mt-1">
                      {`${t('quantity_size') || 'Qty'}: ${sale.quantity}`}
                    </p>
                  </div>
                  <p className="font-black text-neutral-900 text-sm tracking-wide">
                    {`+${sale.total_amount?.toLocaleString()}`} <span className="text-[10px] text-neutral-400 font-extrabold">FCFA</span>
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="p-6 bg-neutral-950 border-t border-neutral-800 flex justify-between items-center shadow-2xl">
            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">
              {userRole === 'manager' || userRole === 'admin' ? (t('total_branch_revenue') || 'Total Branch Revenue') : (t('shift_revenue') || 'Shift Revenue')}
            </span>
            <span className="text-xl font-black text-[#D4AF37] tracking-wider">
              {totalDayRevenue.toLocaleString()} <span className="text-xs font-bold text-neutral-400">FCFA</span>
            </span>
          </div>
        </div>

        {/* PREMIUM MODAL DIALOGUE */}
        {confirmation && (
          <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-md flex items-center justify-center p-4 z-50 transition-all duration-300">
            <div className="bg-white w-full max-w-sm rounded-[36px] p-8 text-center shadow-2xl border border-neutral-100 animate-in zoom-in-95 duration-150 relative overflow-hidden">
              <div className="w-12 h-[3px] bg-neutral-300 mx-auto mb-6 rounded-full"></div>
              <p className="text-3xl font-black text-neutral-900 tracking-tight">{`${confirmation.total.toLocaleString()} FCFA`}</p>
              <p className="text-amber-600 font-black mt-2 mb-8 uppercase text-[10px] tracking-[0.15em] bg-amber-50 px-3 py-1 rounded-full inline-block">{confirmation.name}</p>
              
              <div className="flex flex-col gap-2.5">
                <button 
                  type="button"
                  onClick={finalize} 
                  disabled={loading}
                  className="w-full py-4.5 bg-neutral-950 text-white rounded-2xl font-black uppercase text-xs tracking-widest disabled:opacity-50 active:scale-98 transition-all shadow-xl border border-neutral-900"
                >
                  {loading ? (t('processing_ledger') || 'Processing Ledger...') : (t('approve_sale_btn') || 'Approve Sale')}
                </button>
                <button 
                  type="button" 
                  onClick={() => setConfirmation(null)} 
                  className="w-full py-4 bg-neutral-50 text-neutral-400 rounded-2xl font-extrabold uppercase text-xs tracking-widest hover:bg-neutral-100 hover:text-neutral-600 transition-all"
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}