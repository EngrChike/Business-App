// src/utils/offlineStorage.js
import { openDB } from 'idb';
import { supabase } from '../api/supabaseClient.js'; 

const DB_NAME = 'monbilan_offline_db';
const SALES_STORE = 'pending_sales';
const EXPENSES_STORE = 'pending_expenses';

// Initialize the IndexedDB Database Instance with version 2 to handle both stores
const dbPromise = openDB(DB_NAME, 2, {
  upgrade(db, oldVersion, newVersion) {
    if (!db.objectStoreNames.contains(SALES_STORE)) {
      db.createObjectStore(SALES_STORE, { keyPath: 'local_id', autoIncrement: true });
    }
    if (!db.objectStoreNames.contains(EXPENSES_STORE)) {
      db.createObjectStore(EXPENSES_STORE, { keyPath: 'local_id', autoIncrement: true });
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
    await db.add(SALES_STORE, record);
    return true;
  } catch (err) {
    console.error("IndexedDB sales write failure:", err.message);
    throw err;
  }
}

/**
 * 2. Fetches all pending sales stored locally.
 */
export async function getPendingSales() {
  const db = await dbPromise;
  return db.getAll(SALES_STORE);
}

/**
 * 3. Deletes a specific sale from the local queue after a successful database sync.
 */
export async function clearSyncedSale(localId) {
  const db = await dbPromise;
  return db.delete(SALES_STORE, localId);
}

/**
 * 4. Safely queues an offline expense payload into the browser's IndexedDB storage.
 */
export async function saveExpenseOffline(expenseData) {
  try {
    const db = await dbPromise;
    const record = {
      ...expenseData,
      created_at: expenseData.created_at || new Date().toISOString(),
      is_offline_record: true
    };
    await db.add(EXPENSES_STORE, record);
    return true;
  } catch (err) {
    console.error("IndexedDB expenses write failure:", err.message);
    throw err;
  }
}

/**
 * 5. Fetches all pending expenses stored locally.
 */
export async function getPendingExpenses() {
  const db = await dbPromise;
  return db.getAll(EXPENSES_STORE);
}

/**
 * 6. Deletes a specific expense from the local queue after a successful database sync.
 */
export async function clearSyncedExpense(localId) {
  const db = await dbPromise;
  return db.delete(EXPENSES_STORE, localId);
}

/**
 * 7. Master Background Reconciliation Engine for Sales.
 */
export async function syncOfflineSalesWithSupabase() {
  if (!navigator.onLine) return { success: false, reason: "Hardware network status is offline" };

  const pendingSales = await getPendingSales();
  if (pendingSales.length === 0) return { success: true, processed: 0 };

  let successfullySyncedCount = 0;

  for (const sale of pendingSales) {
    try {
      const { local_id, is_offline_record, inventory, ...cleanSupabasePayload } = sale;

      if (!cleanSupabasePayload.branch_id) {
        console.warn(`[SYNC] Local sale item ${local_id} missing operational branch tracking ID. Skipping.`);
        continue;
      }

      const { error } = await supabase.from('sales').insert([cleanSupabasePayload]);
      if (error) throw error;

      await clearSyncedSale(local_id);
      successfullySyncedCount++;
    } catch (err) {
      console.error(`[SYNC] Server engine rejected local sale record ID ${sale.local_id}:`, err.message);
    }
  }

  if (successfullySyncedCount > 0) {
    window.dispatchEvent(new Event('sales-synced'));
  }

  return { success: true, processed: successfullySyncedCount };
}

/**
 * 8. Master Background Reconciliation Engine for Expenses.
 */
export async function syncOfflineExpensesWithSupabase() {
  if (!navigator.onLine) return { success: false, reason: "Hardware network status is offline" };

  const pendingExpenses = await getPendingExpenses();
  if (pendingExpenses.length === 0) return { success: true, processed: 0 };

  let successfullySyncedCount = 0;

  for (const expense of pendingExpenses) {
    try {
      const { local_id, is_offline_record, ...cleanSupabasePayload } = expense;

      if (!cleanSupabasePayload.branch_id) {
        console.warn(`[SYNC] Local expense item ${local_id} missing operational branch tracking ID. Skipping.`);
        continue;
      }

      const { error } = await supabase.from('expenses').insert([cleanSupabasePayload]);
      if (error) throw error;

      await clearSyncedExpense(local_id);
      successfullySyncedCount++;
    } catch (err) {
      console.error(`[SYNC] Server engine rejected local expense record ID ${expense.local_id}:`, err.message);
    }
  }

  if (successfullySyncedCount > 0) {
    window.dispatchEvent(new Event('expenses-synced'));
  }

  return { success: true, processed: successfullySyncedCount };
}