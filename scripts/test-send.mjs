// Testet api/send-notifications.js mit einer OneSignal-Attrappe.
//
//   npm run test:send
//
// Warum es diesen Test gibt: Der Versand ist die eine Stelle, an der ein
// Fehler unsichtbar bleibt — niemand merkt, dass eine Erinnerung NICHT
// kam. Genau so blieb das Tag-Limit monatelang unentdeckt. Geprüft wird
// deshalb nicht „läuft durch", sondern: Bekommt exakt der richtige Kreis
// die Sendung, mit dem richtigen Ton, und heilt der Altbestand?
//
// Die Datei wird als .mjs importiert, weil das Repo kein "type":"module"
// hat — dieselbe Technik wie test-schedule.mjs.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../api/send-notifications.js');
const dir = mkdtempSync(join(tmpdir(), 'send-'));
const mirror = join(dir, 'send.mjs');
writeFileSync(mirror, readFileSync(SRC, 'utf8'));
const MOD = await import(mirror);
const handler = MOD.default;

let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('FAIL  ' + msg); } };

process.env.ONESIGNAL_API_KEY = 'test-key';
process.env.CRON_SECRET = 'test-secret';
const AUTH = { authorization: 'Bearer test-secret' };

// --- Attrappe: sammelt Sendungen und Tag-Schreibvorgänge ---
function mock(players) {
  const sends = [], puts = [];
  globalThis.fetch = async (url, opts = {}) => {
    if (url.includes('/players?')) {
      const offset = Number(new URL(url).searchParams.get('offset'));
      // Wie die echte API: jedes Gerät trägt notification_types (1 = abonniert).
      const seite = players.map((p) => ({ notification_types: 1, ...p }));
      return { ok: true, json: async () => ({ players: offset === 0 ? seite : [] }) };
    }
    if (url.includes('/notifications')) {
      const b = JSON.parse(opts.body);
      sends.push(b);
      if (b.contents && b.contents.en === undefined) {
        return { ok: false, status: 400, json: async () => ({ errors: ['contents required'] }) };
      }
      return { ok: true, json: async () => ({ id: 'x', recipients: b.include_subscription_ids.length }) };
    }
    // PUT /players/<id> — das Tag-Limit der echten API nachbilden:
    // mehr als 3 Keys in einem Request werden komplett abgewiesen.
    const b = JSON.parse(opts.body);
    const id = url.split('/players/')[1];
    puts.push({ id, tags: b.tags });
    if (Object.keys(b.tags).length > 3) {
      return { json: async () => ({ success: false, errors: ['App is limited to a maximum of 3 tags on a given player'] }) };
    }
    return { json: async () => ({ success: true }) };
  };
  return { sends, puts };
}

async function run(players, headers = AUTH) {
  const m = mock(players);
  let payload = null, status = 200;
  const res = { status(c) { status = c; return this; }, json(p) { payload = p; return this; } };
  await handler({ method: 'GET', headers }, res);
  return { ...m, payload, status };
}

// --- 0) Zugang: fail-closed und nur mit exaktem Secret ---
{
  const ohne = await run([{ id: 'A', tags: { sched: 'v1;m=0000;e=0000;s=' } }], {});
  check(ohne.status === 401 && ohne.sends.length === 0, 'ohne Bearer → 401, nichts gesendet');
  const falsch = await run([], { authorization: 'Bearer test-secret-x' });
  check(falsch.status === 401, 'falsches Secret → 401');
  const nurPrefix = await run([], { authorization: 'Bearer test' });
  check(nurPrefix.status === 401, 'Teil-Secret → 401');
  delete process.env.CRON_SECRET;
  const leer = await run([{ id: 'A', tags: { sched: 'v1;m=0000;e=0000;s=' } }], {});
  check(leer.status === 500 && leer.sends.length === 0,
    'ohne CRON_SECRET in der Umgebung → 500 statt offen (fail-closed)');
  process.env.CRON_SECRET = 'test-secret';
}

// Aktueller Slot in derselben Rechnung wie der Server.
const now = new Date();
const SLOT = `${String(now.getUTCHours()).padStart(2, '0')}${String(Math.floor(now.getUTCMinutes() / 15) * 15).padStart(2, '0')}`;
const ANDERER = SLOT === '0300' ? '0400' : '0300';

// Termine, die garantiert NICHT der aktuelle Slot sind. Feste Literale
// (früher 0500/1830/1345) machten diesen Test zweimal täglich für je eine
// Viertelstunde rot: Läuft er um 18:30 UTC, ist 1830 der aktuelle Slot —
// dann lösen die Testgeräte zusätzlich über ihren Abendtermin aus und es
// kommen doppelt so viele Sendungen heraus wie erwartet.
const versetzt = (viertelstunden) => {
  const min = (Number(SLOT.slice(0, 2)) * 60 + Number(SLOT.slice(2)) + viertelstunden * 15) % 1440;
  return String(Math.floor(min / 60)).padStart(2, '0') + String(min % 60).padStart(2, '0');
};
const MORGENS = versetzt(20);   // +5 h
const ABENDS  = versetzt(52);   // +13 h
const SMALL2  = versetzt(33);   // +8¼ h
const mitDoppelpunkt = (s) => s.slice(0, 2) + ':' + s.slice(2);

// --- 1) Format-Parsing ---
const p = MOD.parseSched('v1;m=0500;e=1830;s=0530,0930,1000;t=ton-2');
check(p.morning === '0500' && p.evening === '1830', 'parseSched: Morgen/Abend');
check(p.smalls.join(',') === '0530,0930,1000', 'parseSched: SMALL-Liste');
check(p.sound === 'ton-2', 'parseSched: Ton');
check(MOD.parseSched('v2;m=0500') === null, 'parseSched: unbekannte Version → null (nicht raten)');
check(MOD.parseSched('') === null && MOD.parseSched(null) === null, 'parseSched: Müll → null');
check(MOD.parseSched('v1;m=0500;e=1830;s=').smalls.length === 0, 'parseSched: leere SMALL-Liste erlaubt');
check(MOD.parseSched('v1;s=0507,0530').smalls.join(',') === '0530', 'parseSched: krumme Zeit fliegt raus');
check(MOD.parseSched('v1;m=0500').sound === 'ton-4', 'parseSched: fehlender Ton → Standard');
check(MOD.parseSched('v1;t=quatsch').sound === 'ton-4', 'parseSched: unbekannter Ton → Standard');
check(MOD.parseSched('v1;m=0500').origin === 'a', 'parseSched: ohne Herkunft → app.angstdoc.de');
check(MOD.parseSched('v1;m=0500;o=v').origin === 'v', 'parseSched: o=v → vercel.app');
check(MOD.parseSched('v1;m=0500;o=x').origin === 'a', 'parseSched: unbekannte Herkunft → app.angstdoc.de');

// --- 2) Zielt der Versand exakt? ---
{
  const players = [
    { id: 'A', tags: { sched: `v1;m=${SLOT};e=${ABENDS};s=` } },              // Morgen jetzt
    { id: 'B', tags: { sched: `v1;m=${MORGENS};e=${ABENDS};s=${ANDERER},${SLOT}` } }, // SMALL jetzt
    { id: 'C', tags: { sched: `v1;m=${MORGENS};e=${SLOT};s=` } },              // Abend jetzt
    { id: 'D', tags: { sched: `v1;m=${MORGENS};e=${ABENDS};s=${ANDERER}` } },       // gar nicht
    { id: 'E', tags: {} },                                               // ohne Zeitplan
    { id: 'F', tags: { sched: '' } }                                     // Push aus
  ];
  const { sends } = await run(players);
  const ids = (typ) => sends.filter(s => s.headings.en === typ)
    .flatMap(s => s.include_subscription_ids).sort().join('');
  check(ids('Löwenherz').includes('A'), 'A bekommt die Morgen-Sendung');
  check(ids('Löwenherz').includes('C'), 'C bekommt die Abend-Sendung');
  check(ids('SMALL-Reminder') === 'B', 'nur B bekommt den SMALL-Reminder');
  const alle = sends.flatMap(s => s.include_subscription_ids);
  check(!alle.includes('D') && !alle.includes('E') && !alle.includes('F'),
    'D/E/F bekommen NICHTS — genau hier lag der alte Bug');
  check(sends.every(s => s.ttl === 900 && s.web_url && !s.url), 'ttl + web_url unverändert');
  check(sends.every(s => s.web_url.startsWith('https://app.angstdoc.de/')),
    'ohne Herkunfts-Marker zeigt der Tap auf app.angstdoc.de');
  check(sends.every(s => s.chrome_web_icon.startsWith('https://app.angstdoc.de/')), 'Icon von app.angstdoc.de');
}

// --- 2b) Herkunft: vercel.app-Geräte bekommen ihre eigene Sendung und URL ---
{
  const players = [
    { id: 'NEU', tags: { sched: `v1;m=${SLOT};e=${ABENDS};s=` } },
    { id: 'ALT', tags: { sched: `v1;m=${SLOT};e=${ABENDS};s=;o=v` } }
  ];
  const { sends } = await run(players);
  check(sends.length === 2, `zwei Sendungen (eine je Herkunft) — waren ${sends.length}`);
  const neu = sends.find(s => s.include_subscription_ids.includes('NEU'));
  const alt = sends.find(s => s.include_subscription_ids.includes('ALT'));
  check(neu && neu.web_url === 'https://app.angstdoc.de/?tab=reflexion', 'NEU → app.angstdoc.de');
  check(alt && alt.web_url === 'https://loewenherz-app.vercel.app/?tab=reflexion',
    'ALT (o=v) → vercel.app, dort liegen seine Daten');
}

// --- 3) Keine Sendung ohne Empfänger ---
{
  const { sends, payload } = await run([{ id: 'A', tags: { sched: `v1;m=${ANDERER};e=${ANDERER};s=` } }]);
  check(sends.length === 0, 'niemand dran → kein einziger API-Call');
  check(payload.calls === 0, 'Report meldet 0 Calls');
}

// --- 4) Ton-Gruppierung: ein Call pro Ton, richtige Datei ---
{
  const players = [
    { id: 'A', tags: { sched: `v1;m=${MORGENS};e=${ABENDS};s=${SLOT}` } },            // Standard
    { id: 'B', tags: { sched: `v1;m=${MORGENS};e=${ABENDS};s=${SLOT};t=ton-4` } },    // explizit Standard
    { id: 'C', tags: { sched: `v1;m=${MORGENS};e=${ABENDS};s=${SLOT};t=ton-2` } },
    { id: 'D', tags: { sched: `v1;m=${MORGENS};e=${ABENDS};s=${SLOT};t=system` } },
    { id: 'E', tags: { sched: `v1;m=${MORGENS};e=${ABENDS};s=${SLOT};t=ton-6` } }
  ];
  const { sends } = await run(players);
  check(sends.length === 4, `4 Sendungen (Standard, ton-2, system, ton-6) — waren ${sends.length}`);
  // Wer nie gewählt hat, bekommt den Löwen — das ist der Sinn der
  // Voreinstellung, und genau das bricht, wenn Client und Server beim
  // DEFAULT_SOUND auseinanderlaufen.
  const std = sends.find(s => s.ios_sound === 'lh-ton-4.caf');
  check(std && std.include_subscription_ids.sort().join('') === 'AB',
    'A (ohne Wahl) und B (explizit ton-4) teilen die Standard-Sendung');
  check(sends.find(s => s.ios_sound === 'lh-ton-2.caf').include_subscription_ids[0] === 'C',
    'C bekommt lh-ton-2.caf');
  check(sends.find(s => s.ios_sound === 'lh-ton-6.caf').include_subscription_ids[0] === 'E',
    'E bekommt lh-ton-6.caf — ein neuer Ton kostet genau eine eigene Sendung');
  const sys = sends.find(s => s.ios_sound === 'default');
  check(sys && sys.include_subscription_ids[0] === 'D',
    'system → ios_sound "default" (Feld weglassen hieße laut Doku: stumm)');
  check(sends.every(s => /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(s.idempotency_key)),
    'jede Sendung trägt einen idempotency_key als UUID v5');
  check(new Set(sends.map(s => s.idempotency_key)).size === sends.length,
    'Schlüssel unterscheiden sich je Gruppe');
}

// --- 4b) Idempotenz: zwei Läufe im selben Slot → identische Schlüssel ---
{
  const players = [{ id: 'A', tags: { sched: `v1;m=${SLOT};e=${ABENDS};s=` } }];
  const erster = await run(players);
  const zweiter = await run(players);
  check(erster.sends[0].idempotency_key === zweiter.sends[0].idempotency_key,
    'gleicher Slot + gleiche Gruppe → gleicher idempotency_key (OneSignal verwirft die Wiederholung)');
  check(MOD.idempotenzSchluessel('a') !== MOD.idempotenzSchluessel('b'), 'verschiedene Texte → verschiedene Schlüssel');
}

// --- 5) Altbestand: wird bedient UND migriert ---
{
  const alt = {
    morning_utc: mitDoppelpunkt(MORGENS), evening_utc: mitDoppelpunkt(ABENDS), sound: 'ton-2',
    small_1_utc: mitDoppelpunkt(SLOT), small_2_utc: mitDoppelpunkt(SMALL2)
  };
  const { sends, puts, payload } = await run([{ id: 'OLD', tags: alt }]);
  check(sends.some(s => s.include_subscription_ids.includes('OLD')),
    'Altbestand bekommt seine Erinnerung weiter');
  check(sends.find(s => s.include_subscription_ids.includes('OLD')).ios_sound === 'lh-ton-2.caf',
    'Ton aus dem Altbestand bleibt erhalten');

  // Reihenfolge und Häppchen prüfen — beides ist zwingend, sonst weist
  // die echte API ab.
  check(puts.every(p => Object.keys(p.tags).length <= 3), 'jeder PUT hat höchstens 3 Keys');
  const letzter = puts[puts.length - 1];
  check('sched' in letzter.tags, 'sched wird ZULETZT gesetzt (Limit zählt pro Gerät)');
  check(puts.slice(0, -1).every(p => Object.values(p.tags).every(v => v === '')),
    'vorher werden ausschließlich alte Keys geleert');
  const geleert = puts.slice(0, -1).flatMap(p => Object.keys(p.tags)).sort().join(',');
  check(geleert === 'evening_utc,morning_utc,small_1_utc,small_2_utc,sound',
    `genau die vorhandenen Alt-Keys werden geleert (war: ${geleert})`);
  check(letzter.tags.sched === `v1;m=${MORGENS};e=${ABENDS};s=${SLOT},${SMALL2};t=ton-2`,
    `migrierter Wert stimmt (war: ${letzter.tags.sched})`);
  check(payload.migrations[0].ok === true, 'Migration als erfolgreich gemeldet');
}

// --- 6) Bereits migrierte Geräte werden nicht erneut angefasst ---
{
  const { puts } = await run([{ id: 'NEW', tags: { sched: `v1;m=${SLOT};e=${ABENDS};s=` } }]);
  check(puts.length === 0, 'kein Schreibvorgang bei bereits migrierten Geräten');
}

// --- 6b) sched UND Alt-Keys nebeneinander: Alt-Keys werden geräumt, sched bleibt ---
{
  const tags = { sched: `v1;m=${SLOT};e=${ABENDS};s=`, morning_utc: mitDoppelpunkt(MORGENS), evening_utc: mitDoppelpunkt(ABENDS) };
  const { sends, puts, payload } = await run([{ id: 'MIX', tags }]);
  check(sends.flatMap(s => s.include_subscription_ids).join('') === 'MIX', 'Plan kommt aus sched, nicht aus den Alt-Keys');
  check(puts.length === 1 && Object.keys(puts[0].tags).sort().join(',') === 'evening_utc,morning_utc'
    && Object.values(puts[0].tags).every(v => v === ''), 'genau ein PUT, der nur die Alt-Keys leert');
  check(!puts.some(p => 'sched' in p.tags), 'sched wird NICHT neu geschrieben (Client-Stand bleibt)');
  check(payload.migrations[0].ok === true && payload.migrations[0].cleared === 2, 'Räumung gemeldet');
}

// --- 6c) Lösch-Reihenfolge: SMALL-Slots zuerst, Morgen/Abend/Ton zuletzt ---
{
  const alt = { morning_utc: mitDoppelpunkt(MORGENS), evening_utc: mitDoppelpunkt(ABENDS), sound: 'ton-2',
    small_1_utc: mitDoppelpunkt(SLOT), small_2_utc: mitDoppelpunkt(SMALL2), small_3_utc: mitDoppelpunkt(SMALL2) };
  const { puts } = await run([{ id: 'ALT6', tags: alt }]);
  check(Object.keys(puts[0].tags).every(k => k.startsWith('small_')),
    'erstes Häppchen leert nur SMALL-Slots — ein Teilabbruch lässt Morgen/Abend stehen');
}

// --- 6d) Migrations-Deckel: höchstens 5 Geräte pro Lauf, Rest gemeldet ---
{
  const viele = Array.from({ length: 7 }, (_, i) => ({ id: `ALT${i}`, tags: { morning_utc: mitDoppelpunkt(MORGENS) } }));
  const { payload } = await run(viele);
  check(payload.migrations.length === 5 && payload.migrations_pending === 2,
    `5 migriert, 2 offen gemeldet (waren ${payload.migrations.length}/${payload.migrations_pending})`);
  check(payload.migrations.every(m => m.id.length <= 8), 'Antwort trägt nur gekürzte IDs');
}

// --- 6e) HTTP-Fehler der Notifications-API wird als Fehler gemeldet, nicht als Erfolg ---
{
  const alt = globalThis.fetch;
  const m = mock([{ id: 'A', tags: { sched: `v1;m=${SLOT};e=${ABENDS};s=` } }]);
  const innen = globalThis.fetch;
  globalThis.fetch = async (url, opts) => url.includes('/notifications')
    ? { ok: false, status: 429, json: async () => ({ errors: ['rate limited'] }) }
    : innen(url, opts);
  let payload = null;
  await handler({ method: 'GET', headers: AUTH }, { status() { return this; }, json(p) { payload = p; return this; } });
  check(payload.results.length === 1 && payload.results[0].error && !payload.results[0].sent,
    'HTTP 429 → result.error statt sent:true');
  globalThis.fetch = alt;
}

// --- 7) Abgemeldete und ungültige Geräte fliegen raus ---
{
  const players = [
    { id: 'OK',   tags: { sched: `v1;m=${SLOT};e=${ABENDS};s=` } },
    { id: 'DEAD', tags: { sched: `v1;m=${SLOT};e=${ABENDS};s=` }, invalid_identifier: true },
    { id: 'OFF',  tags: { sched: `v1;m=${SLOT};e=${ABENDS};s=` }, notification_types: -2 },
    { id: 'NOPERM', tags: { sched: `v1;m=${SLOT};e=${ABENDS};s=` }, notification_types: 0 },
    { id: 'ERR',  tags: { sched: `v1;m=${SLOT};e=${ABENDS};s=` }, notification_types: -31 }
  ];
  const { sends } = await run(players);
  const alle = sends.flatMap(s => s.include_subscription_ids);
  check(alle.join('') === 'OK', `nur abonnierte Geräte (notification_types 1) werden adressiert (waren: ${alle.join(',')})`);
}

console.log(fails === 0 ? 'Alle Tests bestanden.' : `\n${fails} FEHLER`);
process.exit(fails === 0 ? 0 : 1);
