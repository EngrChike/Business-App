import React from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import AdminDashboard from './AdminDashboard.jsx';
import ManagerDashboard from './ManagerDashboard.jsx'; 
import StaffDashboard from './StaffDashboard.jsx';

export default function Dashboard() {
  const { role, loading } = useAuth();

  // Clean, fail-safe evaluation of roles
  const cleanRole = role ? String(role).toLowerCase().trim() : '';

  // 1. Sleek Modern Authorization Loader (Prevents flash of wrong dashboard)
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F3ED] flex flex-col items-center justify-center font-sans antialiased p-6">
        <div className="bg-white/80 backdrop-blur-md border border-slate-200/80 p-8 rounded-[32px] shadow-xl shadow-slate-200/50 flex flex-col items-center max-w-sm w-full text-center">
          <div className="w-12 h-12 bg-slate-950 text-indigo-400 rounded-2xl flex items-center justify-center mb-4 shadow-md border border-slate-800">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mb-3" />
          <p className="text-xs font-black text-slate-800 uppercase tracking-widest mb-1">
            Verifying Access Level
          </p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Loading Terminal Workspace...
          </p>
        </div>
      </div>
    );
  }

  // 2. Role-Based Dynamic Routing
  if (cleanRole === 'admin') {
    return <AdminDashboard />;
  }
  
  if (cleanRole === 'manager') {
    return <ManagerDashboard />;
  }
  
  // 3. Fallback / Default Staff Register Terminal
  return <StaffDashboard />;
}