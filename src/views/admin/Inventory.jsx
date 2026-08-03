// src/components/Inventory.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, 
  Boxes, 
  Building2, 
  MapPin, 
  AlertTriangle, 
  ClipboardList, 
  Mic, 
  MicOff, 
  PlusCircle, 
  RotateCcw, 
  Trash2, 
  Loader2, 
  PackagePlus, 
  X,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.jsx'; 
import { supabase } from '../../api/supabaseClient';
import { processVoiceToData } from '../../api/gemini';

export default function Inventory({ onBack, branchId: dashboardBranchId, userRole: dashboardUserRole, refreshMetrics }) {
  const { t } = useLanguage(); 
  const [items, setItems] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userMetadata, setUserMetadata] = useState({ role: 'staff', branch_id: null });
  const [loadingSession, setLoadingSession] = useState(true);
  
  const [selectedItem, setSelectedItem] = useState(null);
  const [refillQty, setRefillQty] = useState('');
  const [formData, setFormData] = useState({ name: '', stock_quantity: '', bought_price: '', selling_price: '' });

  const fetchInventory = useCallback(async () => {
    if (!selectedBranchId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('branch_id', selectedBranchId)
      .order('name', { ascending: true });
      
    if (!error) setItems(data || []);
    setLoading(false);
  }, [selectedBranchId]);

  // Resolve Security Matrix Clearance Context
  useEffect(() => {
    const resolveUserSessionContext = async () => {
      try {
        setLoadingSession(true);

        // DASHBOARD PROP OPTIMIZATION INTERCEPT
        if (dashboardBranchId && dashboardUserRole) {
          setUserMetadata({ role: dashboardUserRole, branch_id: dashboardBranchId });
          setSelectedBranchId(dashboardBranchId);
          
          const { data: branchData } = await supabase
            .from('branches')
            .select('*')
            .order('name', { ascending: true });
            
          if (branchData) setBranches(branchData);
          return;
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("Unauthorized access token.");

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, branch_id')
          .eq('id', user.id)
          .single();

        if (profileError || !profile) throw new Error("Failed to map user access profiles.");
        
        setUserMetadata({ role: profile.role, branch_id: profile.branch_id });

        const { data: branchData, error: bError } = await supabase
          .from('branches')
          .select('*')
          .order('name', { ascending: true });

        if (!bError && branchData) {
          setBranches(branchData);
          if (profile.role === 'admin') {
            setSelectedBranchId(branchData[0]?.id || '');
          } else {
            setSelectedBranchId(profile.branch_id || '');
          }
        }
      } catch (err) {
        console.error("Security handshake initialization failed:", err.message);
      } finally {
        setLoadingSession(false);
      }
    };

    resolveUserSessionContext();
  }, [dashboardBranchId, dashboardUserRole]);

  useEffect(() => { 
    if (!loadingSession) {
      fetchInventory(); 
    }
  }, [selectedBranchId, loadingSession, fetchInventory]);

  const lowStockItems = items.filter(item => item.stock_quantity < 5);
  
  const copyMarketList = () => {
    const activeBranchName = branches.find(b => b.id === selectedBranchId)?.name || 'BRANCH';
    const list = lowStockItems.map(item => `- ${item.name} (Now: ${item.stock_quantity})`).join('\n');
    navigator.clipboard.writeText(`🛒 DON CHIKE MARKET LIST [${activeBranchName.toUpperCase()}]:\n${list}`);
    alert(t('market_list_copied') || "Market List copied to clipboard!");
  };

  const handleRestock = async () => {
    if (!selectedItem || !refillQty) return;
    const newQty = Number(selectedItem.stock_quantity) + Number(refillQty);
    
    setLoading(true);
    const { error } = await supabase
      .from('inventory')
      .update({ stock_quantity: newQty })
      .eq('id', selectedItem.id);

    if (!error) {
      alert(`${selectedItem.name} ${t('restock_success') || 'Restocked Successfully!'}`);
      setSelectedItem(null);
      setRefillQty('');
      await fetchInventory();
      
      // Fire sync notification hook up to dashboard
      if (typeof refreshMetrics === 'function') refreshMetrics();
    } else {
      alert(error.message);
    }
    setLoading(false);
  };

  const handleDeleteItem = async (item) => {
    const confirmDelete = window.confirm(`${t('security_check') || 'SECURITY CHECK'}: ${t('delete_confirm_msg') || 'Are you sure you want to permanently delete this entry?'}`);
    if (!confirmDelete) return;

    setLoading(true);
    const { error } = await supabase
      .from('inventory')
      .delete()
      .eq('id', item.id);

    if (!error) {
      alert(t('delete_success') || "Entry successfully deleted from registry.");
      await fetchInventory();
      
      // Fire sync notification hook up to dashboard
      if (typeof refreshMetrics === 'function') refreshMetrics();
    } else {
      alert(error.message);
    }
    setLoading(false);
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!selectedBranchId) return alert("Please configure and select a corporate branch location first.");

    setLoading(true);
    const { error } = await supabase
      .from('inventory')
      .insert([{
        name: formData.name.trim(),
        stock_quantity: parseInt(formData.stock_quantity) || 0,
        bought_price: parseFloat(formData.bought_price) || 0,
        selling_price: parseFloat(formData.selling_price) || 0,
        branch_id: selectedBranchId 
      }]);

    if (!error) {
      setFormData({ name: '', stock_quantity: '', bought_price: '', selling_price: '' });
      await fetchInventory();
      
      // Fire sync notification hook up to dashboard
      if (typeof refreshMetrics === 'function') refreshMetrics();
    } else {
      alert(error.message);
    }
    setLoading(false);
  };

  const startVoiceCapture = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Browser not supported");
    if (!selectedBranchId) return alert("Select an active branch filter room before capture.");

    const recognition = new SpeechRecognition();
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      setLoading(true);
      try {
        const aiData = await processVoiceToData(transcript, 'inventory_add');
        if (aiData) {
          await supabase.from('inventory').insert([{
            name: aiData.name,
            stock_quantity: parseInt(aiData.quantity) || 0,
            bought_price: parseFloat(aiData.cost) || 0,
            selling_price: parseFloat(aiData.price) || 0,
            branch_id: selectedBranchId 
          }]);
          await fetchInventory();
          
          // Fire sync notification hook up to dashboard
          if (typeof refreshMetrics === 'function') refreshMetrics();
        }
      } catch (err) { alert("AI Voice Extraction Error"); }
      setLoading(false);
    };
    recognition.start();
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-xs font-black uppercase text-slate-400 tracking-widest gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span>Verifying Security Matrix...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-24 font-sans max-w-4xl mx-auto antialiased">
      
      {/* HEADER SECTION WITH CONTROLLED BRANCH SWITCHER */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-6 border-b border-slate-200/80 pb-4">
        <div className="flex justify-between items-center w-full sm:w-auto">
          <button 
            onClick={onBack} 
            className="inline-flex items-center gap-1.5 text-blue-600 font-extrabold uppercase text-xs hover:text-blue-700 transition-colors py-1 px-2.5 rounded-lg hover:bg-blue-50 mr-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('back')}</span>
          </button>
          <h1 className="text-lg font-black uppercase italic tracking-tight text-slate-900 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-blue-600 not-italic" />
            <span>{t('inventory_intel') || 'Inventory Intelligence'}</span>
          </h1>
        </div>

        <div className="min-w-[220px]">
          {userMetadata.role === 'admin' ? (
            <div className="relative">
              <select 
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full p-3 bg-white text-slate-800 rounded-2xl text-xs font-extrabold outline-none border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-sm cursor-pointer transition-all uppercase"
              >
                {branches.length === 0 ? (
                  <option disabled>No branches configured</option>
                ) : (
                  branches.map(b => (
                    <option key={b.id} value={b.id}>👑 Central Control: {b.name}</option>
                  ))
                )}
              </select>
            </div>
          ) : (
            <div className="w-full p-3 bg-slate-900 text-emerald-400 border border-slate-800 rounded-2xl text-xs font-extrabold uppercase tracking-wider text-center shadow-inner flex items-center justify-center gap-2">
              <MapPin className="w-3.5 h-3.5" />
              <span>Station Counter Locked Base</span>
            </div>
          )}
        </div>
      </div>

      {/* RESTOCK ALERT BOX */}
      {lowStockItems.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-6 rounded-[32px] shadow-sm mb-6 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md shrink-0">
              <AlertTriangle className="w-6 h-6 text-amber-100" />
            </div>
            <div>
              <h2 className="font-black uppercase text-[10px] tracking-widest text-amber-100/90 mb-0.5">
                {t('restock_alert') || 'Restock Alert'}
              </h2>
              <p className="text-base font-black tracking-tight">
                {lowStockItems.length} {t('items_low') || 'items running low'}
              </p>
            </div>
          </div>
          <button 
            onClick={copyMarketList} 
            className="bg-white text-orange-600 hover:bg-orange-50 px-5 py-3 rounded-2xl font-black text-xs uppercase shadow-sm active:scale-[0.98] transition-all flex items-center gap-2 w-full sm:w-auto justify-center shrink-0"
          >
            <ClipboardList className="w-4 h-4" />
            <span>{t('get_market_list') || 'Get Market List'}</span>
          </button>
        </div>
      )}

      {/* RESTOCKING ENTRY CONSOLE */}
      {selectedItem && (
        <div className="bg-slate-900 text-white p-6 rounded-[32px] mb-6 shadow-xl border-b-4 border-blue-600 animate-in slide-in-from-top-4 duration-200">
          <div className="flex justify-between items-center mb-1">
            <h2 className="font-black uppercase text-[10px] tracking-widest text-blue-400 flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('log_refill') || 'Log Logistics Refill'}</span>
            </h2>
            <button 
              onClick={() => setSelectedItem(null)} 
              className="text-slate-400 hover:text-white transition-colors p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <p className="text-sm font-bold mb-4 text-slate-300">
            {t('adding_stock_to') || 'Adding stock to'}: <span className="uppercase font-black text-amber-400">{selectedItem.name}</span> ({t('current_stock') || 'Currently'}: {selectedItem.stock_quantity})
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <input 
              type="number" 
              placeholder={t('incoming_units_placeholder') || "Incoming units count..."} 
              className="bg-white/10 p-4 rounded-2xl flex-1 outline-none border border-white/10 text-white font-bold placeholder:text-slate-400 focus:border-blue-500 transition-all text-sm"
              value={refillQty}
              onChange={(e) => setRefillQty(e.target.value)}
            />
            <div className="flex gap-2 shrink-0">
              <button 
                onClick={handleRestock} 
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-4 sm:py-0 rounded-2xl font-black uppercase text-xs tracking-wider active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 flex-1 sm:flex-none"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>{t('apply_refill') || 'Apply Refill'}</span>
                  </>
                )}
              </button>
              <button 
                onClick={() => setSelectedItem(null)} 
                className="bg-white/5 hover:bg-white/10 text-slate-300 px-4 rounded-2xl font-black text-xs uppercase transition-colors"
              >
                {t('cancel') || 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOICE COMMAND */}
      <div className="bg-indigo-700 p-6 rounded-[32px] shadow-sm mb-6 text-white flex justify-between items-center">
        <div>
          <h2 className="font-black uppercase text-sm tracking-wide flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-300" />
            <span>{t('voice_command')}</span>
          </h2>
          <p className="text-[11px] text-indigo-200/80 italic mt-0.5">{t('voice_example') || '"Add 20 cases of Guinness..."'}</p>
        </div>
        <button 
          onClick={startVoiceCapture} 
          className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-md transition-all active:scale-95 shrink-0 ${
            isListening 
              ? 'bg-rose-500 text-white animate-pulse ring-4 ring-rose-500/30' 
              : 'bg-white text-indigo-700 hover:bg-indigo-50'
          }`}
          title="Toggle Voice Capture"
        >
          {isListening ? <MicOff className="w-6 h-6 animate-bounce" /> : <Mic className="w-6 h-6" />}
        </button>
      </div>

      {/* ADD NEW LOG ENTRY FORM */}
      <form onSubmit={handleCreateProduct} className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-200/80 mb-8">
        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
          <PackagePlus className="w-3.5 h-3.5 text-blue-600" />
          <span>{t('register_new_batch') || 'Register New Batch Line'}</span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <input 
            className="p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all" 
            placeholder={t('product_name')} 
            value={formData.name} 
            onChange={e => setFormData({...formData, name: e.target.value})} 
            required 
          />
          <input 
            type="number" 
            className="p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all" 
            placeholder={t('initial_quantity') || t('quantity')} 
            value={formData.stock_quantity} 
            onChange={e => setFormData({...formData, stock_quantity: e.target.value})} 
            required 
          />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input 
            type="number" 
            className="p-4 bg-amber-50/60 border border-amber-100 rounded-2xl font-bold text-sm text-amber-900 placeholder:text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all" 
            placeholder={t('cost_price') || 'Cost Price'} 
            value={formData.bought_price} 
            onChange={e => setFormData({...formData, bought_price: e.target.value})} 
            required 
          />
          <input 
            type="number" 
            className="p-4 bg-blue-50/60 border border-blue-100 rounded-2xl font-bold text-sm text-blue-900 placeholder:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
            placeholder={t('sales_price') || 'Sales Price'} 
            value={formData.selling_price} 
            onChange={e => setFormData({...formData, selling_price: e.target.value})} 
            required 
          />
          <button 
            type="submit" 
            disabled={loading} 
            className="bg-slate-900 hover:bg-slate-950 text-white p-4 rounded-2xl font-black uppercase text-xs tracking-wider transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <PlusCircle className="w-4 h-4 text-blue-400" />
                <span>{t('save_product') || 'Save Product'}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* MAIN INVENTORY REGISTRY */}
      <div className="grid gap-3">
        {items.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-medium italic bg-white rounded-[32px] border border-slate-200/80">
            No stock listings registered for this location branch yet.
          </div>
        ) : (
          items.map(item => {
            const isCritical = item.stock_quantity < 5;
            return (
              <div 
                key={item.id} 
                className={`bg-white p-5 rounded-[28px] border flex justify-between items-center shadow-sm transition-all hover:border-slate-300 ${
                  isCritical ? 'border-l-8 border-l-amber-500 bg-amber-50/20 border-slate-200/80' : 'border-slate-200/80'
                }`}
              >
                <div className="pr-2">
                  <h3 className="font-black text-slate-800 uppercase text-sm tracking-tight">{item.name}</h3>
                  <p className={`text-[10px] font-black uppercase mt-1 flex items-center gap-1 ${isCritical ? 'text-amber-600' : 'text-blue-600'}`}>
                    {isCritical ? (
                      <>
                        <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                        <span>{t('critical_stock') || 'Critical Stock'}: {item.stock_quantity}</span>
                      </>
                    ) : (
                      <span>{(t('stock_level') || 'Stock Level')}: {item.stock_quantity}</span>
                    )}
                  </p>
                </div>
                
                <div className="flex items-center gap-4 shrink-0">
                  <p className="font-black text-slate-900 text-sm">
                    {item.selling_price.toLocaleString()} <span className="text-[9px] text-slate-400 font-bold">FCFA</span>
                  </p>
                  
                  <div className="flex gap-1.5">
                    <button 
                      onClick={() => setSelectedItem(item)}
                      className="bg-slate-100 hover:bg-blue-600 hover:text-white border border-slate-200 hover:border-blue-600 text-slate-700 text-[10px] font-black px-3 py-2 rounded-xl transition-all uppercase flex items-center gap-1.5 active:scale-95"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{t('refill') || 'Refill'}</span>
                    </button>
                    <button 
                      onClick={() => handleDeleteItem(item)}
                      className="bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-100 hover:border-rose-600 p-2 rounded-xl transition-all active:scale-95"
                      title="Delete Entry"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}