// ============================================================
// Löwenherz — iOS-Bundle-Build (Capacitor webDir)
// Kopiert die Client-App nach www/ (Allowlist, kein Build-Step).
// Bewusst NICHT im Bundle: sw.js + OneSignalSDKWorker.js (nativ
// gibt es keinen Service Worker — fehlende Datei schlägt laut
// fehl statt einen Geister-SW zu installieren), api/, docs/,
// .well-known/, install/confirmed/datenschutz/preview-HTML.
//
// Zusätzlich: js/vendor/ (siehe unten) — die einzigen Dateien im
// Bundle, die NICHT aus dem Repo stammen. Nur nativ, nie im Web.
// Details: docs/ios-capacitor-notes.md
// ============================================================

import { cp, mkdir, rm, stat, readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const WEB_DIR = join(ROOT, 'www');
const VENDOR_DIR = join(WEB_DIR, 'js', 'vendor');

// Nur was die Client-App wirklich braucht.
const ALLOWLIST = ['index.html', 'manifest.json', 'css', 'js', 'content', 'assets'];

// Dateien, die im fertigen Bundle NIE auftauchen dürfen.
const FORBIDDEN = ['sw.js', 'OneSignalSDKWorker.js', 'api', 'ios', '.well-known', 'install.html'];

async function exists(path) {
  try { await stat(path); return true; } catch { return false; }
}

async function countFiles(dir) {
  let n = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) n += await countFiles(join(dir, entry.name));
    else n++;
  }
  return n;
}

// 1) Quellen prüfen — fehlt etwas (z. B. nach Umbenennung), laut abbrechen.
for (const entry of ALLOWLIST) {
  if (!(await exists(join(ROOT, entry)))) {
    console.error(`[build-ios] FEHLER: Quelle fehlt: ${entry}`);
    process.exit(1);
  }
}

// 2) www/ frisch aufbauen (keine veralteten Dateien).
await rm(WEB_DIR, { recursive: true, force: true });
await mkdir(WEB_DIR);

// 3) Allowlist kopieren.
for (const entry of ALLOWLIST) {
  await cp(join(ROOT, entry), join(WEB_DIR, entry), {
    recursive: true,
    filter: (src) => !src.endsWith('.DS_Store')
  });
}

// 4) Vendor-Dateien für das native OneSignal-SDK erzeugen.
//
// Warum überhaupt: Die App hat keinen Bundler. Ein Capacitor-Plugin
// braucht aber `registerPlugin` aus @capacitor/core — der native
// Bridge-Inject (native-bridge.js) liefert nur isNativePlatform/Plugins,
// NICHT registerPlugin. Also werden beide Pakete als fertiges ESM ins
// Bundle kopiert. @capacitor/core ist self-contained; das OneSignal-Dist
// hat genau EINEN Bare-Import, der auf den Nachbarn umgebogen wird.
//
// Diese Dateien liegen NUR in www/ — nicht im Repo, nicht auf Vercel,
// nicht im SW-Precache. Der Web-Pfad lädt sie nie (der dynamische Import
// steckt hinter dem isNative()-Zweig in js/push-native.js).
const CAPACITOR_CORE_SRC = join(ROOT, 'node_modules', '@capacitor', 'core', 'dist', 'index.js');
const ONESIGNAL_SRC = join(ROOT, 'node_modules', '@onesignal', 'capacitor-plugin', 'dist', 'index.js');
const BARE_IMPORT = 'from "@capacitor/core"';

for (const src of [CAPACITOR_CORE_SRC, ONESIGNAL_SRC]) {
  if (!(await exists(src))) {
    console.error(`[build-ios] FEHLER: Vendor-Quelle fehlt: ${src}\n            → npm install ausführen.`);
    process.exit(1);
  }
}

await mkdir(VENDOR_DIR, { recursive: true });

// @capacitor/core: unverändert übernehmen (keine Bare-Imports).
const capacitorCore = await readFile(CAPACITOR_CORE_SRC, 'utf8');
if (capacitorCore.includes('from "@')) {
  console.error('[build-ios] FEHLER: @capacitor/core hat unerwartete Bare-Imports — Vendor-Schritt anpassen.');
  process.exit(1);
}
await writeFile(join(VENDOR_DIR, 'capacitor-core.js'), capacitorCore);

// OneSignal: den einen Bare-Import auf die Nachbardatei umbiegen.
// Trifft der Replace nicht exakt einmal, ist das Dist umgebaut worden
// → laut abbrechen statt still ein kaputtes Bundle auszuliefern.
const oneSignal = await readFile(ONESIGNAL_SRC, 'utf8');
const occurrences = oneSignal.split(BARE_IMPORT).length - 1;
if (occurrences !== 1) {
  console.error(`[build-ios] FEHLER: ${BARE_IMPORT} kommt ${occurrences}× im OneSignal-Dist vor (erwartet: 1).`);
  process.exit(1);
}
await writeFile(
  join(VENDOR_DIR, 'onesignal.js'),
  oneSignal.replace(BARE_IMPORT, 'from "./capacitor-core.js"')
);

// 5) Bundle-Asserts.
if (!(await exists(join(WEB_DIR, 'index.html')))) {
  console.error('[build-ios] FEHLER: www/index.html fehlt nach dem Kopieren.');
  process.exit(1);
}
for (const entry of FORBIDDEN) {
  if (await exists(join(WEB_DIR, entry))) {
    console.error(`[build-ios] FEHLER: ${entry} darf nicht im Bundle liegen.`);
    process.exit(1);
  }
}
// Kein unaufgelöster Bare-Import im Bundle — der WKWebView kann ihn nicht laden.
for (const file of ['capacitor-core.js', 'onesignal.js']) {
  if ((await readFile(join(VENDOR_DIR, file), 'utf8')).includes('from "@')) {
    console.error(`[build-ios] FEHLER: js/vendor/${file} enthält noch einen Bare-Import.`);
    process.exit(1);
  }
}

console.log(`[build-ios] OK — ${await countFiles(WEB_DIR)} Dateien in www/ (inkl. js/vendor/)`);
