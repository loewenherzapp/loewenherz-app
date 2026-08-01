// ============================================================
// Löwenherz PWA — App-weite Konstanten
// ============================================================

import { isNative } from './platform.js';

// Basis-URL für API-Aufrufe: Im Web origin-relativ (''), in der nativen
// Capacitor-App absolut — capacitor://localhost hat kein Backend.
// CORS für capacitor://localhost ist in api/subscribe.js freigeschaltet.
export const API_BASE = isNative() ? 'https://app.angstdoc.de' : '';

// Kanonische Datenschutz-URL der App.
// Diese exakte URL MUSS überall identisch sein:
//   - hier im Code (einzige Quelle der Wahrheit)
//   - in der Google Play Console (Store-Eintrag → Datenschutzerklärung)
//   - öffentlich erreichbar unter dieser Adresse (siehe /datenschutz.html)
// Inhalt der öffentlichen Seite synchron halten mit dem In-App-Modal
// (LEGAL_CONTENT.datenschutz in js/screens/settings.js).
export const PRIVACY_URL = 'https://app.angstdoc.de/datenschutz';
