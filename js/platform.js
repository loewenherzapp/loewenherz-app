// ============================================================
// Löwenherz — Plattform-Detection (Web vs. native Capacitor-App)
// EINZIGE Quelle der Wahrheit: window.Capacitor darf nirgendwo
// sonst im Code abgefragt werden — immer von hier importieren.
// Im Web (PWA, TWA) existiert window.Capacitor nicht → false.
// ============================================================

export function isNative() {
  return window.Capacitor?.isNativePlatform?.() === true;
}

/**
 * Native Android-App (Capacitor). Für das Wenige, das NUR dort anders ist:
 * Zurück-Taste, Benachrichtigungskanal, Sprung in die Android-Einstellungen.
 * Im Web (PWA, alte TWA) und in der iOS-App false.
 */
export function isAndroid() {
  return isNative() && window.Capacitor?.getPlatform?.() === 'android';
}
