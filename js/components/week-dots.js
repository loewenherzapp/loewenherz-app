// ============================================================
// Week Dots Component
// ============================================================

import { getPointsByDate, getReflectionByDate } from '../db.js';

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

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
    if (dateStr === todayStr) dot.classList.add('today');
    const points = await getPointsByDate(dateStr);
    const reflection = await getReflectionByDate(dateStr);
    if (reflection) {
      dot.classList.add(`mood-${reflection.mood}`);
      dot.style.cursor = 'pointer';
      dot.addEventListener('click', () => onDayClick && onDayClick(dateStr));
    } else if (points.length > 0) {
      dot.classList.add('active');
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
    if (dateStr === todayStr) dot.classList.add('today');
    if (dayDate > today && dateStr !== todayStr) dot.classList.add('future');
    const points = await getPointsByDate(dateStr);
    const reflection = await getReflectionByDate(dateStr);
    if (reflection) {
      dot.classList.add(`mood-${reflection.mood}`);
      if (points.length > 0 || reflection) {
        dot.style.cursor = 'pointer';
        dot.addEventListener('click', () => onDayClick && onDayClick(dateStr));
      }
    } else if (points.length > 0) {
      dot.classList.add('active');
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
