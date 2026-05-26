import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.jsx'; 
import { supabase } from '../../api/supabaseClient';
import { processVoiceToData } from '../../api/gemini';

export default function Inventory({ onBack }) {
  const { t } = useLanguage(); 
  const [items, setItems] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userMetadata, setUserMetadata] = useState({ role: 'staff', branch_id: null });
  const [loadingSession, setLoadingSession] = useState(true);
  
  // RESTOCK PANEL STATE
  const [selectedItem, setSelectedItem] = useState(null);
  const [refillQty, setRefillQty] = useState('');
  
  const [formData, setFormData] = useState({ name: '', stock_quantity: '', bought_price: '', selling_price: '' });

  // 1. Resolve User Session Security Rank Clearance first
  useEffect(() => {
    const resolveUserSessionContext = async () => {
      try {
        setLoadingSession(true);
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("Unauthorized access token.");

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, branch_id')
          .eq('id', user.id)
          .single();

        if (profileError || !profile) throw new Error("Failed to map user access profiles.");
        
        setUserMetadata({ role: profile.role, branch_id: profile.branch_id });

        // 2. Load corporate branch options based on verified clearance level
        const { data: branchData, error: bError } = await supabase
          .from('branches')
          .select('*')
          .order('name', { ascending: true });

        if (!bError && branchData) {
          setBranches(branchData);
          
          // Enforcement Rule Engine:
          if (profile.role === 'admin') {
            // Admin defaults to the first alphabetical option but keeps all open
            setSelectedBranchId(branchData[0]?.id || '');
          } else {
            // Managers are strictly trapped to their assigned branch space
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
  }, []);

  // 3. Query inventory items tied SPECIFICALLY to the active branch selection room
  const fetchInventory = async () => {
    if (!selectedBranchId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('branch_id', selectedBranchId)
      .order('name', { ascending: true });
      
    if (!error) setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { 
    if (!loadingSession) {
      fetchInventory(); 
    }
  }, [selectedBranchId, loadingSession]);

  const lowStockItems = items.filter(item => item.stock_quantity < 5);
  
  const copyMarketList = () => {
    const activeBranchName = branches.find(b => b.id === selectedBranchId)?.name || 'BRANCH';
    const list = lowStockItems.map(item => `- ${item.name} (Now: ${item.stock_quantity})`).join('\n');
    navigator.clipboard.writeText(`🛒 DON CHIKE MARKET LIST [${activeBranchName.toUpperCase()}]:\n${list}`);
    alert(t('market_list_copied') || "Market List copied to clipboard!");
  };

  // --- RESTOCK QUANTITY INCREMENT LOGIC (Isolated to Branch) ---
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
      fetchInventory();
    } else {
      alert(error.message);
    }
    setLoading(false);
  };

  // --- DELETE ENTRY ---
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
      fetchInventory();
    } else {
      alert(error.message);
    }
    setLoading(false);
  };

  // --- INVENTORY CREATION ---
  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!selectedBranchId) {
      alert("Please configure and select a corporate branch location first.");
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('inventory')
      .insert([{
        name: formData.name.trim(),
        stock_quantity: parseInt(formData.stock_quantity) || 0,
        bought_price: parseFloat(formData.bought_price) || 0,
        selling_price: parseFloat(formData.selling_price) || 0,
        branch_id: selectedBranchId // Automatically tags row to active branch sandbox
      }]);

    if (!error) {
      setFormData({ name: '', stock_quantity: '', bought_price: '', selling_price: '' });
      fetchInventory();
    } else {
      alert(error.message);
    }
    setLoading(false);
  };

  // --- VOICE CAPTURE OVERHAUL ---
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
            branch_id: selectedBranchId // Stamps voice entry directly into active branch
          }]);
          fetchInventory();
        }
      } catch (err) { alert("AI Error"); }
      setLoading(false);
    };
    recognition.start();
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs font-black uppercase text-slate-400 tracking-widest">
        Verifying Security Matrix...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-24 font-sans max-w-4xl mx-auto">
      
      {/* HEADER SECTION WITH CONTROLLED BRANCH SWITCHER */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-6 border-b border-slate-200 pb-4">
        <div className="flex justify-between items-center w-full sm:w-auto">
          <button onClick={onBack} className="text-blue-600 font-black uppercase text-xs mr-4">← {t('back')}</button>
          <h1 className="text-xl font-black uppercase italic tracking-tight">{t('inventory_intel') || 'Inventory Intelligence'}</h1>
        </div>

        {/* Dynamic Context Control Selector Box */}
        <div className="min-w-[200px]">
          {userMetadata.role === 'admin' ? (
            <select 
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full p-3 bg-white text-slate-800 rounded-xl text-xs font-black outline-none border border-slate-200 focus:border-blue-600 shadow-sm cursor-pointer animate-pulse border-blue-400"
            >
              {branches.length === 0 ? (
                <option disabled>No branches configured</option>
              ) : (
                branches.map(b => (
                  <option key={b.id} value={b.id}>👑 Central Control: {b.name}</option>
                ))
              )}
            </select>
          ) : (
            <div className="w-full p-3 bg-slate-900 text-emerald-400 border border-slate-800 rounded-xl text-xs font-black uppercase tracking-wider text-center shadow-inner">
              📍 Station Counter Locked Base
            </div>
          )}
        </div>
      </div>

      {/* RESTOCK ALERT BOX */}
      {lowStockItems.length > 0 && (
        <div className="bg-orange-500 p-6 rounded-[35px] shadow-lg mb-6 text-white flex justify-between items-center animate-in fade-in zoom-in duration-300">
          <div>
            <h2 className="font-black uppercase text-xs tracking-widest text-orange-200 mb-1">{t('restock_alert') || 'Restock Alert'}</h2>
            <p className="text-lg font-black">{lowStockItems.length} {t('items_low') || 'items running low'}</p>
          </div>
          <button onClick={copyMarketList} className="bg-white text-orange-600 px-4 py-2 rounded-2xl font-black text-[10px] uppercase shadow-xl active:scale-95">
            {t('get_market_list') || 'GET MARKET LIST 📋'}
          </button>
        </div>
      )}

      {/* RESTOCKING ENTRY CONSOLE */}
      {selectedItem && (
        <div className="bg-[#0f172a] text-white p-6 rounded-[35px] mb-6 shadow-2xl border-b-4 border-blue-600 animate-in slide-in-from-top duration-200">
          <h2 className="font-black uppercase text-[10px] tracking-widest text-blue-400 mb-1">{t('log_refill') || 'Log Logistics Refill'}</h2>
          <p className="text-sm font-bold mb-4">{t('adding_stock_to') || 'Adding stock to'}: <span className="uppercase font-black text-amber-400">{selectedItem.name}</span> ({t('current_stock') || 'Currently'}: {selectedItem.stock_quantity})</p>
          <div className="flex gap-3">
            <input 
              type="number" 
              placeholder={t('incoming_units_placeholder') || "Incoming units count..."} 
              className="bg-white/10 p-4 rounded-2xl flex-1 outline-none border border-white/10 text-white font-bold"
              value={refillQty}
              onChange={(e) => setRefillQty(e.target.value)}
            />
            <button 
              onClick={handleRestock} 
              disabled={loading}
              className="bg-blue-600 px-6 rounded-2xl font-black uppercase text-xs tracking-wider hover:bg-blue-500 active:scale-95 transition-all"
            >
              {loading ? '...' : (t('apply_refill') || 'Apply Refill')}
            </button>
            <button onClick={() => setSelectedItem(null)} className="text-slate-400 font-black px-2 text-xs uppercase">{t('cancel') || 'Cancel'}</button>
          </div>
        </div>
      )}

      {/* VOICE COMMAND */}
      <div className="bg-indigo-700 p-6 rounded-[35px] shadow-lg mb-6 text-white flex justify-between items-center">
        <div>
          <h2 className="font-black uppercase text-sm">{t('voice_command')}</h2>
          <p className="text-[10px] opacity-70 italic">{t('voice_example') || '"Add 20 cases of Guinness..."'}</p>
        </div>
        <button onClick={startVoiceCapture} className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all ${isListening ? 'bg-red-500 animate-pulse' : 'bg-white text-indigo-700'}`}>
          {isListening ? "🛑" : "🎙️"}
        </button>
      </div>

      {/* ADD NEW LOG ENTRY FORM */}
      <form onSubmit={handleCreateProduct} className="bg-white p-6 rounded-[35px] shadow-sm border mb-8">
        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{t('register_new_batch') || 'Register New Batch Line'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <input className="p-4 bg-gray-50 rounded-2xl font-bold border-none focus:ring-2 focus:ring-indigo-500" placeholder={t('product_name')} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
          <input type="number" className="p-4 bg-gray-50 rounded-2xl font-bold border-none focus:ring-2 focus:ring-indigo-500" placeholder={t('initial_quantity') || t('quantity')} value={formData.stock_quantity} onChange={e => setFormData({...formData, stock_quantity: e.target.value})} required />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <input type="number" className="p-4 bg-amber-50 rounded-2xl font-bold border-none focus:ring-2 focus:ring-amber-500" placeholder={t('cost_price') || 'Cost Price'} value={formData.bought_price} onChange={e => setFormData({...formData, bought_price: e.target.value})} required />
          <input type="number" className="p-4 bg-blue-50 rounded-2xl font-bold border-none focus:ring-2 focus:ring-blue-500" placeholder={t('sales_price') || 'Sales Price'} value={formData.selling_price} onChange={e => setFormData({...formData, selling_price: e.target.value})} required />
          <button type="submit" disabled={loading} className="bg-slate-900 text-white rounded-2xl font-black uppercase text-xs hover:bg-black transition-all">
            {loading ? "..." : (t('save_product') || 'Save Product')}
          </button>
        </div>
      </form>

      {/* MAIN INVENTORY REGISTRY */}
      <div className="grid gap-3">
        {items.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-medium italic bg-white rounded-[30px] border">
            No stock listings registered for this location branch yet.
          </div>
        ) : (
          items.map(item => (
            <div key={item.id} className={`bg-white p-5 rounded-[30px] border flex justify-between items-center shadow-sm transition-all hover:border-slate-300 ${item.stock_quantity < 5 ? 'border-l-8 border-l-orange-500 bg-orange-50/20' : ''}`}>
              <div>
                <h3 className="font-black text-slate-800 uppercase text-sm">{item.name}</h3>
                <p className={`text-[10px] font-black uppercase mt-0.5 ${item.stock_quantity < 5 ? 'text-orange-600' : 'text-blue-600'}`}>
                  {item.stock_quantity < 5 ? `⚠️ ${t('critical_stock') || 'Critical Stock'}` : (t('stock_level') || 'Stock Level')}: {item.stock_quantity}
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                <p className="font-black text-slate-900 text-sm">{item.selling_price.toLocaleString()} <span className="text-[9px] opacity-30 font-bold">FCFA</span></p>
                
                {/* INTERACTION HUB */}
                <div className="flex gap-1.5">
                  <button 
                    onClick={() => setSelectedItem(item)}
                    className="bg-slate-100 border border-slate-200 text-slate-800 text-[9px] font-black px-3 py-2 rounded-xl hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all uppercase"
                  >
                    ⚡ {t('refill') || 'Refill'}
                  </button>
                  <button 
                    onClick={() => handleDeleteItem(item)}
                    className="bg-red-50 border border-red-100 text-red-500 p-2 rounded-xl hover:bg-red-500 hover:text-white hover:border-red-500 transition-all text-[10px]"
                    title="Delete Entry"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}