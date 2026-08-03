// Testet die reinen Funktionen aus js/small-schedule.js.
//
//   npm run test:schedule
//
// Warum es diesen Test gibt, obwohl das Repo sonst keine hat: Der Würfel
// ist die einzige Stelle mit echter Algorithmik, und sein Ergebnis ist
// zufällig — eine kaputte Ziehung sieht beim Durchklicken genauso
// plausibel aus wie eine korrekte. Nur die Invarianten über viele Läufe
// zeigen den Unterschied.
//
// Die Datei wird unverändert als .mjs gespiegelt, weil das Repo kein
// "type":"module" hat — kein Nachbau, der beim nächsten Edit divergiert.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../js/small-schedule.js');
const dir = mkdtempSync(join(tmpdir(), 'sched-'));
const mirror = join(dir, 'small-schedule.mjs');
writeFileSync(mirror, readFileSync(SRC, 'utf8'));
const S = await import(mirror);

let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('FAIL  ' + msg); } };

const toMin = S.toMin;
const GRID = 15, MIN_GAP = 30;
const MORNING = toMin('07:00'), EVENING = toMin('20:30');

// --- 1) Rundreise der Zeit-Helfer ---
for (let m = 0; m < 1440; m++) check(toMin(S.toHHMM(m)) === m, `Rundreise bei ${m}`);
check(toMin('') === null && toMin('25:00') === null && toMin('07:99') === null, 'toMin lehnt Müll ab');

// --- 2) Invarianten über viele Fenster x Anzahlen ---
const FENSTER = [
  ['06:00', '23:00'], ['08:00', '20:00'], ['09:00', '18:00'],
  ['06:00', '12:00'], ['12:00', '14:00'], ['07:00', '08:00'],
  ['00:00', '23:45'], ['21:00', '23:00'],
];

let gezogen = 0;
for (const [s, e] of FENSTER) {
  const sm = toMin(s), em = toMin(e);
  const cap = Math.min(10, S.maxCountFor(sm, em));
  for (let count = 1; count <= 10; count++) {
    for (let run = 0; run < 400; run++) {
      const t = S.drawTimes(sm, em, count, [MORNING, EVENING]);
      const mins = t.map(toMin);
      gezogen++;

      // Erwartete Anzahl: so viele wie ins Fenster passen.
      const erwartet = Math.min(count, cap);
      check(t.length === erwartet,
        `${s}-${e} count=${count}: ${t.length} statt ${erwartet} → ${t.join(' ')}`);

      check(mins.every(m => m >= sm && m <= em), `${s}-${e} count=${count}: außerhalb → ${t.join(' ')}`);
      check(mins.every(m => m % GRID === 0), `${s}-${e} count=${count}: nicht auf Raster → ${t.join(' ')}`);
      check(mins.every((m, i) => i === 0 || m > mins[i - 1]), `${s}-${e} count=${count}: unsortiert/doppelt → ${t.join(' ')}`);
      check(new Set(mins).size === mins.length, `${s}-${e} count=${count}: Dopplung → ${t.join(' ')}`);

      // Mindestabstand — nur einfordern, wo das Fenster ihn hergibt.
      if (erwartet > 1 && (em - sm) >= (erwartet - 1) * MIN_GAP) {
        check(mins.every((m, i) => i === 0 || m - mins[i - 1] >= MIN_GAP),
          `${s}-${e} count=${count}: Abstand < 30min → ${t.join(' ')}`);
      }
    }
  }
}

// --- 3) Kollision mit Morgen-/Abendzeit im Standardfenster ---
for (let run = 0; run < 3000; run++) {
  const t = S.drawTimes(toMin('06:00'), toMin('23:00'), 10, [MORNING, EVENING]).map(toMin);
  check(!t.includes(MORNING) && !t.includes(EVENING), `Kollision mit fester Zeit: ${t.map(S.toHHMM).join(' ')}`);
}

// --- 4) Streuung: bei count=5 muss über viele Würfe jeder Block belegt werden ---
//     Fiele das durch, lägen alle Impulse in einer Tageshälfte.
const treffer = [0, 0, 0, 0, 0];
const sm = toMin('06:00'), em = toMin('23:00'), block = (em - sm) / 5;
for (let run = 0; run < 2000; run++) {
  for (const t of S.drawTimes(sm, em, 5, [])) {
    treffer[Math.min(4, Math.floor((toMin(t) - sm) / block))]++;
  }
}
check(treffer.every(n => n > 1500), `Streuung ungleich: ${treffer.join(' / ')}`);

// --- 5) Zufall ist echt: zwei Würfe dürfen nicht ständig gleich sein ---
const proben = new Set();
for (let run = 0; run < 200; run++) proben.add(S.drawTimes(sm, em, 5, []).join(','));
check(proben.size > 150, `zu wenig Variation: nur ${proben.size} verschiedene von 200`);

// --- 6) Randfälle, die nicht krachen dürfen ---
check(S.drawTimes(sm, em, 0, []).length === 0, 'count=0 → leer');
check(S.drawTimes(em, sm, 5, []).length === 0, 'Ende vor Start → leer');
check(S.drawTimes(sm, sm, 3, []).length === 1, 'Nullfenster → genau einer');
check(S.maxCountFor(toMin('12:00'), toMin('14:00')) === 5, 'maxCountFor 12–14 Uhr = 5');
check(S.maxCountFor(toMin('06:00'), toMin('23:00')) === 35, 'maxCountFor 06–23 Uhr = 35');

console.log(`\n${gezogen} Ziehungen geprüft.`);
console.log(`Streuung über die fünf Tagesblöcke: ${treffer.join(' / ')}`);
console.log(fails === 0 ? 'Alle Tests bestanden.' : `\n${fails} FEHLER`);
process.exit(fails === 0 ? 0 : 1);
