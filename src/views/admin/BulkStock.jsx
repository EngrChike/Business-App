// src/views/admin/BulkStock.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { supabase } from '../../api/supabaseClient.js';

export default function BulkStock({ onBack, refreshMetrics }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  
  // States
  const [userRole, setUserRole] = useState('manager'); 
  const [batches, setBatches] = useState([]);
  const [branches, setBranches] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);

  // Form Fields
  const [name, setName] = useState('');
  const [packageType, setPackageType] = useState('Bag'); 
  const [packageQty, setPackageQty] = useState('');
  const [unitsPerPkg, setUnitsPerPkg] = useState('');
  const [costPricePerPkg, setCostPricePerPkg] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');

  // Modals Configuration
  const [activeModal, setActiveModal] = useState(null); 
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [modalQuantityInput, setModalQuantityInput] = useState('');
  const [modalNameInput, setModalNameInput] = useState('');

  // Password Gate
  const [showPasswordGate, setShowPasswordGate] = useState(false);
  const [securityPassword, setSecurityPassword] = useState('');
  const [pendingAction, setPendingAction] = useState(null);

  // Get current logged-in person's name dynamically
  const currentUserName = user?.user_metadata?.full_name || user?.email || 'Authorized Staff';
  const isAdmin = userRole === 'admin';
  const isManager = userRole === 'manager';

  const MASTER_ADMIN_KEY = "1234";

  // Fetch registers and activity logs safely
  const fetchBulkData = useCallback(async () => {
    try {
      setLoading(true);
      let activeRole = 'manager';
      
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

      // Fetch logs for visual rendering panel
      const { data: logs, error: logFetchError } = await supabase
        .from('bulk_inventory_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);
      
      if (logFetchError) throw logFetchError;
      if (logs) setAuditLogs(logs);

    } catch (err) {
      console.error("Sync Error:", err.message);
    } finally {
      setLoading(false);
      setCheckingRole(false);
    }
  }, [user?.id, selectedBranch]);

  useEffect(() => {
    fetchBulkData();
  }, [fetchBulkData]);

  const handleVerifyAndProceed = () => {
    if (securityPassword === MASTER_ADMIN_KEY) {
      const action = pendingAction;
      setShowPasswordGate(false);
      setSecurityPassword('');
      setPendingAction(null);
      
      if (action.type === 'delete') {
        executeDeleteRecord(action.batch);
      } else {
        triggerModal(action.type, action.batch);
      }
    } else {
      alert("Invalid Security Password.");
      setSecurityPassword('');
    }
  };

  const requestAccess = (type, batch) => {
    if (type === 'take') {
      triggerModal(type, batch);
    } else {
      setPendingAction({ type, batch });
      setShowPasswordGate(true);
    }
  };

  // --- 1. Initial Stock Creation ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !packageQty || !unitsPerPkg || !costPricePerPkg || !selectedBranch || loading) {
      return alert("Please fill out all fields.");
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

      // Log Initial Creation
      await supabase.from('bulk_inventory_logs').insert([
        {
          bulk_id: String(data?.id),
          item_name: name.trim(),
          action_type: 'INITIAL_CREATE',
          package_qty_changed: parseInt(packageQty),
          old_value: 'Empty Vault',
          new_value: `${packageQty} ${packageType}(s)`,
          performed_by_id: user?.id,
          performed_by_name: currentUserName,
          created_by: user?.id
        }
      ]);

      setName('');
      setPackageQty('');
      setUnitsPerPkg('');
      setCostPricePerPkg('');
      
      await fetchBulkData();
      if (typeof refreshMetrics === 'function') refreshMetrics();
      alert("Bulk item successfully added!");
    } catch (err) {
      alert("Error adding item: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 2. Refill Existing Stock ---
  const handleRefillStock = async () => {
    if (!modalQuantityInput || parseInt(modalQuantityInput) <= 0) return alert('Enter a valid quantity.');
    setLoading(true);

    const addedQty = parseInt(modalQuantityInput);
    const updatedTotalPackages = selectedBatch.package_quantity + addedQty;

    try {
      const { error } = await supabase
        .from('bulk_inventory')
        .update({ package_quantity: updatedTotalPackages })
        .eq('id', selectedBatch.id);

      if (error) throw error;

      // Add audit log trail row
      await supabase.from('bulk_inventory_logs').insert([
        {
          bulk_id: String(selectedBatch.id),
          item_name: selectedBatch.name,
          action_type: 'REFILL',
          package_qty_changed: addedQty,
          old_value: `${selectedBatch.package_quantity} Pkgs`,
          new_value: `${updatedTotalPackages} Pkgs`,
          performed_by_id: user?.id,
          performed_by_name: currentUserName,
          created_by: user?.id
        }
      ]);

      closeOperationalModals();
      await fetchBulkData();
      if (typeof refreshMetrics === 'function') refreshMetrics();
    } catch (err) {
      alert("Error logging refill: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 3. Edit Item Name ---
  const handleEditRecord = async () => {
    if (!modalNameInput.trim()) return alert('Name cannot be empty.');
    setLoading(true);

    try {
      const { error } = await supabase
        .from('bulk_inventory')
        .update({ name: modalNameInput.trim() })
        .eq('id', selectedBatch.id);

      if (error) throw error;

      await supabase.from('bulk_inventory_logs').insert([
        {
          bulk_id: String(selectedBatch.id),
          item_name: modalNameInput.trim(),
          action_type: 'EDIT',
          package_qty_changed: 0,
          old_value: selectedBatch.name,
          new_value: modalNameInput.trim(),
          performed_by_id: user?.id,
          performed_by_name: currentUserName,
          created_by: user?.id
        }
      ]);

      closeOperationalModals();
      await fetchBulkData();
    } catch (err) {
      alert("Error saving edits: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 4. Delete Entire Entry ---
  const executeDeleteRecord = async (batch) => {
    if (!window.confirm(`Delete "${batch.name}" entirely?`)) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from('bulk_inventory')
        .delete()
        .eq('id', batch.id);

      if (error) throw error;

      await supabase.from('bulk_inventory_logs').insert([
        {
          bulk_id: String(batch.id),
          item_name: batch.name,
          action_type: 'DELETE',
          package_qty_changed: -batch.package_quantity,
          old_value: `${batch.package_quantity} Pkgs left`,
          new_value: 'REMOVED FROM SYSTEM',
          performed_by_id: user?.id,
          performed_by_name: currentUserName,
          created_by: user?.id
        }
      ]);

      await fetchBulkData();
      if (typeof refreshMetrics === 'function') refreshMetrics();
    } catch (err) {
      alert("Error deleting record: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 5. Retrieve/Take Packages ---
  const handleTakePackages = async () => {
    if (!modalQuantityInput || parseInt(modalQuantityInput) <= 0) return alert('Enter a valid extraction count.');
    const countTaken = parseInt(modalQuantityInput);

    if (countTaken > selectedBatch.package_quantity) {
      return alert(`Insufficient stock balance! Maximum you can take is ${selectedBatch.package_quantity}.`);
    }

    setLoading(true);
    const remainingQty = selectedBatch.package_quantity - countTaken;

    try {
      const { error } = await supabase
        .from('bulk_inventory')
        .update({ package_quantity: remainingQty })
        .eq('id', selectedBatch.id);

      if (error) throw error;

      // Save complete action parameters to logs
      await supabase.from('bulk_inventory_logs').insert([
        {
          bulk_id: String(selectedBatch.id),
          item_name: selectedBatch.name,
          action_type: 'TAKEN',
          package_qty_changed: -countTaken,
          old_value: `${selectedBatch.package_quantity} Pkgs`,
          new_value: `${remainingQty} Pkgs`,
          performed_by_id: user?.id,
          performed_by_name: currentUserName,
          created_by: user?.id
        }
      ]);

      closeOperationalModals();
      await fetchBulkData();
      if (typeof refreshMetrics === 'function') refreshMetrics();
      alert(`Successfully logged removal by ${currentUserName}!`);
    } catch (err) {
      alert("Logging Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helpers
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
      <div className="min-h-screen bg-[#F4F3ED] flex items-center justify-center">
        <div className="text-center font-bold text-slate-400 animate-pulse text-xs uppercase tracking-widest">
          Synchronizing Security Ledger Registers...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F3ED] text-[#111111] p-4 md:p-8 font-sans antialiased pb-24">
      <div className="max-w-6xl mx-auto">
        
        <button onClick={onBack} className="text-[#3F51B5] font-bold text-xs tracking-wider uppercase mb-2 block hover:opacity-80">
          &larr; {t('back') || 'Back'}
        </button>
        
        <div className="mb-6">
          <h1 className="text-xl font-black tracking-tight text-slate-900">Bulk Stock Supply Management</h1>
          <p className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mt-0.5">
            Active Workspace: <span className="text-[#3F51B5]">{userRole} context</span>
          </p>
        </div>

        {/* Dynamic Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Form Panel */}
          {isAdmin && (
            <div className="bg-white p-6 rounded-[28px] shadow-sm border border-slate-100 lg:col-span-1 h-fit">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4">Log Incoming Shipment</h2>
              <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Item Name</label>
                  <input type="text" className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs text-slate-800" placeholder="e.g. Bags of Rice" value={name} onChange={e => setName(e.target.value)} />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Package Type</label>
                  <select className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs text-slate-800 cursor-pointer" value={packageType} onChange={e => setPackageType(e.target.value)}>
                    <option value="Bag">Bag</option>
                    <option value="Carton">Carton</option>
                    <option value="Box">Box</option>
                    <option value="Gallon">Gallon</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Pkg Qty</label>
                    <input type="number" min="1" className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs text-center text-slate-800" placeholder="10" value={packageQty} onChange={e => setPackageQty(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Units / Pkg</label>
                    <input type="number" min="1" className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs text-center text-slate-800" placeholder="50" value={unitsPerPkg} onChange={e => setUnitsPerPkg(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cost Price per Pkg (FCFA)</label>
                  <input type="number" className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs text-slate-800" placeholder="15,000" value={costPricePerPkg} onChange={e => setCostPricePerPkg(e.target.value)} />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Destination Branch</label>
                  <select className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs text-slate-800 cursor-pointer" value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <button type="submit" disabled={loading} className="w-full mt-2 py-3.5 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-wider disabled:opacity-50">
                  {loading ? "Processing..." : "Commit Bulk Stock"}
                </button>
              </form>
            </div>
          )}

          {/* Balance Registers Middle Panel */}
          <div className={`bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden ${isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            <div className="p-5 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <h2 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider">Active Bulk Vault Balance Registers</h2>
              <div className="bg-[#3F51B5] text-white px-2.5 py-0.5 rounded-full text-[10px] font-extrabold">{batches.length}</div>
            </div>

            <div className="divide-y divide-slate-100 p-5 max-h-[580px] overflow-y-auto">
              {batches.length === 0 ? (
                <p className="text-slate-400 text-xs italic py-8 text-center">No structural logs found.</p>
              ) : (
                batches.map((batch) => (
                  <div key={batch.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-4 gap-3">
                    <div className="flex-1">
                      <h4 className="font-bold text-sm text-slate-800">{batch.name}</h4>
                      <p className="text-[10px] font-medium text-slate-400 mt-0.5 uppercase tracking-wide">
                        📦 Lot Config: {batch.package_quantity} {batch.package_type}(s) &times; {batch.units_per_package} items
                      </p>
                      <p className="text-[9px] font-black text-indigo-600 uppercase mt-1">
                        Total Volume: {(batch.package_quantity * batch.units_per_package).toLocaleString()} Units Available
                      </p>
                    </div>

                    <div className="text-right min-w-[100px]">
                      <p className="font-black text-slate-900 text-sm">
                        {(batch.cost_price_per_pkg * batch.package_quantity).toLocaleString()} <span className="text-[10px] text-slate-400 font-bold">FCFA</span>
                      </p>
                      <p className="text-[9px] text-slate-400">
                        {new Date(batch.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex gap-1.5 self-end sm:self-center">
                      <button onClick={() => requestAccess('take', batch)} className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 font-black text-[10px] rounded-lg uppercase">
                        Take Packages
                      </button>
                      {(isAdmin || isManager) && (
                        <>
                          <button onClick={() => requestAccess('refill', batch)} className="px-2.5 py-1.5 bg-blue-50 text-blue-700 font-black text-[10px] rounded-lg uppercase">Refill</button>
                          <button onClick={() => requestAccess('edit', batch)} className="px-2.5 py-1.5 bg-slate-100 text-slate-600 font-black text-[10px] rounded-lg uppercase">Edit</button>
                          <button onClick={() => requestAccess('delete', batch)} className="px-2.5 py-1.5 bg-red-50 text-red-600 font-black text-[10px] rounded-lg uppercase">Delete</button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Activity Trail Monitor Logs Right Panel */}
          <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm p-5 lg:col-span-1 h-fit max-h-[640px] flex flex-col">
            <div className="pb-3 border-b border-slate-50 mb-3 flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Manager Activity Trail Logs</h3>
              <span className="px-2 py-0.5 bg-red-50 text-red-600 font-black text-[8px] rounded-md animate-pulse">LIVE MONITOR</span>
            </div>
            
            <div className="overflow-y-auto divide-y divide-slate-50 flex-1 pr-1">
              {auditLogs.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic py-8 text-center">No structural log history found.</p>
              ) : (
                auditLogs.map((log) => {
                  // Direct mappings from your precise new Supabase layout columns
                  const personName = log.performed_by_name || 'System User';
                  const itemName = log.item_name || 'Unknown';
                  const quantityChanged = log.package_qty_changed || 0;
                  const timeLogged = log.created_at ? new Date(log.created_at).toLocaleString() : 'N/A';

                  return (
                    <div key={log.id} className="py-2.5 text-[11px]">
                      <div className="flex justify-between items-start font-bold gap-2">
                        <span className="text-slate-700 truncate">{personName}</span>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-black flex-shrink-0 ${
                          log.action_type === 'TAKEN' ? 'bg-amber-50 text-amber-700' :
                          log.action_type === 'DELETE' ? 'bg-red-50 text-red-700' :
                          log.action_type === 'REFILL' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {log.action_type}
                        </span>
                      </div>
                      <p className="text-slate-500 mt-0.5 font-medium">
                        Item: <span className="font-bold text-slate-700">{itemName}</span> 
                        {quantityChanged !== 0 && ` (${quantityChanged > 0 ? '+' : ''}${quantityChanged} Pkgs)`}
                      </p>
                      {log.old_value && (
                        <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                          {log.old_value} &rarr; {log.new_value}
                        </p>
                      )}
                      <p className="text-[8px] text-slate-400 font-semibold mt-1">
                        ⏱️ {timeLogged}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* Security Password Verification Gate */}
        {showPasswordGate && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 z-[100]">
            <div className="bg-white w-full max-w-xs rounded-[32px] p-8 shadow-2xl text-center">
              <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center mx-auto mb-4">🔒</div>
              <h3 className="text-sm font-black text-slate-900 uppercase mb-2">Admin Verification</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-6 leading-relaxed">Please enter the security key.</p>
              <input 
                type="password" 
                autoFocus
                className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-center font-black text-lg tracking-[1em] outline-none"
                value={securityPassword}
                onChange={e => setSecurityPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleVerifyAndProceed()}
              />
              <div className="flex gap-2">
                <button onClick={() => { setShowPasswordGate(false); setSecurityPassword(''); }} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-bold uppercase">Cancel</button>
                <button onClick={handleVerifyAndProceed} className="flex-1 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-bold uppercase">Verify</button>
              </div>
            </div>
          </div>
        )}

        {/* Action Modals (Take/Refill/Edit) */}
        {activeModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white w-full max-w-sm rounded-[32px] p-8 shadow-xl">
              <h3 className="text-xs font-black uppercase text-slate-900 mb-6">
                {activeModal === 'take' ? `Retrieve from Bulk: ${selectedBatch?.name}` : activeModal === 'refill' ? `Refill Inventory: ${selectedBatch?.name}` : 'Edit Entry Name'}
              </h3>
              
              {activeModal === 'edit' ? (
                <input type="text" className="w-full p-4 bg-slate-100 rounded-2xl font-bold text-sm outline-none mb-4" value={modalNameInput} onChange={e => setModalNameInput(e.target.value)} />
              ) : (
                <input type="number" min="1" placeholder={activeModal === 'take' ? "Packages Count to Take" : "Quantity to Add"} className="w-full p-4 bg-slate-100 rounded-2xl font-black text-sm outline-none mb-4" value={modalQuantityInput} onChange={e => setModalQuantityInput(e.target.value)} />
              )}

              <button onClick={activeModal === 'take' ? handleTakePackages : activeModal === 'refill' ? handleRefillStock : handleEditRecord} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest">
                Confirm Action
              </button>
              <button onClick={closeOperationalModals} className="w-full mt-2 text-[10px] font-bold text-slate-400 uppercase py-2">Close</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}