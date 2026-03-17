// ============================================================
// Dashboard — "Heute" main screen (Journal Design)
// ============================================================

import { TEXTS } from '../../content/de.js';
import { getPointsByDate, addSmallPoint, getPointsByDateRange, getReflectionsByDateRange } from '../db.js';
import { openSheet } from '../components/bottom-sheet.js';
import { renderWeekCircles, formatDate, getMonday } from '../components/week-dots.js';
import { renderBalanceBar } from '../components/balance-bar.js';
import { showDayDetail } from './history.js';
import { getDashboardQuatschiText, getTapFeedback, showTapToast } from '../quatschi.js';

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

export async function renderDashboard(container, profile) {
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

  // Quatschi text
  const quatschi = await getDashboardQuatschiText(name);

  container.innerHTML = `
    <div class="dashboard-screen">
      <div class="quatschi-hero">
        <div class="quatschi-tag">QUATSCHI</div>
        <div class="quatschi-text">${quatschi}</div>
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

      <div class="balance-section" id="dashboard-balance"></div>

      <div class="gundula-row ${gundulaState}" id="gundula-bar">
        <img src="${GUNDULA_ICONS[gundulaState]}" alt="Gundula" class="gundula-icon" width="56" height="56">
        <span class="gundula-text">${GUNDULA_TEXTS[gundulaState]}</span>
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

          // Tap animation
          btn.classList.add('tapped');
          btn.style.background = colors.bg;
          setTimeout(() => {
            btn.classList.remove('tapped');
            btn.style.background = '';
          }, 400);

          // Get updated count
          const updatedPoints = await getPointsByDate(todayStr);
          const pointCountToday = updatedPoints.length;
          const feedbackText = getTapFeedback(letter, pointCountToday);

          // Refresh dashboard, then show toast
          await renderDashboard(container, profile);
          showTapToast(feedbackText, name);
        } catch (e) {
          console.error('SMALL tap error:', e);
        }
      });
    });

    buttonsEl.appendChild(btn);
  });

  // Render balance bar (color-coded)
  const balanceEl = document.getElementById('dashboard-balance');
  renderBalanceBar(balanceEl, weekPoints);

  // Render week circles
  const weekCirclesEl = document.getElementById('dashboard-week-circles');
  renderWeekCircles(weekCirclesEl, weekPoints, weekReflections, (dateStr) => {
    showDayDetail(dateStr);
  });
}
