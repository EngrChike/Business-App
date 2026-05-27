// src/views/admin/StaffManagement.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext.jsx'; 
import { supabase } from '../../api/supabaseClient';
import { createClient } from '@supabase/supabase-js';

// Instantiate an independent authentication engine with storage token mapping disabled.
const provisioningClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false, 
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'sb-isolated-provisioning-token', 
      storage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      }
    }
  }
);

export default function StaffManagement({ onBack, refreshMetrics }) {
  const { t } = useLanguage();

  // --- CORE UI LAYOUT STATES ---
  const [branches, setBranches] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loadingLayout, setLoadingLayout] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');

  // --- REGISTRATION FORM STATE ---
  const [fullName, setFullName] = useState(''); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('staff'); 

  // --- BRANCH FORM STATE ---
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchLocation, setNewBranchLocation] = useState('');

  // Centralized background infrastructure synchronizer
  const fetchManagementInfrastructure = useCallback(async () => {
    try {
      const { data: branchData } = await supabase.from('branches').select('id, name, location').order('name', { ascending: true });
      setBranches(branchData || []);

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, name, email, role, branch_id, is_active')
        .neq('role', 'admin')
        .order('name', { ascending: true });
      setStaffList(profilesData || []);
    } catch (err) {
      console.error("Management infrastructure background sync failed:", err);
    }
  }, []);

  // Safe Lifecycle Hook to prevent static loading screen hangs
  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      setLoadingLayout(true);
      try {
        const { data: branchData, error: bError } = await supabase
          .from('branches')
          .select('id, name, location')
          .order('name', { ascending: true });
        if (bError) throw bError;
        if (isMounted) setBranches(branchData || []);

        const { data: profilesData, error: pError } = await supabase
          .from('profiles')
          .select('id, full_name, name, email, role, branch_id, is_active')
          .neq('role', 'admin')
          .order('name', { ascending: true });
        if (pError) throw pError;
        if (isMounted) setStaffList(profilesData || []);

      } catch (err) {
        if (isMounted) setMessage("❌ System Registry Init Error: " + err.message);
      } finally {
        if (isMounted) setLoadingLayout(false);
      }
    };

    loadInitialData();

    return () => {
      isMounted = false; 
    };
  }, []);

  // --- ACTION 1: AUTHORIZE / CREATE NEW AUTH ACCOUNT ---
  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setMessage('');

    if (!fullName.trim() || !email.trim() || !password) {
      setMessage("❌ Error: All registration fields are strictly required.");
      setActionLoading(false);
      return;
    }

    let verifiedEmailString = email.trim().toLowerCase();
    if (!verifiedEmailString.includes('@')) {
      const prefixClean = fullName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      verifiedEmailString = `${prefixClean || 'staff'}@business.local`;
    }

    try {
      const { data, error } = await provisioningClient.auth.signUp({
        email: verifiedEmailString,
        password: password,
        options: {
          data: {
            full_name: fullName.trim(),
            name: fullName.trim(),
            role: selectedRole
          }
        }
      });

      if (error) throw error;

      if (data?.user) {
        setMessage(t('staff_created_success') || "✅ Account Authorized Successfully! Member profile is active.");
        setFullName('');
        setEmail('');
        setPassword('');
        setSelectedRole('staff');
        
        setTimeout(async () => {
          await fetchManagementInfrastructure(); 
          if (typeof refreshMetrics === 'function') refreshMetrics();
        }, 600);
      }
    } catch (err) {
      setMessage("❌ Processing Exception: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // --- ACTION 2: CREATING NEW PHYSICAL BRANCHES ---
  const handleCreateBranch = async (e) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    setActionLoading(true);
    setMessage('');

    try {
      const { data, error } = await supabase
        .from('branches')
        .insert([{ name: newBranchName.trim(), location: newBranchLocation.trim() }])
        .select();

      if (error) throw error;
      
      if (data && data.length > 0) {
        setBranches(prev => [...prev, data[0]]);
      }
      setNewBranchName('');
      setNewBranchLocation('');
      setMessage("✅ New branch location deployed successfully!");
      if (typeof refreshMetrics === 'function') refreshMetrics();
    } catch (err) {
      setMessage("❌ Branch Save Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // --- ACTION 3: REASSIGN EXCLUSIVE BRANCH ALLOCATION ---
  const handleAllocateStaff = async (profileId, targetBranchId) => {
    setMessage('');
    try {
      const updatedBranchValue = targetBranchId === "" ? null : targetBranchId;

      const { error } = await supabase
        .from('profiles')
        .update({ branch_id: updatedBranchValue })
        .eq('id', profileId);

      if (error) throw error;

      setStaffList(prev => prev.map(staff => 
        staff.id === profileId ? { ...staff, branch_id: updatedBranchValue } : staff
      ));
      
      setMessage("✅ Station allocation updated successfully in ledger database.");
    } catch (err) {
      setMessage("⚠️ Allocation System Error: " + err.message);
    }
  };

  // --- ACTION 4: ASSIGN OR ALTER USER ACCOUNT ROLE MANUALLY ---
  const handleRoleChange = async (profileId, targetRole) => {
    setMessage('');
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: targetRole })
        .eq('id', profileId);

      if (error) throw error;

      setStaffList(prev => prev.map(staff => 
        staff.id === profileId ? { ...staff, role: targetRole } : staff
      ));
      
      setMessage("✅ User security rank altered successfully.");
    } catch (err) {
      setMessage("⚠️ Security Modification Rejected: " + err.message);
    }
  };

  // --- ACTION 5: ADMINISTRATIVE DEACTIVATION TOGGLE ---
  const handleToggleStaffAccess = async (profileId, currentStatus) => {
    setMessage('');
    const promptMessage = currentStatus 
      ? "Are you sure you want to SUSPEND this user?"
      : "Restore active app status permissions for this profile?";
      
    if (!window.confirm(promptMessage)) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', profileId);

      if (error) throw error;

      setStaffList(prev => prev.map(staff => 
        staff.id === profileId ? { ...staff, is_active: !currentStatus } : staff
      ));
      
      setMessage(`✅ Staff status changed to ${!currentStatus ? 'ACTIVE' : 'SUSPENDED'}`);
    } catch (err) {
      setMessage("❌ Status alteration rejected: " + err.message);
    }
  };

  // --- ACTION 6: DECOMMISSION / REMOVE A BRANCH ---
  const handleDeleteBranch = async (branchId) => {
    setMessage('');
    if (!window.confirm("Are you sure you want to completely remove this operational station counter?")) return;
    
    try {
      const { error } = await supabase
        .from('branches')
        .delete()
        .eq('id', branchId);

      if (error) throw error;

      setMessage("✅ Branch station successfully decommissioned.");
      await fetchManagementInfrastructure();
      if (typeof refreshMetrics === 'function') refreshMetrics();
    } catch (err) {
      setMessage("❌ Failed to remove branch station: " + err.message);
    }
  };

  if (loadingLayout) {
    return (
      <div className="min-h-screen bg-[#F4F3ED] flex items-center justify-center font-sans">
        <div className="text-xs font-bold text-slate-500 animate-pulse tracking-widest uppercase">
          Loading HQ Access Framework Controls...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F3ED] text-[#111111] p-4 md:p-8 font-sans antialiased space-y-8 max-w-5xl mx-auto">
      
      {/* HEADER SECTION WITH IVORY WRAPPERS */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-6 gap-4">
        <div>
          <button onClick={onBack} className="text-[#3F51B5] font-bold text-xs uppercase tracking-widest flex items-center gap-2 mb-2 hover:opacity-80 transition-all">
            ← {t('back') || 'Back to Station Panel'}
          </button>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">
            {t('access_control') || 'Access Control Center'}
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            {t('staff_provisioning') || 'Enterprise Staff Provisioning & Terminal Station Vectors'}
          </p>
        </div>
      </div>

      {/* RE-ANIMATED NOTIFICATION GRID */}
      {message && (
        <div className={`p-4 rounded-2xl text-xs font-black uppercase text-center tracking-wider border transition-all max-w-xl mx-auto shadow-sm ${
          message.includes('❌') || message.includes('⚠️') 
            ? 'bg-red-50 text-red-700 border-red-200' 
            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
        }`}>
          {message}
        </div>
      )}

      {/* CORE CONTROL INPUT BOARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* PANEL A: ACCOUNT REGISTRATION FORM */}
        <div className="bg-white p-6 md:p-8 rounded-[28px] border border-slate-100 shadow-sm space-y-4">
          <h3 className="font-black text-xs uppercase text-[#3F51B5] tracking-widest">🔑 Account Provisioning Registry</h3>
          <form onSubmit={handleCreateStaff} className="space-y-4">
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">
                {t('staff_full_name_label') || 'Staff Full Name'}
              </label>
              <input 
                type="text" 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#3F51B5] focus:bg-white text-slate-900 font-bold text-xs transition-all"
                placeholder="e.g., Arnold Chike"
                required
              />
            </div>
            
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">
                {t('staff_email_label') || 'Staff Username / Email'}
              </label>
              <input 
                type="text" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#3F51B5] focus:bg-white text-slate-900 font-bold text-xs transition-all"
                placeholder="staffname or email@business.com"
                required
              />
            </div>

            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">
                Account Clearance Rank
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#3F51B5] focus:bg-white text-slate-900 font-bold text-xs transition-all cursor-pointer"
              >
                <option value="staff">Standard Staff Member (Sales Register)</option>
                <option value="manager">Branch Manager (Operational Controls)</option>
              </select>
            </div>

            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">
                {t('secure_password_label') || 'Secure Password'}
              </label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#3F51B5] focus:bg-white text-slate-900 font-bold text-xs tracking-widest transition-all"
                placeholder="••••••••••••"
                minLength={6}
                required
              />
            </div>

            <button 
              type="submit"
              disabled={actionLoading} 
              className="w-full p-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-sm transition-all active:scale-[0.99] disabled:opacity-50 mt-2"
            >
              {actionLoading ? "Provisioning..." : (t('authorize_staff_btn') || "Authorize Account 🔑")}
            </button>
          </form>
        </div>

        {/* PANEL B: PHYSICAL STATION COUNTER CREATION */}
        <div className="bg-white p-6 md:p-8 rounded-[28px] border border-slate-100 shadow-sm space-y-4">
          <h3 className="font-black text-xs uppercase text-[#3F51B5] tracking-widest">🏢 Deployed Stations Counter</h3>
          <form onSubmit={handleCreateBranch} className="space-y-4">
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Branch Name</label>
              <input 
                type="text" 
                placeholder="e.g., Owerri Showroom" 
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#3F51B5] focus:bg-white text-slate-900 font-bold text-xs transition-all"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                required
              />
            </div>
            
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Location Details</label>
              <input 
                type="text" 
                placeholder="e.g., Suite 4 Umuikea Umuoma" 
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#3F51B5] focus:bg-white text-slate-900 font-bold text-xs transition-all"
                value={newBranchLocation}
                onChange={(e) => setNewBranchLocation(e.target.value)}
              />
            </div>

            <button 
              type="submit"
              disabled={actionLoading}
              className="w-full p-4 bg-[#3F51B5] hover:bg-indigo-700 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-sm transition-all active:scale-[0.99] disabled:opacity-50 mt-2"
            >
              Deploy Operational Station Point
            </button>
          </form>
        </div>
      </div>

      {/* LOWER STACKED DATA TABLES */}
      <div className="space-y-6">
        
        {/* TABLE 1: STAFF DATA ENGINE */}
        <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm">
          <h3 className="font-black text-xs uppercase text-slate-800 tracking-wider mb-4">📋 Staff Allocation Ledger & Security Toggles</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                  <th className="pb-3">Employee Information</th>
                  <th className="pb-3">Security Rank</th>
                  <th className="pb-3">Allocated Station Base</th>
                  <th className="pb-3 text-center">Security Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                {staffList.map((staff) => {
                  const fallbackName = staff.email ? staff.email.split('@')[0].toUpperCase() : 'New Staff';
                  const staffDisplayName = staff.full_name || staff.name || fallbackName;
                  const staffDisplayEmail = staff.email || 'No email attached';

                  return (
                    <tr key={staff.id} className={`hover:bg-slate-50/80 transition-colors ${!staff.is_active ? 'bg-red-50/50 opacity-60' : ''}`}>
                      <td className="py-3.5">
                        <p className="font-extrabold text-slate-900 uppercase tracking-tight">{staffDisplayName}</p>
                        <p className="text-[10px] font-medium text-slate-400 lowercase mt-0.5">{staffDisplayEmail}</p>
                      </td>
                      
                      <td className="py-3.5">
                        <select
                          value={staff.role || "staff"}
                          onChange={(e) => handleRoleChange(staff.id, e.target.value)}
                          className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-black text-slate-700 outline-none focus:border-[#3F51B5] cursor-pointer"
                        >
                          <option value="staff">STAFF</option>
                          <option value="manager">MANAGER</option>
                        </select>
                      </td>
                      
                      <td className="py-3.5">
                        <select
                          value={staff.branch_id || ""}
                          onChange={(e) => handleAllocateStaff(staff.id, e.target.value)}
                          className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-black text-slate-700 outline-none focus:border-[#3F51B5] cursor-pointer max-w-[200px]"
                        >
                          <option value="" className="text-amber-600 font-bold">⚠️ Unassigned (Locked Out)</option>
                          {branches.map(b => (
                            <option key={b.id} value={b.id}>
                              🏢 {b.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      
                      <td className="py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStaffAccess(staff.id, staff.is_active)}
                          className={`px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all shadow-sm ${
                            staff.is_active 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-red-50 hover:text-red-600 hover:border-red-100' 
                              : 'bg-red-50 text-red-600 border border-red-100'
                          }`}
                        >
                          {staff.is_active ? '✅ Active' : '🚫 Suspended'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {staffList.length === 0 && (
                  <tr>
                    <td colSpan="4" className="text-center py-6 text-[10px] font-bold text-slate-400 italic">
                      No matching records found in public enterprise registry profiles.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* TABLE 2: STATIONS CONTROLLER ENGINE */}
        <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm">
          <h3 className="font-black text-xs uppercase text-slate-800 tracking-wider mb-4">🏢 Active Deployed Station Indices</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                  <th className="pb-3">Station Name</th>
                  <th className="pb-3">Location Anchor</th>
                  <th className="pb-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                {branches.map((branch) => (
                  <tr key={branch.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 font-extrabold text-slate-900">
                      🏢 {branch.name}
                    </td>
                    <td className="py-3.5 font-medium text-slate-400">
                      {branch.location || 'No metadata description specified'}
                    </td>
                    <td className="py-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteBranch(branch.id)}
                        className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all"
                      >
                        Decommission
                      </button>
                    </td>
                  </tr>
                ))}
                {branches.length === 0 && (
                  <tr>
                    <td colSpan="3" className="text-center py-6 text-[10px] font-bold text-slate-400 italic">
                      No active operational branch records registered in the system.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
      <div className="h-8"></div>
    </div>
  );
}