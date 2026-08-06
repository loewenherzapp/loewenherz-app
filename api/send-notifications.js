// ============================================================
// Löwenherz — Reminder-Versand (alle 15 Minuten per externem Cron)
// ============================================================
//
// WARUM DIESER SERVER DIE ZIELGRUPPE SELBST BILDET
//
// Früher trug jedes Gerät seine Zeiten in 13 einzelnen OneSignal-Tags
// (morning_utc, evening_utc, sound, small_1..10_utc) und OneSignal
// filterte die Empfänger. Das ging nicht mehr auf: Der Plan dieser App
// erlaubt **3 Data-Tags pro Gerät**, kumulativ — und ein Schreibvorgang
// mit mehr Keys wird KOMPLETT abgewiesen ("App is limited to a maximum
// of 3 tags on a given player"). Folge im Feld: Ab dem sechsten
// SMALL-Impuls kam kein einziger Wert mehr an, auch Morgen- und
// Abendzeit blieben auf dem alten Stand. Nutzer sahen ihre neuen Zeiten
// in der App und bekamen die alten zugestellt — ohne jede Fehlermeldung.
//
// Jetzt trägt jedes Gerät genau EINEN Tag `sched` (Aufbau siehe
// parseSched()). Auf einen zusammengesetzten Wert kann OneSignal nicht
// mehr filtern — es vergleicht nur exakt. Deshalb holt dieser Server die
// Subscriptions über die API, liest den Zeitplan selbst und sendet
// gezielt an die passenden IDs.
//
// Nebeneffekt: Es geht nur noch raus, was auch Empfänger hat. Früher
// liefen 12 Sendungen pro Slot, auch wenn niemand dran war.
//
// Altbestand heilt dieser Server selbst: Geräte mit den alten Zeit-Tags
// werden weiter korrekt bedient UND einmalig auf `sched` umgeschrieben
// (migrateAltTags()) — sonst käme dort nie wieder eine Änderung an, weil
// die alten Keys das Tag-Limit blockieren.
// ============================================================

const ONESIGNAL_APP_ID = '1aeeca68-13c9-400a-a243-dd749527c49f';
const ONESIGNAL_BASE = 'https://onesignal.com/api/v1';

// Zuordnung Ton-Kennung → Datei im iOS-Bundle. Muss zu SOUND_OPTIONS in
// js/notification-sound.js passen. Fehlt `t` im Zeitplan, gilt der
// Standardton; 'system' heißt bewusst: kein ios_sound-Feld → Apple-Ton.
const SOUND_FILES = {
  'ton-1': 'lh-ton-1.caf',
  'ton-2': 'lh-ton-2.caf',
  'ton-3': 'lh-ton-3.caf',
  'system': null
};
const DEFAULT_SOUND = 'ton-1';

// Sicherheitsdeckel. Beide werden geloggt, wenn sie greifen — ein
// stiller Deckel würde aussehen wie „alle bedient".
const MAX_PAGES = 40;          // 40 × 300 = 12.000 Subscriptions
const PAGE_SIZE = 300;
const MAX_MIGRATIONS = 40;     // pro Lauf, damit kein Timeout entsteht
const MAX_IDS_PER_SEND = 2000; // OneSignal-Grenze für include_subscription_ids

// Die alten Keys, die bei einer Migration weichen müssen.
const ALT_KEYS = ['morning_utc', 'evening_utc', 'sound']
  .concat(Array.from({ length: 10 }, (_, i) => `small_${i + 1}_utc`));

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  const expectedToken = process.env.CRON_SECRET;
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const apiKey = process.env.ONESIGNAL_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ONESIGNAL_API_KEY not configured' });
  }

  // Aktueller UTC-Slot im 15-Minuten-Raster, als "HHMM" wie im Tag-Wert.
  const now = new Date();
  const utcH = now.getUTCHours();
  const utcM = Math.floor(now.getUTCMinutes() / 15) * 15;
  const currentSlot = `${String(utcH).padStart(2, '0')}${String(utcM).padStart(2, '0')}`;
  const dayOfYear = getDayOfYear(now);

  // --- 1) Subscriptions holen ---
  let subs;
  try {
    subs = await fetchSubscriptions(apiKey);
  } catch (e) {
    // Ohne Empfängerliste ist dieser Lauf wertlos — mit 500 antworten,
    // damit ein Ausfall im Cron-Protokoll sichtbar wird statt als
    // erfolgreicher Lauf ohne Zustellungen durchzugehen.
    console.error('[send] Subscriptions nicht abrufbar:', e.message);
    return res.status(500).json({ error: 'players fetch failed', detail: e.message });
  }

  // --- 2) Zeitpläne lesen und Empfänger je Typ sammeln ---
  // Gruppiert nach Ton, weil der Ton im Payload steckt: pro Typ und Ton
  // eine Sendung.
  const empfaenger = { morning: {}, evening: {}, small: {} };
  const altbestand = [];

  for (const sub of subs) {
    const tags = sub.tags || {};
    const plan = tags.sched ? parseSched(tags.sched) : planAusAltTags(tags);
    if (!plan) continue;
    if (!tags.sched && hatAltKeys(tags)) altbestand.push({ sub, plan });

    const ton = SOUND_FILES[plan.sound] !== undefined ? plan.sound : DEFAULT_SOUND;
    if (plan.morning === currentSlot) push(empfaenger.morning, ton, sub.id);
    if (plan.evening === currentSlot) push(empfaenger.evening, ton, sub.id);
    if (plan.smalls.includes(currentSlot)) push(empfaenger.small, ton, sub.id);
  }

  // --- 3) Senden ---
  const results = [];
  const TEXTE = {
    morning: { title: 'Löwenherz', tab: 'reflexion', texte: morningTexts, offset: 0 },
    evening: { title: 'Löwenherz', tab: 'reflexion', texte: eveningTexts, offset: 2 },
    small:   { title: 'SMALL-Reminder', tab: 'heute', texte: smallTexts,
               offset: parseInt(currentSlot, 10) }
  };

  for (const [typ, gruppen] of Object.entries(empfaenger)) {
    const cfg = TEXTE[typ];
    const body = cfg.texte[(dayOfYear + cfg.offset) % cfg.texte.length];

    for (const [ton, ids] of Object.entries(gruppen)) {
      // Sehr große Gruppen aufteilen — OneSignal nimmt 2.000 IDs pro Call.
      for (let i = 0; i < ids.length; i += MAX_IDS_PER_SEND) {
        const teil = ids.slice(i, i + MAX_IDS_PER_SEND);
        try {
          const r = await sendNotification({
            apiKey,
            subscriptionIds: teil,
            title: cfg.title,
            body,
            url: `https://loewenherz-app.vercel.app/?tab=${cfg.tab}`,
            iosSound: SOUND_FILES[ton]
          });
          results.push({ type: typ, sound: ton, targeted: teil.length, ...r });
        } catch (e) {
          results.push({ type: typ, sound: ton, targeted: teil.length, error: e.message });
        }
      }
    }
  }

  // --- 4) Altbestand einmalig auf `sched` umschreiben ---
  const migriert = [];
  for (const eintrag of altbestand.slice(0, MAX_MIGRATIONS)) {
    migriert.push(await migrateAltTags(apiKey, eintrag.sub, eintrag.plan));
  }
  if (altbestand.length > MAX_MIGRATIONS) {
    console.log(`[send] Migration gedeckelt: ${altbestand.length - MAX_MIGRATIONS} Geräte warten auf den nächsten Lauf`);
  }

  return res.status(200).json({
    slot: currentSlot,
    timestamp: now.toISOString(),
    subscriptions: subs.length,
    calls: results.length,
    results,
    migrations: migriert.length ? migriert : 'keine offen',
    migrations_pending: Math.max(0, altbestand.length - MAX_MIGRATIONS)
  });
}

// ============================================================
// Zeitplan lesen
// ============================================================

/**
 * Parst den `sched`-Tag:  v1;m=0500;e=1830;s=0530,0930;t=ton-2
 *
 * Unbekannte Formatversion → null. Das ist Absicht: Läge hier eine
 * Fehlinterpretation vor, würden Erinnerungen zu falschen Zeiten
 * zugestellt. Lieber gar nicht senden als falsch.
 */
export function parseSched(wert) {
  if (typeof wert !== 'string' || !wert) return null;
  const teile = wert.split(';');
  if (teile[0] !== 'v1') return null;

  const plan = { morning: null, evening: null, smalls: [], sound: DEFAULT_SOUND };
  for (const teil of teile.slice(1)) {
    const [schluessel, roh = ''] = teil.split('=');
    if (schluessel === 'm') plan.morning = gueltigerSlot(roh);
    else if (schluessel === 'e') plan.evening = gueltigerSlot(roh);
    else if (schluessel === 's') {
      plan.smalls = roh.split(',').map(gueltigerSlot).filter(Boolean);
    } else if (schluessel === 't' && SOUND_FILES[roh] !== undefined) {
      plan.sound = roh;
    }
  }
  return plan;
}

/** "HHMM" auf dem 15-Minuten-Raster, sonst null. Ein krummer Wert würde
 *  nie einem Slot entsprechen — ihn hier auszusortieren macht den
 *  Unterschied zwischen „nie zugestellt" und „sichtbar ungültig". */
function gueltigerSlot(roh) {
  if (!/^\d{4}$/.test(roh)) return null;
  const h = Number(roh.slice(0, 2));
  const m = Number(roh.slice(2));
  if (h > 23 || m > 59 || m % 15 !== 0) return null;
  return roh;
}

/**
 * Übergangspfad: Geräte, die noch die alten Einzel-Tags tragen, weil sie
 * die App seit dem Umbau nicht geöffnet haben. Sie werden normal bedient
 * und in Schritt 4 umgeschrieben.
 */
export function planAusAltTags(tags) {
  const alt = (v) => (typeof v === 'string' ? gueltigerSlot(v.replace(':', '')) : null);
  const morning = alt(tags.morning_utc);
  const evening = alt(tags.evening_utc);
  const smalls = [];
  for (let i = 1; i <= 10; i++) {
    const s = alt(tags[`small_${i}_utc`]);
    if (s) smalls.push(s);
  }
  if (!morning && !evening && !smalls.length) return null;
  const sound = SOUND_FILES[tags.sound] !== undefined ? tags.sound : DEFAULT_SOUND;
  return { morning, evening, smalls, sound };
}

function hatAltKeys(tags) {
  return ALT_KEYS.some((k) => tags[k] !== undefined);
}

function push(gruppen, ton, id) {
  (gruppen[ton] = gruppen[ton] || []).push(id);
}

// ============================================================
// OneSignal-Zugriffe
// ============================================================

/** Alle Subscriptions mit ihren Tags, über Seiten hinweg. */
async function fetchSubscriptions(apiKey) {
  const alle = [];
  for (let seite = 0; seite < MAX_PAGES; seite++) {
    const url = `${ONESIGNAL_BASE}/players?app_id=${ONESIGNAL_APP_ID}&limit=${PAGE_SIZE}&offset=${seite * PAGE_SIZE}`;
    const resp = await fetch(url, { headers: { Authorization: `Basic ${apiKey}` } });
    if (!resp.ok) throw new Error(`players HTTP ${resp.status}`);
    const data = await resp.json();
    const players = data.players || [];
    // Abgemeldete und von Apple/Google abgewiesene Geräte kosten nur
    // Payload — sie können keine Zustellung mehr annehmen.
    for (const p of players) {
      if (p.invalid_identifier === true) continue;
      if (p.notification_types === -2) continue;
      alle.push(p);
    }
    if (players.length < PAGE_SIZE) return alle;
  }
  console.log(`[send] Seiten-Deckel erreicht (${MAX_PAGES}× ${PAGE_SIZE}) — es gibt mehr Subscriptions als bedient wurden`);
  return alle;
}

async function sendNotification({ apiKey, subscriptionIds, title, body, url, iosSound }) {
  const resp = await fetch(`${ONESIGNAL_BASE}/notifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${apiKey}` },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      // Gezielt statt per Filter — die Zuordnung passiert oben in diesem
      // Server, weil sie im Tag-Wert steckt.
      include_subscription_ids: subscriptionIds,
      headings: { en: title },
      contents: { en: body },
      // web_url statt url: `url` gilt für ALLE Plattformen und wäre auf iOS
      // die Launch-URL — der Tap würde die Website öffnen statt der App.
      web_url: url,
      chrome_web_icon: 'https://loewenherz-app.vercel.app/assets/icons/icon-192.png',
      // Ohne ios_sound spielt iOS den Systemton. Web-Push ignoriert das Feld.
      ...(iosSound ? { ios_sound: iosSound } : {}),
      ttl: 900 // 15 Minuten — danach nicht mehr zustellen
    })
  });

  const data = await resp.json();
  return {
    sent: true,
    recipients: data.recipients || 0,
    body,
    onesignal_id: data.id || null,
    errors: data.errors || null
  };
}

/**
 * Schreibt einen Altbestand-Zeitplan als `sched` und räumt die alten Keys
 * weg. Reihenfolge und Häppchen sind beides zwingend:
 *
 * - Erst löschen, dann setzen: Das Tag-Limit zählt pro Gerät, ein neuer
 *   Key neben den alten wird abgewiesen.
 * - In 3er-Häppchen: Ein Request mit mehr Keys wird ebenfalls abgewiesen —
 *   das gilt auch fürs Löschen.
 */
async function migrateAltTags(apiKey, sub, plan) {
  const vorhanden = ALT_KEYS.filter((k) => (sub.tags || {})[k] !== undefined);
  try {
    for (let i = 0; i < vorhanden.length; i += 3) {
      const haeppchen = {};
      for (const k of vorhanden.slice(i, i + 3)) haeppchen[k] = '';
      await putTags(apiKey, sub.id, haeppchen);
    }

    const teile = ['v1', `m=${plan.morning || ''}`, `e=${plan.evening || ''}`,
                   `s=${plan.smalls.join(',')}`];
    if (plan.sound && plan.sound !== DEFAULT_SOUND) teile.push(`t=${plan.sound}`);
    const antwort = await putTags(apiKey, sub.id, { sched: teile.join(';') });

    const ok = antwort.success === true || antwort.success === 'true';
    if (!ok) console.error(`[send] Migration von ${sub.id} fehlgeschlagen:`, antwort.errors);
    return { id: sub.id, ok, errors: antwort.errors || null };
  } catch (e) {
    console.error(`[send] Migration von ${sub.id} abgebrochen:`, e.message);
    return { id: sub.id, ok: false, errors: e.message };
  }
}

async function putTags(apiKey, playerId, tags) {
  const resp = await fetch(`${ONESIGNAL_BASE}/players/${playerId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${apiKey}` },
    body: JSON.stringify({ app_id: ONESIGNAL_APP_ID, tags })
  });
  return resp.json();
}

function getDayOfYear(now) {
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now - start) / (1000 * 60 * 60 * 24));
}

// ============================================================
// Texte
// ============================================================

const morningTexts = [
  "Guten Morgen, Löwenherz. Wie willst du heute sein?",
  "Quatschi ist schon wach. Du auch — und du hast einen Plan.",
  "Die Weiche stellt sich nicht von allein.",
  "Bevor der Autopilot übernimmt: Was ist dir heute wichtig?",
  "Gundula ist schon wach. Gib ihr eine Richtung, bevor Quatschi es tut."
];

const eveningTexts = [
  "Der Tag kann warten. Zwei Minuten für dich.",
  "Offene Schleifen? Quatschi nimmt die sonst mit ins Bett.",
  "Kurz innehalten. Nicht grübeln — reflektieren.",
  "Quatschi hatte seinen Auftritt. Jetzt bist du dran.",
  "Was zählt heute aufs Gelassenheitskonto? Auch Kleinigkeiten zählen."
];

const smallTexts = [
  "Kurzer Check: Schultern unten? Atem fließt?",
  "Quatschi-Alarm? Einen Schritt zurücktreten.",
  "Autopilot oder bewusst? Kurzer Check, ehrliche Antwort.",
  "Gerade am Grübeln? Laufband oder Joggen — du hast die Wahl.",
  "Schultern auf Ohrhöhe? Dachte ich mir. Runter damit.",
  "Quatschi redet seit Minuten. Wusstest du das?",
  "SMALL-Check. Welcher Buchstabe ist gerade dran?",
  "Aufmerksamkeit ist Dünger. Worauf richtest du sie?",
  "Schultern, Kiefer, Cocktail — kurzer Scan?",
  "Schultern runter. Atmen. Weiter.",
  "Schultern an den Ohren? Zwei Zentimeter runter.",
  "Dein Cocktail könnte einen Check vertragen.",
  "Quatschi sendet live. Du musst nicht zuhören.",
  "Quatschi empfiehlt absagen. Musst du nicht.",
  "Stopp. Drei Sekunden. Was ist gerade los?",
  "Kurz rauszoomen. Was siehst du?",
  "Dein Autopilot hat gerade die Fernbedienung.",
  "Film oder Kino? Kurzer Check.",
  "Gundula macht Gundula-Sachen. Alles normal.",
  "Wann hast du zuletzt was getrunken?",
  "Radio Bullshit sendet wieder. Regler ist bei dir.",
  "Radio Bullshit: heute nur Wiederholungen.",
  "Gundula meldet Feueralarm. Ist nur der Toast.",
  "Gundula ist heute anstrengend. Sie meint es gut.",
  "Schluck Wasser. Zählt schon.",
  "Kurze Pause ist auch ein SMALL-Punkt.",
  "Etwas gegessen, getrunken, bewegt? Eins reicht.",
  "Frische Luft abgekriegt heute? Gundula mag das.",
  "Wie redest du gerade mit dir? Nur mal gefragt.",
  "Innerer Ton gerade okay? Nur eine Frage.",
  "Nein ist ein vollständiger Satz.",
  "Ein bisschen Freundlichkeit. Für dich, meine ich.",
  "Vermeiden fühlt sich gut an. Kurz. Dann nicht mehr.",
  "Der Weltuntergang fand übrigens nicht statt.",
  "Mood follows Action. Nur als Erinnerung.",
  "Was würdest du tun, wenn Gundula grad Pause hätte?",
  "Was ist das Gefühl gerade? Ein Wort reicht.",
  "Gefühle sind Daten, keine Anweisungen.",
  "Quatschis Trefferquote bisher: überschaubar.",
  "Kiefer locker? Stirn auch?",
  "Magst du kurz bei Gundula vorbeischauen?",
  "Gundula wartet. Ganz entspannt, aber sie wartet.",
  "Kurzbesuch bei Gundula? Sie beißt nicht.",
  "Ein SMALL-Punkt aufs Konto? Kleiner Einsatz reicht.",
  "Kleine Einzahlung aufs Gelassenheitskonto?",
  "Ein Punkt aufs Konto? Alles über null zählt."
];
