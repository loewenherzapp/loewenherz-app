// ============================================================
// Löwenherz — iOS-Bundle-Build (Capacitor webDir)
// Kopiert die Client-App nach www/ (Allowlist, kein Build-Step).
// Bewusst NICHT im Bundle: sw.js + OneSignalSDKWorker.js (nativ
// gibt es keinen Service Worker — fehlende Datei schlägt laut
// fehl statt einen Geister-SW zu installieren), api/, docs/,
// .well-known/, install/confirmed/datenschutz/preview-HTML.
// Details: docs/ios-capacitor-notes.md
// ============================================================

import { cp, mkdir, rm, stat, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const WEB_DIR = join(ROOT, 'www');

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

// 4) Bundle-Asserts.
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

console.log(`[build-ios] OK — ${await countFiles(WEB_DIR)} Dateien in www/`);
