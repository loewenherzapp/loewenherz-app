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
import { migrateLegacySlots } from './small-schedule.js';
import { isNative } from './platform.js';
import { nativePlugin } from './native-plugins.js';

const SCHEMA_VERSION = 1;
const APP_VERSION = '1.0.2';

// LocalStorage-Keys, die zum Backup gehören.
// Exact matches:
const LS_EXACT_KEYS = [
  'loewenherz_push_enabled',
  'loewenherz_push_asked',
  'loewenherz_push_snooze_until',
  'loewenherz_morning_time',
  'loewenherz_evening_time',
  // Nur in der nativen App gesetzt (Settings-Toggle Haptik). Im Web existiert
  // der Key nie → Web-Exporte bleiben byte-identisch zu vorher.
  'loewenherz_haptics_enabled',
  'smallPointsTotal',
  'hasSeenInfo',
  'hasSeenSettingsHint',
  'infoSheetOpened',
  'infoHintShows'
];
// SMALL-Reminder: Zeitfenster und Anzahl.
//
// Der gewürfelte Tagesplan (loewenherz_small_roll*) gehört BEWUSST nicht
// dazu: Ein Backup vom März würde sonst die Märzzeiten wiederherstellen und
// die App hielte sie für den heutigen Wurf.
//
// Die Legacy-Keys bleiben in der Liste, damit alte Backups noch einlesbar
// sind — migrateLegacySlots() rechnet sie danach ins Fenster-Modell um.
const LS_SMALL_KEYS = (() => {
  const out = [
    'loewenherz_small_window_start',
    'loewenherz_small_window_end',
    'loewenherz_small_count'
  ];
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
 * Exportiert das Backup. Web: Browser-Download. Nativ: System-Share-Sheet.
 * @returns {Promise<boolean>} false NUR, wenn der User das Share-Sheet
 *          abgebrochen hat (kein Erfolgs-Toast zeigen); sonst true.
 *          Der Web-Pfad liefert immer true — Verhalten unverändert.
 */
export async function downloadBackup() {
  const data = await exportAllData();
  const json = JSON.stringify(data, null, 2);
  const today = new Date().toISOString().slice(0, 10);
  const filename = `loewenherz-backup-${today}.json`;

  // Nativ: WebKit unterstützt blob:-URLs im download-Attribut nicht
  // (bekannter WebKit-Bug) — der <a download>-Klick unten täte still
  // nichts. Stattdessen Temp-Datei im Cache + natives Share-Sheet
  // („In Dateien sichern", AirDrop, Mail). Gleicher Dateiname, gleiches
  // JSON — der Import liest beide Quellen identisch.
  if (isNative()) {
    return shareBackupNative(filename, json);
  }

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Erst nach kurzem Delay revoken — Safari braucht den URL noch
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

// Share-Sheet-Export (iOS). Abbruch ist KEIN Fehler: Schließt der User das
// Sheet, gibt das Plugin „Share canceled" zurück — dann false liefern statt
// werfen, sonst zeigt settings.js einen Fehler-Alert für eine bewusste
// Nutzerentscheidung. Echte Fehler fliegen weiter.
async function shareBackupNative(filename, json) {
  const [fs, share] = await Promise.all([nativePlugin('Filesystem'), nativePlugin('Share')]);
  if (!fs || !share) throw new Error('Native Export-Plugins nicht verfügbar.');

  await fs.writeFile({ path: filename, data: json, directory: 'CACHE', encoding: 'utf8' });
  try {
    const { uri } = await fs.getUri({ path: filename, directory: 'CACHE' });
    await share.share({ files: [uri] });
    return true;
  } catch (e) {
    if (/cancel/i.test(String((e && e.message) || e))) return false;
    throw e;
  } finally {
    // Best effort — eine liegengebliebene Cache-Datei räumt iOS selbst.
    fs.deleteFile({ path: filename, directory: 'CACHE' }).catch(() => {});
  }
}

/**
 * Validiert ein Backup-Objekt. Wirft mit klarer Fehlermeldung
 * wenn die Daten kaputt sind.
 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LETTERS = ['S', 'M', 'A', 'L1', 'L2'];
const istText = (v, max) => typeof v === 'string' && v.length <= max;
const optionalText = (v, max) => v === undefined || v === null || istText(v, max);

/**
 * Prüft jeden Datensatz, BEVOR irgendetwas gelöscht wird. Ein inhaltlich
 * kaputtes Backup (Punkt ohne Datum, Morgen-Eintrag ohne JSON) ließ vorher
 * Meilenstein-Checks und den Heute-Tab beim Rendern scheitern – nach dem
 * Löschen der alten Daten.
 */
function validateBackup(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Backup-Datei ist leer oder beschädigt.');
  }
  if (data.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Schema-Version ${data.schemaVersion} wird nicht unterstützt (erwartet: ${SCHEMA_VERSION}).`);
  }
  if (data.profile !== null) {
    if (typeof data.profile !== 'object' || !istText(data.profile.name, 30) || !data.profile.name.trim()) {
      throw new Error('Profil-Daten sind ungültig.');
    }
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
  data.points.forEach((pt, i) => {
    if (!pt || typeof pt !== 'object' || !DATE_RE.test(String(pt.date)) || !LETTERS.includes(pt.letter)
        || !optionalText(pt.time, 5) || !optionalText(pt.category, 60) || !optionalText(pt.categoryLabel, 60)) {
      throw new Error(`SMALL-Punkt ${i + 1} im Backup ist beschädigt.`);
    }
  });
  data.reflections.forEach((r, i) => {
    if (!r || typeof r !== 'object' || !DATE_RE.test(String(r.date)) || !/^[a-z]{1,20}$/.test(String(r.mood))
        || !(r.helped === undefined || (Array.isArray(r.helped) && r.helped.every((h) => istText(h, 20))))
        || !optionalText(r.gratitude, 500) || !optionalText(r.quatschiComment, 300)) {
      throw new Error(`Reflexion ${i + 1} im Backup ist beschädigt.`);
    }
  });
  data.milestones.forEach((m, i) => {
    if (!m || typeof m !== 'object' || !/^[A-Z]\d{1,2}$/.test(String(m.id)) || !optionalText(m.date, 40)) {
      throw new Error(`Meilenstein ${i + 1} im Backup ist beschädigt.`);
    }
  });
  if (data.localStorage !== undefined && data.localStorage !== null) {
    if (typeof data.localStorage !== 'object') throw new Error('Einstellungen im Backup sind ungültig.');
    for (const [k, v] of Object.entries(data.localStorage)) {
      if (typeof v !== 'string' || v.length > 2000) throw new Error(`Einstellung „${k}“ im Backup ist beschädigt.`);
      if (k.startsWith('morningReflection_')) {
        let parsed = null;
        try { parsed = JSON.parse(v); } catch (e) { parsed = null; }
        if (!parsed || typeof parsed !== 'object') throw new Error(`Einstellung „${k}“ im Backup ist beschädigt.`);
      }
    }
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

  // Ein Backup von vor der Umstellung bringt die alten Einzelslots zurück.
  // Ohne diesen Aufruf stünde der Nutzer bis zum nächsten Öffnen der
  // Einstellungen in einem Zustand, den der Push-Pfad nicht mehr liest.
  migrateLegacySlots();

  return {
    pointsRestored: data.points.length,
    reflectionsRestored: data.reflections.length,
    milestonesRestored: data.milestones.length
  };
}
