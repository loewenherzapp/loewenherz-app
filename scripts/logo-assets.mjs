// ============================================================
// Löwenherz — alle Logo-Bitmaps aus der Designer-Vektordatei erzeugen
// ============================================================
//
//   node scripts/logo-assets.mjs [--store <ordner>]
//
// Quelle: scripts/logo/loewenherz-logo-rund.svg (Hauptlogo rund, Viktoria
// Sabo, November 2026, passend zum Buchumschlag). Die Datei besteht aus
// einem gemalten Hintergrund (eingebettetes JPEG, auf einen Kreis
// beschnitten) und dem goldenen Löwen als Vektor (Verlauf #bb7b3a–#e4ac62).
// Das Gesicht des Löwen ist Aussparung: Dort scheint der Hintergrund durch.
// Hintergrund und Löwe werden deshalb immer GEMEINSAM skaliert, sonst
// verrutscht der helle Fleck hinter dem Gesicht.
//
// Erzeugt werden alle Bitmaps für Web-App, Android, iOS und (mit --store)
// die Store-Grafiken. Nie von Hand nachbearbeiten, sondern dieses Skript
// erneut laufen lassen. Ersetzt scripts/android-assets.swift (Petrol-Icon).
//
// Drei Formen, je nach Ort:
//   rund      Originallogo, Ecken transparent: Web-Icons „any", Favicon,
//             Logo in der App, Benachrichtigungsbild, rundes Launcher-Icon,
//             Splash.
//   quadrat   Hintergrund randlos, Löwe auf 85 %: App-Icon iOS, Play-Store-
//             Icon, apple-touch-icon, maskable Web-Icon, Launcher-Icon
//             Android 7. Die Stores und Systeme runden selbst ab; ein Kreis
//             im abgerundeten Quadrat sähe doppelt aus.
//   vordergrund  Hintergrund randlos, Logo auf 2/3: Vordergrund des Adaptive
//             Icons (108 dp). Der sichtbare Kreis (72 dp) zeigt damit genau
//             das runde Logo, eckigere Masken zeigen mehr Hintergrund.
//
// Gerendert wird mit Chrome headless (auf dem Mac vorhanden, keine
// Installation nötig), mit eigenem Profilordner — Patricks laufendes Chrome
// bleibt unberührt. Alphakanal entfernt für Icons, die keinen haben dürfen
// (App-Store-Icon), per sips.
// ============================================================

import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = join(ROOT, 'scripts', 'logo', 'loewenherz-logo-rund.svg');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CREME = '#F7EAD8';           // Seitenhintergrund der App (css/styles.css, colors.xml)

function fail(msg) { console.error('[logo-assets] FEHLER: ' + msg); process.exit(1); }
if (!existsSync(SRC)) fail('Quelle fehlt: ' + SRC);
if (!existsSync(CHROME)) fail('Chrome nicht gefunden: ' + CHROME);

const storeIdx = process.argv.indexOf('--store');
const STORE_DIR = storeIdx > 0 ? process.argv[storeIdx + 1] : null;

// ---------- Quelle zerlegen ----------
const svgSrc = readFileSync(SRC, 'utf8');
const viewBox = svgSrc.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
if (!viewBox || viewBox[1] !== viewBox[2]) fail('viewBox nicht quadratisch');
const V = Number(viewBox[1]);
const C = V / 2;
const gradient = svgSrc.match(/<linearGradient[\s\S]*?<\/linearGradient>/)?.[0];
const clipRect = svgSrc.match(/<clipPath[\s\S]*?<rect([^>]*)\/>[\s\S]*?<\/clipPath>/)?.[1];
const image = svgSrc.match(/<image[\s\S]*?\/>/)?.[0];
const paths = svgSrc.match(/<path[^>]*\/>/g) || [];
if (!gradient || !clipRect || !image || paths.length !== 3) fail('Aufbau der SVG unerwartet (Verlauf, Kreis, Bild, 3 Pfade)');
const gradId = gradient.match(/id="([^"]+)"/)[1];

// Klassen der Illustrator-Datei in feste Füllungen übersetzen
function loewe(fill) {
  return paths.map((p) => {
    const cls = p.match(/class="(\w+)"/)?.[1];
    const original = cls === 'st2' ? `url(#${gradId})` : '#e4ac62';
    return p.replace(/class="\w+"/, `fill="${fill || original}"`);
  }).join('');
}
const kreis = `<clipPath id="kreis"><rect${clipRect.replace(/class="\w+"/, '')}/></clipPath>`;

/**
 * SVG einer Variante. scale: Logo (Hintergrund + Löwe gemeinsam) um die
 * Mitte skaliert. bg=false: nur der Löwe. rund: auf den Kreis beschnitten.
 */
function variante({ size, scale = 1, bg = true, rund = false, fill = null, viewBoxOverride = null }) {
  const t = `translate(${C} ${C}) scale(${scale}) translate(${-C} ${-C})`;
  const inhalt = `<g transform="${t}">${bg ? image : ''}${loewe(fill)}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"`
    + ` width="${size}" height="${size}" viewBox="${viewBoxOverride || `0 0 ${V} ${V}`}" style="display:block">`
    + `<defs>${gradient}${rund ? kreis : ''}</defs>`
    + (rund ? `<g clip-path="url(#kreis)">${inhalt}</g>` : inhalt)
    + `</svg>`;
}

// ---------- Rendern ----------
const TMP = mkdtempSync(join(tmpdir(), 'logo-assets-'));
const PROFIL = join(TMP, 'chrome-profil');
let n = 0;

function render(html, w, h, out, { alpha = true } = {}) {
  const page = join(TMP, `seite-${n++}.html`);
  writeFileSync(page, `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;width:${w}px;height:${h}px;overflow:hidden;background:transparent}
  </style></head><body>${html}</body></html>`);
  const png = join(TMP, `bild-${n}.png`);
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--force-device-scale-factor=1', `--window-size=${w},${h}`,
    '--default-background-color=00000000', `--user-data-dir=${PROFIL}`,
    `--screenshot=${png}`, pathToFileURL(page).href
  ], { stdio: 'ignore' });
  if (!existsSync(png)) fail('Chrome hat kein Bild erzeugt: ' + out);
  mkdirSync(dirname(out), { recursive: true });
  if (alpha) {
    copyFileSync(png, out);
  } else {
    // Alphakanal entfernen (App Store lehnt Icons mit Alphakanal ab):
    // über ein verlustfreies BMP zurück nach PNG.
    const bmp = join(TMP, `bild-${n}.bmp`);
    execFileSync('sips', ['-s', 'format', 'bmp', png, '--out', bmp], { stdio: 'ignore' });
    execFileSync('sips', ['-s', 'format', 'png', bmp, '--out', out], { stdio: 'ignore' });
  }
  const groesse = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', '-g', 'hasAlpha', out]).toString();
  const [, bw] = groesse.match(/pixelWidth: (\d+)/); const [, bh] = groesse.match(/pixelHeight: (\d+)/);
  const hatAlpha = /hasAlpha: yes/.test(groesse);
  if (Number(bw) !== w || Number(bh) !== h) fail(`Größe falsch: ${out} ${bw}×${bh} statt ${w}×${h}`);
  if (!alpha && hatAlpha) fail('Alphakanal nicht entfernt: ' + out);
  console.log(`  ${out.replace(ROOT + '/', '')}  ${w}×${h}${hatAlpha ? '' : ' (ohne Alpha)'}`);
}

const icon = (form, size, out, opts) => {
  const v = {
    rund: { scale: 1, rund: true },
    quadrat: { scale: 0.85 },
    vordergrund: { scale: 2 / 3 }
  }[form];
  render(variante({ size, ...v }), size, size, out, opts);
};

/** Logo rund mit Durchmesser d mittig auf Creme (Splash). */
function splash(w, h, d, out) {
  render(`<div style="width:${w}px;height:${h}px;background:${CREME};display:flex;align-items:center;justify-content:center">`
    + variante({ size: d, scale: 1, rund: true }) + `</div>`, w, h, out, { alpha: false });
}

/** Weiße Löwen-Silhouette, auf den Löwen zugeschnitten, mit Rand. */
function silhouette(px, rand, out) {
  // Begrenzungsrahmen per getBBox im Browser bestimmen und die viewBox
  // darauf setzen — so füllt der Löwe die Fläche bis auf den Rand.
  const svg = variante({ size: px - 2 * rand, bg: false, fill: '#ffffff' });
  render(`<div style="padding:${rand}px">${svg}</div><script>
    const s=document.querySelector('svg'); const b=s.querySelector('g').getBBox();
    const m=Math.max(b.width,b.height); s.setAttribute('viewBox',
      [b.x-(m-b.width)/2, b.y-(m-b.height)/2, m, m].join(' '));
  </script>`, px, px, out);
}

const dichten = [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]];
const RES = join(ROOT, 'android', 'app', 'src', 'main', 'res');

console.log('[logo-assets] Web-App');
icon('quadrat', 180, join(ROOT, 'assets/icons/icon-180.png'), { alpha: false });   // apple-touch-icon
icon('rund', 192, join(ROOT, 'assets/icons/icon-192.png'));                         // Manifest „any", Favicon, Web-Push
icon('rund', 512, join(ROOT, 'assets/icons/icon-512.png'));                         // Manifest „any"
icon('quadrat', 512, join(ROOT, 'assets/icons/icon-512-maskable.png'), { alpha: false }); // Löwe liegt in der 80-%-Schutzzone
icon('rund', 288, join(ROOT, 'assets/icons/logo-288.png'));                         // Logo in der App (96 px × 3)

console.log('[logo-assets] Android');
for (const [name, d] of dichten) {
  icon('quadrat', 48 * d, join(RES, `mipmap-${name}/ic_launcher.png`), { alpha: false });   // Android 7
  icon('rund', 48 * d, join(RES, `mipmap-${name}/ic_launcher_round.png`));                   // API 25 rund
  icon('vordergrund', 108 * d, join(RES, `mipmap-${name}/ic_launcher_foreground.png`), { alpha: false });
  silhouette(24 * d, d, join(RES, `drawable-${name}/ic_stat_onesignal_default.png`));        // Statusleiste: nur Alpha zählt
  // Splash des SplashScreen-Plugins: Hochformat 360×800 dp, Logo 160 dp —
  // so groß wie der Kreis des Android-12-Systemsplashs direkt davor.
  splash(360 * d, 800 * d, 160 * d, join(RES, `drawable-port-${name}/splash.png`));
}
icon('rund', 256, join(RES, 'drawable-xxxhdpi/ic_onesignal_large_icon_default.png'));      // Bild rechts in der Benachrichtigung
splash(1200, 1200, 480, join(RES, 'drawable/splash.png'));                                  // Fallback (160 dp × 3)

console.log('[logo-assets] iOS');
icon('quadrat', 1024, join(ROOT, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'), { alpha: false });

if (STORE_DIR) {
  console.log('[logo-assets] Store-Grafiken');
  icon('quadrat', 512, join(STORE_DIR, 'play-icon-512.png'), { alpha: false });
  // Titelbild Google Play (1024×500): gemalter Hintergrund des Logos in
  // Originalgröße, oberer Ausschnitt — der helle Fleck in der Bildmitte
  // (im Logo hinter dem Gesicht) liegt so außerhalb. Wortmarke wie in der
  // App (Instrument Serif, Petrol), Löwe rechts.
  const bg = image.match(/xlink:href="([^"]+)"/)[1];
  const font = (f) => pathToFileURL(join(ROOT, 'assets/fonts', f)).href;
  const svgLoewe = variante({ size: 360, bg: false });
  render(`<style>
      @font-face{font-family:'Instrument Serif';src:url('${font('instrument-serif-regular-latin.woff2')}') format('woff2'),url('${font('instrument-serif-regular-latin-ext.woff2')}') format('woff2')}
      @font-face{font-family:'DM Sans';src:url('${font('dm-sans-latin.woff2')}') format('woff2'),url('${font('dm-sans-latin-ext.woff2')}') format('woff2')}
      .g{width:1024px;height:500px;position:relative;background:url('${bg}') -176px -40px/1376px 1391px no-repeat}
      .t{position:absolute;left:84px;top:150px;font-family:'Instrument Serif',serif;color:#39828b;font-size:112px;line-height:1;letter-spacing:-1px}
      .u{position:absolute;left:90px;top:282px;font-family:'Instrument Serif',serif;color:#8a6a45;font-size:40px;line-height:1}
      .l{position:absolute;right:92px;top:70px}
    </style><div class="g"><div class="t">Löwenherz</div><div class="u">Die App zum Buch</div><div class="l">${svgLoewe}</div></div>`,
    1024, 500, join(STORE_DIR, 'play-feature-1024x500.png'), { alpha: false });
}

rmSync(TMP, { recursive: true, force: true });
console.log('[logo-assets] OK');
