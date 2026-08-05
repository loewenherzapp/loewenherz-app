// ============================================================
// Löwenherz — Externe Links (nur native iOS-App)
// ============================================================
//
// In der WebView-App darf kein externer Link IN der WebView aufgehen —
// es gäbe keinen Zurück-Weg. Ein zentraler, delegierter Klick-Listener
// statt Link-für-Link-Behandlung:
//
//   http(s)  → SFSafariViewController (@capacitor/browser) mit Done-Button
//   tel:     → Systemwähler   (WKWebView/Capacitor nativ, nicht angefasst)
//   mailto:  → Mail-App       (dito)
//   #        → App-interne Handler (E-Mail-Datenschutz-Links), nicht angefasst
//
// Delegation auf document-Ebene erfasst auch per innerHTML eingefügte
// Links (Impressum/Datenschutz-Modal, Krisen-Modal, Settings).
// Im Web passiert hier NICHTS — target="_blank" bleibt wie es ist.
// ============================================================

import { isNative } from './platform.js';
import { nativePlugin } from './native-plugins.js';

export function initExternalLinks() {
  if (!isNative()) return;

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    if (!/^https?:\/\//i.test(href)) return;

    e.preventDefault();
    nativePlugin('Browser')
      .then((browser) => browser && browser.open({ url: href }))
      .catch((err) => console.warn('[Native] Browser.open fehlgeschlagen:', err));
  });
}
