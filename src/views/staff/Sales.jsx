import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext.jsx'; // Centralized translation wrapper hook
import { supabase } from '../../api/supabaseClient';
import { useAuth } from "../../context/AuthContext"; 
import { saveSaleOffline } from '../../utils/offlineStorage.js';

export default function Sales({ onBack }) {
  const { user } = useAuth();
  const { t } = useLanguage(); // Uses the same global state language engine
  
  const [inventory, setInventory] = useState([]);
  const [dailySales, setDailySales] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [isTab, setIsTab] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => { 
    fetchInv(); 
    if (user) fetchDailySales();

    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [user]);

  const fetchInv = async () => {
    try {
      const { data, error } = await supabase.from('inventory').select('*').gt('stock_quantity', 0);
      if (error) throw error;
      setInventory(data || []);
    } catch (err) {
      console.error("Inventory Fetch Error:", err.message);
    }
  };

  const fetchDailySales = async () => {
    if (!user) return;
    try {
      const targetShiftBoundary = new Date();
      if (targetShiftBoundary.getHours() < 6) {
        targetShiftBoundary.setDate(targetShiftBoundary.getDate() - 1);
      }
      targetShiftBoundary.setHours(6, 0, 0, 0);

      const { data, error } = await supabase
        .from('sales')
        .select(`
          id, 
          total_amount, 
          quantity, 
          created_at,
          inventory ( name )
        `)
        .eq('seller_id', user.id)
        .gte('created_at', targetShiftBoundary.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDailySales(data || []);
    } catch (err) {
      console.error("Daily Sales Fetch Error:", err.message);
    }
  };

  const handleProcess = () => {
    const prod = inventory.find(i => i.id === selectedProduct);
    if (!prod) return alert(t('alert_select_product') || "Select a product first");
    
    setConfirmation({
      product_id: prod.id,
      name: prod.name,
      quantity: parseInt(quantity) || 1,
      total: (prod.selling_price || 0) * (parseInt(quantity) || 1),
      status: isTab ? 'debt' : 'paid'
    });
  };

  const finalize = async () => {
    if (!confirmation || !user || loading) return;
    setLoading(true);

    const activeStaffName = user.user_metadata?.full_name || user.full_name || user.email || 'System Terminal';
    
    // Construct uniform baseline payload structure
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
      payment_status: confirmation.status,
      customer_name: isTab ? customerName.trim() : (t('cash_customer') || "Cash Customer"), 
      customer_phone: isTab ? customerPhone.trim() : "N/A",
      is_verified: false
    };

    try {
      // Offline fallback check interceptor
      if (!navigator.onLine) {
        await saveSaleOffline(salePayload);
        executeLocalStateDeduction();
        alert("⚠️ Mode Hors-ligne : Vente enregistrée en local ! Elle se synchronisera dès que le réseau reviendra.");
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

      // Safe live refresh
      await fetchInv();
      await fetchDailySales();
      clearFormFields();
      alert(t('alert_sale_recorded') || "Sale Recorded Successfully!");

    } catch (error) {
      console.error("Online execution broken, moving to local store fallback storage:", error);
      try {
        await saveSaleOffline(salePayload);
        executeLocalStateDeduction();
        alert("📡 Réseau instable. Transaction sécurisée localement.");
      } catch (fallbackErr) {
        alert("Critical storage error: " + fallbackErr.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const executeLocalStateDeduction = () => {
    // Process client UI inventory adjustments directly in state if server drops mid-shift
    setInventory(prev => prev.map(item => {
      if (item.id === confirmation.product_id) {
        return { ...item, stock_quantity: Math.max(0, item.stock_quantity - confirmation.quantity) };
      }
      return item;
    }).filter(item => item.stock_quantity > 0));

    // Append fake visual log item directly into local viewport history tracker
    const localVisualLogItem = {
      id: 'local_temp_' + Date.now(),
      total_amount: confirmation.total,
      quantity: confirmation.quantity,
      created_at: new Date().toISOString(),
      inventory: { name: confirmation.name + " (En attente de sync ⏳)" }
    };
    setDailySales(prev => [localVisualLogItem, ...prev]);
    clearFormFields();
  };

  const clearFormFields = () => {
    setConfirmation(null);
    setSelectedProduct("");
    setQuantity(1);
    setIsTab(false);
    setCustomerName("");
    setCustomerPhone("");
  };

  const totalDayRevenue = dailySales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
  const staffDisplayName = user?.user_metadata?.full_name || 'Staff Terminal';

  return (
    <div className="min-h-screen bg-[#F4F3ED] text-[#111111] p-4 md:p-8 font-sans antialiased pb-24">
      <div className="max-w-xl mx-auto">
        
        {/* --- PREMIUM APP REGISTRATION HEADER --- */}
        <div className="flex justify-between items-center mb-6 mt-2 relative">
          <div>
            <button onClick={onBack} className="text-[#3F51B5] font-bold text-xs tracking-wider uppercase mb-1 block hover:opacity-80 transition-opacity">
              {t('back')}
            </button>
            <h1 className="text-xl font-black tracking-tight text-slate-900">
              {t('sales_entry') || 'Sales Entry'}
            </h1>
          </div>

          {/* RIGHT FLOATING USER HEADER AVATAR MENU */}
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
        
        {/* INPUT TRANSACTION REGISTRATION CARD FORM */}
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
            {inventory.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>

          <div className="flex gap-3 mb-5">
            <div className="w-1/3">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider text-center">
                {t('qty_label') || 'Qty'}
              </label>
              <input type="number" min="1" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-center text-slate-800 text-sm" value={quantity} onChange={e => setQuantity(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider">
                {t('payment_method') || 'Payment Method'}
              </label>
              <button 
                type="button" 
                onClick={() => setIsTab(!isTab)} 
                className={`w-full p-4 rounded-2xl font-black text-xs uppercase transition-all border ${
                  isTab ? 'bg-[#FFEBEA] text-[#FF5A50] border-[#FFD0CD]' : 'bg-slate-50 text-slate-600 border-slate-100'
                }`}
              >
                {isTab ? (t('open_tab_btn') || 'Open Tab 🚨') : (t('immediate_cash_btn') || 'Immediate Cash 💰')}
              </button>
            </div>
          </div>

          {isTab && (
            <div className="grid grid-cols-1 gap-3 mb-5 animate-in fade-in slide-in-from-top-1 duration-150">
              <input className="p-4 bg-red-50/50 border border-red-100 rounded-xl font-bold text-sm outline-none text-slate-800 placeholder-red-300" placeholder={t('debtor_name_placeholder') || "Debtor Name"} value={customerName} onChange={e => setCustomerName(e.target.value)} />
              <input className="p-4 bg-red-50/50 border border-red-100 rounded-xl font-bold text-sm outline-none text-slate-800 placeholder-red-300" placeholder={t('debtor_phone_placeholder') || "Debtor Phone"} value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
            </div>
          )}

          <button onClick={handleProcess} className="w-full py-4.5 bg-[#1C1B1F] text-white rounded-2xl font-bold uppercase text-xs tracking-widest shadow-sm active:scale-[0.99] hover:opacity-90 transition-all mt-2">
            {t('confirm_order_btn') || 'Confirm Order'}
          </button>
        </div>

        {/* DAILY PERFORMANCE TRACKING SHIFT SUMMARY */}
        <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
            <h2 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider">
              {t('sales_shift_today') || 'Your Sales Shift Today'}
            </h2>
            <div className="bg-[#3F51B5] text-white px-3 py-0.5 rounded-full text-[10px] font-extrabold">{dailySales.length}</div>
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
              {t('shift_revenue') || 'Shift Revenue'}
            </span>
            <span className="text-xl font-black text-[#3F51B5] tracking-tight">{totalDayRevenue.toLocaleString()} <span className="text-[10px] font-bold text-slate-400">FCFA</span></span>
          </div>
        </div>

        {/* COMFORT CONFIRMATION OVERLAY DRAWER MODAL */}
        {confirmation && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white w-full max-w-sm rounded-[28px] p-8 text-center shadow-2xl animate-in zoom-in-95 duration-150">
              <p className="text-3xl font-black text-slate-900 tracking-tight">{confirmation.total.toLocaleString()} FCFA</p>
              <p className="text-[#3F51B5] font-bold mt-1 mb-8 uppercase text-[10px] tracking-wider">{confirmation.name}</p>
              <div className="flex flex-col gap-2">
                <button 
                  onClick={finalize} 
                  disabled={loading}
                  className="w-full py-4 bg-[#3F51B5] text-white rounded-xl font-bold uppercase text-xs tracking-wider disabled:opacity-50 active:scale-98 transition-all shadow-sm"
                >
                  {loading ? (t('processing_ledger') || 'Processing Ledger...') : (t('approve_sale_btn') || 'Approve Sale')}
                </button>
                <button onClick={() => setConfirmation(null)} className="w-full py-3.5 bg-slate-50 text-slate-400 rounded-xl font-bold uppercase text-xs tracking-wider hover:bg-slate-100 transition-colors">
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
