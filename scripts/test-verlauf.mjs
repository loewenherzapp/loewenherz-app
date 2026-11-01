// Testet Datenreihe und Zeichnung der Stimmungskurve „Dein Auf und Ab"
// (js/components/mood-chart.js).
//
//   npm run test:verlauf
//
// Warum es diesen Test gibt: Die Kurve ist für Menschen mit Angst gedacht.
// Ein ausgelassener Abend darf nie wie ein Absturz aussehen (Null-Regel),
// ein einzelner Abend macht noch keinen Trend, und über eine längere Pause
// hinweg darf keine Linie gezogen werden, als wäre dort etwas gemessen
// worden. Einer falschen Kurve sieht man das beim Durchklicken nicht an.
//
// js/ und content/ werden unverändert gespiegelt (mit "type":"module"), weil
// das Repo kein "type":"module" hat. Zeitzone fest, weil der Zeitraum über
// die Zeitumstellung am 25.10.2026 läuft.
process.env.TZ = 'Europe/Berlin';
import { cpSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = mkdtempSync(join(tmpdir(), 'verlauf-'));
for (const d of ['js', 'content']) cpSync(join(ROOT, d), join(dir, d), { recursive: true });
writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
const M = await import(join(dir, 'js', 'components', 'mood-chart.js'));

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok    ' : 'FAIL  ') + msg); if (!ok) fails++; };

const heute = new Date(2026, 9, 30, 9, 0); // Fr 30.10.2026, vormittags
const R = (date, mood) => ({ date, mood });
const P = (date) => ({ date, letter: 'S' });
const tag = (reihe, date) => reihe.find(t => t.date === date);

// 1) Zeitraum, Reihenfolge, Lücken
{
  const reihe = M.stimmungsVerlauf([R('2026-10-20', 'good')], [], heute, 28);
  check(reihe.length === 28 && reihe[0].date === '2026-10-03' && reihe[27].date === '2026-10-30',
    '28 Tage bis heute, ältester zuerst');
  // Abstand als Kalendertage in UTC — der 25.10. hat in Ortszeit 25 Stunden
  const lueckenlos = reihe.every((t, i) => i === 0
    || Date.parse(t.date + 'T00:00:00Z') - Date.parse(reihe[i - 1].date + 'T00:00:00Z') === 86400000);
  check(lueckenlos, 'jeder Kalendertag genau einmal, auch über die Zeitumstellung');
  check(tag(reihe, '2026-10-21').stimmung === null, 'Abend ohne Reflexion = Lücke (null), nie 0');
  check(reihe.every(t => t.stimmung !== 0 && t.trend !== 0), 'nirgends eine 0 in der Reihe');
}

// 2) Stufen aus der Reihenfolge der Reflexions-Stimmungen
{
  const reihe = M.stimmungsVerlauf(
    [R('2026-10-28', 'gibtsnicht'), R('2026-10-29', 'drowned'), R('2026-10-30', 'lion')], [], heute, 28);
  check(tag(reihe, '2026-10-29').stimmung === 1 && tag(reihe, '2026-10-30').stimmung === 5, '🌊 = Stufe 1, 🦁 = Stufe 5');
  check(tag(reihe, '2026-10-28').stimmung === null, 'unbekannte Stimmung = Lücke statt Absturz');
}

// 3) Trend: Mittel im 7-Tage-Fenster, erst ab zwei Abenden
{
  const reihe = M.stimmungsVerlauf([R('2026-10-20', 'good'), R('2026-10-22', 'tough')], [], heute, 28);
  check(tag(reihe, '2026-10-21').trend === 3, 'Trend = Mittel der Abende im Fenster (☀️ und 🌧️ → 🌤️)');
  check(tag(reihe, '2026-10-25').trend === null, 'ein einzelner Abend im Fenster macht noch keinen Trend');
}

// 4) Am linken Rand zählen auch Abende kurz vor dem Zeitraum
{
  const refl = [R('2026-10-01', 'okay'), R('2026-10-02', 'good'), R('2026-10-04', 'good')];
  const kurz = tag(M.stimmungsVerlauf(refl, [], heute, 28), '2026-10-03').trend;
  const lang = tag(M.stimmungsVerlauf(refl, [], heute, 91), '2026-10-03').trend;
  check(kurz !== null && kurz === lang, 'Trend am Rand gleich, ob 4 Wochen oder 3 Monate gezeigt werden');
}

// 5) SMALL-Punkte pro Tag
{
  const reihe = M.stimmungsVerlauf([], [P('2026-10-30'), P('2026-10-30'), P('2026-10-29')], heute, 28);
  check(tag(reihe, '2026-10-30').punkte === 2 && tag(reihe, '2026-10-29').punkte === 1 && tag(reihe, '2026-10-28').punkte === 0,
    'SMALL-Punkte pro Tag gezählt');
}

// 6) Zeichnung: zwei Phasen mit langer Pause dazwischen
{
  const abende = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-24', '2026-10-25', '2026-10-26'];
  const reihe = M.stimmungsVerlauf(abende.map(d => R(d, 'okay')), [P('2026-10-06'), P('2026-10-25')], heute, 28);
  const svg = M.kurvenSvg(reihe, 300, 'Test');
  const zahl = (re) => (svg.match(re) || []).length;
  check(zahl(/class="mood-line"/g) === 2, 'die Linie reißt an der Pause ab (zwei getrennte Strecken)');
  check(zahl(/class="mood-dot"/g) === abende.length, 'ein Kreis pro Abend');
  check(zahl(/class="mood-bar"/g) === 2, 'Säulen nur an Tagen mit Punkten');
  check(!/NaN|undefined/.test(svg) && !/>0</.test(svg), 'kein NaN, nichts Undefiniertes, keine 0 in der Zeichnung');
}

console.log(fails ? `${fails} FEHLER` : 'Alle Tests bestanden.');
process.exit(fails ? 1 : 0);
