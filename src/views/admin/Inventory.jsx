import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.jsx'; // Centralized language wrapper hook
import { supabase } from '../../api/supabaseClient';
import { processVoiceToData } from '../../api/gemini';

export default function Inventory({ onBack }) {
  const { t } = useLanguage(); // Uses the same global state language engine
  const [items, setItems] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // RESTOCK PANEL STATE
  const [selectedItem, setSelectedItem] = useState(null);
  const [refillQty, setRefillQty] = useState('');
  
  const [formData, setFormData] = useState({ name: '', stock_quantity: '', bought_price: '', selling_price: '' });

  const fetchInventory = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('inventory').select('*').order('name', { ascending: true });
    if (!error) setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchInventory(); }, []);

  const lowStockItems = items.filter(item => item.stock_quantity < 5);
  
  const copyMarketList = () => {
    const list = lowStockItems.map(item => `- ${item.name} (Now: ${item.stock_quantity})`).join('\n');
    navigator.clipboard.writeText(`🛒 DON CHIKE MARKET LIST:\n${list}`);
    alert(t('market_list_copied') || "Market List copied to clipboard!");
  };

  // --- RESTOCK QUANTITY INCREMENT LOGIC ---
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

  // --- DUPLICATE/MISTAKE PURGE ENGINE ---
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

  const startVoiceCapture = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Browser not supported");
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
            selling_price: parseFloat(aiData.price) || 0
          }]);
          fetchInventory();
        }
      } catch (err) { alert("AI Error"); }
      setLoading(false);
    };
    recognition.start();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-24 font-sans max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <button onClick={onBack} className="text-blue-600 font-black uppercase text-xs">← {t('back')}</button>
        <h1 className="text-xl font-black uppercase italic tracking-tight">{t('inventory_intel') || 'Inventory Intelligence'}</h1>
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
      <form onSubmit={async (e) => { e.preventDefault(); await supabase.from('inventory').insert([formData]); fetchInventory(); setFormData({name:'', stock_quantity:'', bought_price:'', selling_price:''}); }} className="bg-white p-6 rounded-[35px] shadow-sm border mb-8">
        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{t('register_new_batch') || 'Register New Batch Line'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <input className="p-4 bg-gray-50 rounded-2xl font-bold border-none focus:ring-2 focus:ring-indigo-500" placeholder={t('product_name')} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          <input type="number" className="p-4 bg-gray-50 rounded-2xl font-bold border-none focus:ring-2 focus:ring-indigo-500" placeholder={t('initial_quantity') || t('quantity')} value={formData.stock_quantity} onChange={e => setFormData({...formData, stock_quantity: e.target.value})} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <input type="number" className="p-4 bg-amber-50 rounded-2xl font-bold border-none focus:ring-2 focus:ring-amber-500" placeholder={t('cost_price') || 'Cost Price'} value={formData.bought_price} onChange={e => setFormData({...formData, bought_price: e.target.value})} />
          <input type="number" className="p-4 bg-blue-50 rounded-2xl font-bold border-none focus:ring-2 focus:ring-blue-500" placeholder={t('sales_price') || 'Sales Price'} value={formData.selling_price} onChange={e => setFormData({...formData, selling_price: e.target.value})} />
          <button type="submit" className="bg-slate-900 text-white rounded-2xl font-black uppercase text-xs hover:bg-black transition-all">
            {loading ? "..." : (t('save_product') || 'Save Product')}
          </button>
        </div>
      </form>

      {/* MAIN INVENTORY REGISTRY */}
      <div className="grid gap-3">
        {items.map(item => (
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
        ))}
      </div>
    </div>
  );
}