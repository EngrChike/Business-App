import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../api/supabaseClient';
import { useAuth } from '../../context/AuthContext';

export default function BulkInventory({ userRole }) {
  const { user } = useAuth();
  const isAdmin = userRole === 'admin';

  // Core State
  const [bulkItems, setBulkItems] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modal / Form States
  const [activeModal, setActiveModal] = useState(null); // 'refill' | 'edit' | 'take'
  const [selectedItem, setSelectedItem] = useState(null);
  
  // Form Inputs
  const [itemName, setItemName] = useState('');
  const [quantityInput, setQuantityInput] = useState(0);

  const currentUserName = user?.user_metadata?.full_name || user?.email || 'Unknown User';

  // --- Data Fetching ---
  const fetchBulkData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: inventory, error: invError } = await supabase
        .from('bulk_inventory')
        .select('*')
        .order('item_name', { ascending: true });

      if (invError) throw invError;
      setBulkItems(inventory || []);

      if (isAdmin) {
        const { data: logs, error: logsError } = await supabase
          .from('bulk_inventory_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (logsError) throw logsError;
        setAuditLogs(logs || []);
      }
    } catch (err) {
      console.error('Error fetching bulk inventory data:', err.message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchBulkData();
  }, [fetchBulkData]);

  // --- Core CRUD Actions ---
  
  // 1. CREATE NEW ITEM (Admin Only)
  const handleAddNewItem = async (e) => {
    e.preventDefault();
    if (!itemName.trim() || quantityInput < 0) return;

    try {
      const { data, error } = await supabase
        .from('bulk_inventory')
        .insert([{ item_name: itemName.trim(), total_quantity: quantityInput }])
        .select()
        .single();

      if (error) throw error;

      await supabase.from('bulk_inventory_logs').insert([{
        item_id: data.id,
        item_name: data.item_name,
        action_type: 'INITIAL_CREATE',
        quantity_changed: data.total_quantity,
        performed_by_id: user.id,
        performed_by_name: currentUserName
      }]);

      closeModals();
      fetchBulkData();
    } catch (err) {
      alert(err.message);
    }
  };

  // 2. REFILL STOCK (Admin Only)
  const handleRefill = async () => {
    if (quantityInput <= 0) return alert('Enter a valid quantity to increase stock.');
    const newQty = selectedItem.total_quantity + parseInt(quantityInput);

    try {
      const { error } = await supabase
        .from('bulk_inventory')
        .update({ total_quantity: newQty, updated_at: new Date().toISOString() })
        .eq('id', selectedItem.id);

      if (error) throw error;

      await supabase.from('bulk_inventory_logs').insert([{
        item_id: selectedItem.id,
        item_name: selectedItem.item_name,
        action_type: 'REFILL',
        quantity_changed: parseInt(quantityInput),
        old_value: `${selectedItem.total_quantity}`,
        new_value: `${newQty}`,
        performed_by_id: user.id,
        performed_by_name: currentUserName
      }]);

      closeModals();
      fetchBulkData();
    } catch (err) {
      alert(err.message);
    }
  };

  // 3. EDIT RECORD (Admin Only)
  const handleEdit = async () => {
    if (!itemName.trim()) return;

    try {
      const { error } = await supabase
        .from('bulk_inventory')
        .update({ item_name: itemName.trim(), updated_at: new Date().toISOString() })
        .eq('id', selectedItem.id);

      if (error) throw error;

      await supabase.from('bulk_inventory_logs').insert([{
        item_id: selectedItem.id,
        item_name: itemName.trim(),
        action_type: 'EDIT',
        quantity_changed: 0,
        old_value: selectedItem.item_name,
        new_value: itemName.trim(),
        performed_by_id: user.id,
        performed_by_name: currentUserName
      }]);

      closeModals();
      fetchBulkData();
    } catch (err) {
      alert(err.message);
    }
  };

  // 4. DELETE RECORD (Admin Only)
  const handleDelete = async (item) => {
    if (!window.confirm(`Are you absolutely sure you want to delete "${item.item_name}" entirely from bulk storage?`)) return;

    try {
      const { error } = await supabase.from('bulk_inventory').delete().eq('id', item.id);
      if (error) throw error;

      await supabase.from('bulk_inventory_logs').insert([{
        item_id: item.id,
        item_name: item.item_name,
        action_type: 'DELETE',
        quantity_changed: -item.total_quantity,
        old_value: `Qty: ${item.total_quantity}`,
        new_value: 'DELETED',
        performed_by_id: user.id,
        performed_by_name: currentUserName
      }]);

      fetchBulkData();
    } catch (err) {
      alert(err.message);
    }
  };

  // 5. RECORD ITEM TAKEN (Available to Both Admin & Manager)
  const handleTakeItems = async () => {
    if (quantityInput <= 0) return alert('Enter a valid quantity taken.');
    if (quantityInput > selectedItem.total_quantity) return alert('Insufficient stock in bulk vault!');

    const newQty = selectedItem.total_quantity - parseInt(quantityInput);

    try {
      const { error } = await supabase
        .from('bulk_inventory')
        .update({ total_quantity: newQty, updated_at: new Date().toISOString() })
        .eq('id', selectedItem.id);

      if (error) throw error;

      await supabase.from('bulk_inventory_logs').insert([{
        item_id: selectedItem.id,
        item_name: selectedItem.item_name,
        action_type: 'TAKEN',
        quantity_changed: -parseInt(quantityInput),
        old_value: `${selectedItem.total_quantity}`,
        new_value: `${newQty}`,
        performed_by_id: user.id,
        performed_by_name: currentUserName
      }]);

      closeModals();
      fetchBulkData();
    } catch (err) {
      alert(err.message);
    }
  };

  const openModal = (type, item) => {
    setActiveModal(type);
    setSelectedItem(item);
    if (item) {
      setItemName(item.item_name);
      setQuantityInput(0);
    } else {
      setItemName('');
      setQuantityInput(0);
    }
  };

  const closeModals = () => {
    setActiveModal(null);
    setSelectedItem(null);
    setItemName('');
    setQuantityInput(0);
  };

  return (
    <div className="p-4 md:p-8 bg-[#F4F3ED] min-h-screen text-slate-800 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* Header Block */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">Bulk Vault Inventory</h1>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Current Access Authorization: <span className="text-indigo-600 font-black uppercase">{userRole}</span>
            </p>
          </div>
          {isAdmin && (
            <button 
              onClick={() => openModal('create', null)} 
              className="bg-slate-900 text-white text-xs font-bold uppercase tracking-wider px-5 py-3 rounded-xl shadow-sm active:scale-95 transition-all"
            >
              + Add New Bulk Stock Reference
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Stock Registry List */}
          <div className="lg:col-span-2 bg-white rounded-[28px] border border-slate-100 shadow-sm p-6">
            <h2 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-4">Stock Ledger Control Matrix</h2>
            
            {loading ? (
              <p className="text-xs font-bold text-slate-400 animate-pulse uppercase">Syncing Central Matrix Vault...</p>
            ) : bulkItems.length === 0 ? (
              <p className="text-xs italic text-slate-400">Vault registry is completely empty.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="py-3 text-[10px] font-black uppercase text-slate-400 tracking-wider">Item Name</th>
                      <th className="py-3 text-[10px] font-black uppercase text-slate-400 tracking-wider text-center">Total Balance</th>
                      <th className="py-3 text-[10px] font-black uppercase text-slate-400 tracking-wider text-right">Operations Allowed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {bulkItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 font-bold text-sm text-slate-800">{item.item_name}</td>
                        <td className="py-4 text-center">
                          <span className="font-black px-3 py-1 bg-slate-100 rounded-lg text-xs text-slate-700">
                            {item.total_quantity.toLocaleString()} units
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex gap-1.5 justify-end">
                            <button 
                              onClick={() => openModal('take', item)}
                              className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold text-[11px] rounded-lg uppercase tracking-wide hover:bg-emerald-100 transition-colors"
                            >
                              Take Item
                            </button>
                            
                            {isAdmin && (
                              <>
                                <button 
                                  onClick={() => openModal('refill', item)}
                                  className="px-3 py-1.5 bg-blue-50 text-blue-700 font-bold text-[11px] rounded-lg uppercase tracking-wide hover:bg-blue-100 transition-colors"
                                >
                                  Refill
                                </button>
                                <button 
                                  onClick={() => openModal('edit', item)}
                                  className="px-3 py-1.5 bg-slate-100 text-slate-600 font-bold text-[11px] rounded-lg uppercase tracking-wide hover:bg-slate-200 transition-colors"
                                >
                                  Edit
                                </button>
                                <button 
                                  onClick={() => handleDelete(item)}
                                  className="px-3 py-1.5 bg-red-50 text-red-600 font-bold text-[11px] rounded-lg uppercase tracking-wide hover:bg-red-100 transition-colors"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right Audit Trail Column (Visible strictly to Admins) */}
          {isAdmin && (
            <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm p-6 h-fit max-h-[75vh] flex flex-col">
              <h2 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-4 flex items-center justify-between">
                <span>Manager Activity Tracker Trail</span>
                <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[9px] font-black rounded-md animate-pulse">LIVE AUDIT</span>
              </h2>
              
              <div className="overflow-y-auto divide-y divide-slate-100 pr-1 flex-1">
                {auditLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">No audited actions caught yet.</p>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className="py-3 text-xs">
                      <div className="flex justify-between items-start font-bold">
                        <span className="text-slate-800">{log.performed_by_name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-black ${
                          log.action_type === 'TAKEN' ? 'bg-amber-50 text-amber-700' :
                          log.action_type === 'DELETE' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                        }`}>
                          {log.action_type}
                        </span>
                      </div>
                      <p className="text-slate-500 mt-1">
                        Product: <span className="font-semibold text-slate-700">{log.item_name}</span> 
                        {log.quantity_changed !== 0 && ` (${log.quantity_changed > 0 ? '+' : ''}${log.quantity_changed})`}
                      </p>
                      {log.old_value && (
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {log.old_value} &rarr; {log.new_value}
                        </p>
                      )}
                      <p className="text-[9px] text-slate-300 mt-1">{new Date(log.created_at).toLocaleString()}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>

        {/* --- DYNAMIC INTERACTION DIALOG MODALS --- */}
        {activeModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white w-full max-w-md rounded-[24px] p-6 shadow-xl">
              <h3 className="text-sm font-black uppercase text-slate-900 tracking-wider mb-4">
                {activeModal === 'create' && 'Create New Vault Entry'}
                {activeModal === 'refill' && `Refill Stock: ${selectedItem?.item_name}`}
                {activeModal === 'edit' && `Modify Base Record Details`}
                {activeModal === 'take' && `Extract Stock: ${selectedItem?.item_name}`}
              </h3>

              <form onSubmit={(e) => e.preventDefault()}>
                {(activeModal === 'create' || activeModal === 'edit') && (
                  <div className="mb-4">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Item Title Name</label>
                    <input 
                      type="text" 
                      value={itemName} 
                      onChange={(e) => setItemName(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-slate-300"
                      placeholder="e.g. Luxury Base Gold Lotion"
                    />
                  </div>
                )}

                {(activeModal === 'create' || activeModal === 'refill' || activeModal === 'take') && (
                  <div className="mb-6">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      {activeModal === 'create' && 'Initial Stock Quantity'}
                      {activeModal === 'refill' && 'Add Quantity Increments'}
                      {activeModal === 'take' && `Quantity Taken (Max: ${selectedItem?.total_quantity})`}
                    </label>
                    <input 
                      type="number" 
                      min="1"
                      value={quantityInput} 
                      onChange={(e) => setQuantityInput(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-black text-sm outline-none focus:border-slate-300"
                    />
                  </div>
                )}

                <div className="flex gap-2 justify-end mt-4">
                  <button 
                    type="button" 
                    onClick={closeModals}
                    className="px-4 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold uppercase"
                  >
                    Cancel
                  </button>
                  
                  {activeModal === 'create' && (
                    <button onClick={handleAddNewItem} className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase">Insert</button>
                  )}
                  {activeModal === 'refill' && (
                    <button onClick={handleRefill} className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase">Confirm Refill</button>
                  )}
                  {activeModal === 'edit' && (
                    <button onClick={handleEdit} className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase">Save Changes</button>
                  )}
                  {activeModal === 'take' && (
                    <button onClick={handleTakeItems} className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold uppercase">Log Dispatched Units</button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}