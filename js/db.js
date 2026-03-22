// ============================================================
// Löwenherz PWA — Storage Layer
// Supports IndexedDB with in-memory fallback
// ============================================================

const DB_NAME = 'loewenherz-db';
const DB_VERSION = 2;

let dbInstance = null;
let useMemory = false;

// In-memory fallback store
const memStore = {
  profile: null,
  points: [],
  reflections: [],
  nextPointId: 1,
  nextReflectionId: 1
};

// Dynamic access to avoid static detection
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
        // v2: Milestones store
        if (!db.objectStoreNames.contains('milestones')) {
          db.createObjectStore('milestones', { keyPath: 'id' });
        }
      };

      request.onsuccess = (e) => {
        dbInstance = e.target.result;
        resolve(dbInstance);
      };

      request.onerror = (e) => {
        console.warn('IndexedDB open failed, using memory storage');
        useMemory = true;
        resolve(null);
      };

      request.onblocked = () => {
        console.warn('IndexedDB upgrade blocked — another tab has the DB open. Please reload.');
      };
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

// ---- Profile ----
export function getProfile() {
  if (useMemory) {
    return Promise.resolve(memStore.profile);
  }
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
  if (useMemory) {
    memStore.profile = profile;
    return Promise.resolve(profile);
  }
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('userProfile', 'readwrite');
    const store = tx.objectStore('userProfile');
    const req = store.put(profile);
    req.onsuccess = () => resolve(profile);
    req.onerror = () => reject(req.error);
  });
}

// ---- SMALL Points ----
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
  if (useMemory) {
    return Promise.resolve(memStore.points.filter(p => p.date === date));
  }
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
  if (useMemory) {
    return Promise.resolve(memStore.points.filter(p => p.date >= startDate && p.date <= endDate));
  }
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

// ---- Reflections ----
export function saveReflection(reflection) {
  if (useMemory) {
    const existing = memStore.reflections.find(r => r.date === reflection.date);
    if (existing) {
      Object.assign(existing, reflection);
      return Promise.resolve(existing.id);
    } else {
      const r = { ...reflection, id: memStore.nextReflectionId++ };
      memStore.reflections.push(r);
      return Promise.resolve(r.id);
    }
  }
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('reflections', 'readwrite');
    const store = tx.objectStore('reflections');
    const index = store.index('date');
    const getReq = index.get(reflection.date);
    getReq.onsuccess = () => {
      const existing = getReq.result;
      let putData;
      if (existing) {
        putData = { ...existing, ...reflection, id: existing.id };
      } else {
        putData = { ...reflection };
        delete putData.id;
      }
      const putReq = store.put(putData);
      putReq.onsuccess = () => resolve(putReq.result);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export function getReflectionByDate(date) {
  if (useMemory) {
    return Promise.resolve(memStore.reflections.find(r => r.date === date) || null);
  }
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
  if (useMemory) {
    return Promise.resolve(memStore.reflections.filter(r => r.date >= startDate && r.date <= endDate));
  }
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

// ---- Reminders v2: 8 fixed alarm slots ----

const DEFAULT_REMINDERS_V2 = [
  { id: 1, time: '08:00', enabled: true },
  { id: 2, time: '13:00', enabled: true },
  { id: 3, time: '18:00', enabled: true },
  { id: 4, time: '09:00', enabled: false },
  { id: 5, time: '10:00', enabled: false },
  { id: 6, time: '12:00', enabled: false },
  { id: 7, time: '15:00', enabled: false },
  { id: 8, time: '20:00', enabled: false }
];

const DEFAULT_MORNING_RITUAL = { time: '07:00', enabled: true };
const DEFAULT_EVENING_REFLECTION = { time: '21:00', enabled: true };

/**
 * Migrate from v1 data (remindersList array with type/label or old reminders object)
 * to v2 (8 fixed slots). Called once when remindersV2 doesn't exist.
 */
export function migrateRemindersToV2(profile) {
  const v2 = DEFAULT_REMINDERS_V2.map(d => ({ ...d }));

  // Try to pull data from v1 remindersList (Feature-Prompt 5 format)
  const oldList = profile.remindersList;
  if (oldList && Array.isArray(oldList)) {
    // Separate defaults and customs
    const defaults = oldList.filter(r => r.type === 'default');
    const customs = oldList.filter(r => r.type === 'custom');

    // Map old defaults to slots 1-3
    const keyMap = { 'reminder_default_morning': 1, 'reminder_default_midday': 2, 'reminder_default_evening': 3 };
    for (const d of defaults) {
      const slotId = keyMap[d.id];
      if (slotId) {
        const slot = v2.find(s => s.id === slotId);
        if (slot) {
          slot.time = d.time || slot.time;
          slot.enabled = d.enabled !== undefined ? d.enabled : slot.enabled;
        }
      }
    }

    // Map customs (up to 5) to slots 4-8, sorted by time (earliest first)
    const sortedCustoms = [...customs].sort((a, b) => (a.time || '').localeCompare(b.time || '')).slice(0, 5);
    for (let i = 0; i < sortedCustoms.length; i++) {
      const slot = v2.find(s => s.id === i + 4);
      if (slot) {
        slot.time = sortedCustoms[i].time || slot.time;
        slot.enabled = sortedCustoms[i].enabled !== undefined ? sortedCustoms[i].enabled : slot.enabled;
      }
    }
  } else if (profile.reminders && typeof profile.reminders === 'object') {
    // Even older format: profile.reminders = { morning: {...}, midday: {...}, evening: {...} }
    const old = profile.reminders;
    if (old.morning) { v2[0].time = old.morning.time || v2[0].time; v2[0].enabled = old.morning.enabled !== undefined ? old.morning.enabled : v2[0].enabled; }
    if (old.midday) { v2[1].time = old.midday.time || v2[1].time; v2[1].enabled = old.midday.enabled !== undefined ? old.midday.enabled : v2[1].enabled; }
    if (old.evening) { v2[2].time = old.evening.time || v2[2].time; v2[2].enabled = old.evening.enabled !== undefined ? old.evening.enabled : v2[2].enabled; }
  }

  return v2;
}

/**
 * Full migration: sets remindersV2, morningRitual, eveningReflection and cleans old keys.
 */
export async function migrateToV2(profile) {
  if (profile.remindersV2) return profile; // already migrated

  profile.remindersV2 = migrateRemindersToV2(profile);

  // morningRitual: new, no old data to migrate
  if (!profile.morningRitual) {
    profile.morningRitual = { ...DEFAULT_MORNING_RITUAL };
  }

  // eveningReflection: migrate from old reflectionTime/reflectionEnabled
  if (!profile.eveningReflection) {
    profile.eveningReflection = {
      time: profile.reflectionTime || DEFAULT_EVENING_REFLECTION.time,
      enabled: profile.reflectionEnabled !== undefined ? profile.reflectionEnabled : DEFAULT_EVENING_REFLECTION.enabled
    };
  }

  // Clean up old keys
  delete profile.remindersList;
  delete profile.reminders;
  delete profile.reflectionTime;
  delete profile.reflectionEnabled;

  await saveProfile(profile);
  return profile;
}

export async function getRemindersV2() {
  const profile = await getProfile();
  if (!profile || !profile.remindersV2) return DEFAULT_REMINDERS_V2.map(d => ({ ...d }));
  return profile.remindersV2;
}

export async function saveRemindersV2(reminders) {
  const profile = await getProfile();
  if (!profile) return;
  profile.remindersV2 = reminders;
  await saveProfile(profile);
}

export async function getMorningRitual() {
  const profile = await getProfile();
  if (!profile || !profile.morningRitual) return { ...DEFAULT_MORNING_RITUAL };
  return profile.morningRitual;
}

export async function saveMorningRitual(data) {
  const profile = await getProfile();
  if (!profile) return;
  profile.morningRitual = data;
  await saveProfile(profile);
}

export async function getEveningReflection() {
  const profile = await getProfile();
  if (!profile || !profile.eveningReflection) return { ...DEFAULT_EVENING_REFLECTION };
  return profile.eveningReflection;
}

export async function saveEveningReflection(data) {
  const profile = await getProfile();
  if (!profile) return;
  profile.eveningReflection = data;
  await saveProfile(profile);
}

// ---- All Points (for milestone engine) ----
export function getAllPoints() {
  if (useMemory) {
    return Promise.resolve([...memStore.points]);
  }
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('smallPoints', 'readonly');
    const store = tx.objectStore('smallPoints');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export function getAllReflections() {
  if (useMemory) {
    return Promise.resolve([...memStore.reflections]);
  }
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('reflections', 'readonly');
    const store = tx.objectStore('reflections');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// ---- Milestones ----
export function getMilestone(id) {
  if (useMemory) {
    return Promise.resolve(memStore.milestones ? memStore.milestones.find(m => m.id === id) || null : null);
  }
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('milestones', 'readonly');
    const store = tx.objectStore('milestones');
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export function saveMilestone(milestone) {
  if (useMemory) {
    if (!memStore.milestones) memStore.milestones = [];
    const idx = memStore.milestones.findIndex(m => m.id === milestone.id);
    if (idx >= 0) memStore.milestones[idx] = milestone;
    else memStore.milestones.push(milestone);
    return Promise.resolve(milestone);
  }
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('milestones', 'readwrite');
    const store = tx.objectStore('milestones');
    const req = store.put(milestone);
    req.onsuccess = () => resolve(milestone);
    req.onerror = () => reject(req.error);
  });
}

export function getAllMilestonesDB() {
  if (useMemory) {
    return Promise.resolve(memStore.milestones ? [...memStore.milestones] : []);
  }
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('milestones', 'readonly');
    const store = tx.objectStore('milestones');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// ---- Clear All ----
export function clearAllData() {
  if (useMemory) {
    memStore.profile = null;
    memStore.points = [];
    memStore.reflections = [];
    memStore.nextPointId = 1;
    memStore.nextReflectionId = 1;
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
