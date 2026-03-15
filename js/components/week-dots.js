// ============================================================
// Week Dots Component
// ============================================================

import { getPointsByDate, getReflectionByDate } from '../db.js';

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
 * Render week dots into a container for the dashboard (current week).
 * @param {HTMLElement} container
 * @param {Function} onDayClick - callback(dateStr) when a dot with data is tapped
 */
export async function renderWeekDots(container, onDayClick) {
  const today = new Date();
  const todayStr = formatDate(today);
  const monday = getMonday(today);

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

    // Check if future
    if (dayDate > today && dateStr !== todayStr) {
      // Don't style future differently on dashboard — just inactive
    }

    // Check for points and reflections
    const points = await getPointsByDate(dateStr);
    const reflection = await getReflectionByDate(dateStr);
    const hasPoints = points.length > 0;

    if (hasPoints) {
      dot.classList.add('active');
    }

    if (reflection) {
      dot.classList.add(`mood-${reflection.mood}`);
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
 */
export async function renderHistoryWeekDots(container, mondayDate, onDayClick) {
  const today = new Date();
  const todayStr = formatDate(today);

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

    const points = await getPointsByDate(dateStr);
    const reflection = await getReflectionByDate(dateStr);
    const hasPoints = points.length > 0;

    if (hasPoints) {
      dot.classList.add('active');
    }

    if (reflection) {
      dot.classList.add(`mood-${reflection.mood}`);
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
