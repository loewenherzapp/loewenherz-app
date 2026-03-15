// ============================================================
// Week Dots Component
// ============================================================

import { getPointsByDateRange, getReflectionsByDateRange } from '../db.js';

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/**
 * Get Monday of the week containing a given date.
 */
export function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay(); // 0=Sun, 1=Mon ...
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Get ISO week number
 */
export function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

/**
 * Build lookup maps from a range query: { "YYYY-MM-DD": [...items] }
 */
function groupByDate(items) {
  const map = {};
  for (const item of items) {
    if (!map[item.date]) map[item.date] = [];
    map[item.date].push(item);
  }
  return map;
}

function groupReflectionsByDate(items) {
  const map = {};
  for (const item of items) {
    map[item.date] = item;
  }
  return map;
}

/**
 * Render week dots into a container for the dashboard (current week).
 * Uses a single range query for efficiency and reliability.
 * @param {HTMLElement} container
 * @param {Function} onDayClick - callback(dateStr) when a dot with data is tapped
 */
export async function renderWeekDots(container, onDayClick) {
  const today = new Date();
  const todayStr = formatDate(today);
  const monday = getMonday(today);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const startStr = formatDate(monday);
  const endStr = formatDate(sunday);

  // Single range query — much more reliable than 7 individual queries
  const allPoints = await getPointsByDateRange(startStr, endStr);
  const allReflections = await getReflectionsByDateRange(startStr, endStr);
  const pointsByDay = groupByDate(allPoints);
  const reflectionsByDay = groupReflectionsByDate(allReflections);

  container.innerHTML = '';

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + i);
    const dateStr = formatDate(dayDate);

    const wrap = document.createElement('div');
    wrap.className = 'week-dot-wrap';

    const dot = document.createElement('div');
    dot.className = 'week-dot';

    // Check if today
    if (dateStr === todayStr) {
      dot.classList.add('today');
    }

    // Check for points and reflections via lookup
    const dayPoints = pointsByDay[dateStr] || [];
    const reflection = reflectionsByDay[dateStr] || null;
    const hasPoints = dayPoints.length > 0;

    if (hasPoints) {
      dot.classList.add('active');
    }

    if (reflection) {
      dot.classList.add('mood-' + reflection.mood);
    }

    if (hasPoints || reflection) {
      dot.style.cursor = 'pointer';
      dot.addEventListener('click', () => onDayClick && onDayClick(dateStr));
    }

    const label = document.createElement('div');
    label.className = 'week-dot-label';
    label.textContent = DAY_LABELS[i];

    wrap.appendChild(dot);
    wrap.appendChild(label);
    container.appendChild(wrap);
  }
}

/**
 * Render week dots for history view (any week).
 * Uses a single range query for efficiency and reliability.
 */
export async function renderHistoryWeekDots(container, mondayDate, onDayClick) {
  const today = new Date();
  const todayStr = formatDate(today);
  const sunday = new Date(mondayDate);
  sunday.setDate(mondayDate.getDate() + 6);

  const startStr = formatDate(mondayDate);
  const endStr = formatDate(sunday);

  // Single range query per week
  const allPoints = await getPointsByDateRange(startStr, endStr);
  const allReflections = await getReflectionsByDateRange(startStr, endStr);
  const pointsByDay = groupByDate(allPoints);
  const reflectionsByDay = groupReflectionsByDate(allReflections);

  container.innerHTML = '';

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(mondayDate);
    dayDate.setDate(mondayDate.getDate() + i);
    const dateStr = formatDate(dayDate);

    const wrap = document.createElement('div');
    wrap.className = 'history-dot-wrap';

    const dot = document.createElement('div');
    dot.className = 'history-dot';

    if (dateStr === todayStr) {
      dot.classList.add('today');
    }

    // Future dates
    if (dayDate > today && dateStr !== todayStr) {
      dot.classList.add('future');
    }

    const dayPoints = pointsByDay[dateStr] || [];
    const reflection = reflectionsByDay[dateStr] || null;
    const hasPoints = dayPoints.length > 0;

    if (hasPoints) {
      dot.classList.add('active');
    }

    if (reflection) {
      dot.classList.add('mood-' + reflection.mood);
    }

    if (hasPoints || reflection) {
      dot.style.cursor = 'pointer';
      dot.addEventListener('click', () => onDayClick && onDayClick(dateStr));
    }

    const label = document.createElement('div');
    label.className = 'history-dot-label';
    label.textContent = DAY_LABELS[i];

    wrap.appendChild(dot);
    wrap.appendChild(label);
    container.appendChild(wrap);
  }
}
