// Tiny IndexedDB wrapper for transactions created while offline
const pendingDB = (() => {
  const DB_NAME = 'budget';
  const STORE = 'pending';

  const open = () =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { autoIncrement: true });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

  const run = async (mode, fn) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const result = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
      tx.onerror = () => reject(tx.error);
    });
  };

  return {
    add: (record) => run('readwrite', (store) => store.add(record)),
    getAll: () => run('readonly', (store) => store.getAll()),
    clear: () => run('readwrite', (store) => store.clear()),
  };
})();
