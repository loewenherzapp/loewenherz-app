// ============================================================
// Dashboard — "Heute" main screen (Journal Design)
// ============================================================

import { TEXTS } from '../../content/de.js';
import { getPointsByDate, addSmallPoint, getPointsByDateRange, getReflectionsByDateRange } from '../db.js';
import { openSheet } from '../components/bottom-sheet.js';
import { renderWeekCircles, formatDate, getMonday } from '../components/week-dots.js';

import { showDayDetail } from './history.js';
import { getDashboardQuatschiText, getTapFeedback, showTapToast } from '../quatschi.js';

const MORNING_NUDGE_TEXTS = [
  "Quatschi fragt, ob du heute einen Plan hast?",
  "Gundula wartet auf deine Morgenreflexion.",
  "Wie willst du heute sein? Quatschi hat schon Vorschläge. Ignoriere sie.",
  "Die Weiche stellt sich nicht von allein."
];

const LETTERS = ['S', 'M', 'A', 'L1', 'L2'];
const DISPLAY_LETTERS = ['S', 'M', 'A', 'L', 'L'];
const BUTTON_LABELS = ['Selbst', 'Meta', 'Affekt', 'Löwen', 'Liebe'];

// Color config per SMALL letter
const LETTER_COLORS = {
  S:  { color: 'var(--color-S)',  bg: 'var(--color-S-bg)',  border: 'var(--color-S-border)' },
  M:  { color: 'var(--color-M)',  bg: 'var(--color-M-bg)',  border: 'var(--color-M-border)' },
  A:  { color: 'var(--color-A)',  bg: 'var(--color-A-bg)',  border: 'var(--color-A-border)' },
  L1: { color: 'var(--color-L1)', bg: 'var(--color-L1-bg)', border: 'var(--color-L1-border)' },
  L2: { color: 'var(--color-L2)', bg: 'var(--color-L2-bg)', border: 'var(--color-L2-border)' }
};

// Gundula state logic
function getGundulaState(activeDaysLast7) {
  if (activeDaysLast7 >= 7) return 'entspannt';
  if (activeDaysLast7 >= 5) return 'ruhig';
  if (activeDaysLast7 >= 3) return 'wachsam';
  return 'tense';
}

const GUNDULA_TEXTS = {
  entspannt: 'Gundula sonnt sich',
  ruhig: 'Gundula ist ruhig',
  wachsam: 'Gundula ist wachsam',
  tense: 'Gundula ist angespannt'
};

const GUNDULA_PIP_COLORS = {
  tense: 'var(--color-L2)',
  wachsam: 'var(--gold)',
  ruhig: 'var(--color-M)',
  entspannt: 'var(--color-M)'
};

const GUNDULA_ICONS = {
  entspannt: 'assets/gundula/gundula-entspannt-112.png',
  ruhig: 'assets/gundula/gundula-ruhig-112.png',
  wachsam: 'assets/gundula/gundula-wachsam-112.png',
  tense: 'assets/gundula/gundula-tense-112.png'
};

// Preload all Gundula icons to prevent flicker
Object.values(GUNDULA_ICONS).forEach(src => { const img = new Image(); img.src = src; });

// Calculate active days in last 7 (single range query)
async function getActiveDaysLast7() {
  const today = new Date();
  const sevenAgo = new Date(today);
  sevenAgo.setDate(today.getDate() - 6);
  const points = await getPointsByDateRange(formatDate(sevenAgo), formatDate(today));
  const uniqueDays = new Set(points.map(p => p.date));
  return uniqueDays.size;
}

export async function renderDashboard(container, profile, { animate = true } = {}) {
  const name = profile.name;
  const todayStr = formatDate(new Date());

  // Get today's points
  const todayPoints = await getPointsByDate(todayStr);

  // Get week's points for balance bars
  const monday = getMonday(new Date());
  const sundayDate = new Date(monday);
  sundayDate.setDate(monday.getDate() + 6);
  const weekStart = formatDate(monday);
  const weekEnd = formatDate(sundayDate);
  const weekPoints = await getPointsByDateRange(weekStart, weekEnd);
  const weekReflections = await getReflectionsByDateRange(weekStart, weekEnd);

  const totalToday = todayPoints.length;

  // Active days for stats + gundula
  const activeDays = await getActiveDaysLast7();
  const gundulaState = getGundulaState(activeDays);

  // Quatschi text — check for morning nudge
  const hour = new Date().getHours();
  const morningWindow = true; // hour >= 5 && hour <= 11; // DEBUG: temporarily always active
  const morningDoneKey = 'morningReflection_' + todayStr;
  const morningDoneData = localStorage.getItem(morningDoneKey);
  const morningDone = morningDoneData ? JSON.parse(morningDoneData).completed : false;
  const showMorningNudge = morningWindow && !morningDone;

  const quatschi = showMorningNudge
    ? MORNING_NUDGE_TEXTS[Math.floor(Math.random() * MORNING_NUDGE_TEXTS.length)]
    : await getDashboardQuatschiText(name);

  const quatschiTextHtml = showMorningNudge
    ? `<div class="quatschi-nudge" id="quatschi-nudge"><span class="quatschi-text">${quatschi}</span><span class="quatschi-nudge-arrow">\u2192</span></div>`
    : `<div class="quatschi-text">${quatschi}</div>`;

  container.innerHTML = `
    <div class="dashboard-screen">
      <div class="quatschi-hero">
        <div class="quatschi-tag">QUATSCHI</div>
        ${quatschiTextHtml}
        <div class="quatschi-divider"></div>
      </div>

      <div class="stats-row">
        <div class="stats-left">
          <div class="stats-number">${totalToday}</div>
          <div class="stats-label">Punkte heute</div>
        </div>
        <div class="stats-right">
          <div class="stats-value">${activeDays}<span class="stats-value-suffix"> von 7</span></div>
          <div class="stats-label">Tagen aktiv</div>
        </div>
      </div>

      <div class="small-section">
        <div class="small-buttons" id="small-buttons"></div>
      </div>

      <div class="gundula-row ${gundulaState}" id="gundula-bar">
        <img src="${GUNDULA_ICONS[gundulaState]}" alt="Gundula" class="gundula-icon" width="56" height="56">
        <span class="gundula-text">${GUNDULA_TEXTS[gundulaState]}</span>
        <button class="gundula-info-btn" id="gundula-info" aria-label="Gundula Info">ⓘ</button>
        <span class="gundula-pip" style="background:${GUNDULA_PIP_COLORS[gundulaState]};${gundulaState === 'ruhig' ? 'opacity:0.7;' : ''}"></span>
      </div>

      <div class="week-block">
        <div class="week-label">DIESE WOCHE</div>
        <div class="week-circles" id="dashboard-week-circles"></div>
      </div>

      <div class="mantra-anchor">
        <div class="mantra-line"></div>
        <div class="mantra-text">Alles über null ist Gewinn.</div>
      </div>
    </div>
  `;

  // Render SMALL buttons
  const buttonsEl = document.getElementById('small-buttons');
  const letterCounts = {};
  LETTERS.forEach(l => letterCounts[l] = 0);
  todayPoints.forEach(p => { if (letterCounts[p.letter] !== undefined) letterCounts[p.letter]++; });

  LETTERS.forEach((letter, i) => {
    const colors = LETTER_COLORS[letter];
    const btn = document.createElement('button');
    btn.className = 'small-btn';
    btn.style.borderColor = colors.border;

    const dot = document.createElement('div');
    dot.className = 'btn-dot';
    dot.style.background = colors.color;
    dot.textContent = DISPLAY_LETTERS[i];

    const label = document.createElement('div');
    label.className = 'small-btn-label';
    label.textContent = BUTTON_LABELS[i];

    btn.appendChild(dot);
    btn.appendChild(label);

    btn.addEventListener('click', () => {
      const qs = TEXTS.ui.quickSelect[letter];
      openSheet(qs.title, qs.options, async (opt) => {
        try {
          // Haptic feedback — subtle 15ms vibration on tap
          if (navigator.vibrate) navigator.vibrate(15);

          const now = new Date();
          const todayStr = formatDate(now);
          await addSmallPoint({
            date: todayStr,
            time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
            letter: letter,
            category: opt.key,
            categoryLabel: opt.label
          });

          // --- Erfolgs-Animation auf dem Button ---
          btn.classList.add('tapped');
          btn.style.background = colors.bg;

          // Gold-Glow auf dem Dot
          dot.classList.add('dot-success');

          // Checkmark-Overlay
          const check = document.createElement('span');
          check.className = 'dot-check';
          check.textContent = '✓';
          dot.appendChild(check);

          // Punkte-Zähler bump
          const statsNum = document.querySelector('.stats-number');
          if (statsNum) {
            const oldVal = parseInt(statsNum.textContent) || 0;
            statsNum.textContent = oldVal + 1;
            statsNum.classList.add('stats-bump');
            statsNum.addEventListener('animationend', () => statsNum.classList.remove('stats-bump'), { once: true });
          }

          // Get updated count for toast
          const updatedPoints = await getPointsByDate(todayStr);
          const pointCountToday = updatedPoints.length;
          const feedbackText = getTapFeedback(letter, pointCountToday);

          // Toast sofort zeigen (parallel zur Animation)
          showTapToast(feedbackText, name);

          // Nach 600ms: Re-Render OHNE Animation
          setTimeout(async () => {
            await renderDashboard(container, profile, { animate: false });
          }, 600);
        } catch (e) {
          console.error('SMALL tap error:', e);
        }
      });
    });

    buttonsEl.appendChild(btn);
  });

  // Render week circles
  const weekCirclesEl = document.getElementById('dashboard-week-circles');
  renderWeekCircles(weekCirclesEl, weekPoints, weekReflections, (dateStr) => {
    showDayDetail(dateStr);
  });

  // Gundula info button
  document.getElementById('gundula-info').addEventListener('click', (e) => {
    e.stopPropagation();
    showGundulaInfo();
  });

  // Morning nudge tap -> navigate to reflection tab
  const nudgeEl = document.getElementById('quatschi-nudge');
  if (nudgeEl) {
    nudgeEl.addEventListener('click', () => {
      document.querySelector('.nav-tab[data-tab="reflection"]').click();
    });
  }

  // --- Dashboard entrance animations (nur bei Tab-Wechsel, nicht nach SMALL-Tap) ---
  if (animate) animateDashboardEntrance();
}

function animateDashboardEntrance() {
  // Skip if user prefers reduced motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const stagger = 60;
  const elements = [
    { sel: '.quatschi-hero', cls: 'fade-in', delay: 0 },
    { sel: '.stats-row', cls: 'fade-up', delay: stagger },
    { sel: '.gundula-row', cls: 'fade-in-scale', delay: stagger * 3 },
    { sel: '.week-block', cls: 'fade-up', delay: stagger * 5 },
    { sel: '.mantra-anchor', cls: 'fade-in', delay: stagger * 6 }
  ];

  // Apply animation classes
  elements.forEach(({ sel, cls, delay }) => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.classList.add(cls);
    setTimeout(() => el.classList.add('visible'), 20 + delay);
  });

  // SMALL buttons: individual staggered fadeUp with scale
  const smallBtns = document.querySelectorAll('.small-btn');
  smallBtns.forEach((btn, i) => {
    btn.classList.add('fade-up-scale');
    setTimeout(() => btn.classList.add('visible'), 20 + stagger * 2 + i * 80);
  });

  // Week dots: sequential fadeIn
  const weekDots = document.querySelectorAll('.week-circle-wrap');
  weekDots.forEach((dot, i) => {
    dot.classList.add('fade-up');
    setTimeout(() => dot.classList.add('visible'), 20 + stagger * 8 + i * 40);
  });

  // Gundula breathe after entrance
  const gundulaIcon = document.querySelector('.gundula-icon');
  if (gundulaIcon) {
    setTimeout(() => gundulaIcon.classList.add('gundula-breathe'), stagger * 4 + 400);
  }
}

function showGundulaInfo() {
  // Remove existing if any
  const existing = document.getElementById('gundula-sheet-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'gundula-sheet-overlay';
  overlay.className = 'info-sheet-overlay';

  overlay.innerHTML = `
    <div class="info-sheet">
      <div class="info-sheet-grip"></div>
      <h3>Wie funktioniert Gundula?</h3>
      <p>Gundula ist dein Nervensystem — uralt, gut gemeint, manchmal etwas übervorsichtig.</p>
      <p>Sie reagiert auf deinen Biochemie-Cocktail: Schlaf, Bewegung, Stress, Ernährung. Je besser du für dich sorgst, desto ruhiger wird sie.</p>
      <p><strong>Gundula hat vier Zustände:</strong></p>
      <div class="info-states">
        <div class="info-state"><span class="info-dot" style="background:var(--color-M)"></span> Entspannt — Alles im grünen Bereich</div>
        <div class="info-state"><span class="info-dot" style="background:var(--color-M);opacity:0.7"></span> Ruhig — Wachsam, aber gelassen</div>
        <div class="info-state"><span class="info-dot" style="background:var(--gold)"></span> Wachsam — Aufmerksamkeit erhöht</div>
        <div class="info-state"><span class="info-dot" style="background:var(--color-L2)"></span> Angespannt — Alarmstufe</div>
      </div>
      <p>Ihr Zustand berechnet sich aus deinen SMALL-Punkten und deiner Aktivität der letzten Tage. Jeder Tap auf einen SMALL-Buchstaben hilft ihr, runterzukommen.</p>
      <button class="info-sheet-close">Verstanden</button>
    </div>
  `;

  document.body.appendChild(overlay);

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => overlay.classList.add('active'));
  });

  // Close handlers
  const close = () => {
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 300);
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector('.info-sheet-close').addEventListener('click', close);
}
