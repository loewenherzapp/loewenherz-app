// ============================================================
// Löwenherz — Android-Release bauen (App Bundle + APK, signiert)
// ============================================================
//
//   npm run release:android
//
// Baut aus dem Repo das signierte App Bundle (.aab, für die Play Console)
// und das signierte APK (für Emulator/Gerätetest) — mit dem Upload-Key,
// Play App Signing signiert beim Upload um. Alle Fallen aus den TWA-Bauten
// stecken hier drin, damit sie nicht wieder zuschlagen:
//
//   - Capacitor 8 verlangt Java 21 (Homebrew: openjdk@21, keg-only, nicht
//     im PATH) → JAVA_HOME wird gesetzt, kein globales Java nötig.
//   - signing-key-info.txt hat CRLF-Zeilenenden → Passwörter werden von
//     \r\n befreit, sonst meldet der Signer „password was incorrect".
//   - ONESIGNAL_DISABLE_LOCATION=true lässt das Standort-Modul des
//     OneSignal-SDKs weg (wie iOS seit 1.0.1) — keine Standort-Berechtigung
//     im Merged Manifest.
//   - Nach dem Bau wird der Zertifikats-Fingerabdruck geprüft: Weicht er vom
//     Upload-Key ab, lehnt Play das Paket ab (und assetlinks.json passt nicht).
//
// Pfade außerhalb des Repos (Patricks Mac) sind Defaults und per Umgebung
// überschreibbar:
//   LH_KEYSTORE_DIR   Ordner mit signing.keystore + signing-key-info.txt
//   LH_OUT_DIR        Ablage der fertigen Pakete
//   ANDROID_HOME      Android-SDK (Homebrew: android-commandlinetools)
//   JAVA_HOME         JDK 21
// ============================================================

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ANDROID = join(ROOT, 'android');

const KEYSTORE_DIR = process.env.LH_KEYSTORE_DIR || '/Users/Katana/Buch/Löwenherz - Google Play package';
const ANDROID_HOME = process.env.ANDROID_HOME || '/opt/homebrew/share/android-commandlinetools';
const JAVA_HOME = process.env.JAVA_HOME || '/opt/homebrew/opt/openjdk@21';

// Upload-Key dieser App (zweiter Eintrag in .well-known/assetlinks.json).
const UPLOAD_KEY_SHA256 = '8D:94:10:CA:9C:3C:F8:88:65:18:C7:AC:8B:91:72:FA:C2:EE:9B:B7:34:91:7A:4C:D1:AB:15:3B:14:A0:70:71';

function fail(msg) {
  console.error(`[release-android] FEHLER: ${msg}`);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  console.log(`\n[release-android] $ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.status !== 0) fail(`${cmd} endete mit Status ${r.status}`);
}

function capture(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  if (r.status !== 0) fail(`${cmd} ${args[0]}: ${r.stderr || r.stdout}`);
  return r.stdout;
}

// 1) Voraussetzungen
for (const [name, path] of [['JDK 21', join(JAVA_HOME, 'bin', 'java')], ['Android-SDK', join(ANDROID_HOME, 'platform-tools')],
                            ['Keystore', join(KEYSTORE_DIR, 'signing.keystore')], ['Key-Info', join(KEYSTORE_DIR, 'signing-key-info.txt')]]) {
  if (!existsSync(path)) fail(`${name} fehlt: ${path}`);
}
const javaVersion = capture(join(JAVA_HOME, 'bin', 'java'), ['-version']);
// java -version schreibt auf stderr; capture() liefert stdout → separat prüfen
const jv = spawnSync(join(JAVA_HOME, 'bin', 'java'), ['-version'], { encoding: 'utf8' }).stderr;
if (!/version "21\./.test(jv)) fail(`Java 21 erwartet, gefunden: ${jv.split('\n')[0]}`);

// 2) Passwörter lesen — CRLF-Falle: jede Zeile von \r befreien.
const info = readFileSync(join(KEYSTORE_DIR, 'signing-key-info.txt'), 'utf8').split(/\r?\n/);
const wert = (label) => {
  const zeile = info.find((z) => z.toLowerCase().startsWith(label.toLowerCase() + ':'));
  if (!zeile) fail(`"${label}" fehlt in signing-key-info.txt`);
  return zeile.slice(label.length + 1).trim();
};
const storePassword = wert('Key store password');
const keyAlias = wert('Key alias');
const keyPassword = wert('Key password');
if (!storePassword || !keyAlias || !keyPassword) fail('Passwort oder Alias leer');

// 3) versionCode/versionName aus dem Gradle-File — eine Quelle, hier nur gelesen.
const gradle = readFileSync(join(ANDROID, 'app', 'build.gradle'), 'utf8');
const versionCode = Number((gradle.match(/versionCode\s+(\d+)/) || [])[1]);
const versionName = (gradle.match(/versionName\s+"([^"]+)"/) || [])[1];
if (!versionCode || !versionName) fail('versionCode/versionName nicht in android/app/build.gradle gefunden');
const OUT_DIR = process.env.LH_OUT_DIR
  || `/Users/Katana/Buch/Löwenherz - Google Play package v${versionCode} (versionCode ${versionCode})`;

// 4) Web-Bundle + Capacitor-Sync
run('node', [join(ROOT, 'scripts', 'build-www.mjs')]);
run('npx', ['cap', 'sync', 'android'], { cwd: ROOT });

// 5) Gradle: Bundle + APK, signiert
const env = {
  ...process.env,
  JAVA_HOME,
  ANDROID_HOME,
  ANDROID_SDK_ROOT: ANDROID_HOME,
  ONESIGNAL_DISABLE_LOCATION: 'true',
  LH_KEYSTORE_FILE: join(KEYSTORE_DIR, 'signing.keystore'),
  LH_KEYSTORE_PASSWORD: storePassword,
  LH_KEY_ALIAS: keyAlias,
  LH_KEY_PASSWORD: keyPassword
};
run('./gradlew', ['--no-daemon', 'bundleRelease', 'assembleRelease'], { cwd: ANDROID, env });

const aab = join(ANDROID, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');
const apk = join(ANDROID, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
for (const f of [aab, apk]) if (!existsSync(f)) fail(`Ausgabe fehlt: ${f}`);

// 6) Signatur prüfen — APK mit apksigner, Bundle mit keytool.
const buildTools = join(ANDROID_HOME, 'build-tools');
const btVersion = capture('ls', [buildTools]).trim().split('\n').sort().pop();
const apksigner = join(buildTools, btVersion, 'apksigner');
const certs = capture(apksigner, ['verify', '--print-certs', apk], { env });
const apkSha = (certs.match(/SHA-256 digest:\s*([0-9a-f]{64})/i) || [])[1];
const erwartet = UPLOAD_KEY_SHA256.replace(/:/g, '').toLowerCase();
if (apkSha !== erwartet) fail(`APK ist mit dem falschen Schlüssel signiert: ${apkSha}`);
const bundleCert = capture(join(JAVA_HOME, 'bin', 'keytool'), ['-printcert', '-jarfile', aab]);
const aabSha = (bundleCert.match(/SHA256:\s*([0-9A-F:]{95})/) || [])[1];
if (aabSha !== UPLOAD_KEY_SHA256) fail(`Bundle ist mit dem falschen Schlüssel signiert: ${aabSha}`);

// 7) Merged Manifest: keine Werbe-ID, kein Standort (Play-Deklarationen!)
const manifest = readFileSync(join(ANDROID, 'app', 'build', 'intermediates', 'merged_manifests', 'release', 'processReleaseManifest', 'AndroidManifest.xml'), 'utf8');
for (const verboten of ['com.google.android.gms.permission.AD_ID', 'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION']) {
  if (manifest.includes(verboten)) fail(`Merged Manifest enthält ${verboten} — Play-Deklaration „keine Werbe-ID / kein Standort" wäre falsch`);
}
const permissions = [...manifest.matchAll(/uses-permission android:name="([^"]+)"/g)].map((m) => m[1]);

// 8) Ablegen
mkdirSync(OUT_DIR, { recursive: true });
copyFileSync(aab, join(OUT_DIR, `Löwenherz-v${versionCode}.aab`));
copyFileSync(apk, join(OUT_DIR, `Löwenherz-v${versionCode}.apk`));
writeFileSync(join(OUT_DIR, 'build-info.txt'), [
  `Löwenherz Android ${versionName} (versionCode ${versionCode}) — Capacitor-Bau`,
  `Gebaut: ${new Date().toISOString()}`,
  `Signiert mit Upload-Key SHA-256 ${UPLOAD_KEY_SHA256}`,
  `Berechtigungen: ${permissions.join(', ')}`,
  ''
].join('\n'));

console.log(`\n[release-android] OK — ${versionName} (${versionCode})`);
console.log(`  ${join(OUT_DIR, `Löwenherz-v${versionCode}.aab`)}`);
console.log(`  ${join(OUT_DIR, `Löwenherz-v${versionCode}.apk`)}`);
console.log(`  Berechtigungen: ${permissions.join(', ')}`);
