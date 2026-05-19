import React, { useEffect, useState } from 'react';
import { supabase } from '../api/supabaseClient.js';
import { getPendingSales, clearSyncedSale } from '../utils/offlineStorage.js';

export default function OfflineSyncManager() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineDataToServer();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (navigator.onLine) syncOfflineDataToServer();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncOfflineDataToServer = async () => {
    try {
      const pendingRecords = await getPendingSales();
      if (!pendingRecords || pendingRecords.length === 0) return;

      setSyncing(true);
      for (const sale of pendingRecords) {
        const { local_id, is_offline_record, ...cleanSaleData } = sale;
        const { error } = await supabase.from('sales').insert([cleanSaleData]);
        if (!error) {
          await clearSyncedSale(local_id);
        } else {
          console.error("Failed to push batch record:", error.message);
        }
      }
    } catch (err) {
      console.error("Offline sync routine failed:", err);
    } finally {
      setSyncing(false);
    }
  };

  if (!isOnline) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:w-80 bg-[#FF5A50] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 z-50 font-sans animate-bounce">
        <span className="text-lg">📡</span>
        <div>
          <p className="text-xs font-black uppercase tracking-wider">Connexion Interrompue</p>
          <p className="text-[10px] font-medium opacity-90">Mode déconnecté actif. Les ventes sont sécurisées localement.</p>
        </div>
      </div>
    );
  }

  if (syncing) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:w-80 bg-[#3F51B5] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 z-50 font-sans">
        <span className="text-lg animate-spin">⏳</span>
        <div>
          <p className="text-xs font-black uppercase tracking-wider">Mise à jour du Cloud</p>
          <p className="text-[10px] font-medium opacity-90">Synchronisation des transactions locales en cours...</p>
        </div>
      </div>
    );
  }

  return null;
}
