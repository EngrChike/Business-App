// src/views/admin/StaffManagement.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, 
  KeyRound, 
  Building2, 
  Users, 
  UserPlus, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Trash2, 
  Loader2, 
  ShieldCheck,
  MapPin,
  ClipboardList
} from 'lucide-react';
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
        if (isMounted) setMessage("System Registry Init Error: " + err.message);
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
      setMessage("Error: All registration fields are strictly required.");
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
        setMessage(t('staff_created_success') || "Account Authorized Successfully! Member profile is active.");
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
      setMessage("Processing Exception: " + err.message);
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
      setMessage("New branch location deployed successfully!");
      if (typeof refreshMetrics === 'function') refreshMetrics();
    } catch (err) {
      setMessage("Branch Save Error: " + err.message);
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
      
      setMessage("Station allocation updated successfully in ledger database.");
    } catch (err) {
      setMessage("Allocation System Error: " + err.message);
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
      
      setMessage("User security rank altered successfully.");
    } catch (err) {
      setMessage("Security Modification Rejected: " + err.message);
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
      
      setMessage(`Staff status changed to ${!currentStatus ? 'ACTIVE' : 'SUSPENDED'}`);
    } catch (err) {
      setMessage("Status alteration rejected: " + err.message);
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

      setMessage("Branch station successfully decommissioned.");
      await fetchManagementInfrastructure();
      if (typeof refreshMetrics === 'function') refreshMetrics();
    } catch (err) {
      setMessage("Failed to remove branch station: " + err.message);
    }
  };

  if (loadingLayout) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans p-6">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
        <div className="text-xs font-black text-slate-400 animate-pulse tracking-widest uppercase">
          Loading HQ Access Framework Controls...
        </div>
      </div>
    );
  }

  const isErrorMessage = message.toLowerCase().includes('error') || message.toLowerCase().includes('failed') || message.toLowerCase().includes('rejected') || message.toLowerCase().includes('exception');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 font-sans antialiased space-y-8 max-w-6xl mx-auto pb-24">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-6 gap-4">
        <div>
          <button 
            onClick={onBack} 
            className="inline-flex items-center gap-1.5 text-indigo-600 font-extrabold text-xs uppercase tracking-wider hover:text-indigo-700 transition-colors py-1 px-2.5 rounded-lg hover:bg-indigo-50 mb-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('back') || 'Back to Station Panel'}</span>
          </button>
          <h1 className="text-xl md:text-2xl font-black italic uppercase tracking-tight text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-600 not-italic shrink-0" />
            <span>{t('access_control') || 'Access Control Center'}</span>
          </h1>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
            {t('staff_provisioning') || 'Enterprise Staff Provisioning & Terminal Station Vectors'}
          </p>
        </div>
      </div>

      {/* NOTIFICATION BANNER */}
      {message && (
        <div className={`p-4 rounded-2xl text-xs font-black uppercase text-center tracking-wide border transition-all max-w-2xl mx-auto shadow-xs flex items-center justify-center gap-2 ${
          isErrorMessage 
            ? 'bg-rose-50 text-rose-700 border-rose-200/80' 
            : 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
        }`}>
          {isErrorMessage ? <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" /> : <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />}
          <span>{message}</span>
        </div>
      )}

      {/* CORE CONTROL INPUT BOARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* PANEL A: ACCOUNT REGISTRATION FORM */}
        <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
            <KeyRound className="w-5 h-5 text-indigo-600" />
            <h3 className="font-black text-xs uppercase text-slate-900 tracking-wider">Account Provisioning Registry</h3>
          </div>

          <form onSubmit={handleCreateStaff} className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 px-1">
                {t('staff_full_name_label') || 'Staff Full Name'}
              </label>
              <input 
                type="text" 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white text-slate-900 font-bold text-xs transition-all"
                placeholder="e.g., Arnold Chike"
                required
              />
            </div>
            
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 px-1">
                {t('staff_email_label') || 'Staff Username / Email'}
              </label>
              <input 
                type="text" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white text-slate-900 font-bold text-xs transition-all"
                placeholder="staffname or email@business.com"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 px-1">
                Account Clearance Rank
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white text-slate-900 font-extrabold text-xs transition-all cursor-pointer"
              >
                <option value="staff">Standard Staff Member (Sales Register)</option>
                <option value="manager">Branch Manager (Operational Controls)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 px-1">
                {t('secure_password_label') || 'Secure Password'}
              </label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white text-slate-900 font-bold text-xs tracking-widest transition-all"
                placeholder="••••••••••••"
                minLength={6}
                required
              />
            </div>

            <button 
              type="submit"
              disabled={actionLoading} 
              className="w-full p-4 bg-slate-900 hover:bg-slate-950 text-white rounded-2xl font-black uppercase text-xs tracking-wider shadow-xs hover:shadow active:scale-[0.98] transition-all disabled:opacity-50 mt-2 inline-flex items-center justify-center gap-2"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>Provisioning Account...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 text-indigo-400" />
                  <span>{t('authorize_staff_btn') || "Authorize Account"}</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* PANEL B: PHYSICAL STATION COUNTER CREATION */}
        <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <h3 className="font-black text-xs uppercase text-slate-900 tracking-wider">Deployed Stations Counter</h3>
          </div>

          <form onSubmit={handleCreateBranch} className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 px-1">Branch Name</label>
              <input 
                type="text" 
                placeholder="e.g., Owerri Showroom" 
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white text-slate-900 font-bold text-xs transition-all"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                required
              />
            </div>
            
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 px-1">Location Details</label>
              <input 
                type="text" 
                placeholder="e.g., Suite 4 Umuikea Umuoma" 
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white text-slate-900 font-bold text-xs transition-all"
                value={newBranchLocation}
                onChange={(e) => setNewBranchLocation(e.target.value)}
              />
            </div>

            <button 
              type="submit"
              disabled={actionLoading}
              className="w-full p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase text-xs tracking-wider shadow-xs hover:shadow active:scale-[0.98] transition-all disabled:opacity-50 mt-2 inline-flex items-center justify-center gap-2"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Deploying Station...</span>
                </>
              ) : (
                <>
                  <Building2 className="w-4 h-4 text-indigo-200" />
                  <span>Deploy Operational Station Point</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* LOWER STACKED DATA TABLES */}
      <div className="space-y-6">
        
        {/* TABLE 1: STAFF DATA ENGINE */}
        <div className="bg-white rounded-[32px] border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-6 bg-white border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <h3 className="font-black text-xs uppercase text-slate-900 tracking-wider">Staff Allocation Ledger & Security Toggles</h3>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[9px] font-black uppercase text-slate-400 tracking-widest bg-slate-50/60">
                  <th className="p-5">Employee Information</th>
                  <th className="p-5">Security Rank</th>
                  <th className="p-5">Allocated Station Base</th>
                  <th className="p-5 text-center">Security Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                {staffList.map((staff) => {
                  const fallbackName = staff.email ? staff.email.split('@')[0].toUpperCase() : 'New Staff';
                  const staffDisplayName = staff.full_name || staff.name || fallbackName;
                  const staffDisplayEmail = staff.email || 'No email attached';

                  return (
                    <tr key={staff.id} className={`hover:bg-slate-50/50 transition-colors ${!staff.is_active ? 'bg-rose-50/30' : ''}`}>
                      <td className="p-5">
                        <p className="font-extrabold text-slate-900 uppercase tracking-tight">{staffDisplayName}</p>
                        <p className="text-[10px] font-medium text-slate-400 lowercase mt-0.5">{staffDisplayEmail}</p>
                      </td>
                      
                      <td className="p-5">
                        <select
                          value={staff.role || "staff"}
                          onChange={(e) => handleRoleChange(staff.id, e.target.value)}
                          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-black text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer uppercase"
                        >
                          <option value="staff">STAFF</option>
                          <option value="manager">MANAGER</option>
                        </select>
                      </td>
                      
                      <td className="p-5">
                        <select
                          value={staff.branch_id || ""}
                          onChange={(e) => handleAllocateStaff(staff.id, e.target.value)}
                          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-black text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer max-w-[220px]"
                        >
                          <option value="" className="text-amber-600 font-bold">Unassigned (Locked Out)</option>
                          {branches.map(b => (
                            <option key={b.id} value={b.id}>
                              Station: {b.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      
                      <td className="p-5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStaffAccess(staff.id, staff.is_active)}
                          className={`px-3.5 py-2 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all shadow-xs active:scale-95 inline-flex items-center gap-1.5 ${
                            staff.is_active 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200' 
                              : 'bg-rose-50 text-rose-600 border border-rose-200/80 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                          }`}
                        >
                          {staff.is_active ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Active</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-rose-500" />
                              <span>Suspended</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {staffList.length === 0 && (
                  <tr>
                    <td colSpan="4" className="text-center py-8 text-xs font-bold text-slate-400 italic">
                      No matching records found in public enterprise registry profiles.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* TABLE 2: STATIONS CONTROLLER ENGINE */}
        <div className="bg-white rounded-[32px] border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-6 bg-white border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <h3 className="font-black text-xs uppercase text-slate-900 tracking-wider">Active Deployed Station Indices</h3>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[9px] font-black uppercase text-slate-400 tracking-widest bg-slate-50/60">
                  <th className="p-5">Station Name</th>
                  <th className="p-5">Location Anchor</th>
                  <th className="p-5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                {branches.map((branch) => (
                  <tr key={branch.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-5 font-extrabold text-slate-900 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>{branch.name}</span>
                    </td>
                    <td className="p-5 font-medium text-slate-500">
                      {branch.location ? (
                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{branch.location}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">No location specified</span>
                      )}
                    </td>
                    <td className="p-5 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteBranch(branch.id)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100/80 text-rose-600 border border-rose-200/80 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all active:scale-95 inline-flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        <span>Decommission</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {branches.length === 0 && (
                  <tr>
                    <td colSpan="3" className="text-center py-8 text-xs font-bold text-slate-400 italic">
                      No active operational branch records registered in the system.
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