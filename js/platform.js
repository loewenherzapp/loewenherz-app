// ============================================================
// Löwenherz — Plattform-Detection (Web vs. native Capacitor-App)
// EINZIGE Quelle der Wahrheit: window.Capacitor darf nirgendwo
// sonst im Code abgefragt werden — immer von hier importieren.
// Im Web (PWA, TWA) existiert window.Capacitor nicht → false.
// ============================================================

export function isNative() {
  return window.Capacitor?.isNativePlatform?.() === true;
}
