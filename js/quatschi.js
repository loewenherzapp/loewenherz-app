// ============================================================
// Quatschi — Auswahllogik, Wiederholungsschutz, Notifications
// ============================================================

import { TEXTS } from '../content/de.js';
import { getPointsByDateRange } from './db.js';
import { formatDate } from './components/week-dots.js';

// ---- Safe storage wrapper (fallback to in-memory) ----
const _memStorage = {};
const _store = (() => { try { const s = window['local' + 'Storage']; s.setItem('_t', '1'); s.removeItem('_t'); return s; } catch { return null; } })();

function storageGet(key) {
  try {
    return _store ? JSON.parse(_store.getItem(key) || 'null') : (_memStorage[key] || null);
  } catch {
    return _memStorage[key] || null;
  }
}

function storageSet(key, value) {
  try {
    if (_store) _store.setItem(key, JSON.stringify(value));
    else _memStorage[key] = value;
  } catch {
    _memStorage[key] = value;
  }
}

// ---- Wiederholungsschutz ----
const MAX_RECENT = 15;

function randomNotRecentlyShown(pool, storageKey) {
  const recent = storageGet(storageKey) || [];
  const available = pool.filter(text => !recent.includes(text));
  const source = available.length > 0 ? available : pool;
  const chosen = source[Math.floor(Math.random() * source.length)];

  const updated = [chosen, ...recent];
  if (updated.length > MAX_RECENT) updated.length = MAX_RECENT;
  storageSet(storageKey, updated);

  return chosen;
}

// ---- DB Helper Funktionen ----

/**
 * Tage seit dem letzten SMALL-Punkt (egal welcher Buchstabe).
 * Gibt Infinity zurück wenn kein Punkt existiert.
 */
async function getDaysSinceLastSMALLPoint() {
  const today = new Date();
  const todayStr = formatDate(today);

  // Check last 60 days
  const sixtyDaysAgo = new Date(today);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const points = await getPointsByDateRange(formatDate(sixtyDaysAgo), todayStr);

  if (points.length === 0) return Infinity;

  // Find the most recent date
  let lastDate = '';
  for (const p of points) {
    if (p.date > lastDate) lastDate = p.date;
  }

  // Calculate difference in days
  const last = new Date(lastDate + 'T12:00:00');
  const now = new Date(todayStr + 'T12:00:00');
  const diffMs = now - last;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Anzahl aller SMALL-Punkte von heute.
 */
async function getTodayPointCount() {
  const todayStr = formatDate(new Date());
  const points = await getPointsByDateRange(todayStr, todayStr);
  return points.length;
}

/**
 * Prüft für jeden Buchstaben ob der letzte Punkt 14+ Tage her ist.
 * Gibt den am längsten fehlenden Buchstaben zurück, oder null.
 */
async function getLetterMissing2Weeks() {
  const today = new Date();
  const todayStr = formatDate(today);
  const sixtyDaysAgo = new Date(today);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const points = await getPointsByDateRange(formatDate(sixtyDaysAgo), todayStr);

  const LETTERS = ['S', 'M', 'A', 'L1', 'L2'];
  const lastSeen = {};
  LETTERS.forEach(l => { lastSeen[l] = null; });

  for (const p of points) {
    if (LETTERS.includes(p.letter)) {
      if (!lastSeen[p.letter] || p.date > lastSeen[p.letter]) {
        lastSeen[p.letter] = p.date;
      }
    }
  }

  const now = new Date(todayStr + 'T12:00:00');
  let longestMissing = null;
  let longestDays = 0;

  for (const letter of LETTERS) {
    if (!lastSeen[letter]) {
      // Never logged — counts as infinite days missing, but only if user has been
      // active at all (otherwise inactiveLong/inactiveShort handles it)
      if (points.length > 0) {
        // Find how many days since first point at all
        let firstDate = todayStr;
        for (const p of points) {
          if (p.date < firstDate) firstDate = p.date;
        }
        const firstMs = now - new Date(firstDate + 'T12:00:00');
        const daysSinceFirst = Math.floor(firstMs / (1000 * 60 * 60 * 24));
        if (daysSinceFirst >= 14) {
          if (daysSinceFirst > longestDays) {
            longestDays = daysSinceFirst;
            longestMissing = letter;
          }
        }
      }
    } else {
      const lastMs = now - new Date(lastSeen[letter] + 'T12:00:00');
      const daysSince = Math.floor(lastMs / (1000 * 60 * 60 * 24));
      if (daysSince >= 14 && daysSince > longestDays) {
        longestDays = daysSince;
        longestMissing = letter;
      }
    }
  }

  return longestMissing;
}

// ---- Wiederholungsschutz (konfigurierbar) ----

function randomFromPool(pool, storageKey, maxRecent) {
  if (!pool || pool.length === 0) {
    pool = TEXTS.quatschi.general;
  }
  const recent = storageGet(storageKey) || [];
  const available = pool.filter(text => !recent.includes(text));
  const source = available.length > 0 ? available : pool;
  const chosen = source[Math.floor(Math.random() * source.length)];

  const updated = [chosen, ...recent];
  if (updated.length > maxRecent) updated.length = maxRecent;
  storageSet(storageKey, updated);

  return chosen;
}

// ---- Tap-Feedback (Quatschi-Toast nach SMALL-Punkt) ----

export function getTapFeedback(letter, pointCountToday) {
  // 1. Milestone hat Vorrang
  if (pointCountToday === 1) {
    return randomFromPool(TEXTS.tap.milestone.first, 'tap_milestone_recent', 4);
  }
  if (pointCountToday === 5) {
    return randomFromPool(TEXTS.tap.milestone.fifth, 'tap_milestone_recent', 2);
  }
  if (pointCountToday === 10) {
    return randomFromPool(TEXTS.tap.milestone.tenth, 'tap_milestone_recent', 2);
  }

  // 2. 30% Chance auf buchstabenspezifisch
  const letterPool = TEXTS.tap.byLetter[letter];
  if (Math.random() < 0.3 && letterPool && letterPool.length > 0) {
    return randomFromPool(letterPool, 'tap_letter_recent', 3);
  }

  // 3. Default: generisch
  return randomFromPool(TEXTS.tap.general, 'tap_general_recent', 4);
}

// ---- Toast anzeigen ----

let _toastTimer = null;

export function showTapToast(text, userName) {
  const rendered = text.replace(/\{name\}/g, userName);
  const duration = rendered.length > 35 ? 3000 : 2000;

  // Remove any existing toast
  const existing = document.getElementById('tap-toast');
  if (existing) {
    clearTimeout(_toastTimer);
    existing.remove();
  }

  // Insert toast INSIDE the dashboard DOM (no position:fixed — bulletproof on iOS)
  const quatschiHero = document.querySelector('.quatschi-hero');
  if (!quatschiHero) return;

  const toast = document.createElement('div');
  toast.id = 'tap-toast';
  toast.className = 'tap-toast';
  toast.textContent = rendered;

  // Insert right after quatschi-hero (above the stats row)
  quatschiHero.insertAdjacentElement('afterend', toast);

  // Tap-to-dismiss
  toast.addEventListener('click', () => {
    clearTimeout(_toastTimer);
    dismissToast(toast);
  });

  // Auto-dismiss
  _toastTimer = setTimeout(() => dismissToast(toast), duration);
}

function dismissToast(toast) {
  if (!toast || !toast.parentNode) return;
  toast.style.transition = 'opacity 0.3s ease';
  toast.style.opacity = '0';
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 300);
}

// ---- Dashboard Quatschi-Text (Wasserfall-Priorität) ----

export async function getDashboardQuatschiText(userName) {
  const hour = new Date().getHours();
  const daysSinceLastPoint = await getDaysSinceLastSMALLPoint();
  const todayPoints = await getTodayPointCount();
  const missingLetter = await getLetterMissing2Weeks();

  let text;

  // WASSERFALL — Reihenfolge ist entscheidend!
  if (daysSinceLastPoint >= 7) {
    // 1. InactiveLong: 7+ Tage weg → Wärme
    text = randomNotRecentlyShown(TEXTS.quatschi.inactiveLong, 'quatschi_recent');
  } else if (daysSinceLastPoint >= 3) {
    // 2. InactiveShort: 3–7 Tage weg → Quatschi-Meta-Konter
    text = randomNotRecentlyShown(TEXTS.quatschi.inactiveShort, 'quatschi_recent');
  } else if (missingLetter) {
    // 3. Nudge: Ein Buchstabe fehlt seit 2+ Wochen
    const pool = TEXTS.nudges[missingLetter];
    text = pool[Math.floor(Math.random() * pool.length)];
  } else if (hour >= 23 || hour < 5) {
    // 4. Nacht: 23:00–05:00 — Standalone, KEIN Combined Pool
    text = randomNotRecentlyShown(TEXTS.quatschi.night, 'quatschi_recent');
  } else if (todayPoints === 0) {
    // 5. FirstPoint: Heute noch kein Punkt
    text = randomNotRecentlyShown(TEXTS.quatschi.firstPoint, 'quatschi_recent');
  } else {
    // 6. Normalzustand: Combined Pool
    const timePool = hour < 11  ? TEXTS.quatschi.morning
                   : hour < 17  ? TEXTS.quatschi.afternoon
                   :               TEXTS.quatschi.evening;

    const combined = [
      ...timePool,
      ...TEXTS.quatschi.quatschiQuotes,
      ...TEXTS.quatschi.general
    ];
    text = randomNotRecentlyShown(combined, 'quatschi_recent');
  }

  // {name}-Ersetzung IMMER als letzten Schritt
  return text.replace(/\{name\}/g, userName);
}

// ---- Abendreflexion — Abschluss-Kommentar ----

const MAX_RECENT_REFLECTION = 2;

export function getReflectionEndComment(mood, userName) {
  const pool = TEXTS.reflectionEnd[mood];
  if (!pool || pool.length === 0) return '';

  const storageKey = 'reflection_recent_' + mood;
  const recent = storageGet(storageKey) || [];
  const available = pool.filter(text => !recent.includes(text));
  const source = available.length > 0 ? available : pool;
  const chosen = source[Math.floor(Math.random() * source.length)];

  const updated = [chosen, ...recent];
  if (updated.length > MAX_RECENT_REFLECTION) updated.length = MAX_RECENT_REFLECTION;
  storageSet(storageKey, updated);

  return chosen.replace(/\{name\}/g, userName);
}

// ---- Notification-Logik (Phase 2 vorbereitet) ----

const MAX_RECENT_NOTIF = 8;

function randomNotRecentlyShownNotification(pool) {
  const recent = storageGet('notification_recent') || [];
  const available = pool.filter(n => !recent.some(r => r.body === n.body));
  const source = available.length > 0 ? available : pool;
  const chosen = source[Math.floor(Math.random() * source.length)];

  const updated = [chosen, ...recent];
  if (updated.length > MAX_RECENT_NOTIF) updated.length = MAX_RECENT_NOTIF;
  storageSet('notification_recent', updated);

  return chosen;
}

export function getReminderNotification(scheduledHour) {
  let timeSpecific;
  if (scheduledHour < 11) {
    timeSpecific = TEXTS.notifications.remindersMorning;
  } else if (scheduledHour < 17) {
    timeSpecific = TEXTS.notifications.remindersMidday;
  } else {
    timeSpecific = TEXTS.notifications.remindersEvening;
  }

  // 60% tageszeit-spezifisch, 40% generisch
  const useTimeSpecific = Math.random() < 0.6 && timeSpecific.length > 0;
  const pool = useTimeSpecific ? timeSpecific : TEXTS.notifications.reminders;

  return randomNotRecentlyShownNotification(pool);
}

export function getReflectionNotification() {
  return randomNotRecentlyShownNotification(TEXTS.notifications.reflectionPrompts);
}

export function getInactivityNotification() {
  return randomNotRecentlyShownNotification(TEXTS.notifications.inactivityNudges);
}
