// Testet api/set-tags.js und api/subscribe.js mit Attrappen — ohne Netz.
//
//   npm run test:api
//
// Warum: Beide Endpunkte sind ohne Login erreichbar. Geprüft wird, dass
// nichts Ungeprüftes in die OneSignal-URL oder zu Brevo läuft, dass ein
// Bot (Honeypot) und eine Schleife (Rate-Limit) abprallen, und dass
// gültige Tag-Werte aus buildTags() weiterhin durchkommen.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'api-'));
async function load(name) {
  const mirror = join(dir, name + '.mjs');
  writeFileSync(mirror, readFileSync(resolve(here, '../api/' + name + '.js'), 'utf8'));
  return (await import(mirror)).default;
}
const setTags = await load('set-tags');
const subscribe = await load('subscribe');

let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('FAIL  ' + msg); } };

function call(handler, { method = 'POST', body, headers = {} } = {}) {
  let status = 200, payload = null;
  const res = {
    status(c) { status = c; return this; },
    json(p) { payload = p; return this; },
    end() { return this; },
    setHeader() {}
  };
  return handler({ method, body, headers, socket: { remoteAddress: '10.0.0.1' } }, res)
    .then(() => ({ status, payload }));
}

// ---------------- set-tags ----------------
process.env.ONESIGNAL_API_KEY = 'test-key';
const puts = [];
globalThis.fetch = async (url, opts = {}) => {
  puts.push({ url, body: JSON.parse(opts.body) });
  return { ok: true, status: 200, json: async () => ({ success: true }) };
};
const ID = '0f7b8f3e-2d5a-4c1b-9a6e-3d2f1e0c9b8a';

{
  const r = await call(setTags, { body: { player_id: '../apps/x', tags: { sched: '' } } });
  check(r.status === 400 && puts.length === 0, 'Pfad-Injection in player_id → 400, kein Upstream-Call');
  const r2 = await call(setTags, { body: 'kein-objekt' });
  check(r2.status === 400, 'Nicht-Objekt-Body → 400 statt Absturz');
  const r3 = await call(setTags, { body: { player_id: ID, tags: { sched: 'v1;m=05:00;e=1830;s=' } } });
  check(r3.status === 400, 'Zeit mit Doppelpunkt → 400');
  const r4 = await call(setTags, { body: { player_id: ID, tags: { sched: 'v1;m=0500;e=1830;s=;x=1' } } });
  check(r4.status === 400, 'unbekannter Schlüssel → 400');
  const r5 = await call(setTags, { body: { player_id: ID, tags: { sched: 'v1;m=0500', extra: '1' } } });
  check(r5.status === 400, 'unvollständiger Plan → 400');
  check(puts.length === 0, 'bis hierher kein einziger Upstream-Call');
}
{
  // Alles, was buildTags() erzeugen kann, muss durchkommen.
  const gueltig = [
    '',                                                    // Push aus
    'v1;m=0500;e=1830;s=',                                 // keine SMALL-Zeiten
    'v1;m=0500;e=1830;s=0530,0930,1000',                   // Standard
    'v1;m=0500;e=1830;s=0530,0930,1000,1100,1200,1300,1400,1500,1600,1700', // 10 Slots
    'v1;m=0500;e=1830;s=0530;t=ton-2',                     // Ton (nativ)
    'v1;m=0500;e=1830;s=0530;t=system',                    // Systemton
    'v1;m=0500;e=1830;s=0530;o=v',                         // alte Domain (Web)
    'v1;m=0500;e=1830;s=;t=ton-6;o=a'
  ];
  for (const sched of gueltig) {
    const r = await call(setTags, { body: { player_id: ID.toUpperCase(), tags: { sched, morning_utc: '05:00' } } });
    check(r.status === 200 && r.payload.success === true, `gültig: "${sched}" → 200`);
    check(!('onesignal_response' in r.payload) && !('tags_set' in r.payload), 'Antwort verrät keine Upstream-Details');
  }
  check(puts.length === gueltig.length, 'ein PUT je gültigem Aufruf');
  check(puts.every(p => Object.keys(p.body.tags).join('') === 'sched'), 'nur sched geht zu OneSignal — nie ein zweiter Key');
  check(puts.every(p => p.url.endsWith('/players/' + ID.toUpperCase())), 'URL trägt exakt die geprüfte ID');
}

// ---------------- subscribe ----------------
process.env.API_APP_Brevo = 'k'; process.env.LIST_APP_Brevo = '4'; process.env.TEMPLATE_APP_Brevo = '7';
const brevo = [];
globalThis.fetch = async (url, opts = {}) => { brevo.push(JSON.parse(opts.body)); return { status: 201, text: async () => '{}' }; };
{
  const bot = await call(subscribe, { body: { email: 'bot@example.com', website: 'http://spam' } });
  check(bot.status === 200 && bot.payload.success === true && brevo.length === 0,
    'Honeypot gefüllt → still 200, Brevo unangetastet');
  const mensch = await call(subscribe, { body: { email: 'mensch@example.com', website: '' } });
  check(mensch.status === 200 && brevo.length === 1 && brevo[0].email === 'mensch@example.com', 'leeres Honeypot-Feld → normale Anmeldung');
  const ohneFeld = await call(subscribe, { body: { email: 'alt@example.com' } });
  check(ohneFeld.status === 200 && brevo.length === 2, 'alter Client ohne Feld → weiterhin erlaubt');
}
{
  // Rate-Limit: 5 pro 10 Minuten je IP — die sechste Anfrage prallt ab
  const ip = { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' };
  const antworten = [];
  for (let i = 0; i < 6; i++) antworten.push(await call(subscribe, { body: { email: `n${i}@example.com` }, headers: ip }));
  check(antworten.slice(0, 5).every(a => a.status === 200), 'die ersten 5 Anfragen derselben IP gehen durch');
  const letzte = antworten[5];
  check(letzte.status === 429 && letzte.payload.success === false, '6. Anfrage derselben IP in 10 min → 429');
  const vorher = brevo.length;
  await call(subscribe, { body: { email: 'n9@example.com' }, headers: ip });
  check(brevo.length === vorher, 'gedrosselte Anfragen erreichen Brevo nicht');
  const andere = await call(subscribe, { body: { email: 'x@example.com' }, headers: { 'x-forwarded-for': '198.51.100.7' } });
  check(andere.status === 200, 'andere IP ist nicht betroffen');
}

console.log(fails === 0 ? 'Alle Tests bestanden.' : `\n${fails} FEHLER`);
process.exit(fails === 0 ? 0 : 1);
