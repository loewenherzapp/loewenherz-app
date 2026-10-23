// ============================================================
// Löwenherz — Push nativ (iOS + Android, @onesignal/capacitor-plugin)
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
//
// Android-Besonderheit: Seit Android 8 bestimmt der Benachrichtigungs-
// KANAL den Ton, nicht die Nachricht — und der Ton eines Kanals ist nach
// dem Anlegen unveränderlich. Deshalb trägt die Kanal-ID den Ton
// („lh-ton-4", „lh-system"), und ensureAndroidChannel() legt vor jedem
// Tag-Sync den Kanal zum gewählten Ton an (das native Plugin räumt den
// alten weg). Der Server schickt existing_android_channel_id mit
// derselben Konvention (api/send-notifications.js). Fehlt der Kanal
// auf dem Gerät, fällt das SDK auf seinen Standardkanal zurück.
// ============================================================

import { ONESIGNAL_APP_ID } from './config.js';
import { isAndroid } from './platform.js';
import { nativePlugin } from './native-plugins.js';
import { getSound } from './notification-sound.js';

// Das SDK selbst liegt nur im iOS-Bundle (www/js/vendor/, erzeugt von
// scripts/build-www.mjs). Im Web existiert der Pfad nicht — deshalb
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

/**
 * Android: Kanal zum gewählten Ton anlegen (idempotent, Android-only;
 * iOS/Web: No-op). Läuft vor dem SDK-Init und vor jedem Tag-Sync, damit
 * der Kanal existiert, bevor der Server ihn adressiert. Wirft nie.
 * Konvention Kanal-ID = 'lh-' + Ton-Kennung aus notification-sound.js;
 * Ton-Datei = raw-Ressource 'lh_ton_N' (android/app/src/main/res/raw/).
 */
export async function ensureAndroidChannel() {
  if (!isAndroid()) return;
  try {
    const kanal = await nativePlugin('Erinnerungskanal');
    if (!kanal) return;
    const ton = getSound();   // 'ton-4' … 'ton-6', 'ton-1' … 'ton-3' oder 'system'
    await kanal.setzen({
      id: 'lh-' + ton,
      name: 'Erinnerungen',
      beschreibung: 'Morgenkompass, Abendreflexion, SMALL-Reminder',
      ton: ton === 'system' ? '' : 'lh_' + ton.replace('-', '_')
    });
  } catch (e) {
    console.warn('[Push] Benachrichtigungskanal nicht gesetzt:', e);
  }
}

async function refreshPermissionState(OneSignal) {
  try {
    // iOS: 0–4 (s. o.). Android: das Plugin liefert nur 1 (keine Erlaubnis)
    // oder 2 (erlaubt). „Keine Erlaubnis" heißt dort aber zweierlei: nie
    // gefragt (Android 13+ vor dem Dialog — der Normalfall nach dem Umzug
    // aus der TWA per Backup) oder wirklich verweigert. canRequestPermission()
    // trennt das: Darf noch gefragt werden, ist es 'default', sonst 'denied'.
    // Ohne diese Unterscheidung stünde nach dem Backup-Import „blockiert" in
    // den Einstellungen, obwohl nie jemand Nein gesagt hat.
    const native = await OneSignal.Notifications.permissionNative();
    permissionState = PERMISSION_BY_NATIVE_VALUE[native] || 'default';
    if (isAndroid() && permissionState === 'denied') {
      const darfFragen = await OneSignal.Notifications.canRequestPermission();
      if (darfFragen) permissionState = 'default';
    }
  } catch (e) {
    // permissionNative() nicht verfügbar — Fallback auf den Boolean.
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
    // Android: Kanal VOR dem Init, denn mit dem Init entsteht das Abo und
    // die erste Erinnerung kann Minuten später kommen.
    await ensureAndroidChannel();
    await OneSignal.initialize(ONESIGNAL_APP_ID);

    // Standort hart aus. Die App braucht ihn nirgends. Seit Version 1.0.1
    // wird OneSignalLocation.framework gar nicht mehr mitgebaut
    // (ONESIGNAL_DISABLE_LOCATION=true, siehe docs/app-store-connect.md,
    // ITMS-90683) — der Aufruf bleibt als zweite Sicherung für Builds, die
    // das Modul doch enthalten. Er steht bewusst im try/catch und ohne
    // await: Fehlt das Modul und die Brücke wirft, darf das NIE die
    // Push-Initialisierung abbrechen (sonst gäbe es gar keine Erinnerungen).
    try {
      OneSignal.Location.setShared(false);
    } catch (e) {
      console.log('[Push] Location-Modul nicht vorhanden — nichts abzuschalten');
    }

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

    // Nur Diagnose: Abo-ID und Opt-in-Status im Log (Gerätetest, Logcat /
    // Xcode-Konsole). Keine Verarbeitung.
    try {
      OneSignal.User.pushSubscription.addEventListener('change', (event) => {
        const jetzt = event && event.current;
        console.log('[Push] Abo geändert:', jetzt && jetzt.id, 'optedIn:', jetzt && jetzt.optedIn);
      });
    } catch (e) {
      // Diagnose darf den Init nie stören
    }

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
 * Zeigt den System-Dialog (Apple bzw. Android 13+ „Zulassen?"). Nur nach
 * Zustimmung im Soft-Ask aufrufen. `false` = kein automatischer Sprung in
 * die System-Einstellungen (V1). Android vor 13 hat keinen Dialog: Die
 * Erlaubnis gilt als erteilt, requestPermission() liefert sofort true.
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
 * Schreibt den Zeitplan über das native SDK.
 * @param tags Fertiges Objekt aus buildTags() in js/push.js — seit dem
 *             Umbau auf das `sched`-Format genau EIN Schlüssel. Mehr wären
 *             fatal: Der OneSignal-Plan erlaubt 3 Tags pro Gerät und weist
 *             einen Request mit zu vielen Keys komplett ab.
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

    // Android: Kanal zum (ggf. gerade gewechselten) Ton anlegen, BEVOR der
    // Tag mit der Ton-Kennung rausgeht — sonst zielt der Server auf einen
    // Kanal, den es noch nicht gibt.
    await ensureAndroidChannel();

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
