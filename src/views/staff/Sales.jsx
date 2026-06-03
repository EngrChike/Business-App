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

    // 🌟 FIX: Cleaned up the comment syntax on line 182 below to eliminate the parsing error completely
    setConfirmation({
      product_id: prod.id,
      name: prod.name,
      quantity: parseInt(quantity) || 1,
      total: (prod.selling_price || 0) * (parseInt(quantity) || 1),
      status: 'paid' // Locked cleanly to immediate cash transaction
    });
  };

  const executeLocalStateDeduction = useCallback(() => {
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
      <div className="min-h-screen bg-[#F4F3ED] flex items-center justify-center font-sans">
        <div className="text-center font-bold text-slate-500 animate-pulse text-xs uppercase tracking-widest">
          Securing Branch Sandbox Terminal Context...
        </div>
      </div>
    );
  }

  if (!userBranch) {
    return (
      <div className="min-h-screen bg-[#F4F3ED] flex items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 max-w-sm rounded-[35px] shadow-sm border border-slate-200 text-center">
          <span className="text-4xl block mb-4">🛑</span>
          <h2 className="text-base font-black text-slate-900 uppercase tracking-tight mb-2">Terminal Access Locked</h2>
          <p className="text-xs font-medium text-slate-400 leading-relaxed mb-6">
            Your account hasn't been mapped to an active operating location branch yet. Please contact your manager to assign your terminal station.
          </p>
          <button onClick={() => supabase.auth.signOut()} className="w-full py-3.5 bg-red-500 text-white font-black rounded-2xl text-xs uppercase tracking-wider shadow-sm active:scale-95 transition-all">
            Log Out Securely
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F3ED] text-[#111111] p-4 md:p-8 font-sans antialiased pb-24">
      <div className="max-w-xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6 mt-2 relative">
          <div className="flex-1 mr-2">
            <button onClick={onBack} className="text-[#3F51B5] font-bold text-xs tracking-wider uppercase mb-1 block hover:opacity-80 transition-opacity">
              {t('back')}
            </button>
            <h1 className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              {t('sales_entry') || 'Sales Entry'}
            </h1>
            
            <div className="flex flex-wrap gap-1.5 items-center mt-2 w-full">
              {userRole === 'admin' ? (
                <select
                  value={userBranch.id}
                  onChange={(e) => handleAdminBranchSwitch(e.target.value)}
                  className="bg-slate-900 text-emerald-400 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl outline-none border border-slate-800 cursor-pointer shadow-md focus:border-emerald-500 max-w-[220px] truncate"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id} className="bg-white text-slate-900 font-bold">
                      👑 Switch: {b.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md tracking-wider inline-block">
                  📍 Station: {userBranch.name}
                </span>
              )}
              
              {userRole === 'manager' && (
                <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md tracking-wider inline-block">
                  💼 Manager View
                </span>
              )}
            </div>
          </div>

          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center justify-center h-10 w-10 rounded-full bg-[#1C1B1F] text-white font-black text-sm uppercase shadow-md active:scale-95 transition-all"
            >
              {staffDisplayName.charAt(0)}
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 top-12 w-60 bg-white border border-slate-100 rounded-[22px] shadow-xl p-4 z-50">
                <div className="pb-2 border-b border-slate-100">
                  <p className="text-xs font-black text-slate-800 truncate">{staffDisplayName}</p>
                  <p className="text-[10px] font-medium text-slate-400 truncate mt-0.5">{user?.email}</p>
                  <p className="text-[9px] font-black text-indigo-600 uppercase mt-1">Role: {userRole}</p>
                </div>
                <div className="pt-2">
                  <button 
                    onClick={() => supabase.auth.signOut()} 
                    className="w-full text-left px-2 py-1.5 text-xs font-bold text-[#FF5A50] hover:bg-red-50 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <span>🚪</span> {t('sign_out')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* INPUT FORM */}
        <div className="bg-white p-6 md:p-8 rounded-[28px] shadow-sm border border-slate-100 mb-6">
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider">
            {t('choose_item') || 'Choose Item'}
          </label>
          <select 
            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl mb-4 font-bold outline-none text-slate-800 text-sm focus:border-slate-200 transition-all" 
            value={selectedProduct} 
            onChange={(e) => setSelectedProduct(e.target.value)}
          >
            <option value="">-- {t('select_item_option') || 'Select Item'} --</option>
            {inventory.map(item => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.stock_quantity} left) — {item.selling_price?.toLocaleString()} FCFA
              </option>
            ))}
          </select>

          <div className="flex gap-3 mb-5">
            <div className="w-full">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider text-center">
                {t('qty_label') || 'Qty'}
              </label>
              <input type="number" min="1" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-center text-slate-800 text-sm" value={quantity} onChange={e => setQuantity(e.target.value)} />
            </div>
          </div>

          <button onClick={handleProcess} className="w-full py-4.5 bg-[#1C1B1F] text-white rounded-2xl font-bold uppercase text-xs tracking-widest shadow-sm active:scale-[0.99] hover:opacity-90 transition-all mt-2">
            {t('confirm_order_btn') || 'Confirm Order'}
          </button>
        </div>

        {/* PERFORMANCE SUMMARY */}
        <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
            <h2 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider truncate mr-2">
              {userRole === 'manager' || userRole === 'admin' 
                ? `${t('branch_sales_today') || 'Total Branch Sales Today'} [${userBranch.name.toUpperCase()}]`
                : (t('sales_shift_today') || 'Your Sales Shift Today')}
            </h2>
            <div className="bg-[#3F51B5] text-white px-3 py-0.5 rounded-full text-[10px] font-extrabold flex-shrink-0">{dailySales.length}</div>
          </div>

          <div className="p-5 divide-y divide-slate-100 max-h-60 overflow-y-auto pr-2">
            {dailySales.length === 0 ? (
              <p className="text-slate-400 text-xs italic py-4 text-center">
                {t('no_transactions_shift') || 'No transactions completed yet this shift.'}
              </p>
            ) : (
              dailySales.map((sale) => (
                <div key={sale.id} className="flex justify-between items-center py-3.5 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-bold text-sm text-slate-800">{sale.inventory?.name || "Product Item"}</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                      {t('quantity_size') || 'Quantity Size'}: {sale.quantity}
                    </p>
                  </div>
                  <p className="font-extrabold text-slate-900 text-sm">+{sale.total_amount?.toLocaleString()} <span className="text-[10px] text-slate-400 font-bold">FCFA</span></p>
                </div>
              ))
            )}
          </div>

          <div className="p-5 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {userRole === 'manager' || userRole === 'admin' ? (t('total_branch_revenue') || 'Total Branch Revenue') : (t('shift_revenue') || 'Shift Revenue')}
            </span>
            <span className="text-xl font-black text-[#3F51B5] tracking-tight">{totalDayRevenue.toLocaleString()} <span className="text-[10px] font-bold text-slate-400">FCFA</span></span>
          </div>
        </div>

        {/* MODAL */}
        {confirmation && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white w-full max-w-sm rounded-[28px] p-8 text-center shadow-2xl animate-in zoom-in-95 duration-150">
              <p className="text-3xl font-black text-slate-900 tracking-tight">{confirmation.total.toLocaleString()} FCFA</p>
              <p className="text-[#3F51B5] font-bold mt-1 mb-8 uppercase text-[10px] tracking-wider">{confirmation.name}</p>
              <div className="flex flex-col gap-2">
                <button 
                  type="button"
                  onClick={finalize} 
                  disabled={loading}
                  className="w-full py-4 bg-[#3F51B5] text-white rounded-xl font-bold uppercase text-xs tracking-wider disabled:opacity-50 active:scale-98 transition-all shadow-sm"
                >
                  {loading ? (t('processing_ledger') || 'Processing Ledger...') : (t('approve_sale_btn') || 'Approve Sale')}
                </button>
                <button type="button" onClick={() => setConfirmation(null)} className="w-full py-3.5 bg-slate-50 text-slate-400 rounded-xl font-bold uppercase text-xs tracking-wider hover:bg-slate-100 transition-colors">
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