// ============================================================
// Löwenherz PWA — Push Notifications (Server-Side Scheduling)
// ============================================================
//
// DSGVO: Das OneSignal-SDK lädt NICHT mehr beim App-Start.
// Es wird erst geladen, wenn der User Push aktiviert ODER wenn ein
// Bestandsuser die App öffnet, der Push schon mal aktiviert hatte
// (loewenherz_push_asked === 'true' && loewenherz_push_enabled !== 'false').
// Damit fließt keine IP-Adresse an OneSignal/USA vor Einwilligung.
//
// Diese Datei ist die Push-Facade: Sie kapselt beide Plattformen und
// verzweigt intern nach isNative(). Außerhalb von push.js und
// push-native.js greift NICHTS mehr direkt auf OneSignal oder die
// Notification-API zu.
//
//   Web   → OneSignal Web SDK v16 (CDN, lazy) — hier in dieser Datei
//   Nativ → @onesignal/capacitor-plugin       — js/push-native.js
//
// Geteilt und bewusst NICHT dupliziert: roundTo15Min(), localTimeToUTC()
// und buildTags(). Der Server filtert nach exakten Tag-Werten; jede
// Abweichung im Format bräche das Scheduling lautlos.
// ============================================================

import { isNative } from './platform.js';
import { API_BASE, ONESIGNAL_APP_ID } from './config.js';
import { rollIfNeeded, getRoll, toMin, MAX_SLOTS, migrateLegacySlots } from './small-schedule.js';

const ONESIGNAL_SDK_URL = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
let oneSignalLoadPromise = null;
let nativeLoadPromise = null;

// Handle auf js/push-native.js, sobald der native Pfad geladen ist.
// Bleibt im Web für immer null.
let nativePush = null;

/**
 * Aktueller Permission-Status: 'default' | 'granted' | 'denied' | 'unsupported'.
 * Bewusst synchron, damit die Aufrufer (settings.js) unverändert bleiben —
 * nativ liefert ein Cache im SDK-Adapter den Wert.
 */
export function getPermissionState() {
  if (isNative()) {
    return nativePush ? nativePush.getNativePermissionState() : 'default';
  }
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

/**
 * Lädt das OneSignal-SDK dynamisch nach und initialisiert es.
 * Idempotent: weitere Aufrufe geben das gleiche Promise zurück.
 */
export function ensureOneSignalLoaded() {
  // Nativ: statt des Web-SDKs den Capacitor-Adapter laden.
  if (isNative()) {
    if (nativeLoadPromise) return nativeLoadPromise;
    nativeLoadPromise = import('./push-native.js').then((mod) => {
      nativePush = mod;
      return mod.initNative().then((sdk) => {
        // Pendant zu attemptTagSync() im Web-Zweig: nach dem Init einmal
        // die Tags schreiben. Kein Polling nötig — das native SDK hält
        // die Tags im User-Model und synct selbst.
        if (sdk && mod.getNativePermissionState() === 'granted') {
          syncTagsToOneSignal();
        }
        return sdk;
      });
    }).catch((e) => {
      console.warn('[Push] Nativer Push-Adapter nicht ladbar:', e);
      return null;
    });
    return nativeLoadPromise;
  }
  if (oneSignalLoadPromise) return oneSignalLoadPromise;

  oneSignalLoadPromise = new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function(OneSignal) {
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        serviceWorkerParam: { scope: "/" },
        serviceWorkerPath: "OneSignalSDKWorker.js",
        notifyButton: { enable: false },
        welcomeNotification: { disable: true }
      });

      console.log('[Push] OneSignal initialized');
      console.log('[Push] OptedIn:', OneSignal.User.PushSubscription.optedIn);
      console.log('[Push] PushSubscription.id:', OneSignal.User.PushSubscription.id);

      OneSignal.User.PushSubscription.addEventListener('change', function(event) {
        console.log('[Push] Subscription changed:', event.current);
        if (event.current.optedIn) {
          attemptTagSync(0);
        }
      });

      attemptTagSync(0);
      resolve(OneSignal);
    });

    // Script erst nach OneSignalDeferred-Setup injizieren
    const script = document.createElement('script');
    script.src = ONESIGNAL_SDK_URL;
    script.defer = true;
    document.head.appendChild(script);
  });

  return oneSignalLoadPromise;
}

/**
 * Hat dieser User Push aktiv? Das ist die DSGVO-Zusage in Codeform —
 * ist das hier false, darf KEIN OneSignal-SDK geladen werden.
 * Bewusst nur an dieser einen Stelle definiert: Eine zweite Kopie wäre
 * die Stelle, an der die Zusage irgendwann auseinanderläuft.
 */
function pushIsActive() {
  const asked = localStorage.getItem('loewenherz_push_asked') === 'true';
  const enabled = localStorage.getItem('loewenherz_push_enabled') !== 'false';
  if (!asked || !enabled) return false;
  // WKWebView kennt Notification.permission nicht — den echten Status klärt
  // das native SDK selbst beim Init.
  if (isNative()) return true;
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

// --- Migration der alten Einzelslots ---
//
// Muss beim App-START laufen, nicht erst beim Öffnen der Einstellungen.
// Sonst wird ein Bestandsnutzer, der nie in die Einstellungen geht, nie
// migriert: Seine small_1..5 liegen ungelesen herum, und weil buildTags()
// nur noch den Wurf liest, bekommt er stillschweigend die Vorgabe
// 06:00–23:00 mit fünf Impulsen statt seiner gewohnten Zeiten. Kein
// Absturz, keine Meldung — einfach andere Erinnerungen als gestern.
//
// Bewusst hier und nicht in app.js: Der Zeitplan gehört zum Push-Bereich,
// app.js müsste sonst von Migrationen wissen. Die Aufrufe in settings.js
// und data-export.js bleiben trotzdem stehen — migrateLegacySlots() ist
// idempotent, und der Backup-Import braucht seinen eigenen.
(function migrateOnStartup() {
  try {
    if (migrateLegacySlots()) {
      console.log('[Push] Alte SMALL-Slots ins Zeitfenster-Modell überführt');
    }
  } catch (e) {
    // Silent — eine fehlgeschlagene Migration darf den Start nicht blockieren
  }
})();

// --- Auto-load für Bestandsuser ---
// Wer Push schon mal aktiviert hat und nicht explizit deaktiviert hat,
// braucht das SDK direkt (sonst keine Tag-Syncs, keine Subscription-Pflege).
(function autoLoadForExistingUsers() {
  try {
    if (pushIsActive()) ensureOneSignalLoaded();
  } catch (e) {
    // Silent — kein Push-Fail darf App-Start blockieren
  }
})();

// --- Zeitzonen-Drift: Tags neu schreiben, wenn sich der UTC-Offset ändert ---
//
// Die Tags speichern absolute UTC-Zeiten, berechnet mit dem Offset vom Tag
// des Schreibens. Nach einer Zeitumstellung (oder einer Reise) stimmen sie
// nicht mehr: "07:00 Ortszeit" ist im Sommer 05:00 UTC, im Winter 06:00 UTC.
//
// Beim App-START werden die Tags ohnehin neu geschrieben. Die Lücke ist iOS:
// Dort werden Apps suspendiert statt beendet — der WKWebView bleibt im
// Speicher, dieses Modul wird beim Zurückholen aus dem Hintergrund NICHT neu
// ausgewertet. Ohne diesen Listener bekäme ein User, der nie kalt startet,
// nie einen Re-Sync.

const TZ_OFFSET_KEY = 'loewenherz_tz_offset';

// Minuten gegenüber UTC, Osten positiv (Berlin Sommer: "120", Winter: "60").
function currentUtcOffset() {
  return String(-new Date().getTimezoneOffset());
}

// Wird erst aufgerufen, wenn die Tags das Gerät tatsächlich verlassen haben.
// Bewusst NICHT einfach am Anfang von syncTagsToOneSignal(): Ein Sync, der
// mangels geladenem SDK ins Leere läuft, würde sonst den Offset festschreiben
// und damit den nächsten Wiederholungsversuch unterdrücken.
function rememberOffset() {
  try {
    localStorage.setItem(TZ_OFFSET_KEY, currentUtcOffset());
  } catch (e) {
    // Silent — ohne den Merker gibt es nur einen überflüssigen Re-Sync.
  }
}

function resyncIfOffsetChanged() {
  try {
    if (!pushIsActive()) return;
    const gespeichert = localStorage.getItem(TZ_OFFSET_KEY);
    const jetzt = currentUtcOffset();
    if (gespeichert === jetzt) return;
    console.log(`[Push] Zeitzonen-Offset geändert: ${gespeichert} → ${jetzt} — Tags neu schreiben`);
    ensureOneSignalLoaded().then(() => syncOneSignalTags()).catch(() => {});
  } catch (e) {
    // Silent — Push darf nie den App-Flow stören
  }
}

// --- Tageswechsel: neu würfeln ---
//
// Der Wurf gilt für einen Kalendertag. Ohne diesen Handler bekäme jemand,
// der die App tagelang nur aus dem Hintergrund zurückholt statt sie kalt
// zu starten, immer wieder dieselben Uhrzeiten — also genau die Gewöhnung,
// gegen die das Würfeln gebaut ist.
function resyncIfRollStale() {
  try {
    if (!pushIsActive()) return;
    // rollIfNeeded() meldet mit true, dass es tatsächlich gewürfelt hat.
    // Am selben Tag mit unveränderten Einstellungen passiert nichts.
    if (!rollIfNeeded(fixedTimesInMinutes())) return;
    console.log('[Push] Neuer Tag — SMALL-Zeiten neu gewürfelt:', getRoll().join(' '));
    ensureOneSignalLoaded().then(() => syncOneSignalTags()).catch(() => {});
  } catch (e) {
    // Silent — Push darf nie den App-Flow stören
  }
}

// Bewusst hier und nicht in app.js: Der Handler braucht weder DOM noch
// Tab-Zustand. Läge er dort, müsste app.js von Zeitzonen-Offsets wissen —
// genau das soll die Push-Facade verhindern.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  resyncIfOffsetChanged();
  resyncIfRollStale();
});

// --- Polling: Warte bis PushSubscription.id bereit ist ---

function attemptTagSync(attempt) {
  const MAX_ATTEMPTS = 15;
  const INTERVAL_MS = 2000;

  if (!window.OneSignal || !window.OneSignal.User) {
    if (attempt < MAX_ATTEMPTS) {
      setTimeout(() => attemptTagSync(attempt + 1), INTERVAL_MS);
    }
    return;
  }

  const optedIn = OneSignal.User.PushSubscription.optedIn;
  const subId = OneSignal.User.PushSubscription.id;

  console.log(`[Push] Attempt ${attempt + 1}: optedIn=${optedIn}, subId=${subId}`);

  if (optedIn && subId) {
    syncTagsToOneSignal();
  } else if (attempt < MAX_ATTEMPTS) {
    setTimeout(() => attemptTagSync(attempt + 1), INTERVAL_MS);
  } else {
    console.log('[Push] Max attempts reached.');
  }
}

// --- Time Helpers ---

/**
 * Rundet "HH:MM" auf das 15-Minuten-Raster.
 *
 * Gibt null zurück, wenn der Wert kein gültiges HH:MM ist. Der Fall ist
 * real: Chromes Android-Zeitdialog hat einen „Löschen"-Button, der das
 * Feld leert — das anschließende focusout schrieb "00:NaN" nach
 * localStorage und als Tag zu OneSignal. Der Slot war danach still tot.
 *
 * Aufrufer MÜSSEN auf null prüfen.
 */
export function roundTo15Min(timeStr) {
  if (typeof timeStr !== 'string') return null;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  const rounded = Math.round(m / 15) * 15;
  const finalM = rounded === 60 ? 0 : rounded;
  const finalH = rounded === 60 ? (h + 1) % 24 : h;
  return `${String(finalH).padStart(2, '0')}:${String(finalM).padStart(2, '0')}`;
}

export function localTimeToUTC(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const now = new Date();
  now.setHours(h, m, 0, 0);
  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();
  return `${String(utcH).padStart(2, '0')}:${String(utcM).padStart(2, '0')}`;
}

// --- Tag Sync: 12 Tags ---
// morning_utc, evening_utc, small_1_utc .. small_10_utc
// push_enabled entfällt — wenn Push aus: alle Tags löschen

/**
 * Stellt sicher, dass für heute ein Wurf existiert, ohne einen Tag-Sync
 * auszulösen. Für die Einstellungen: Dort sollen die heutigen Uhrzeiten
 * auch dann stehen, wenn Push (noch) aus ist — sonst zeigt der Screen
 * eine leere Vorschau und wirkt kaputt.
 *
 * Kein zweiter Würfelpfad: rollIfNeeded() bleibt die einzige Stelle, die
 * würfelt, und tut es nur bei Tageswechsel oder geänderten Einstellungen.
 */
export function ensureRoll() {
  return rollIfNeeded(fixedTimesInMinutes());
}

/** Die festen Zeiten in Minuten — der Würfel muss sie freilassen. */
function fixedTimesInMinutes() {
  const morning = roundTo15Min(localStorage.getItem('loewenherz_morning_time') || '07:00') || '07:00';
  const evening = roundTo15Min(localStorage.getItem('loewenherz_evening_time') || '20:30') || '20:30';
  return [toMin(morning), toMin(evening)];
}

function buildTags() {
  const pushEnabled = localStorage.getItem('loewenherz_push_enabled') !== 'false';

  // Push deaktiviert → alle Tags löschen (leerer String = Tag wird gelöscht)
  if (!pushEnabled) {
    const tags = { morning_utc: '', evening_utc: '' };
    for (let i = 1; i <= MAX_SLOTS; i++) tags[`small_${i}_utc`] = '';
    return tags;
  }

  const morningRaw = localStorage.getItem('loewenherz_morning_time') || '07:00';
  const eveningRaw = localStorage.getItem('loewenherz_evening_time') || '20:30';
  // Fallback fängt auch Altbestand ab: Wer vor dem null-Riegel in
  // roundTo15Min() ein "00:NaN" gespeichert hat, heilt hier still aus.
  const morning = roundTo15Min(morningRaw) || '07:00';
  const evening = roundTo15Min(eveningRaw) || '20:30';
  const morningUTC = localTimeToUTC(morning);
  const eveningUTC = localTimeToUTC(evening);

  const tags = {
    morning_utc: morningUTC,
    evening_utc: eveningUTC
  };

  // Der Aufruf ist idempotent: rollIfNeeded() würfelt nur bei Tageswechsel
  // oder geänderten Einstellungen. Deshalb darf er hier stehen, obwohl
  // buildTags() an sieben Stellen erreicht wird — ein unbedingter Würfel
  // an dieser Stelle würde dem Nutzer über den Tag ein Vielfaches der
  // eingestellten Anzahl schicken.
  rollIfNeeded(fixedTimesInMinutes());
  const roll = getRoll();

  // IMMER alle Slots schreiben, auch die ungenutzten. Stellt jemand von 10
  // auf 3 zurück und wir schrieben nur drei, blieben small_4..10 bei
  // OneSignal stehen und feuerten weiter — für immer, weil sie nie wieder
  // angefasst würden.
  for (let i = 1; i <= MAX_SLOTS; i++) {
    tags[`small_${i}_utc`] = roll[i - 1] ? localTimeToUTC(roll[i - 1]) : '';
  }

  return tags;
}

function syncTagsToOneSignal() {
  const tags = buildTags();
  console.log('[Push] Syncing tags:', tags);

  // Nativ: ausschließlich über das SDK. api/set-tags.js hat kein
  // CORS-Handling und ist aus capacitor://localhost nicht erreichbar —
  // der Server-Doppelschreiber unten entfällt deshalb bewusst.
  if (isNative()) {
    if (nativePush) nativePush.syncNativeTags(tags).then(rememberOffset).catch(() => {});
    return;
  }

  // Client-seitig via SDK
  try {
    if (window.OneSignal && window.OneSignal.User) {
      OneSignal.User.addTags(tags);
      rememberOffset();
      console.log('[Push] Client addTags() called');
    }
  } catch (e) {
    console.warn('[Push] Client addTags() error:', e);
  }

  // Server-Fallback nach 3s (Legacy Players API — funktioniert mit PushSubscription.id)
  setTimeout(() => {
    syncTagsViaServer(tags);
  }, 3000);
}

function syncTagsViaServer(tags) {
  let subscriptionId = null;

  try {
    if (window.OneSignal && window.OneSignal.User && window.OneSignal.User.PushSubscription) {
      subscriptionId = OneSignal.User.PushSubscription.id;
    }
  } catch (e) {
    console.warn('[Push] Error reading PushSubscription.id:', e);
  }

  if (!subscriptionId) {
    console.log('[Push] No PushSubscription.id — skipping server sync');
    return;
  }

  console.log('[Push] Server sync for:', subscriptionId);

  fetch(API_BASE + '/api/set-tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_id: subscriptionId, tags: tags })
  })
    .then(r => r.json())
    .then(data => {
      console.log('[Push] Server sync result:', data);
    })
    .catch(err => {
      console.warn('[Push] Server sync failed:', err);
    });
}

// --- Exportierte Sync-Funktion (für Settings-Screen) ---

export function syncOneSignalTags() {
  syncTagsToOneSignal();
}

// --- Permission-Prompt (Facade für Soft-Ask und Settings) ---

/**
 * Lädt bei Bedarf das SDK und zeigt den Permission-Prompt.
 * Resolved mit 'granted' | 'denied' | 'default' | 'unknown'.
 *
 * 'unknown' ist der Web-Slidedown-Pfad und Absicht: OneSignals Slidedown
 * meldet kein Ergebnis zurück. Aufrufer dürfen daraufhin NICHTS am
 * UI-Zustand ändern — exakt das Verhalten, das der Web-Pfad heute hat.
 */
export function requestPushPermission() {
  return ensureOneSignalLoaded().then(() => {
    // Nativ: Der Apple-System-Dialog ist ein One-Shot. Lehnt der User dort
    // ab, wird nie wieder gefragt — kein Nag-Screen, und mit `false` in
    // requestPermission() auch kein Sprung in die iOS-Einstellungen (V1).
    if (isNative()) {
      if (!nativePush) return 'unknown';
      return nativePush.requestNativePermission()
        .then(() => nativePush.getNativePermissionState())
        .catch(() => 'unknown');
    }
    if (window.OneSignal && OneSignal.Slidedown) {
      OneSignal.Slidedown.promptPush();
      return 'unknown';
    }
    if (typeof Notification !== 'undefined') {
      return Notification.requestPermission();
    }
    return 'unknown';
  });
}

// --- Soft-Ask Overlay ---

export function showPushSoftAsk() {
  if (getPermissionState() !== 'default') return;
  if (localStorage.getItem('loewenherz_push_asked')) return;
  // Der push_asked-Riegel greift erst NACH einer Nutzerentscheidung. Zwei
  // Auslöser können aber gleichzeitig feuern — die Morgenreflexion vergibt
  // selbst SMALL-Punkte, triggert also beide Pfade. Ohne diese Zeile lägen
  // dann zwei Overlays übereinander.
  if (document.querySelector('.push-soft-ask-overlay')) return;

  const overlay = document.createElement('div');
  overlay.className = 'push-soft-ask-overlay';
  overlay.innerHTML = `
    <div class="push-soft-ask-content">
      <div class="push-soft-ask-icon">🔔</div>
      <h2 class="push-soft-ask-title">Soll ich dich erinnern?</h2>
      <p class="push-soft-ask-text">
        Morgens an deine Intention.<br>
        Abends an deine Reflexion.<br>
        Und zwischendurch an einen SMALL-Moment.
      </p>
      <button class="btn-primary push-soft-ask-accept" id="push-accept">Ja, gern →</button>
      <button class="push-soft-ask-later" id="push-later">Später</button>
    </div>
  `;

  document.body.appendChild(overlay);

  // Layout-Durchlauf synchron erzwingen statt über requestAnimationFrame:
  // rAF feuert nicht, solange document.visibilityState 'hidden' ist. Wandert
  // die App genau zwischen Auslöser und Animationsstart in den Hintergrund,
  // bliebe .active für immer ungesetzt — das Overlay hinge unsichtbar im
  // DOM. Bei diesem hier wäre das fatal: z-index 600 über der ganzen App.
  void overlay.offsetHeight;
  overlay.classList.add('active');

  document.getElementById('push-accept').addEventListener('click', () => {
    localStorage.setItem('loewenherz_push_asked', 'true');
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 300);

    if (!localStorage.getItem('loewenherz_push_enabled')) {
      localStorage.setItem('loewenherz_push_enabled', 'true');
    }
    if (!localStorage.getItem('loewenherz_morning_time')) {
      localStorage.setItem('loewenherz_morning_time', '07:00');
    }
    if (!localStorage.getItem('loewenherz_evening_time')) {
      localStorage.setItem('loewenherz_evening_time', '20:30');
    }
    // Für die SMALL-Reminder wird hier bewusst NICHTS geschrieben.
    // getWindow()/getCount() liefern ihre Defaults ohne Speichereintrag —
    // und ein hier geschriebenes Default-Fenster würde migrateLegacySlots()
    // blockieren („überschreibe kein bestehendes Fenster"). Ein Bestands-
    // nutzer, der den Soft-Ask vor dem ersten Öffnen der Einstellungen
    // sieht, verlöre damit seine gewohnten Zeiten.

    // Erst jetzt der echte Permission-Prompt — im Web der Slidedown,
    // nativ der Apple-System-Dialog.
    requestPushPermission().then((state) => {
      if (state !== 'granted') return;
      localStorage.setItem('loewenherz_push_enabled', 'true');
      if (isNative()) syncTagsToOneSignal();
      else attemptTagSync(0);
    });
  });

  document.getElementById('push-later').addEventListener('click', () => {
    localStorage.setItem('loewenherz_push_asked', 'true');
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 300);
  });
}

// --- Check Soft-Ask after Reflexion ---

// Gleiche UI, gleiche Logik, gleiche localStorage-Keys auf beiden Plattformen.
// Nativ ist die Reihenfolge: Soft-Ask (unsere UI) → erst bei Zustimmung der
// Apple-System-Dialog. Ablehnung im Soft-Ask → gar kein System-Dialog.
//
// Aufrufer: nach einer abgeschlossenen Reflexion (reflection.js) UND nach
// einem SMALL-Punkt vom Dashboard. Der Dashboard-Pfad ist der wichtigere:
// Reflexionen gehen nur 05:00–11:59 und 18:00–04:59, ein SMALL-Punkt geht
// jederzeit. Ohne ihn wird ein User, der nachmittags installiert, an dem
// Tag gar nicht gefragt.
export function checkPushSoftAsk() {
  setTimeout(() => {
    if (
      getPermissionState() === 'default' &&
      !localStorage.getItem('loewenherz_push_asked')
    ) {
      showPushSoftAsk();
    }
  }, 1500);
}
