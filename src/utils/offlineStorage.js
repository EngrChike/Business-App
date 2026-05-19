const DB_NAME = 'MonBilanOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'pending_sales';

export const initOfflineDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (event) => reject(`Database error: ${event.target.error}`);
    request.onsuccess = (event) => resolve(event.target.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'local_id', autoIncrement: true });
      }
    };
  });
};

export const saveSaleOffline = async (saleData) => {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const record = {
      ...saleData,
      created_at: new Date().toISOString(),
      is_offline_record: true
    };
    const request = store.add(record);
    request.onsuccess = () => resolve(true);
    request.onerror = (event) => reject(event.target.error);
  });
};

export const getPendingSales = async () => {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });
};

export const clearSyncedSale = async (localId) => {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(localId);
    request.onsuccess = () => resolve(true);
    request.onerror = (event) => reject(event.target.error);
  });
};
