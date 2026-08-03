// ============================================================
// SMALL-Reminder — Zeitplan würfeln
// ============================================================
//
// Der Nutzer legt nur noch ein Zeitfenster und eine Anzahl fest; die
// konkreten Uhrzeiten würfelt die App täglich neu. Verhaltenstherapeutisch
// gewollt: An eine feste Uhrzeit gewöhnt man sich, und ein Reminder, den
// man erwartet, verliert genau die Wirkung, wegen der er da ist.
//
// Morgenkompass und Abendreflexion bleiben bewusst fest — das sind
// Rituale, die Verlässlichkeit brauchen, keine Überraschung.
//
// ARCHITEKTUR — die eine Regel, an der alles hängt:
//
//   Gewürfelt wird NUR in rollIfNeeded(). buildTags() liest ausschließlich
//   das gespeicherte Ergebnis.
//
// Der Grund: syncOneSignalTags() wird an sieben Stellen gerufen — bei
// jeder Zeitänderung, beim Master-Toggle, nach dem Permission-Prompt, beim
// SDK-Init und beim Zeitzonen-Resync über visibilitychange. Würfelte
// buildTags() selbst, bekäme der Nutzer nach jedem App-Wechsel einen
// frischen Satz Uhrzeiten und über den Tag ein Vielfaches der
// eingestellten Anzahl. Der Zeitzonen-Resync soll denselben Wurf neu nach
// UTC umrechnen — nicht ihn zerstören.
//
// Deshalb liegt der Wurf in LOKALZEIT im Speicher; die Umrechnung nach UTC
// passiert erst in buildTags(), wie bei den festen Zeiten auch.
// ============================================================

const KEY_START = 'loewenherz_small_window_start';
const KEY_END   = 'loewenherz_small_window_end';
const KEY_COUNT = 'loewenherz_small_count';
const KEY_ROLL  = 'loewenherz_small_roll';
const KEY_DATE  = 'loewenherz_small_roll_date';
const KEY_SIG   = 'loewenherz_small_roll_sig';

export const DEFAULT_START = '06:00';
export const DEFAULT_END   = '23:00';
export const DEFAULT_COUNT = 5;

// Obergrenze der Auswahl. Mehr als zehn Impulse am Tag kippen von
// „Erinnerung" zu „Nervensäge" — und die Reaktion darauf ist nicht
// Wegwischen, sondern Deinstallieren.
export const MAX_COUNT = 10;

// Zahl der small_N_utc-Tags. Muss zu api/send-notifications.js und
// api/set-tags.js passen — dort wird bis MAX_SLOTS gefiltert bzw.
// durchgelassen.
export const MAX_SLOTS = 10;

const GRID = 15;      // Server-Slotraster, siehe api/send-notifications.js
const MIN_GAP = 30;   // Mindestabstand zweier Impulse in Minuten

// --- Zeit-Helfer (Minuten seit Mitternacht) ---

export function toMin(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function toHHMM(min) {
  const h = Math.floor(min / 60) % 24;
  return `${String(h).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

const gridUp   = (x) => Math.ceil(x / GRID) * GRID;
const gridDown = (x) => Math.floor(x / GRID) * GRID;

/**
 * Wie viele Impulse passen mit Mindestabstand in ein Fenster?
 * Bei 06:00–23:00 sind das 35 — die 10 aus MAX_COUNT sind dort nie das
 * Limit. Eng wird es erst bei kleinen Fenstern: In 12:00–14:00 passen
 * genau 5.
 */
export function maxCountFor(startMin, endMin) {
  if (endMin <= startMin) return 1;
  return Math.max(1, Math.floor((endMin - startMin) / MIN_GAP) + 1);
}

/**
 * Zieht `count` Uhrzeiten im Fenster [startMin, endMin].
 *
 * Geschichtet statt gleichverteilt: Das Fenster wird in `count` Blöcke
 * geteilt und pro Block einer gezogen. Reine Gleichverteilung würde
 * gelegentlich alle Impulse in den Vormittag legen — zufällig, aber für
 * den Nutzer schlicht kaputt.
 *
 * Zusätzlich hält jeder Slot MIN_GAP Abstand zum vorherigen und lässt
 * genug Platz für die noch fehlenden. Passt nicht alles hinein, kommen
 * eben weniger zurück — nie ein Fehler, denn ein geworfener Fehler würde
 * hier den Tag ohne jeden Reminder lassen.
 *
 * @param {number[]} exclude  Minuten, die freibleiben müssen (Morgen-/
 *                            Abendzeit) — sonst zwei Push in derselben Minute.
 * @param {function} rnd      Zufallsquelle, injizierbar für Tests.
 * @returns {string[]} aufsteigend sortierte "HH:MM"
 */
export function drawTimes(startMin, endMin, count, exclude = [], rnd = Math.random) {
  const out = [];
  if (count < 1 || endMin < startMin) return out;

  const span = endMin - startMin;
  let prev = -Infinity;

  for (let i = 0; i < count; i++) {
    const blockStart = startMin + Math.floor((span * i) / count);
    const blockEnd   = startMin + Math.floor((span * (i + 1)) / count);

    let lo = Math.max(gridUp(blockStart), prev + MIN_GAP, startMin);
    // Platz für die noch fehlenden Slots reservieren, sonst bleibt am Ende
    // keiner mehr übrig und wir liefern weniger als versprochen.
    let hi = Math.min(gridDown(i === count - 1 ? endMin : blockEnd), endMin - (count - 1 - i) * MIN_GAP);
    hi = gridDown(hi);

    if (lo > hi) {
      // Fenster zu eng für diesen Block — so früh wie erlaubt weitermachen.
      lo = Math.max(gridUp(prev + MIN_GAP), startMin);
      if (lo > endMin) break;
      hi = lo;
    }

    let candidates = [];
    for (let t = lo; t <= hi; t += GRID) candidates.push(t);
    // Kollision mit Morgen-/Abendreminder vermeiden — aber nur, solange
    // überhaupt eine Alternative bleibt.
    const free = candidates.filter(t => !exclude.includes(t));
    if (free.length) candidates = free;
    if (!candidates.length) break;

    const pick = candidates[Math.floor(rnd() * candidates.length)];
    out.push(pick);
    prev = pick;
  }

  return out.map(toHHMM);
}

// --- Einstellungen ---

export function getWindow() {
  return {
    start: localStorage.getItem(KEY_START) || DEFAULT_START,
    end:   localStorage.getItem(KEY_END)   || DEFAULT_END
  };
}

export function getCount() {
  const raw = parseInt(localStorage.getItem(KEY_COUNT), 10);
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_COUNT;
  const { start, end } = getWindow();
  const cap = Math.min(MAX_COUNT, maxCountFor(toMin(start), toMin(end)));
  return Math.min(raw, cap);
}

/**
 * Fenster und Anzahl schreiben. Klemmt selbst, damit kein Aufrufer eine
 * Kombination durchreichen kann, für die drawTimes() zu wenig liefert.
 * Ende immer mindestens eine Stunde nach Start — ein Fenster über
 * Mitternacht bräuchte in jeder Rechnung unten einen Sonderfall und
 * niemand braucht es.
 */
export function setSchedule({ start, end, count }) {
  const s = toMin(start) ?? toMin(DEFAULT_START);
  let e = toMin(end) ?? toMin(DEFAULT_END);
  if (e < s + 60) e = Math.min(s + 60, 23 * 60 + 45);

  localStorage.setItem(KEY_START, toHHMM(s));
  localStorage.setItem(KEY_END, toHHMM(e));
  const cap = Math.min(MAX_COUNT, maxCountFor(s, e));
  localStorage.setItem(KEY_COUNT, String(Math.max(1, Math.min(count, cap))));
}

// --- Migration vom alten Modell (5 feste Einzelslots) ---

const LEGACY_SLOTS = 5;

/**
 * Überführt `small_1..5_time/_enabled` ins Fenster-Modell und räumt die
 * alten Keys weg. Läuft beim Öffnen der Einstellungen und nach jedem
 * Backup-Import — ein Backup von vor der Umstellung bringt die alten Keys
 * sonst zurück und der Nutzer landet in einem Zustand, den es nicht mehr
 * gibt.
 *
 * Abgeleitet wird aus den AKTIVEN Slots: das Fenster aus der frühesten und
 * spätesten Zeit (auf volle Stunden gerundet, damit es nicht krumm
 * aussieht), die Anzahl aus ihrer Menge. Wer drei Slots auf 09:30, 12:30
 * und 15:30 hatte, bekommt 09:00–16:00 mit drei Impulsen — nah an dem, was
 * er kannte, aber ab jetzt gewürfelt.
 *
 * @returns {boolean} true, wenn migriert wurde.
 */
export function migrateLegacySlots() {
  let gefunden = false;
  const aktive = [];

  for (let i = 1; i <= LEGACY_SLOTS; i++) {
    const raw = localStorage.getItem(`loewenherz_small_${i}_time`);
    if (raw === null) continue;
    gefunden = true;
    const enabled = localStorage.getItem(`loewenherz_small_${i}_enabled`) !== 'false';
    const min = toMin(raw);
    // Korrupte Altwerte ("00:NaN" aus dem Löschen-Bug) fließen nicht ein.
    if (enabled && min !== null) aktive.push(min);
  }

  if (!gefunden) return false;

  // Hat der Nutzer bereits ein Fenster? Dann NICHT überschreiben — nur die
  // Altlast wegräumen. Sonst passiert genau das hier: Das Onboarding fragt
  // nach dem Zeitraum und speichert ihn, beim ersten Öffnen der
  // Einstellungen läuft diese Migration und ersetzt die Antwort durch das
  // aus den alten Slots abgeleitete Fenster. Der Nutzer sieht zwei
  // verschiedene Zeiträume und keiner davon ist der, den er gewählt hat.
  const schonGesetzt = localStorage.getItem(KEY_START) !== null;

  // Erst nach dem Auslesen löschen, sonst verlieren wir bei einem Fehler
  // in der Mitte beides.
  for (let i = 1; i <= LEGACY_SLOTS; i++) {
    localStorage.removeItem(`loewenherz_small_${i}_time`);
    localStorage.removeItem(`loewenherz_small_${i}_enabled`);
  }

  if (schonGesetzt) return false;

  // Alle Slots aus? Dann hat der Nutzer SMALL bewusst abgewählt — das
  // respektieren wir mit der kleinsten Anzahl statt mit dem Default.
  if (!aktive.length) {
    setSchedule({ start: DEFAULT_START, end: DEFAULT_END, count: 1 });
    return true;
  }

  const frueh = Math.floor(Math.min(...aktive) / 60) * 60;
  const spaet = Math.ceil(Math.max(...aktive) / 60) * 60;
  setSchedule({
    start: toHHMM(frueh),
    end: toHHMM(Math.min(spaet, 23 * 60 + 45)),
    count: aktive.length
  });
  return true;
}

// --- Wurf ---

function todayKey(now) {
  // Bewusst lokal zusammengebaut: toISOString() wäre UTC und würde den
  // Wurf abends um 23:00 MESZ dem nächsten Tag zuschlagen.
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function signature() {
  const { start, end } = getWindow();
  return `${start}-${end}-${getCount()}`;
}

/** Die heute gültigen Uhrzeiten als "HH:MM"-Array (Lokalzeit). */
export function getRoll() {
  const raw = localStorage.getItem(KEY_ROLL);
  if (!raw) return [];
  return raw.split(',').filter(t => toMin(t) !== null);
}

/**
 * Würfelt neu, wenn nötig — also bei Tageswechsel oder wenn der Nutzer
 * Fenster/Anzahl geändert hat. Sonst passiert nichts.
 *
 * Bei einer Änderung mitten am Tag bleiben die bereits vergangenen
 * Uhrzeiten stehen und nur der Rest wird neu gezogen. Ein kompletter
 * Neuwurf um 15:00 würde die drei am Vormittag schon zugestellten Impulse
 * ignorieren und der Nutzer bekäme deutlich mehr als eingestellt.
 *
 * @param {number[]} exclude  Morgen-/Abendzeit in Minuten.
 * @returns {boolean} true, wenn neu gewürfelt wurde.
 */
export function rollIfNeeded(exclude = [], now = new Date(), rnd = Math.random) {
  const date = todayKey(now);
  const sig = signature();
  const sameDay = localStorage.getItem(KEY_DATE) === date;
  const sameSig = localStorage.getItem(KEY_SIG) === sig;
  if (sameDay && sameSig && getRoll().length) return false;

  const { start, end } = getWindow();
  const startMin = toMin(start), endMin = toMin(end);
  const count = getCount();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  let times;
  if (sameDay) {
    // Einstellungen geändert: Vergangenes behalten, Rest neu ziehen.
    const keep = getRoll().filter(t => toMin(t) < nowMin).slice(0, count);
    const remaining = count - keep.length;
    if (remaining > 0) {
      const lastKeep = keep.length ? toMin(keep[keep.length - 1]) : -Infinity;
      const from = Math.max(startMin, gridUp(nowMin), lastKeep + MIN_GAP);
      times = [...keep, ...drawTimes(from, endMin, remaining, exclude, rnd)];
    } else {
      times = keep;
    }
  } else {
    // Neuer Tag: voller Wurf über das ganze Fenster. Liegt ein Teil davon
    // schon in der Vergangenheit (Installation am Nachmittag), verfallen
    // diese Slots still — sie in den Restnachmittag zu quetschen wäre Spam.
    times = drawTimes(startMin, endMin, count, exclude, rnd);
  }

  localStorage.setItem(KEY_ROLL, times.join(','));
  localStorage.setItem(KEY_DATE, date);
  localStorage.setItem(KEY_SIG, sig);
  return true;
}
