// ============================================================
// History — "Verlauf" tab
// ============================================================

import { TEXTS } from '../../content/de.js';
import { getPointsByDate, getPointsByDateRange, getReflectionByDate, getReflectionsByDateRange } from '../db.js';
import { formatDate, getMonday, getWeekNumber, renderHistoryWeekDots } from '../components/week-dots.js';
import { renderBalanceBars } from '../components/balance-bar.js';

const MOOD_MAP = {};
TEXTS.ui.reflection.moods.forEach(m => { MOOD_MAP[m.key] = m; });

export async function showDayDetail(dateStr) {
  const points = await getPointsByDate(dateStr);
  const reflection = await getReflectionByDate(dateStr);
  if (points.length === 0 && !reflection) return;

  const dateObj = new Date(dateStr + 'T12:00:00');
  const dateLabel = dateObj.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const labels = TEXTS.ui.smallLabels;

  let html = `<div class="detail-popup-overlay" id="detail-overlay"><div class="detail-popup"><div class="detail-popup-date">${dateLabel}</div>`;

  if (reflection) {
    const mood = MOOD_MAP[reflection.mood];
    html += `<div class="detail-popup-mood"><span>${mood ? mood.emoji : ''}</span><span>${mood ? mood.label : ''}</span></div>`;
  }

  if (points.length > 0) {
    html += `<div class="detail-popup-section"><div class="detail-popup-section-title">SMALL Punkte</div>`;
    points.forEach(p => {
      const ld = p.letter === 'L1' ? 'L₁' : p.letter === 'L2' ? 'L₂' : p.letter;
      html += `<div class="detail-popup-item"><strong>${ld}</strong> ${p.categoryLabel || p.category}</div>`;
    });
    html += `</div>`;
  }

  if (reflection && reflection.helped && reflection.helped.length > 0) {
    html += `<div class="detail-popup-section"><div class="detail-popup-section-title">${TEXTS.ui.reflection.helpedTitle}</div>`;
    reflection.helped.forEach(h => {
      if (h === 'dontknow') html += `<div class="detail-popup-item">${TEXTS.ui.reflection.helpedDontKnow}</div>`;
      else if (h === 'survived') html += `<div class="detail-popup-item">${TEXTS.ui.reflection.helpedSurvived}</div>`;
      else { const d = h === 'L1' ? 'L₁' : h === 'L2' ? 'L₂' : h; html += `<div class="detail-popup-item">${d} ${labels[h] || h}</div>`; }
    });
    html += `</div>`;
  }

  if (reflection && reflection.gratitude) {
    html += `<div class="detail-popup-section"><div class="detail-popup-section-title">${TEXTS.ui.reflection.gratitudeTitle}</div><div class="detail-popup-gratitude">"${reflection.gratitude}"</div></div>`;
  }

  html += `<button class="btn-secondary detail-popup-close" id="detail-close">${TEXTS.ui.reflection.close}</button></div></div>`;

  const el = document.createElement('div');
  el.id = 'day-detail-container';
  el.innerHTML = html;
  document.body.appendChild(el);
  document.getElementById('detail-close').addEventListener('click', () => el.remove());
  document.getElementById('detail-overlay').addEventListener('click', (e) => { if (e.target === e.currentTarget) el.remove(); });
}

export async function renderHistory(container, profile) {
  const name = profile.name;
  const t = TEXTS.ui.history;
  const title = t.title.replace('{name}', name);
  container.innerHTML = `<div class="history-screen"><h2 class="history-title">${title}</h2><div id="history-weeks"></div></div>`;
  const weeksContainer = document.getElementById('history-weeks');
  const today = new Date();
  const todayStr = formatDate(today);
  const currentMonday = getMonday(today);
  const weeksToCheck = 12;
  const weekData = [];

  for (let w = 0; w < weeksToCheck; w++) {
    const monday = new Date(currentMonday);
    monday.setDate(currentMonday.getDate() - (w * 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const startStr = formatDate(monday);
    const endStr = formatDate(sunday);
    const points = await getPointsByDateRange(startStr, endStr);
    const reflections = await getReflectionsByDateRange(startStr, endStr);
    if (points.length > 0 || reflections.length > 0) {
      weekData.push({ monday, sunday, points, reflections, weekNum: getWeekNumber(monday), isCurrent: w === 0 });
    }
  }

  if (weekData.length === 0) {
    weeksContainer.innerHTML = `<p style="text-align:center;color:var(--text-secondary);padding:40px 0;">Noch keine Daten.</p>`;
    return;
  }

  for (const week of weekData) {
    const weekEl = document.createElement('div');
    weekEl.className = 'history-week';
    const headerText = week.isCurrent ? t.thisWeek : t.weekLabel.replace('{n}', week.weekNum);
    weekEl.innerHTML = `<div class="history-week-header">${headerText}</div><div class="history-dots" id="hw-dots-${week.weekNum}-${week.isCurrent ? 'c' : 'p'}"></div><div class="balance-bars" id="hw-balance-${week.weekNum}-${week.isCurrent ? 'c' : 'p'}"></div>`;
    weeksContainer.appendChild(weekEl);
    const dotsEl = weekEl.querySelector('.history-dots');
    await renderHistoryWeekDots(dotsEl, week.monday, (dateStr) => showDayDetail(dateStr));
    const balanceEl = weekEl.querySelector('.balance-bars');
    renderBalanceBars(balanceEl, week.points);
  }
}
