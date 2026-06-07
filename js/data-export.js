// ============================================================
// Löwenherz PWA — Backup: Export & Import
// ============================================================
// Schreibt/liest ein JSON-Snapshot aller lokalen Daten.
// Schema-Version 1: Bricht der App-Daten-Aufbau, muss Schema-Version
// hochgezählt + Migrationspfad implementiert werden.
// ============================================================

import {
  getProfile,
  saveProfile,
  getAllPoints,
  addSmallPoint,
  getAllReflections,
  saveReflection,
  getAllMilestonesDB,
  saveMilestone,
  clearAllData,
  initDB
} from './db.js';

const SCHEMA_VERSION = 1;
const APP_VERSION = '1.0';

// LocalStorage-Keys, die zum Backup gehören.
// Exact matches:
const LS_EXACT_KEYS = [
  'loewenherz_push_enabled',
  'loewenherz_push_asked',
  'loewenherz_morning_time',
  'loewenherz_evening_time',
  'smallPointsTotal',
  'hasSeenInfo'
];
// Slot keys (1..5):
const LS_SMALL_KEYS = (() => {
  const out = [];
  for (let i = 1; i <= 5; i++) {
    out.push(`loewenherz_small_${i}_time`);
    out.push(`loewenherz_small_${i}_enabled`);
  }
  return out;
})();
// Prefix matches: morningReflection_YYYY-MM-DD, morningDone_YYYY-MM-DD
const LS_PREFIXES = ['morningReflection_', 'morningDone_'];

function collectLocalStorage() {
  const out = {};
  const allKeys = [...LS_EXACT_KEYS, ...LS_SMALL_KEYS];
  for (const k of allKeys) {
    const v = localStorage.getItem(k);
    if (v !== null) out[k] = v;
  }
  // Prefix-Scan
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (LS_PREFIXES.some(p => k.startsWith(p))) {
      out[k] = localStorage.getItem(k);
    }
  }
  return out;
}

function restoreLocalStorage(ls) {
  if (!ls || typeof ls !== 'object') return;
  // Erst alle löschen, die wir kennen — sonst bleiben fremde Reste
  const allKnown = [...LS_EXACT_KEYS, ...LS_SMALL_KEYS];
  for (const k of allKnown) localStorage.removeItem(k);
  // Prefixed keys löschen
  const toRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && LS_PREFIXES.some(p => k.startsWith(p))) toRemove.push(k);
  }
  for (const k of toRemove) localStorage.removeItem(k);

  // Jetzt aus Backup wiederherstellen
  for (const [k, v] of Object.entries(ls)) {
    if (typeof v !== 'string') continue;
    // Whitelist-Check: nur bekannte Keys oder Prefix-Matches
    if (allKnown.includes(k) || LS_PREFIXES.some(p => k.startsWith(p))) {
      localStorage.setItem(k, v);
    }
  }
}

/**
 * Sammelt alle Daten und liefert ein Backup-Objekt.
 */
export async function exportAllData() {
  await initDB();
  const [profile, points, reflections, milestones] = await Promise.all([
    getProfile(),
    getAllPoints(),
    getAllReflections(),
    getAllMilestonesDB()
  ]);

  return {
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    profile: profile || null,
    points: points || [],
    reflections: reflections || [],
    milestones: milestones || [],
    localStorage: collectLocalStorage()
  };
}

/**
 * Triggert den Browser-Download des Backups.
 */
export async function downloadBackup() {
  const data = await exportAllData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const today = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `loewenherz-backup-${today}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Erst nach kurzem Delay revoken — Safari braucht den URL noch
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Validiert ein Backup-Objekt. Wirft mit klarer Fehlermeldung
 * wenn die Daten kaputt sind.
 */
function validateBackup(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Backup-Datei ist leer oder beschädigt.');
  }
  if (data.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Schema-Version ${data.schemaVersion} wird nicht unterstützt (erwartet: ${SCHEMA_VERSION}).`);
  }
  if (data.profile !== null && (typeof data.profile !== 'object' || !data.profile.name)) {
    throw new Error('Profil-Daten sind ungültig.');
  }
  if (!Array.isArray(data.points)) {
    throw new Error('SMALL-Punkte fehlen oder sind ungültig.');
  }
  if (!Array.isArray(data.reflections)) {
    throw new Error('Reflexionen fehlen oder sind ungültig.');
  }
  if (!Array.isArray(data.milestones)) {
    throw new Error('Meilensteine fehlen oder sind ungültig.');
  }
}

/**
 * Ersetzt ALLE vorhandenen Daten durch die aus dem Backup.
 * Bestätigung muss vorher durch die UI eingeholt werden.
 */
export async function importBackup(jsonText) {
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch (e) {
    throw new Error('Datei ist kein gültiges JSON.');
  }
  validateBackup(data);

  // Erst alles löschen — clearAllData löscht die IDB
  await clearAllData();
  // DB neu initialisieren (clearAllData hat dbInstance auf null gesetzt)
  await initDB();

  // Profile wiederherstellen
  if (data.profile) {
    const p = { ...data.profile };
    delete p.id; // wird neu vergeben
    await saveProfile(p);
  }

  // Points: ohne id wiederherstellen (auto-increment vergibt neue)
  for (const point of data.points) {
    const p = { ...point };
    delete p.id;
    await addSmallPoint(p);
  }

  // Reflections: saveReflection findet bestehende via date-Index
  for (const r of data.reflections) {
    const item = { ...r };
    delete item.id;
    await saveReflection(item);
  }

  // Milestones: id ist fest (z.B. 'P1') → direkt put
  for (const m of data.milestones) {
    await saveMilestone(m);
  }

  // LocalStorage wiederherstellen (inkl. Push-Settings)
  restoreLocalStorage(data.localStorage);

  return {
    pointsRestored: data.points.length,
    reflectionsRestored: data.reflections.length,
    milestonesRestored: data.milestones.length
  };
}
