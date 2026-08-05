// ============================================================
// Löwenherz — Haptik (nur native iOS-App)
// ============================================================
//
// Genau drei semantische Stellen rufen diese Utility — nicht mehr:
//   1. Reflexion abgeschlossen  (Morgenkompass + Abendreflexion) → Impact Light
//   2. SMALL-Punkt gesetzt      (Dashboard-Sheet)                → Selection-Tick
//   3. Meilenstein-Toast        (app.js)                         → Notification Success
// Keine Haptik bei Navigation, Tab-Wechsel, Scrollen oder Modal-Öffnen.
//
// Der Settings-Toggle wird HIER geprüft — die Aufrufstellen kennen ihn
// nicht. Im Web ist alles ein No-op und wirft nie; die bestehenden
// navigator.vibrate()-Aufrufe (Android/Web) bleiben unberührt.
// ============================================================

import { isNative } from './platform.js';
import { nativePlugin } from './native-plugins.js';

const TOGGLE_KEY = 'loewenherz_haptics_enabled';

/** Toggle-Zustand; fehlender Key gilt als AN (Muster wie push_enabled). */
export function hapticsEnabled() {
  return localStorage.getItem(TOGGLE_KEY) !== 'false';
}

export function setHapticsEnabled(on) {
  localStorage.setItem(TOGGLE_KEY, on ? 'true' : 'false');
}

function fire(run) {
  try {
    if (!isNative() || !hapticsEnabled()) return;
    nativePlugin('Haptics')
      .then((h) => { if (h) return run(h); })
      .catch(() => {});
  } catch (e) {
    // Haptik darf nie den Hauptflow stören.
  }
}

/**
 * SMALL-Punkt gesetzt — das dezenteste Feedback, das iOS anbietet
 * (die Rasterung der Picker-Räder).
 * selectionChanged() allein ist im Plugin ein stiller No-op: Der
 * UISelectionFeedbackGenerator existiert erst nach selectionStart()
 * (Haptics.swift, geprüft). Deshalb die volle Sequenz für einen Tick.
 */
export function hapticSelection() {
  fire(async (h) => {
    await h.selectionStart();
    await h.selectionChanged();
    await h.selectionEnd();
  });
}

/** Reflexion abgeschlossen — sanftester Impact. Nie Medium/Heavy. */
export function hapticSaved() {
  fire((h) => h.impact({ style: 'LIGHT' }));
}

/** Meilenstein-Toast — Belohnungsmoment, bewusst spürbarer. */
export function hapticMilestone() {
  fire((h) => h.notification({ type: 'SUCCESS' }));
}
