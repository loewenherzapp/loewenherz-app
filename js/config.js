// ============================================================
// Löwenherz PWA — App-weite Konstanten
// ============================================================

import { isNative } from './platform.js';

// Basis-URL für API-Aufrufe: Im Web origin-relativ (''), in der nativen
// Capacitor-App absolut — capacitor://localhost hat kein Backend.
// CORS für capacitor://localhost ist in api/subscribe.js freigeschaltet.
export const API_BASE = isNative() ? 'https://app.angstdoc.de' : '';

// OneSignal-App-ID — EINE App für alle Plattformen.
// Web-SDK (js/push.js) und natives SDK (js/push-native.js) nutzen dieselbe ID;
// dadurch landen Web- und iOS-Subscriptions im selben OneSignal-Projekt und
// werden vom Server über dieselben Tags erreicht.
// Die Kopien in api/*.js bleiben bewusst separat — Server-Code teilt keine
// Module mit dem Client. Bei einer Änderung: hier UND in api/ nachziehen.
export const ONESIGNAL_APP_ID = '1aeeca68-13c9-400a-a243-dd749527c49f';

// Kanonische Datenschutz-URL der App.
// Diese exakte URL MUSS überall identisch sein:
//   - hier im Code (einzige Quelle der Wahrheit)
//   - in der Google Play Console (Store-Eintrag → Datenschutzerklärung)
//   - öffentlich erreichbar unter dieser Adresse (siehe /datenschutz.html)
// Inhalt der öffentlichen Seite synchron halten mit dem In-App-Modal
// (LEGAL_CONTENT.datenschutz in js/screens/settings.js).
export const PRIVACY_URL = 'https://app.angstdoc.de/datenschutz';
