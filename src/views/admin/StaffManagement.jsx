import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.jsx'; // Centralized translation wrapper hook
import { supabase } from '../../api/supabaseClient';
// 1. Import the original client initializer to create an isolated admin provisioning tunnel
import { createClient } from '@supabase/supabase-js';

// 2. Instantiate an independent authentication engine with storage token mapping completely DISABLED.
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

export default function StaffManagement({ onBack }) {
  const { t } = useLanguage(); // Centralized localized string dictionary reference

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

  // Safe Lifecycle Hook to prevent static loading screen hangs
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (!isMounted) return;
      setLoadingLayout(true);
      try {
        const { data: branchData, error: bError } = await supabase
          .from('branches')
          .select('id, name, location');
        if (bError) throw bError;
        if (isMounted) setBranches(branchData || []);

        const { data: profilesData, error: pError } = await supabase
          .from('profiles')
          .select('id, full_name, name, email, role, branch_id, is_active')
          .neq('role', 'admin');
        if (pError) throw pError;
        if (isMounted) setStaffList(profilesData || []);

      } catch (err) {
        if (isMounted) setMessage("❌ System Init Error: " + err.message);
      } finally {
        if (isMounted) setLoadingLayout(false);
      }
    };

    loadData();

    return () => {
      isMounted = false; 
    };
  }, []);

  // Manual explicit refresh action engine
  const fetchManagementInfrastructure = async () => {
    try {
      const { data: branchData } = await supabase.from('branches').select('id, name, location');
      setBranches(branchData || []);

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, name, email, role, branch_id, is_active')
        .neq('role', 'admin');
      setStaffList(profilesData || []);
    } catch (err) {
      console.error("Background sync failed", err);
    }
  };

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
      // ⚡ METADATA ROUTING: We pass the data parameters here so your backend custom trigger
      // handles writing rows into public.profiles with superuser privileges loop-free.
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
        
        // Pause briefly to give the background async trigger a millisecond to complete its transaction entry
        setTimeout(async () => {
          await fetchManagementInfrastructure(); 
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

    try {
      const { data, error } = await supabase
        .from('branches')
        .insert([{ name: newBranchName.trim(), location: newBranchLocation.trim() }])
        .select();

      if (error) throw error;
      
      setBranches(prev => [...prev, data[0]]);
      setNewBranchName('');
      setNewBranchLocation('');
      setMessage("✅ New branch location deployed successfully!");
    } catch (err) {
      setMessage("❌ Branch Save Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // --- ACTION 3: REASSIGN EXCLUSIVE BRANCH ALLOCATION ---
  const handleAllocateStaff = async (profileId, targetBranchId) => {
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
      alert("⚠️ Allocation System Error: " + err.message);
    }
  };

  // --- ACTION 4: ASSIGN OR ALTER USER ACCOUNT ROLE MANUALLY ---
  const handleRoleChange = async (profileId, targetRole) => {
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
      alert("⚠️ Security Modification Rejected: " + err.message);
    }
  };

  // --- ACTION 5: ADMINISTRATIVE DEACTIVATION TOGGLE ---
  const handleToggleStaffAccess = async (profileId, currentStatus) => {
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
      alert("Status alteration rejected: " + err.message);
    }
  };

  // --- ACTION 6: DECOMMISSION / REMOVE A BRANCH ---
  const handleDeleteBranch = async (branchId) => {
    if (!window.confirm("Are you sure you want to completely remove this operational station counter?")) return;
    
    try {
      const { error } = await supabase
        .from('branches')
        .delete()
        .eq('id', branchId);

      if (error) throw error;

      setMessage("✅ Branch station successfully decommissioned.");
      await fetchManagementInfrastructure();
    } catch (err) {
      alert("Failed to remove branch station: " + err.message);
    }
  };

  if (loadingLayout) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-xs font-black uppercase text-slate-500 tracking-widest">
        Loading Access Framework...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 font-sans text-white space-y-10 max-w-6xl mx-auto relative">
      <button onClick={onBack} className="text-blue-500 font-black text-xs uppercase tracking-widest hover:text-blue-400 transition-all block mb-4">
        {t('back') || '⬅️ Back'}
      </button>

      <div className="border-b border-white/5 pb-6">
        <h1 className="font-black text-2xl uppercase tracking-tight italic text-white">
          {t('access_control') || 'Access Control Center'}
        </h1>
        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mt-1">
          {t('staff_provisioning') || 'Enterprise Staff Provisioning & Stations Management'}
        </p>
      </div>

      {message && (
        <div className={`p-4 rounded-2xl text-xs font-black uppercase text-center tracking-wider border transition-all max-w-md mx-auto ${
          message.includes('❌') || message.includes('⚠️') 
            ? 'bg-red-500/10 text-red-400 border-red-500/20' 
            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        }`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* PANEL A: ACCOUNT REGISTRATION FORM */}
        <div className="bg-[#0f172a] p-6 md:p-8 rounded-[40px] border border-white/5 shadow-xl space-y-4">
          <h3 className="font-black text-sm uppercase text-slate-400 tracking-wider">🔑 Account Provisioning Registry</h3>
          <form onSubmit={handleCreateStaff} className="space-y-4">
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">
                {t('staff_full_name_label') || 'Staff Full Name'}
              </label>
              <input 
                type="text" 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)}
                className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-blue-500 text-white font-bold text-sm transition-all"
                placeholder="e.g., John Doe"
                required
              />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">
                {t('staff_email_label') || 'Staff Email Address'}
              </label>
              <input 
                type="text" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-blue-500 text-white font-bold text-sm transition-all"
                placeholder="staff@business.com or Name"
                required
              />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">
                Account Clearance Hierarchy Rank
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-blue-500 text-white font-bold text-sm transition-all"
              >
                <option value="staff" className="bg-slate-900 text-white">Standard Staff Member (Sales Registry Only)</option>
                <option value="manager" className="bg-slate-900 text-blue-400 font-extrabold">Branch Manager (Operational Controls)</option>
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
                className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-blue-500 text-white font-bold text-sm tracking-wide transition-all"
                placeholder="••••••••••••"
                minLength={6}
                required
              />
            </div>
            <button 
              type="submit"
              disabled={actionLoading} 
              className="w-full p-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl transition-all active:scale-95 border-b-4 border-blue-800 disabled:opacity-50 mt-4"
            >
              {actionLoading ? "Provisioning..." : (t('authorize_staff_btn') || "Authorize New Account 🔑")}
            </button>
          </form>
        </div>

        {/* PANEL B: PHYSICAL STATION COUNTER CREATION */}
        <div className="bg-[#0f172a] p-6 md:p-8 rounded-[40px] border border-white/5 shadow-xl space-y-4">
          <h3 className="font-black text-sm uppercase text-slate-400 tracking-wider">🏢 Deployed Stations Counter</h3>
          <form onSubmit={handleCreateBranch} className="space-y-4">
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Branch Name</label>
              <input 
                type="text" 
                placeholder="e.g., Main Retail Counter" 
                className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-blue-500 text-white font-bold text-sm transition-all"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Location/Address Details</label>
              <input 
                type="text" 
                placeholder="e.g., Floor 1 Suite C" 
                className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-blue-500 text-white font-bold text-sm transition-all"
                value={newBranchLocation}
                onChange={(e) => setNewBranchLocation(e.target.value)}
              />
            </div>
            <button 
              type="submit"
              disabled={actionLoading}
              className="w-full p-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl transition-all active:scale-95 border-b-4 border-indigo-800 disabled:opacity-50 mt-4"
            >
              Deploy New Station Point
            </button>
          </form>
        </div>
      </div>

      {/* LOWER STACKED DATA PANELS SECTION */}
      <div className="space-y-8">
        {/* TABLE 1: STAFF MANAGEMENT LEDGER */}
        <div className="bg-[#0f172a] p-6 md:p-8 rounded-[40px] border border-white/5 shadow-xl">
          <h3 className="font-black text-sm uppercase text-slate-400 tracking-wider mb-6">📋 Staff Allocation Ledger & Security Toggles</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                  <th className="pb-4">Employee Information</th>
                  <th className="pb-4">Security Rank Role</th>
                  <th className="pb-4">Allocated Station Base</th>
                  <th className="pb-4 text-center">System Logins Security</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs font-bold text-slate-300">
                {staffList.map((staff) => {
                  const fallbackName = staff.email ? staff.email.split('@')[0].toUpperCase() : 'New Staff Entry';
                  const staffDisplayName = staff.full_name || staff.name || fallbackName;
                  const staffDisplayEmail = staff.email || 'No email configured';

                  return (
                    <tr key={staff.id} className={`hover:bg-white/5 transition-colors ${!staff.is_active ? 'bg-red-500/5 opacity-40' : ''}`}>
                      <td className="py-4">
                        <p className="font-extrabold text-white">{staffDisplayName}</p>
                        <p className="text-[10px] font-medium text-slate-500 mt-0.5">{staffDisplayEmail}</p>
                      </td>
                      <td className="py-4">
                        <select
                          value={staff.role || "staff"}
                          onChange={(e) => handleRoleChange(staff.id, e.target.value)}
                          className="p-2 bg-white/5 border border-white/10 rounded-xl text-xs font-black text-slate-300 outline-none focus:border-blue-500 transition-all"
                        >
                          <option value="staff" className="bg-slate-900 text-white">STAFF</option>
                          <option value="manager" className="bg-slate-900 text-blue-400">MANAGER</option>
                        </select>
                      </td>
                      <td className="py-4">
                        <select
                          value={staff.branch_id || ""}
                          onChange={(e) => handleAllocateStaff(staff.id, e.target.value)}
                          className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs font-black text-slate-300 outline-none focus:border-blue-500 transition-all"
                        >
                          <option value="" className="bg-slate-900 text-amber-500">⚠️ Unassigned (Locked Out)</option>
                          {branches.map(b => (
                            <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                              🏢 {b.name} ({b.location || 'No Location'})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStaffAccess(staff.id, staff.is_active)}
                          className={`px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all active:scale-95 shadow-md ${
                            staff.is_active 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-red-500/20 hover:text-red-400' 
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
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
                    <td colSpan="4" className="text-center py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      No registry rows returned from profiles database grid.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* TABLE 2: CONSOLIDATED ACTIVE STATIONS LIST */}
        <div className="bg-[#0f172a] p-6 md:p-8 rounded-[40px] border border-white/5 shadow-xl">
          <h3 className="font-black text-sm uppercase text-slate-400 tracking-wider mb-6">🏢 Deployed Station Counters Registry</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                  <th className="pb-4">Station Name</th>
                  <th className="pb-4">Location Meta</th>
                  <th className="pb-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs font-bold text-slate-300">
                {branches.map((branch) => (
                  <tr key={branch.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-4 font-extrabold text-white">
                      🏢 {branch.name}
                    </td>
                    <td className="py-4 font-medium text-slate-400">
                      {branch.location || 'No address specified'}
                    </td>
                    <td className="py-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteBranch(branch.id)}
                        className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all"
                      >
                        Remove Station
                      </button>
                    </td>
                  </tr>
                ))}
                {branches.length === 0 && (
                  <tr>
                    <td colSpan="3" className="text-center py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      No physical station records discovered in database context.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}