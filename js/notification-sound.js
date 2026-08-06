// ============================================================
// Löwenherz — Benachrichtigungston (Auswahl nur in der iOS-App)
// ============================================================
//
// Der Ton steckt nicht im Gerät, sondern im Push-Payload: Der Server
// (api/send-notifications.js) schreibt den Löwenherz-Standardton in die
// normalen Sammel-Sendungen — Web-Empfänger ignorieren das ios_sound-Feld,
// deshalb braucht der Standard KEINEN Tag. Nur wer abweicht (anderer Ton
// oder iOS-Systemton), bekommt einen `sound`-Tag und eine eigene Sendung.
//
// Die Zuordnung id → .caf-Datei lebt ausschließlich im Server
// (SOUND_VARIANTS in api/send-notifications.js). Die ids hier und dort
// müssen exakt übereinstimmen — eine Abweichung bricht nur den
// betroffenen Ton, aber lautlos.
//
// Web/Android können den Ton nicht steuern (Web-Push hat kein Ton-API,
// Android verwaltet ihn im System) — dort zeigt settings.js statt der
// Auswahl einen Hinweistext. Dieses Modul selbst ist plattformneutral;
// den isNative()-Zweig zieht der Aufrufer.
// ============================================================

const STORAGE_KEY = 'loewenherz_sound';

export const DEFAULT_SOUND = 'ton-1';

// preview: Pfad für das Vorhören in den Einstellungen (liegt über die
// assets-Allowlist von build-ios.mjs auch im nativen Bundle). Der
// iOS-Systemton hat bewusst keine Vorschau — Apple gibt Dritt-Apps
// keinen Zugriff auf die Systemton-Dateien.
export const SOUND_OPTIONS = [
  { id: 'ton-1',  label: 'Gedämpfter Tupfer', preview: 'assets/sounds/lh-ton-1.mp3' },
  { id: 'ton-2',  label: 'Sanfter Impuls',    preview: 'assets/sounds/lh-ton-2.mp3' },
  { id: 'ton-3',  label: 'Sanfter Impuls II', preview: 'assets/sounds/lh-ton-3.mp3' },
  { id: 'system', label: 'iOS-Standardton',   preview: null }
];

/** Gewählter Ton, gegen die bekannten ids validiert — ein kaputter
 *  Speicherwert fällt still auf den Standard zurück. */
export function getSound() {
  const v = localStorage.getItem(STORAGE_KEY);
  return SOUND_OPTIONS.some(o => o.id === v) ? v : DEFAULT_SOUND;
}

export function setSound(id) {
  if (!SOUND_OPTIONS.some(o => o.id === id)) return;
  localStorage.setItem(STORAGE_KEY, id);
}

/** Anzeigename des gewählten Tons (für die Settings-Zeile). */
export function soundLabel() {
  const v = getSound();
  return (SOUND_OPTIONS.find(o => o.id === v) || SOUND_OPTIONS[0]).label;
}

/**
 * Wert für den OneSignal-Tag `sound`. Leerer String = Tag löschen
 * (dasselbe Muster wie die Zeit-Tags in buildTags): Der Standardton
 * braucht keinen Tag, der Server erreicht diese Nutzer über einen
 * not_exists-Filter. So bleibt bei OneSignal nur gespeichert, was
 * vom Standard abweicht — und Bestand ohne Update fällt automatisch
 * in den Standard.
 */
export function soundTagValue() {
  const v = getSound();
  return v === DEFAULT_SOUND ? '' : v;
}
