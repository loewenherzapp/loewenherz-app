// ============================================================
// Löwenherz — Push nativ (iOS, @onesignal/capacitor-plugin)
// ============================================================
//
// Nativer Zwilling des Web-Pfads in js/push.js. Wird AUSSCHLIESSLICH
// von dort aufgerufen (dynamischer Import hinter isNative()) — außerhalb
// dieser beiden Dateien gibt es keinen direkten OneSignal-Zugriff.
//
// DSGVO: Gleiches Lazy-Gate wie im Web. initNative() läuft erst, wenn
// der User zugestimmt hat bzw. bei Bestandsusern, die Push schon an
// haben. Vor der Einwilligung fließt nichts an OneSignal.
//
// Tags: Diese Datei berechnet NICHTS. Sie bekommt das fertige Objekt
// aus buildTags() in js/push.js — dieselbe Funktion, die auch der
// Web-Pfad benutzt. Der Server filtert nach exakten Werten; ein
// nachgebautes Duplikat würde das Scheduling lautlos brechen.
//
// iOS-Besonderheit: Der Apple-System-Dialog ist ein One-Shot. Lehnt
// der User dort ab, fragen wir nie wieder — kein Nag-Screen. Der
// Parameter `false` in requestPermission() unterdrückt bewusst auch
// den automatischen Sprung in die iOS-Einstellungen (V1).
// ============================================================

import { ONESIGNAL_APP_ID } from './config.js';

// Das SDK selbst liegt nur im iOS-Bundle (www/js/vendor/, erzeugt von
// scripts/build-ios.mjs). Im Web existiert der Pfad nicht — deshalb
// steht der Import in einer Funktion und nicht am Dateianfang.
const SDK_PATH = './vendor/onesignal.js';

// OSNotificationPermission → unser Web-kompatibles Vokabular.
// 0 NotDetermined, 1 Denied, 2 Authorized, 3 Provisional, 4 Ephemeral
const PERMISSION_BY_NATIVE_VALUE = {
  0: 'default',
  1: 'denied',
  2: 'granted',
  3: 'granted',
  4: 'granted'
};

let initPromise = null;

// Synchron lesbarer Spiegel des Permission-Status. Nötig, weil das
// native SDK nur async antwortet, settings.js aber — wie im Web —
// synchron entscheidet. Gepflegt beim Init, nach requestPermission()
// und über den permissionChange-Listener.
let permissionState = 'default';

/**
 * Aktueller Permission-Status, synchron: 'default' | 'granted' | 'denied'.
 * Web-Pendant: Notification.permission.
 */
export function getNativePermissionState() {
  return permissionState;
}

async function refreshPermissionState(OneSignal) {
  try {
    const native = await OneSignal.Notifications.permissionNative();
    permissionState = PERMISSION_BY_NATIVE_VALUE[native] || 'default';
  } catch (e) {
    // permissionNative() ist iOS-only — Fallback auf den Boolean.
    try {
      permissionState = (await OneSignal.Notifications.hasPermission()) ? 'granted' : 'default';
    } catch (e2) {
      console.warn('[Push] Permission-Status nicht lesbar:', e2);
    }
  }
  return permissionState;
}

/**
 * Lädt und initialisiert das native SDK. Idempotent: weitere Aufrufe
 * geben dasselbe Promise zurück (wie ensureOneSignalLoaded() im Web).
 * Resolved mit der OneSignal-Instanz oder null, wenn etwas schiefging.
 */
export function initNative() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const { default: OneSignal } = await import(SDK_PATH);
    await OneSignal.initialize(ONESIGNAL_APP_ID);

    // Foreground unterdrücken: Es sind Reminder („öffne die App").
    // Wer die App gerade offen hat, braucht den Reminder nicht — ein
    // Banner über der offenen App wirkt kaputt.
    // preventDefault() MUSS synchron fallen: das Plugin ruft direkt
    // nach dem Listener-Durchlauf proceedWithWillDisplay().
    OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event) => {
      event.preventDefault();
    });

    OneSignal.Notifications.addEventListener('permissionChange', () => {
      refreshPermissionState(OneSignal).catch(() => {});
    });

    // Kein click-Listener: V1 öffnet nur die App, kein Deep-Link-Routing.

    await refreshPermissionState(OneSignal);
    console.log('[Push] Natives SDK initialisiert, Permission:', permissionState);
    return OneSignal;
  })().catch((e) => {
    console.warn('[Push] Natives SDK konnte nicht initialisiert werden:', e);
    return null;
  });

  return initPromise;
}

/**
 * Zeigt den Apple-System-Dialog. Nur nach Zustimmung im Soft-Ask aufrufen.
 * `false` = kein automatischer Redirect in die iOS-Einstellungen (V1).
 */
export async function requestNativePermission() {
  try {
    const OneSignal = await initNative();
    if (!OneSignal) return false;
    const accepted = await OneSignal.Notifications.requestPermission(false);
    await refreshPermissionState(OneSignal);
    console.log('[Push] Permission-Dialog beantwortet:', accepted, '→', permissionState);
    return accepted;
  } catch (e) {
    console.warn('[Push] requestPermission fehlgeschlagen:', e);
    return false;
  }
}

/**
 * Schreibt die 7 Tags über das native SDK.
 * @param tags Fertiges Objekt aus buildTags() in js/push.js.
 *
 * Init wird hier bewusst NICHT erzwungen: Wie im Web (dort das
 * `if (window.OneSignal ...)`) passiert ohne geladenes SDK nichts.
 * Sonst würde eine Zeitänderung in den Settings das SDK hochfahren,
 * obwohl der User Push nie zugestimmt hat.
 *
 * Leere Werte kommen als removeTags(), nicht als addTags(''): Das
 * Web-SDK behandelt '' als Löschen, das native SDK würde den leeren
 * String als Wert schreiben. Für den Server-Filter ist beides
 * gleichwertig — im Dashboard sieht nur so beides identisch aus.
 */
export async function syncNativeTags(tags) {
  if (!initPromise) {
    console.log('[Push] SDK nicht geladen — Tag-Sync übersprungen');
    return;
  }

  try {
    const OneSignal = await initPromise;
    if (!OneSignal) return;

    const toSet = {};
    const toRemove = [];
    for (const [key, value] of Object.entries(tags)) {
      if (value === '') toRemove.push(key);
      else toSet[key] = value;
    }

    if (Object.keys(toSet).length > 0) await OneSignal.User.addTags(toSet);
    if (toRemove.length > 0) await OneSignal.User.removeTags(toRemove);
    console.log('[Push] Native Tags gesetzt:', toSet, 'gelöscht:', toRemove);
  } catch (e) {
    console.warn('[Push] Nativer Tag-Sync fehlgeschlagen:', e);
  }
}
