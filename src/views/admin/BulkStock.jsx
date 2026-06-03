// src/views/admin/BulkStock.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { supabase } from '../../api/supabaseClient.js';

export default function BulkStock({ onBack, refreshMetrics }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  
  // Role & Master Data State
  const [userRole, setUserRole] = useState('manager'); // Safe fallback
  const [batches, setBatches] = useState([]);
  const [branches, setBranches] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);

  // Form Fields (Incoming Shipments - Admin Only)
  const [name, setName] = useState('');
  const [packageType, setPackageType] = useState('Carton');
  const [packageQty, setPackageQty] = useState('');
  const [unitsPerPkg, setUnitsPerPkg] = useState('');
  const [costPricePerPkg, setCostPricePerPkg] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');

  // Modals Configuration State
  const [activeModal, setActiveModal] = useState(null); // 'refill' | 'edit' | 'take'
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [modalQuantityInput, setModalQuantityInput] = useState('');
  const [modalNameInput, setModalNameInput] = useState('');

  const currentUserName = user?.user_metadata?.full_name || user?.email || 'System User';
  const isAdmin = userRole === 'admin';
  const isManager = userRole === 'manager';

  // --- Fetch System Context & Database Ledgers ---
  const fetchBulkData = useCallback(async () => {
    try {
      setLoading(true);
      let activeRole = 'manager';
      
      // Resolve User Role directly from profiles
      if (user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        if (profile?.role) {
          setUserRole(profile.role);
          activeRole = profile.role;
        }
      }

      // Fetch registries based on authorization rules
      const [bulkRes, branchRes] = await Promise.all([
        supabase.from('bulk_inventory').select('*').order('created_at', { ascending: false }),
        supabase.from('branches').select('*').order('name', { ascending: true })
      ]);

      if (bulkRes.data) setBatches(bulkRes.data);
      if (branchRes.data) {
        setBranches(branchRes.data);
        if (branchRes.data.length > 0 && !selectedBranch) {
          setSelectedBranch(branchRes.data[0].id);
        }
      }

      // Managers and Admins both get authorization to read the audit trail logs
      if (activeRole === 'admin' || activeRole === 'manager') {
        const { data: logs, error: logFetchError } = await supabase
          .from('bulk_inventory_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(40);
        
        if (logFetchError) throw logFetchError;
        if (logs) setAuditLogs(logs);
      }

    } catch (err) {
      console.error("Bulk Ledger Sync Error:", err.message);
    } finally {
      setLoading(false);
      setCheckingRole(false);
    }
  }, [user?.id, selectedBranch]); // Stabilized dependencies array to prevent infinite rendering cycles

  useEffect(() => {
    fetchBulkData();
  }, [fetchBulkData]);

  // --- 1. INITIAL BULK ENTRY CREATION (Admin Only) ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !packageQty || !unitsPerPkg || !costPricePerPkg || !selectedBranch || loading) {
      return alert("Please fill out all operational fields cleanly.");
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bulk_inventory')
        .insert([
          {
            name: name.trim(),
            package_type: packageType,
            package_quantity: parseInt(packageQty),
            units_per_package: parseInt(unitsPerPkg),
            cost_price_per_pkg: parseFloat(costPricePerPkg),
            branch_id: selectedBranch,
            created_by: user?.id
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // Log Initial Batch Creation to Audit Trail
      const { error: logError } = await supabase.from('bulk_inventory_logs').insert([
        {
          bulk_id: data?.id,
          item_name: name.trim(),
          action_type: 'INITIAL_CREATE',
          package_qty_changed: parseInt(packageQty),
          old_value: '0 Packages',
          new_value: `${packageQty} ${packageType}s`,
          performed_by_id: user?.id,
          performed_by_name: currentUserName
        }
      ]);

      if (logError) throw logError;

      setName('');
      setPackageQty('');
      setUnitsPerPkg('');
      setCostPricePerPkg('');
      
      await fetchBulkData();
      if (typeof refreshMetrics === 'function') refreshMetrics();
      alert("Bulk stock entry committed to system ledger successfully!");
    } catch (err) {
      alert("Committed error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 2. REFILL PACKAGES OPERATION (Admin Only) ---
  const handleRefillStock = async () => {
    if (!modalQuantityInput || parseInt(modalQuantityInput) <= 0) return alert('Enter a valid quantity increment.');
    setLoading(true);

    const addedQty = parseInt(modalQuantityInput);
    const updatedTotalPackages = selectedBatch.package_quantity + addedQty;

    try {
      const { error } = await supabase
        .from('bulk_inventory')
        .update({ package_quantity: updatedTotalPackages })
        .eq('id', selectedBatch.id);

      if (error) throw error;

      const { error: logError } = await supabase.from('bulk_inventory_logs').insert([
        {
          bulk_id: selectedBatch.id,
          item_name: selectedBatch.name,
          action_type: 'REFILL',
          package_qty_changed: addedQty,
          old_value: `${selectedBatch.package_quantity} Pkgs`,
          new_value: `${updatedTotalPackages} Pkgs`,
          performed_by_id: user?.id,
          performed_by_name: currentUserName
        }
      ]);

      if (logError) throw logError;

      closeOperationalModals();
      await fetchBulkData();
      if (typeof refreshMetrics === 'function') refreshMetrics();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 3. EDIT SYSTEM CONTEXT RECORD (Admin Only) ---
  const handleEditRecord = async () => {
    if (!modalNameInput.trim()) return alert('Item title cannot be left blank.');
    setLoading(true);

    try {
      const { error } = await supabase
        .from('bulk_inventory')
        .update({ name: modalNameInput.trim() })
        .eq('id', selectedBatch.id);

      if (error) throw error;

      const { error: logError } = await supabase.from('bulk_inventory_logs').insert([
        {
          bulk_id: selectedBatch.id,
          item_name: modalNameInput.trim(),
          action_type: 'EDIT',
          package_qty_changed: 0,
          old_value: selectedBatch.name,
          new_value: modalNameInput.trim(),
          performed_by_id: user?.id,
          performed_by_name: currentUserName
        }
      ]);

      if (logError) throw logError;

      closeOperationalModals();
      await fetchBulkData();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 4. DELETE ENTIRE RECORD (Admin Only) ---
  const handleDeleteRecord = async (batch) => {
    if (!window.confirm(`Are you sure you want to delete "${batch.name}" entirely from bulk registers? This cannot be undone.`)) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from('bulk_inventory')
        .delete()
        .eq('id', batch.id);

      if (error) throw error;

      const { error: logError } = await supabase.from('bulk_inventory_logs').insert([
        {
          bulk_id: batch.id,
          item_name: batch.name,
          action_type: 'DELETE',
          package_qty_changed: -batch.package_quantity,
          old_value: `Existed with ${batch.package_quantity} Pkgs`,
          new_value: 'DELETED',
          performed_by_id: user?.id,
          performed_by_name: currentUserName
        }
      ]);

      if (logError) throw logError;

      await fetchBulkData();
      if (typeof refreshMetrics === 'function') refreshMetrics();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 5. RECORD ITEM PACKAGES TAKEN (Admin & Manager Access) ---
  const handleTakePackages = async () => {
    if (!modalQuantityInput || parseInt(modalQuantityInput) <= 0) return alert('Enter a valid package amount extracted.');
    const countTaken = parseInt(modalQuantityInput);

    if (countTaken > selectedBatch.package_quantity) {
      return alert(`Insufficient stock balance! You can take a maximum of ${selectedBatch.package_quantity} packages.`);
    }

    setLoading(true);
    const remainingQty = selectedBatch.package_quantity - countTaken;

    try {
      const { error } = await supabase
        .from('bulk_inventory')
        .update({ package_quantity: remainingQty })
        .eq('id', selectedBatch.id);

      if (error) throw error;

      // Append Audit Entry tracking what the manager/admin removed
      const { error: logError } = await supabase.from('bulk_inventory_logs').insert([
        {
          bulk_id: selectedBatch.id,
          item_name: selectedBatch.name,
          action_type: 'TAKEN',
          package_qty_changed: -countTaken,
          old_value: `${selectedBatch.package_quantity} Pkgs`,
          new_value: `${remainingQty} Pkgs`,
          performed_by_id: user?.id,
          performed_by_name: currentUserName
        }
      ]);

      if (logError) throw logError; // Caught and resolved runtime validation failures

      closeOperationalModals();
      await fetchBulkData();
      if (typeof refreshMetrics === 'function') refreshMetrics();
      alert("Removal action successfully logged to the audit tracking table.");
    } catch (err) {
      alert("Database Logging Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Modal Helpers ---
  const triggerModal = (type, batch) => {
    setActiveModal(type);
    setSelectedBatch(batch);
    setModalQuantityInput('');
    setModalNameInput(batch ? batch.name : '');
  };

  const closeOperationalModals = () => {
    setActiveModal(null);
    setSelectedBatch(null);
    setModalQuantityInput('');
    setModalNameInput('');
  };

  if (checkingRole) {
    return (
      <div className="min-h-screen bg-[#F4F3ED] flex items-center justify-center font-sans">
        <div className="text-center font-bold text-slate-500 animate-pulse text-xs uppercase tracking-widest">
          Verifying Bulk Stock Access Level...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F3ED] text-[#111111] p-4 md:p-8 font-sans antialiased pb-24">
      <div className="max-w-6xl mx-auto">
        
        {/* BACK ACTION & HEADER */}
        <button onClick={onBack} className="text-[#3F51B5] font-bold text-xs tracking-wider uppercase mb-2 block hover:opacity-80 transition-opacity">
          &larr; {t('back') || 'Back'}
        </button>
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900">Bulk Stock Supply Management</h1>
            <p className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mt-0.5">
              Secure Environment: <span className="text-[#3F51B5]">{userRole} view</span>
            </p>
          </div>
        </div>

        {/* SECURE LAYOUT GRID - Expanded automatically to 4 columns when logs are visible */}
        <div className={`grid grid-cols-1 ${(isAdmin || isManager) ? 'lg:grid-cols-4' : 'grid-cols-1'} gap-6`}>
          
          {/* LOGGING ENTRY FORM (Rendered strictly for Admin roles) */}
          {isAdmin && (
            <div className="bg-white p-6 rounded-[28px] shadow-sm border border-slate-100 lg:col-span-1 h-fit">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4">Log Incoming Shipment</h2>
              <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Item Name</label>
                  <input type="text" className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs outline-none text-slate-800" placeholder="e.g. Premium Lip Balm" value={name} onChange={e => setName(e.target.value)} />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Package Type</label>
                  <select className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs outline-none text-slate-800 cursor-pointer" value={packageType} onChange={e => setPackageType(e.target.value)}>
                    <option value="Carton">Carton</option>
                    <option value="Box">Box</option>
                    <option value="Crate">Crate</option>
                    <option value="Pallet">Pallet</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Pkg Qty</label>
                    <input type="number" min="1" className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs text-center outline-none text-slate-800" placeholder="10" value={packageQty} onChange={e => setPackageQty(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Units / Pkg</label>
                    <input type="number" min="1" className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs text-center outline-none text-slate-800" placeholder="24" value={unitsPerPkg} onChange={e => setUnitsPerPkg(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cost Price per Pkg (FCFA)</label>
                  <input type="number" className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs outline-none text-slate-800" placeholder="15,000" value={costPricePerPkg} onChange={e => setCostPricePerPkg(e.target.value)} />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Destination Branch</label>
                  <select className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs outline-none text-slate-800 cursor-pointer" value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <button type="submit" disabled={loading} className="w-full mt-2 py-3.5 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-wider disabled:opacity-50 shadow-sm active:scale-98 transition-all">
                  {loading ? "Processing Ledger..." : "Commit Bulk Stock"}
                </button>
              </form>
            </div>
          )}

          {/* STOCK MONITORING LEDGER LIST - Auto dimensions matching role view columns footprint */}
          <div className={`bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden ${isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            <div className="p-5 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <h2 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider">Active Bulk Vault Balance Registers</h2>
              <div className="bg-[#3F51B5] text-white px-2.5 py-0.5 rounded-full text-[10px] font-extrabold">{batches.length}</div>
            </div>

            <div className="divide-y divide-slate-100 max-h-[580px] overflow-y-auto p-5">
              {batches.length === 0 ? (
                <p className="text-slate-400 text-xs italic py-8 text-center">No bulk shipments registered in the operational master yet.</p>
              ) : (
                batches.map((batch) => (
                  <div key={batch.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-4.5 first:pt-0 last:pb-0 gap-3">
                    <div className="flex-1">
                      <h4 className="font-bold text-sm text-slate-800">{batch.name}</h4>
                      <p className="text-[10px] font-medium text-slate-400 mt-0.5 uppercase tracking-wide">
                        📦 Lot Config: {batch.package_quantity} {batch.package_type}(s) &times; {batch.units_per_package} items
                      </p>
                      <p className="text-[9px] font-black text-indigo-600 uppercase mt-1">
                        Total Volume: {batch.total_unit_count?.toLocaleString() || (batch.package_quantity * batch.units_per_package).toLocaleString()} Units Available
                      </p>
                    </div>

                    <div className="flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-center gap-1 min-w-[100px]">
                      <p className="font-black text-slate-900 text-sm">
                        {batch.total_cost_amount?.toLocaleString() || (batch.cost_price_per_pkg * batch.package_quantity).toLocaleString()} <span className="text-[10px] text-slate-400 font-bold">FCFA</span>
                      </p>
                      <p className="text-[9px] text-slate-400 font-medium">
                        {new Date(batch.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Operational Actions Context Routing */}
                    <div className="flex gap-1.5 self-end sm:self-center">
                      <button 
                        onClick={() => triggerModal('take', batch)}
                        className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 font-black text-[10px] rounded-lg uppercase tracking-wider hover:bg-emerald-100 transition-colors"
                      >
                        Take Packages
                      </button>

                      {isAdmin && (
                        <>
                          <button 
                            onClick={() => triggerModal('refill', batch)}
                            className="px-2.5 py-1.5 bg-blue-50 text-blue-700 font-black text-[10px] rounded-lg uppercase tracking-wider hover:bg-blue-100 transition-colors"
                          >
                            Refill
                          </button>
                          <button 
                            onClick={() => triggerModal('edit', batch)}
                            className="px-2.5 py-1.5 bg-slate-100 text-slate-600 font-black text-[10px] rounded-lg uppercase tracking-wider hover:bg-slate-200 transition-colors"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteRecord(batch)}
                            className="px-2.5 py-1.5 bg-red-50 text-red-600 font-black text-[10px] rounded-lg uppercase tracking-wider hover:bg-red-100 transition-colors"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* REAL-TIME AUDIT TRACKING TIMELINE PANEL - Authorized for both Admin and Manager dashboard views */}
          {(isAdmin || isManager) && (
            <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm p-5 lg:col-span-1 h-fit max-h-[640px] flex flex-col">
              <div className="pb-3 border-b border-slate-50 mb-3 flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Manager Activity Trail Logs</h3>
                <span className="px-2 py-0.5 bg-red-50 text-red-600 font-black text-[8px] rounded-md animate-pulse">LIVE MONITOR</span>
              </div>
              <div className="overflow-y-auto divide-y divide-slate-50 flex-1 pr-1">
                {auditLogs.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic py-4 text-center">No structural log history found.</p>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className="py-2.5 text-[11px]">
                      <div className="flex justify-between items-start font-bold gap-2">
                        <span className="text-slate-700 truncate">{log.performed_by_name}</span>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-black flex-shrink-0 ${
                          log.action_type === 'TAKEN' ? 'bg-amber-50 text-amber-700' :
                          log.action_type === 'DELETE' ? 'bg-red-50 text-red-700' :
                          log.action_type === 'REFILL' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {log.action_type}
                        </span>
                      </div>
                      <p className="text-slate-500 mt-0.5 font-medium">
                        Product: <span className="font-bold text-slate-700">{log.item_name}</span> 
                        {log.package_qty_changed !== 0 && ` (${log.package_qty_changed > 0 ? '+' : ''}${log.package_qty_changed} Pkgs)`}
                      </p>
                      {log.old_value && (
                        <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                          {log.old_value} &rarr; {log.new_value}
                        </p>
                      )}
                      <p className="text-[8px] text-slate-300 font-medium mt-0.5">{new Date(log.created_at).toLocaleString()}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>

        {/* --- DYNAMIC INTERACTION DIALOG DIALOGS --- */}
        {activeModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white w-full max-w-sm rounded-[24px] p-6 shadow-xl animate-in zoom-in-95 duration-100">
              <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider mb-4">
                {activeModal === 'refill' && `Refill Packages: ${selectedBatch?.name}`}
                {activeModal === 'edit' && `Modify Product Entry Name`}
                {activeModal === 'take' && `Log Packages Taken: ${selectedBatch?.name}`}
              </h3>

              <div className="flex flex-col gap-4">
                {activeModal === 'edit' ? (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Update Item Title</label>
                    <input 
                      type="text" 
                      value={modalNameInput} 
                      onChange={(e) => setModalNameInput(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs outline-none focus:border-slate-300"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      {activeModal === 'refill' ? 'Add Package Count Increments' : `Package Count Extracted (Max Available: ${selectedBatch?.package_quantity})`}
                    </label>
                    <input 
                      type="number" 
                      min="1"
                      placeholder="e.g. 5"
                      value={modalQuantityInput} 
                      onChange={(e) => setModalQuantityInput(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-black text-xs outline-none focus:border-slate-300"
                    />
                  </div>
                )}

                <div className="flex gap-2 justify-end mt-2">
                  <button 
                    type="button" 
                    onClick={closeOperationalModals}
                    disabled={loading}
                    className="px-4 py-2 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-bold uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                  
                  {activeModal === 'refill' && (
                    <button onClick={handleRefillStock} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider">Commit Refill</button>
                  )}
                  {activeModal === 'edit' && (
                    <button onClick={handleEditRecord} disabled={loading} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider">Save Title</button>
                  )}
                  {activeModal === 'take' && (
                    <button onClick={handleTakePackages} disabled={loading} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider">Log Dispatched</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}