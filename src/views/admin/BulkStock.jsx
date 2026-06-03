import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { supabase } from '../../api/supabaseClient.js';

export default function BulkStock({ onBack, refreshMetrics }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [batches, setBatches] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [packageType, setPackageType] = useState('Carton');
  const [packageQty, setPackageQty] = useState('');
  const [unitsPerPkg, setUnitsPerPkg] = useState('');
  const [costPricePerPkg, setCostPricePerPkg] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');

  const fetchBulkData = useCallback(async () => {
    try {
      const [bulkRes, branchRes] = await Promise.all([
        supabase.from('bulk_inventory').select('*').order('created_at', { ascending: false }),
        supabase.from('branches').select('*').order('name', { ascending: true })
      ]);
      if (bulkRes.data) setBatches(bulkRes.data);
      if (branchRes.data) {
        setBranches(branchRes.data);
        if (branchRes.data.length > 0) setSelectedBranch(branchRes.data[0].id);
      }
    } catch (err) {
      console.error("Bulk Data Load Error:", err.message);
    }
  }, []);

  useEffect(() => {
    fetchBulkData();
  }, [fetchBulkData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !packageQty || !unitsPerPkg || !costPricePerPkg || !selectedBranch || loading) {
      return alert("Please fill out all operational fields cleanly.");
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('bulk_inventory').insert([
        {
          name: name.trim(),
          package_type: packageType,
          package_quantity: parseInt(packageQty),
          units_per_package: parseInt(unitsPerPkg),
          cost_price_per_pkg: parseFloat(costPricePerPkg),
          branch_id: selectedBranch,
          created_by: user?.id
        }
      ]);

      if (error) throw error;

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

  return (
    <div className="min-h-screen bg-[#F4F3ED] text-[#111111] p-4 md:p-8 font-sans antialiased pb-24">
      <div className="max-w-4xl mx-auto">
        <button onClick={onBack} className="text-[#3F51B5] font-bold text-xs tracking-wider uppercase mb-2 block hover:opacity-80 transition-opacity">
          ← {t('back') || 'Back'}
        </button>
        <h1 className="text-xl font-black tracking-tight text-slate-900 mb-6">Bulk Stock Supply Management</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* LOGGING ENTRY FORM */}
          <div className="bg-white p-6 rounded-[28px] shadow-sm border border-slate-100 md:col-span-1 h-fit">
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

          {/* STOCK MONITORING LEDGER */}
          <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden md:col-span-2">
            <div className="p-5 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <h2 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider">Active Bulk Supply Registers</h2>
              <div className="bg-[#3F51B5] text-white px-2.5 py-0.5 rounded-full text-[10px] font-extrabold">{batches.length}</div>
            </div>

            <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto p-5">
              {batches.length === 0 ? (
                <p className="text-slate-400 text-xs italic py-8 text-center">No bulk shipments registered in the operational master yet.</p>
              ) : (
                batches.map((batch) => (
                  <div key={batch.id} className="flex justify-between items-center py-4 first:pt-0 last:pb-0">
                    <div>
                      <h4 className="font-bold text-sm text-slate-800">{batch.name}</h4>
                      <p className="text-[10px] font-medium text-slate-400 mt-0.5 uppercase tracking-wide">
                        📦 Lot Config: {batch.package_quantity} {batch.package_type}(s) × {batch.units_per_package} items
                      </p>
                      <p className="text-[9px] font-bold text-indigo-600 uppercase mt-1">
                        Total Volume: {batch.total_unit_count?.toLocaleString()} Units Available
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-slate-900 text-sm">
                        {batch.total_cost_amount?.toLocaleString()} <span className="text-[10px] text-slate-400 font-bold">FCFA</span>
                      </p>
                      <p className="text-[9px] text-slate-400 font-medium mt-0.5">
                        {new Date(batch.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}