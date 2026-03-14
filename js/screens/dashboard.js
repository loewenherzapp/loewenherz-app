// ============================================================
// Dashboard — "Heute" main screen
// ============================================================

import { TEXTS } from '../../content/de.js';
import { getPointsByDate, addSmallPoint, getPointsByDateRange } from '../db.js';
import { openSheet } from '../components/bottom-sheet.js';
import { renderWeekDots, formatDate, getMonday } from '../components/week-dots.js';
import { renderBalanceBars } from '../components/balance-bar.js';
import { showDayDetail } from './history.js';

const LETTERS = ['S', 'M', 'A', 'L1', 'L2'];
const DISPLAY_LETTERS = ['S', 'M', 'A', 'L₁', 'L₂'];

function getQuatschiLine(name, todayPoints, lastActivityDate) {
  const t = TEXTS.quatschi;
  const today = new Date();
  const todayStr = formatDate(today);
  let pool;
  if (lastActivityDate) {
    const lastDate = new Date(lastActivityDate);
    const diffDays = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
    if (diffDays > 7) pool = t.inactiveLong;
    else if (diffDays > 3) pool = t.inactiveShort;
    else if (todayPoints === 0) pool = t.firstPoint;
    else pool = t.general;
  } else if (todayPoints === 0) {
    pool = t.firstPoint;
  } else {
    pool = t.general;
  }
  const line = pool[Math.floor(Math.random() * pool.length)];
  return line.replace(/\{name\}/g, name);
}

export async function renderDashboard(container, profile) {
  const name = profile.name;
  const todayStr = formatDate(new Date());
  const todayPoints = await getPointsByDate(todayStr);
  const monday = getMonday(new Date());
  const sundayDate = new Date(monday);
  sundayDate.setDate(monday.getDate() + 6);
  const weekStart = formatDate(monday);
  const weekEnd = formatDate(sundayDate);
  const weekPoints = await getPointsByDateRange(weekStart, weekEnd);
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const recentPoints = await getPointsByDateRange(formatDate(fourWeeksAgo), todayStr);
  let lastActivityDate = null;
  for (const p of recentPoints) {
    if (p.date !== todayStr) {
      if (!lastActivityDate || p.date > lastActivityDate) lastActivityDate = p.date;
    }
  }
  const letterCounts = {};
  LETTERS.forEach(l => letterCounts[l] = 0);
  todayPoints.forEach(p => { if (letterCounts[p.letter] !== undefined) letterCounts[p.letter]++; });
  const totalToday = todayPoints.length;
  const quatschi = getQuatschiLine(name, totalToday, lastActivityDate);
  const dt = TEXTS.ui.dashboard;
  let dayCounterText;
  if (totalToday === 0) dayCounterText = dt.todayPointsZero;
  else if (totalToday === 1) dayCounterText = dt.todayPointsSingular;
  else dayCounterText = dt.todayPoints.replace('{n}', totalToday);

  container.innerHTML = `
    <div class="dashboard-screen">
      <p class="quatschi-line">${quatschi}</p>
      <div class="small-buttons">
        <div class="small-row" id="small-row-top"></div>
        <div class="small-row" id="small-row-bottom"></div>
      </div>
      <div class="day-counter" id="day-counter">${dayCounterText}</div>
      <div class="week-dots" id="dashboard-week-dots"></div>
      <div class="balance-bars" id="dashboard-balance"></div>
      <p class="motto">${dt.motto}</p>
    </div>
  `;

  const topRow = document.getElementById('small-row-top');
  const bottomRow = document.getElementById('small-row-bottom');
  const labels = TEXTS.ui.smallLabels;

  function createSmallButton(letter, displayLetter, index) {
    const wrap = document.createElement('div');
    wrap.className = 'small-btn-wrap';
    const circle = document.createElement('button');
    circle.className = 'small-circle';
    if (letterCounts[letter] > 0) circle.classList.add('filled');
    circle.innerHTML = displayLetter;
    if (letterCounts[letter] > 0) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = letterCounts[letter];
      circle.appendChild(badge);
    }
    const label = document.createElement('div');
    label.className = 'small-label';
    label.textContent = labels[letter];
    circle.addEventListener('click', () => {
      const qs = TEXTS.ui.quickSelect[letter];
      openSheet(qs.title, qs.options, async (opt) => {
        const now = new Date();
        await addSmallPoint({
          date: formatDate(now),
          time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
          letter: letter,
          category: opt.key,
          categoryLabel: opt.label
        });
        await renderDashboard(container, profile);
      });
    });
    wrap.appendChild(circle);
    wrap.appendChild(label);
    return wrap;
  }

  ['S', 'M', 'A'].forEach((l, i) => topRow.appendChild(createSmallButton(l, DISPLAY_LETTERS[i], i)));
  ['L1', 'L2'].forEach((l, i) => bottomRow.appendChild(createSmallButton(l, DISPLAY_LETTERS[i + 3], i + 3)));

  const weekDotsEl = document.getElementById('dashboard-week-dots');
  await renderWeekDots(weekDotsEl, (dateStr) => showDayDetail(dateStr));

  const balanceEl = document.getElementById('dashboard-balance');
  renderBalanceBars(balanceEl, weekPoints);
}
