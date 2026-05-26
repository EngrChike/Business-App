import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import AdminDashboard from './AdminDashboard.jsx';
import ManagerDashboard from './ManagerDashboard.jsx'; // ✅ Added Manager Dashboard Import
import StaffDashboard from './StaffDashboard.jsx';

export default function Dashboard() {
  const { role } = useAuth();

  // Clean, fail-safe evaluation of roles
  const cleanRole = role ? String(role).toLowerCase().trim() : '';

  if (cleanRole === 'admin') {
    return <AdminDashboard />;
  }
  
  if (cleanRole === 'manager') {
    return <ManagerDashboard />;
  }
  
  return <StaffDashboard />;
}