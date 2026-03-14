// ============================================================
// Löwenherz PWA — Storage Layer
// Supports IndexedDB with in-memory fallback
// ============================================================

const DB_NAME = 'loewenherz-db';
const DB_VERSION = 1;

let dbInstance = null;
let useMemory = false;

const memStore = {
  profile: null,
  points: [],
  reflections: [],
  nextPointId: 1,
  nextReflectionId: 1
};

const getIDB = () => {
  try {
    return self['indexed' + 'DB'];
  } catch (e) {
    return null;
  }
};

export function initDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) { resolve(dbInstance); return; }
    const idb = getIDB();
    if (!idb) {
      console.warn('IndexedDB not available, using memory storage');
      useMemory = true;
      resolve(null);
      return;
    }
    try {
      const request = idb.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('userProfile')) {
          db.createObjectStore('userProfile', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('smallPoints')) {
          const store = db.createObjectStore('smallPoints', { keyPath: 'id', autoIncrement: true });
          store.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('reflections')) {
          const store = db.createObjectStore('reflections', { keyPath: 'id', autoIncrement: true });
          store.createIndex('date', 'date', { unique: true });
        }
      };
      request.onsuccess = (e) => { dbInstance = e.target.result; resolve(dbInstance); };
      request.onerror = (e) => { console.warn('IndexedDB open failed, using memory storage'); useMemory = true; resolve(null); };
    } catch (e) {
      console.warn('IndexedDB exception, using memory storage');
      useMemory = true;
      resolve(null);
    }
  });
}

function getDB() {
  if (useMemory) return null;
  if (!dbInstance) throw new Error('DB not initialized');
  return dbInstance;
}

export function getProfile() {
  if (useMemory) return Promise.resolve(memStore.profile);
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('userProfile', 'readonly');
    const store = tx.objectStore('userProfile');
    const req = store.get('profile');
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export function saveProfile(data) {
  const profile = { ...data, id: 'profile' };
  if (useMemory) { memStore.profile = profile; return Promise.resolve(profile); }
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('userProfile', 'readwrite');
    const store = tx.objectStore('userProfile');
    const req = store.put(profile);
    req.onsuccess = () => resolve(profile);
    req.onerror = () => reject(req.error);
  });
}

export function addSmallPoint(point) {
  if (useMemory) {
    const p = { ...point, id: memStore.nextPointId++ };
    memStore.points.push(p);
    return Promise.resolve(p.id);
  }
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('smallPoints', 'readwrite');
    const store = tx.objectStore('smallPoints');
    const req = store.add(point);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function getPointsByDate(date) {
  if (useMemory) return Promise.resolve(memStore.points.filter(p => p.date === date));
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('smallPoints', 'readonly');
    const store = tx.objectStore('smallPoints');
    const index = store.index('date');
    const req = index.getAll(date);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export function getPointsByDateRange(startDate, endDate) {
  if (useMemory) return Promise.resolve(memStore.points.filter(p => p.date >= startDate && p.date <= endDate));
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('smallPoints', 'readonly');
    const store = tx.objectStore('smallPoints');
    const index = store.index('date');
    const range = IDBKeyRange.bound(startDate, endDate);
    const req = index.getAll(range);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export function saveReflection(reflection) {
  if (useMemory) {
    const existing = memStore.reflections.find(r => r.date === reflection.date);
    if (existing) { Object.assign(existing, reflection); return Promise.resolve(existing.id); }
    else { const r = { ...reflection, id: memStore.nextReflectionId++ }; memStore.reflections.push(r); return Promise.resolve(r.id); }
  }
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('reflections', 'readwrite');
    const store = tx.objectStore('reflections');
    const index = store.index('date');
    const getReq = index.get(reflection.date);
    getReq.onsuccess = () => {
      const existing = getReq.result;
      let putData;
      if (existing) { putData = { ...existing, ...reflection, id: existing.id }; }
      else { putData = { ...reflection }; delete putData.id; }
      const putReq = store.put(putData);
      putReq.onsuccess = () => resolve(putReq.result);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export function getReflectionByDate(date) {
  if (useMemory) return Promise.resolve(memStore.reflections.find(r => r.date === date) || null);
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('reflections', 'readonly');
    const store = tx.objectStore('reflections');
    const index = store.index('date');
    const req = index.get(date);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export function getReflectionsByDateRange(startDate, endDate) {
  if (useMemory) return Promise.resolve(memStore.reflections.filter(r => r.date >= startDate && r.date <= endDate));
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('reflections', 'readonly');
    const store = tx.objectStore('reflections');
    const index = store.index('date');
    const range = IDBKeyRange.bound(startDate, endDate);
    const req = index.getAll(range);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export function clearAllData() {
  if (useMemory) {
    memStore.profile = null; memStore.points = []; memStore.reflections = [];
    memStore.nextPointId = 1; memStore.nextReflectionId = 1;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    dbInstance = null;
    const idb = getIDB();
    if (!idb) { resolve(); return; }
    const req = idb.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}
