// Prüft, dass das Etikett über einem Spruch zur Figur im Satz passt.
//
//   npm run test:sprecher
//
// Warum es diesen Test gibt: Bis Oktober 2026 stand über jedem Spruch auf
// dem Heute-Bildschirm fest „QUATSCHI" — auch über „Gundula macht
// Gundula-Sachen". Eine Testerin wusste deshalb nicht, wer gerade spricht
// (Rückmeldung 30.10.2026). Geprüft wird: Kein Satz ohne Quatschi steht unter
// „QUATSCHI", kein Satz ohne Gundula unter „GUNDULA", gemischte Sätze gehören
// der zuerst genannten Figur, und ein Vorname wie „Gundula" kippt nichts.
//
// js/ und content/ werden unverändert gespiegelt (mit "type":"module"), weil
// das Repo kein "type":"module" hat — kein Nachbau, der beim Edit divergiert.
import { cpSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = mkdtempSync(join(tmpdir(), 'sprecher-'));
for (const d of ['js', 'content']) cpSync(join(ROOT, d), join(dir, d), { recursive: true });
writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
const Q = await import(join(dir, 'js', 'quatschi.js'));
const { TEXTS } = await import(join(dir, 'content', 'de.js'));
const DB = await import(join(dir, 'js', 'db.js'));

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok    ' : 'FAIL  ') + msg); if (!ok) fails++; };

// 1) Feste Fälle, darunter der Satz aus dem Screenshot der Testerin
const FAELLE = [
  ['Gundula macht Gundula-Sachen. Alles normal, {name}.', 'gundula'],
  ['Quatschi empfiehlt: Lieber absagen. Sicher ist sicher.', 'quatschi'],
  ['Radio Bullshit, Schwerpunkt heute: Weltuntergang oder Versagen?', 'quatschi'], // Quatschis Sender
  ['Kurz rauszoomen, {name}. Was siehst du?', 'impuls'],
  ['Gundula chillt im Schatten. Quatschi ist irritiert.', 'gundula'],
  ['Quatschi hat die Woche gewonnen. Aber Gundula führt im Gesamtklassement.', 'quatschi']
];
for (const [satz, soll] of FAELLE) check(Q.sprecherVon(satz) === soll, `„${satz}" → ${soll}`);

// 2) Alle Sätze, die auf dem Heute-Bildschirm unter dem Etikett stehen können
const pool = [...Object.values(TEXTS.quatschi).flat(), ...Object.values(TEXTS.nudges).flat()];
const arten = new Set(pool.map(Q.sprecherVon));
check(arten.has('quatschi') && arten.has('gundula') && arten.has('impuls'), 'der Pool enthält alle drei Arten (sonst wäre Punkt 2 wertlos)');
let falsch = 0;
for (const satz of pool) {
  const s = Q.sprecherVon(satz);
  const hatQ = /Quatschi|Radio Bullshit/.test(satz);
  const hatG = /Gundula/.test(satz);
  if ((s === 'quatschi' && !hatQ) || (s === 'gundula' && !hatG) || (s === 'impuls' && (hatQ || hatG))) {
    falsch++;
    console.log(`      passt nicht: „${satz}" → ${s}`);
  }
}
check(falsch === 0, `${pool.length} Sätze aus content/de.js: das Etikett passt immer zum Satz`);

// 3) Der Vorname kippt nichts: ohne Punkte kommen Willkommens-Sätze ohne Figur
const origWarn = console.warn; console.warn = () => {};
await DB.initDB(); // ohne IndexedDB: Arbeitsspeicher, keine Punkte
console.warn = origWarn;
for (const name of ['Gundula', 'Quatschi']) {
  const ergebnisse = [];
  for (let i = 0; i < 20; i++) ergebnisse.push(await Q.getDashboardQuatschiText(name));
  check(ergebnisse.every(r => r.sprecher === 'impuls') && ergebnisse.some(r => r.text.includes(name)),
    `Vorname „${name}" eingesetzt, Etikett bleibt Impuls`);
}

console.log(fails ? `${fails} FEHLER` : 'Alle Tests bestanden.');
process.exit(fails ? 1 : 0);
