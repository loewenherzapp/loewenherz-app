// ============================================================
// History — "Verlauf" tab with new design
// ============================================================

import { TEXTS } from '../../content/de.js';
import { getPointsByDate, getPointsByDateRange, getReflectionByDate, getReflectionsByDateRange } from '../db.js';
import { formatDate, getMonday, getWeekNumber, renderHistoryWeekDots } from '../components/week-dots.js';
import { renderBalanceBar } from '../components/balance-bar.js';

const MOOD_MAP = {};
TEXTS.ui.reflection.moods.forEach(m => { MOOD_MAP[m.key] = m; });

/**
 * Show day detail popup.
 * Exported so dashboard can also use it.
 */
export async function showDayDetail(dateStr) {
  const points = await getPointsByDate(dateStr);
  const reflection = await getReflectionByDate(dateStr);

  if (points.length === 0 && !reflection) return;

  const dateObj = new Date(dateStr + 'T12:00:00');
  const dateLabel = dateObj.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const labels = TEXTS.ui.smallLabels;

  let html = `<div class="detail-popup-overlay" id="detail-overlay">
    <div class="detail-popup">
      <div class="detail-popup-date">${dateLabel}</div>`;

  // Mood
  if (reflection) {
    const mood = MOOD_MAP[reflection.mood];
    html += `<div class="detail-popup-mood">
      <span>${mood ? mood.emoji : ''}</span>
      <span>${mood ? mood.label : ''}</span>
    </div>`;
  }

  // Points
  if (points.length > 0) {
    html += `<div class="detail-popup-section">
      <div class="detail-popup-section-title">SMALL Punkte</div>`;
    points.forEach(p => {
      const letterDisplay = p.letter === 'L1' ? 'L₁' : p.letter === 'L2' ? 'L₂' : p.letter;
      html += `<div class="detail-popup-item">
        <strong>${letterDisplay}</strong> ${p.categoryLabel || p.category}
      </div>`;
    });
    html += `</div>`;
  }

  // What helped
  if (reflection && reflection.helped && reflection.helped.length > 0) {
    html += `<div class="detail-popup-section">
      <div class="detail-popup-section-title">${TEXTS.ui.reflection.helpedTitle}</div>`;
    reflection.helped.forEach(h => {
      if (h === 'dontknow') {
        html += `<div class="detail-popup-item">${TEXTS.ui.reflection.helpedDontKnow}</div>`;
      } else if (h === 'survived') {
        html += `<div class="detail-popup-item">${TEXTS.ui.reflection.helpedSurvived}</div>`;
      } else {
        const display = h === 'L1' ? 'L₁' : h === 'L2' ? 'L₂' : h;
        html += `<div class="detail-popup-item">${display} ${labels[h] || h}</div>`;
      }
    });
    html += `</div>`;
  }

  // Gratitude
  if (reflection && reflection.gratitude) {
    html += `<div class="detail-popup-section">
      <div class="detail-popup-section-title">${TEXTS.ui.reflection.gratitudeTitle}</div>
      <div class="detail-popup-gratitude">"${reflection.gratitude}"</div>
    </div>`;
  }

  html += `<button class="btn-secondary detail-popup-close" id="detail-close">${TEXTS.ui.reflection.close}</button>`;
  html += `</div></div>`;

  const el = document.createElement('div');
  el.id = 'day-detail-container';
  el.innerHTML = html;
  document.body.appendChild(el);

  document.getElementById('detail-close').addEventListener('click', () => el.remove());
  document.getElementById('detail-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) el.remove();
  });
}

export async function renderHistory(container, profile) {
  const name = profile.name;
  const t = TEXTS.ui.history;
  const title = t.title.replace('{name}', name);

  const weekHeaders = [t.thisWeek, t.lastWeek, t.weeksAgo2, t.weeksAgo3];

  container.innerHTML = `
    <div class="history-screen">
      <h2 class="history-title">${title}</h2>
      <div id="history-weeks"></div>
    </div>
  `;

  const weeksContainer = document.getElementById('history-weeks');

  const today = new Date();
  const currentMonday = getMonday(today);

  for (let w = 0; w < 4; w++) {
    const monday = new Date(currentMonday);
    monday.setDate(currentMonday.getDate() - (w * 7));

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const startStr = formatDate(monday);
    const endStr = formatDate(sunday);

    const points = await getPointsByDateRange(startStr, endStr);
    const reflections = await getReflectionsByDateRange(startStr, endStr);

    const weekEl = document.createElement('div');
    weekEl.className = 'history-week';

    const headerText = weekHeaders[w];

    weekEl.innerHTML = `
      <div class="history-week-header">${headerText}</div>
      <div class="history-dots" id="hw-dots-${w}"></div>
      <div id="hw-balance-${w}"></div>
    `;

    weeksContainer.appendChild(weekEl);

    // Render dots with 3-level system
    const dotsEl = weekEl.querySelector('.history-dots');
    renderHistoryWeekDots(dotsEl, monday, points, reflections, (dateStr) => showDayDetail(dateStr));

    // Render color-coded balance bar
    const balanceEl = weekEl.querySelector(`#hw-balance-${w}`);
    renderBalanceBar(balanceEl, points);
  }
}
