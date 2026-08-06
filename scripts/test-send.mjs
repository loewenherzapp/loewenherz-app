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
delete process.env.CRON_SECRET;

// --- Attrappe: sammelt Sendungen und Tag-Schreibvorgänge ---
function mock(players) {
  const sends = [], puts = [];
  globalThis.fetch = async (url, opts = {}) => {
    if (url.includes('/players?')) {
      const offset = Number(new URL(url).searchParams.get('offset'));
      return { ok: true, json: async () => ({ players: offset === 0 ? players : [] }) };
    }
    if (url.includes('/notifications')) {
      const b = JSON.parse(opts.body);
      sends.push(b);
      return { json: async () => ({ id: 'x', recipients: b.include_subscription_ids.length }) };
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

async function run(players) {
  const m = mock(players);
  let payload = null;
  const res = { status() { return this; }, json(p) { payload = p; return this; } };
  await handler({ method: 'GET', headers: {} }, res);
  return { ...m, payload };
}

// Aktueller Slot in derselben Rechnung wie der Server.
const now = new Date();
const SLOT = `${String(now.getUTCHours()).padStart(2, '0')}${String(Math.floor(now.getUTCMinutes() / 15) * 15).padStart(2, '0')}`;
const ANDERER = SLOT === '0300' ? '0400' : '0300';

// --- 1) Format-Parsing ---
const p = MOD.parseSched('v1;m=0500;e=1830;s=0530,0930,1000;t=ton-2');
check(p.morning === '0500' && p.evening === '1830', 'parseSched: Morgen/Abend');
check(p.smalls.join(',') === '0530,0930,1000', 'parseSched: SMALL-Liste');
check(p.sound === 'ton-2', 'parseSched: Ton');
check(MOD.parseSched('v2;m=0500') === null, 'parseSched: unbekannte Version → null (nicht raten)');
check(MOD.parseSched('') === null && MOD.parseSched(null) === null, 'parseSched: Müll → null');
check(MOD.parseSched('v1;m=0500;e=1830;s=').smalls.length === 0, 'parseSched: leere SMALL-Liste erlaubt');
check(MOD.parseSched('v1;s=0507,0530').smalls.join(',') === '0530', 'parseSched: krumme Zeit fliegt raus');
check(MOD.parseSched('v1;m=0500').sound === 'ton-1', 'parseSched: fehlender Ton → Standard');
check(MOD.parseSched('v1;t=quatsch').sound === 'ton-1', 'parseSched: unbekannter Ton → Standard');

// --- 2) Zielt der Versand exakt? ---
{
  const players = [
    { id: 'A', tags: { sched: `v1;m=${SLOT};e=1830;s=` } },              // Morgen jetzt
    { id: 'B', tags: { sched: `v1;m=0500;e=1830;s=${ANDERER},${SLOT}` } }, // SMALL jetzt
    { id: 'C', tags: { sched: `v1;m=0500;e=${SLOT};s=` } },              // Abend jetzt
    { id: 'D', tags: { sched: `v1;m=0500;e=1830;s=${ANDERER}` } },       // gar nicht
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
    { id: 'A', tags: { sched: `v1;m=0500;e=1830;s=${SLOT}` } },            // Standard
    { id: 'B', tags: { sched: `v1;m=0500;e=1830;s=${SLOT};t=ton-1` } },    // explizit Standard
    { id: 'C', tags: { sched: `v1;m=0500;e=1830;s=${SLOT};t=ton-2` } },
    { id: 'D', tags: { sched: `v1;m=0500;e=1830;s=${SLOT};t=system` } }
  ];
  const { sends } = await run(players);
  check(sends.length === 3, `3 Sendungen (Standard, ton-2, system) — waren ${sends.length}`);
  const std = sends.find(s => s.ios_sound === 'lh-ton-1.caf');
  check(std && std.include_subscription_ids.sort().join('') === 'AB',
    'A und B teilen die Standard-Sendung');
  check(sends.find(s => s.ios_sound === 'lh-ton-2.caf').include_subscription_ids[0] === 'C',
    'C bekommt lh-ton-2.caf');
  const sys = sends.find(s => !('ios_sound' in s));
  check(sys && sys.include_subscription_ids[0] === 'D', 'system → gar kein ios_sound-Feld');
}

// --- 5) Altbestand: wird bedient UND migriert ---
{
  const alt = {
    morning_utc: '05:00', evening_utc: '18:30', sound: 'ton-2',
    small_1_utc: SLOT.slice(0, 2) + ':' + SLOT.slice(2), small_2_utc: '13:45'
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
  check(letzter.tags.sched === `v1;m=0500;e=1830;s=${SLOT},1345;t=ton-2`,
    `migrierter Wert stimmt (war: ${letzter.tags.sched})`);
  check(payload.migrations[0].ok === true, 'Migration als erfolgreich gemeldet');
}

// --- 6) Bereits migrierte Geräte werden nicht erneut angefasst ---
{
  const { puts } = await run([{ id: 'NEW', tags: { sched: `v1;m=${SLOT};e=1830;s=` } }]);
  check(puts.length === 0, 'kein Schreibvorgang bei bereits migrierten Geräten');
}

// --- 7) Abgemeldete und ungültige Geräte fliegen raus ---
{
  const players = [
    { id: 'OK',   tags: { sched: `v1;m=${SLOT};e=1830;s=` } },
    { id: 'DEAD', tags: { sched: `v1;m=${SLOT};e=1830;s=` }, invalid_identifier: true },
    { id: 'OFF',  tags: { sched: `v1;m=${SLOT};e=1830;s=` }, notification_types: -2 }
  ];
  const { sends } = await run(players);
  const alle = sends.flatMap(s => s.include_subscription_ids);
  check(alle.join('') === 'OK', `nur lebende Geräte werden adressiert (waren: ${alle.join(',')})`);
}

console.log(fails === 0 ? 'Alle Tests bestanden.' : `\n${fails} FEHLER`);
process.exit(fails === 0 ? 0 : 1);
