// src/utils/offlineStorage.js
import { openDB } from 'idb';

// ✅ FIXED PATH FOR PRODUCTION VERCEL DEPLOYMENT
// Backs out of utils/ into src/, then targets your operational frontend API folder
import { supabase } from '../api/supabaseClient.js'; 

const DB_NAME = 'monbilan_offline_db';
const STORE_NAME = 'pending_sales';

// Initialize the IndexedDB Database Instance
const dbPromise = openDB(DB_NAME, 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: 'local_id', autoIncrement: true });
    }
  },
});

/**
 * 1. Safely queues an offline sale payload into the browser's IndexedDB storage.
 */
export async function saveSaleOffline(saleData) {
  try {
    const db = await dbPromise;
    const record = {
      ...saleData,
      created_at: saleData.created_at || new Date().toISOString(),
      is_offline_record: true
    };
    await db.add(STORE_NAME, record);
    return true;
  } catch (err) {
    console.error("IndexedDB write failure:", err.message);
    throw err;
  }
}

/**
 * 2. Fetches all pending transactions stored locally.
 */
export async function getPendingSales() {
  const db = await dbPromise;
  return db.getAll(STORE_NAME);
}

/**
 * 3. Deletes a specific sale from the local queue after a successful database sync.
 */
export async function clearSyncedSale(localId) {
  const db = await dbPromise;
  return db.delete(STORE_NAME, localId);
}

/**
 * 4. Master Background Reconciliation Engine.
 * Iterates through local items, strips UI layout objects, and uploads directly to Supabase.
 */
export async function syncOfflineSalesWithSupabase() {
  // Gracefully stop if the hardware client doesn't detect network connectivity
  if (!navigator.onLine) return { success: false, reason: "Hardware network status is offline" };

  const pendingSales = await getPendingSales();
  if (pendingSales.length === 0) return { success: true, processed: 0 };

  let successfullySyncedCount = 0;

  for (const sale of pendingSales) {
    try {
      // SANITIZATION: Strip local Primary Keys and layout variables out before server insertion
      const { local_id, is_offline_record, inventory, ...cleanSupabasePayload } = sale;

      // Validate data integrity: protect against missing branch identities
      if (!cleanSupabasePayload.branch_id) {
        console.warn(`[SYNC] Local item ${local_id} missing operational branch tracking ID. Skipping.`);
        continue;
      }

      // Execute row insertion into your Supabase production table
      const { error } = await supabase.from('sales').insert([cleanSupabasePayload]);
      if (error) throw error;

      // Clear from browser storage immediately upon successful server response
      await clearSyncedSale(local_id);
      successfullySyncedCount++;
    } catch (err) {
      console.error(`[SYNC] Server engine rejected local record ID ${sale.local_id}:`, err.message);
    }
  }

  // Broadcast a global runtime window event to trigger an instant UI layout refresh
  if (successfullySyncedCount > 0) {
    window.dispatchEvent(new Event('sales-synced'));
  }

  return { success: true, processed: successfullySyncedCount };
}