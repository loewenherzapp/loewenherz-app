// ============================================================
// Mood Chart — „Dein Auf und Ab" im Verlauf
// Stimmung der Abendreflexionen als ruhige Kurve, darunter die
// SMALL-Punkte als Säulen (Idee einer Testerin, 30.10.2026).
// ============================================================

import { TEXTS } from '../../content/de.js';
import { formatDate } from './week-dots.js';

const T = TEXTS.ui.history.mood;
// Reihenfolge der Reflexions-Stimmungen = Stufe 1 (🌊) bis 5 (🦁)
const MOODS = TEXTS.ui.reflection.moods;
const STUFE = {};
MOODS.forEach((m, i) => { STUFE[m.key] = i + 1; });

const ZEITRAEUME = [
  { tage: 28, label: T.range4w },
  { tage: 91, label: T.range3m }
];
const FENSTER = 3;     // Trend: Mittel über ±3 Tage (7-Tage-Fenster)
const MIN_ABENDE = 2;  // Trend erst ab zwei Abenden im Fenster

/**
 * Tagesreihe für die Kurve, ältester Tag zuerst, `tage` Einträge bis heute.
 * stimmung: 1–5 oder null — ein Abend ohne Reflexion ist eine Lücke, nie 0
 * trend:    Mittel der Abende im 7-Tage-Fenster, null unter zwei Abenden
 * punkte:   SMALL-Punkte des Tages
 */
export function stimmungsVerlauf(reflections, points, heute, tage) {
  const stimmungProTag = new Map();
  reflections.forEach(r => { if (STUFE[r.mood]) stimmungProTag.set(r.date, STUFE[r.mood]); });
  const punkteProTag = new Map();
  points.forEach(p => punkteProTag.set(p.date, (punkteProTag.get(p.date) || 0) + 1));

  // Mittag als Anker: Datumsrechnung unabhängig von der Zeitumstellung.
  // Die Reihe beginnt FENSTER Tage früher, damit der Trend am linken Rand
  // nicht davon abhängt, ob gerade 4 Wochen oder 3 Monate gezeigt werden.
  const basis = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate(), 12);
  const reihe = [];
  for (let i = tage - 1 + FENSTER; i >= 0; i--) {
    const d = new Date(basis);
    d.setDate(basis.getDate() - i);
    const date = formatDate(d);
    reihe.push({ date, stimmung: stimmungProTag.get(date) ?? null, punkte: punkteProTag.get(date) || 0 });
  }
  reihe.forEach((tag, i) => {
    const werte = reihe.slice(Math.max(0, i - FENSTER), i + FENSTER + 1)
      .map(t => t.stimmung)
      .filter(s => s !== null);
    tag.trend = werte.length >= MIN_ABENDE ? werte.reduce((a, b) => a + b, 0) / werte.length : null;
  });
  return reihe.slice(FENSTER);
}

// --- Zeichnen (SVG in echter Pixelbreite, keine Verzerrung der Emojis) ---

const H = 172;
const LINKS = 26, RECHTS = 4;           // links die Emoji-Achse
const PLOT_OBEN = 10, PLOT_H = 106;     // Stimmungsbereich
const SAEULEN_OBEN = PLOT_OBEN + PLOT_H + 16, SAEULEN_H = 22;
const LABEL_Y = H - 4;

function geometrie(n, breite) {
  const schritt = (breite - LINKS - RECHTS) / n;
  return {
    schritt,
    x: i => LINKS + schritt * (i + 0.5),
    y: stufe => PLOT_OBEN + PLOT_H * (MOODS.length - stufe) / (MOODS.length - 1)
  };
}

const r1 = v => Math.round(v * 10) / 10;

function kurzdatum(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
}

// Weiche Linie durch die Mittelpunkte (quadratische Bögen bleiben innerhalb
// ihrer Stützpunkte, schießen also nie über 🦁 oder unter 🌊 hinaus)
function linienPfad(pkte) {
  let d = `M${r1(pkte[0].x)} ${r1(pkte[0].y)}`;
  for (let i = 1; i < pkte.length - 1; i++) {
    const mx = (pkte[i].x + pkte[i + 1].x) / 2;
    const my = (pkte[i].y + pkte[i + 1].y) / 2;
    d += ` Q${r1(pkte[i].x)} ${r1(pkte[i].y)} ${r1(mx)} ${r1(my)}`;
  }
  const letzter = pkte[pkte.length - 1];
  return d + ` L${r1(letzter.x)} ${r1(letzter.y)}`;
}

/** SVG-Markup der Kurve für eine Breite in Pixeln. */
export function kurvenSvg(reihe, breite, ariaLabel) {
  const n = reihe.length;
  const { schritt, x, y } = geometrie(n, breite);
  let svg = `<svg class="mood-svg" viewBox="0 0 ${breite} ${H}" role="img" aria-label="${ariaLabel}">`;

  // Stufen: feine Linien, Emojis als Achse — keine Zahlen
  MOODS.forEach((m, i) => {
    const yy = r1(y(i + 1));
    svg += `<line class="mood-grid" x1="${LINKS}" x2="${breite - RECHTS}" y1="${yy}" y2="${yy}"/>`;
    svg += `<text class="mood-emoji" x="${LINKS / 2 - 1}" y="${yy}">${m.emoji}</text>`;
  });

  // SMALL-Punkte als Säulen — an Tagen ohne Punkte steht keine
  const bezug = Math.max(8, ...reihe.map(t => t.punkte));
  const sb = Math.max(1.5, schritt * 0.55);
  reihe.forEach((t, i) => {
    if (t.punkte <= 0) return;
    const h = Math.max(2, (t.punkte / bezug) * SAEULEN_H);
    svg += `<rect class="mood-bar" x="${r1(x(i) - sb / 2)}" y="${r1(SAEULEN_OBEN + SAEULEN_H - h)}" width="${r1(sb)}" height="${r1(h)}" rx="${r1(Math.min(1.5, sb / 2))}"/>`;
  });

  // Trend: je zusammenhängender Strecke ein Pfad — an Pausen reißt die Linie ab
  let strecke = [];
  const schliessen = () => {
    if (strecke.length >= 2) svg += `<path class="mood-line" d="${linienPfad(strecke)}"/>`;
    strecke = [];
  };
  reihe.forEach((t, i) => {
    if (t.trend === null) schliessen();
    else strecke.push({ x: x(i), y: y(t.trend) });
  });
  schliessen();

  // Abende als Kreise
  const r = schritt >= 6 ? 3.5 : 2.2;
  reihe.forEach((t, i) => {
    if (t.stimmung === null) return;
    svg += `<circle class="mood-dot" cx="${r1(x(i))}" cy="${r1(y(t.stimmung))}" r="${r}"/>`;
  });

  // Datumsmarken: wöchentlich (4 Wochen) bzw. monatlich (3 Monate), rechts „heute"
  const abstand = n <= 31 ? 7 : 30;
  for (let i = 0; i < n - abstand / 2; i += abstand) {
    const anker = i === 0 ? 'start' : 'middle';
    const xx = i === 0 ? LINKS : r1(x(i));
    svg += `<text class="mood-date" x="${xx}" y="${LABEL_Y}" text-anchor="${anker}">${kurzdatum(reihe[i].date)}</text>`;
  }
  svg += `<text class="mood-date" x="${breite - RECHTS}" y="${LABEL_Y}" text-anchor="end">${T.today}</text>`;

  return svg + `</svg>`;
}

/**
 * Rendert die Karte „Dein Auf und Ab" in `container`. Ohne Abendreflexion
 * in den letzten 3 Monaten entfernt sich die Karte selbst.
 * onDayTap(dateStr): Tipp auf einen Tag (nächster Tag mit Daten).
 */
export function renderMoodChart(container, { reflections, points, onDayTap }) {
  const heute = new Date();
  const laengster = ZEITRAEUME[ZEITRAEUME.length - 1].tage;
  if (!stimmungsVerlauf(reflections, [], heute, laengster).some(t => t.stimmung !== null)) {
    container.remove();
    return;
  }

  let tage = ZEITRAEUME[0].tage;

  const zeichnen = () => {
    const zeitraum = ZEITRAEUME.find(z => z.tage === tage);
    const reihe = stimmungsVerlauf(reflections, points, heute, tage);
    const abende = reihe.filter(t => t.stimmung !== null).length;

    let html = `<div class="history-week-header-row">`;
    html += `<div class="history-week-header mood-title">${T.title}</div>`;
    html += `<div class="mood-range">`;
    ZEITRAEUME.forEach(z => {
      const aktiv = z.tage === tage;
      html += `<button class="mood-range-btn${aktiv ? ' active' : ''}" data-tage="${z.tage}" aria-pressed="${aktiv}">${z.label}</button>`;
    });
    html += `</div></div>`;

    if (abende < MIN_ABENDE) {
      html += `<div class="mood-empty">${T.empty}</div>`;
    } else {
      html += `<div class="mood-plot"></div>`;
      html += `<div class="mood-legend">`;
      html += `<span class="mood-legend-item"><span class="mood-key mood-key-dot"></span>${T.legendDots}</span>`;
      html += `<span class="mood-legend-item"><span class="mood-key mood-key-line"></span>${T.legendLine}</span>`;
      html += `<span class="mood-legend-item"><span class="mood-key mood-key-bar"></span>${T.legendBars}</span>`;
      html += `</div>`;
    }
    container.innerHTML = html;

    const plot = container.querySelector('.mood-plot');
    if (plot) {
      const breite = Math.round(plot.clientWidth) || 300;
      plot.innerHTML = kurvenSvg(reihe, breite, T.aria.replace('{zeitraum}', zeitraum.label));
      const svg = plot.querySelector('svg');
      const { schritt } = geometrie(reihe.length, breite);
      svg.addEventListener('click', (e) => {
        const rect = svg.getBoundingClientRect();
        const sx = (e.clientX - rect.left) * (breite / rect.width);
        const i = Math.round((sx - LINKS) / schritt - 0.5);
        // nächster Tag mit Daten, höchstens ~14 px neben dem Finger
        const reichweite = Math.max(1, Math.round(14 / schritt));
        for (let d = 0; d <= reichweite; d++) {
          for (const k of [i - d, i + d]) {
            const t = reihe[k];
            if (t && (t.stimmung !== null || t.punkte > 0)) { onDayTap(t.date); return; }
          }
        }
      });
    }

    container.querySelectorAll('.mood-range-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const neu = Number(btn.dataset.tage);
        if (neu !== tage) { tage = neu; zeichnen(); }
      });
    });
  };

  zeichnen();
}
