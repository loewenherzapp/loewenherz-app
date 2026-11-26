// Testet die Landing-Seite (js/screens/landing.js) in einem echten Browser.
//
//   npm run test:landing
//
// Warum es diesen Test gibt: Der QR-Code im Buch führt auf diese Seite. Sie
// hat eine Aufgabe — Leser in den passenden Store bringen. Fehlt ein Store,
// zeigt ein Link ins Leere oder rutschen die Knöpfe auf einem kleinen Handy
// unter den sichtbaren Rand, verliert die App Leser, ohne dass es jemand
// merkt. Dazu das Impressum: Es muss von der Seite aus erreichbar sein.
//
// Der Test startet einen eigenen kleinen Dateiserver und Chrome ohne Fenster
// (DevTools-Protokoll, keine Zusatzpakete). Er braucht Google Chrome.
import { createServer } from 'node:http';
import { readFile, rm, mkdtemp } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname, resolve, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!existsSync(CHROME)) { console.error('FEHLER: Google Chrome nicht gefunden: ' + CHROME); process.exit(1); }

// Die Store-Adressen der App (einzige Quelle: js/config.js) …
const config = readFileSync(join(ROOT, 'js', 'config.js'), 'utf8');
const APP_STORE_URL = config.match(/APP_STORE_URL = '([^']+)'/)[1];
const PLAY_STORE_URL = config.match(/PLAY_STORE_URL = '([^']+)'/)[1];

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2'
};
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const file = join(ROOT, path === '/' ? 'index.html' : path);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(data);
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const URL_BASE = `http://127.0.0.1:${server.address().port}/`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (ok, msg, detail = '') => { console.log((ok ? 'ok    ' : 'FAIL  ') + msg + (!ok && detail ? ' — ' + detail : '')); if (!ok) fails++; };

async function pruefe(breite, hoehe) {
  console.log(`\n${breite} × ${hoehe}`);
  const profil = await mkdtemp(join(tmpdir(), 'lh-landing-'));
  const port = 9300 + Math.floor(Math.random() * 600);
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, 'about:blank'], { stdio: 'ignore' });
  try {
    let ziel;
    for (let i = 0; i < 60 && !ziel; i++) {
      await sleep(200);
      try { ziel = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch {}
    }
    if (!ziel) { check(false, 'Chrome startet'); return; }
    const ws = new WebSocket(ziel.webSocketDebuggerUrl);
    await new Promise((r) => (ws.onopen = r));
    let id = 0; const offen = new Map(); const fehler = [];
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && offen.has(m.id)) { offen.get(m.id)(m); offen.delete(m.id); }
      if (m.method === 'Runtime.exceptionThrown') fehler.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') fehler.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
    };
    const send = (method, params = {}) => new Promise((res) => { const i = ++id; offen.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
    const js = async (ausdruck) => {
      const r = await send('Runtime.evaluate', { expression: ausdruck, awaitPromise: true, returnByValue: true });
      if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || ausdruck);
      return r.result?.result?.value;
    };

    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: breite, height: hoehe, deviceScaleFactor: 2, mobile: breite < 700 });
    await send('Page.navigate', { url: URL_BASE });
    for (let i = 0; i < 60; i++) { await sleep(250); if (await js("!!document.querySelector('.landing-page, .onboarding-screen')")) break; }
    await sleep(900);

    // 1) Neue Besucher landen auf der Seite, nicht im Onboarding
    check(await js("!!document.querySelector('.landing-page') && !document.getElementById('landing-container').classList.contains('hidden')"),
      'neue Besucher sehen die Landing');
    if (!(await js("!!document.querySelector('.landing-page')"))) return;
    check(await js("document.documentElement.scrollWidth <= innerWidth"), 'kein waagerechtes Scrollen',
      await js("document.documentElement.scrollWidth + ' > ' + innerWidth"));
    check(await js("document.getElementById('app').getBoundingClientRect().width === innerWidth"), 'die Seite nutzt die ganze Breite');

    // 2) Beide Stores, immer, an zwei Stellen — kein Umschalter mehr
    const gruppen = JSON.parse(await js(`JSON.stringify([...document.querySelectorAll('.landing-stores')].map(g => [...g.querySelectorAll('a')].map(a => {
      const r = a.getBoundingClientRect(); return { href: a.href, target: a.target, w: Math.round(r.width), h: Math.round(r.height) }; })))`));
    check(gruppen.length === 2 && gruppen.every((g) => g.length === 2), 'App Store und Google Play stehen oben und am Schluss');
    for (const [i, g] of gruppen.entries()) {
      const wo = i === 0 ? 'oben' : 'am Schluss';
      if (g.length !== 2) continue;
      check(g[0].href === APP_STORE_URL && g[0].href.includes('id6806331837'), `${wo}: erster Knopf führt in den App Store`, g[0].href);
      check(g[1].href === PLAY_STORE_URL && g[1].href.includes('id=de.angstdoc.loewenherz'), `${wo}: zweiter Knopf führt zu Google Play`, g[1].href);
      check(g[0].w === g[1].w && g[0].h === g[1].h && g[0].h >= 44, `${wo}: beide Knöpfe gleich groß und gut tippbar`, JSON.stringify(g.map((a) => `${a.w}x${a.h}`)));
      check(g.every((a) => a.target === ''), `${wo}: Store-Links öffnen im selben Tab`);
    }
    check(await js("!/Ich nutze (Android|ein iPhone)/.test(document.querySelector('.landing-page').textContent)"), 'kein Umschalter „Ich nutze …“ mehr');

    // 3) Die Store-Knöpfe sind ohne Scrollen zu sehen
    check(await js("[...document.querySelectorAll('.landing-hero .landing-store')].every(a => a.getBoundingClientRect().bottom <= innerHeight)"),
      'beide Knöpfe sind oben ohne Scrollen sichtbar',
      await js("Math.round(document.querySelector('.landing-hero .landing-stores').getBoundingClientRect().bottom) + ' von ' + innerHeight"));

    // 4) Alle Bilder laden (einmal durch die Seite und durch die Screenshot-Reihe)
    await js(`(async () => { const h = document.documentElement.scrollHeight;
      for (let y = 0; y < h; y += 500) { window.scrollTo({ top: y, behavior: 'instant' }); await new Promise(r => setTimeout(r, 120)); }
      document.querySelector('.landing-shots').scrollTo({ left: 9999, behavior: 'instant' }); await new Promise(r => setTimeout(r, 500)); })()`);
    const bilder = JSON.parse(await js("JSON.stringify([...document.querySelectorAll('.landing-page img')].map(i => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0, zuSehen: i.offsetParent !== null })))"));
    const kaputt = bilder.filter((b) => b.zuSehen && !b.ok).map((b) => b.src);
    check(kaputt.length === 0, 'alle sichtbaren Bilder laden', kaputt.join(', '));
    check(await js("document.querySelectorAll('.landing-shot').length === 4"), 'vier App-Screenshots');
    if (breite < 900) {
      check(await js("(() => { const r = document.querySelector('.landing-shot:last-child').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; })()"),
        'der letzte Screenshot lässt sich ganz ins Bild wischen');
    }
    const qr = await js("getComputedStyle(document.querySelector('.landing-qr')).display !== 'none'");
    check(breite >= 900 ? qr : !qr, breite >= 900 ? 'QR-Code am Computer sichtbar' : 'QR-Code am Handy ausgeblendet');

    // 5) Häufige Fragen
    await js("document.querySelectorAll('.landing-faq-item summary')[1].click()"); await sleep(200);
    check(await js("document.querySelectorAll('.landing-faq-item')[1].open"), 'eine Frage klappt auf');

    // 6) Impressum und Datenschutz sind von der Seite aus erreichbar
    for (const [key, probe] of [['impressum', 'Der AngstDoc und Kollegen'], ['datenschutz', 'Datenschutz']]) {
      await js(`document.querySelector('[data-legal=${key}]').click()`); await sleep(600);
      check(await js(`!!document.querySelector('.legal-page.active') && document.querySelector('.legal-page .legal-content').textContent.includes('${probe}')`), `${key} öffnet`);
      await js("document.getElementById('legal-back').click()"); await sleep(500);
      check(await js("!document.querySelector('.legal-page')"), `${key} schließt wieder`);
    }

    // 7) Der Weg ohne Store führt ins Onboarding der Web-App
    check(await js("document.querySelectorAll('.landing-browser').length === 2"), 'zwei Wege in den Browser (Fragen und Schluss)');
    await js("document.querySelectorAll('.landing-browser')[1].click()"); await sleep(600);
    check(await js("!document.getElementById('onboarding-container').classList.contains('hidden') && document.getElementById('landing-container').classList.contains('hidden')"),
      '„Löwenherz im Browser nutzen“ führt ins Onboarding');
    check(await js("!document.body.classList.contains('landing-active') && document.getElementById('app').getBoundingClientRect().width <= 480"),
      'danach ist die App-Spalte wieder schmal');
    check(await js("window.scrollY === 0"), 'das Onboarding beginnt oben');

    const echteFehler = fehler.filter((f) => !/_vercel\/insights|Failed to load resource/.test(f));
    check(echteFehler.length === 0, 'keine Fehler in der Konsole', echteFehler.join(' | '));
    ws.close();
  } finally {
    chrome.kill();
    await sleep(300);
    await rm(profil, { recursive: true, force: true }).catch(() => {});
  }
}

// Kleinstes übliches Handy, übliches Handy, Tablet, Computer
for (const [b, h] of [[320, 568], [375, 667], [768, 1024], [1280, 800]]) await pruefe(b, h);

server.close();
console.log(fails ? `\n${fails} FEHLER` : '\nAlle Tests bestanden.');
process.exit(fails ? 1 : 0);
