// src/components/OfflineSyncManager.jsx
import React, { useEffect, useState } from 'react';
// ✅ CORRECT PATH: Steps up out of components/, then enters your utils folder
import { syncOfflineSalesWithSupabase, getPendingSales } from '../utils/offlineStorage.js';

export default function OfflineSyncManager() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Check local queue count on layout initialization
    checkQueueCount();

    // Set up listeners for background state changes or manual sync updates
    const handleSyncRefresh = () => checkQueueCount();
    window.addEventListener('sales-synced', handleSyncRefresh);
    
    // Periodically attempt background sync every 30 seconds if network status changes
    const syncInterval = setInterval(() => {
      attemptBackgroundSync();
    }, 30000);

    return () => {
      window.removeEventListener('sales-synced', handleSyncRefresh);
      clearInterval(syncInterval);
    };
  }, []);

  const checkQueueCount = async () => {
    try {
      const pendingList = await getPendingSales();
      setPendingCount(pendingList.length);
    } catch (err) {
      console.error("[OFFLINE_MGR] Failed to read pending cache queue:", err.message);
    }
  };

  const attemptBackgroundSync = async () => {
    if (!navigator.onLine || isSyncing) return;
    
    try {
      setIsSyncing(true);
      await syncOfflineSalesWithSupabase();
      await checkQueueCount();
    } catch (err) {
      console.error("[OFFLINE_MGR] Background synchronization failed:", err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // If there are no pending local sales, keep the element hidden from the interface
  if (pendingCount === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-white border border-slate-100 rounded-2xl shadow-xl p-4 flex items-center gap-3 animate-fade-in">
      <div className="flex-1">
        <p className="text-xs font-black text-slate-800">
          {pendingCount} Pending {pendingCount === 1 ? 'Sale' : 'Sales'} Stored Locally
        </p>
        <p className="text-[10px] font-medium text-slate-400 mt-0.5">
          {navigator.onLine ? 'Network detected. Preparing cloud sync...' : 'Waiting for network connection...'}
        </p>
      </div>
      
      {navigator.onLine && (
        <button
          type="button"
          disabled={isSyncing}
          onClick={attemptBackgroundSync}
          className={`px-3 py-1.5 rounded-xl text-[11px] font-black tracking-tight text-white transition-all shadow-sm ${
            isSyncing 
              ? 'bg-slate-400 cursor-not-allowed' 
              : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'
          }`}
        >
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </button>
      )}
    </div>
  );
}