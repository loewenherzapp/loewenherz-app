// ============================================================
// Week Circles Component — Morgen/Abend Reflection Status
// ============================================================

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
 * Get reflection status for a day:
 * - morning: check localStorage morningReflection_YYYY-MM-DD
 * - evening: check reflections data (IndexedDB)
 * Returns { morning: boolean, evening: boolean }
 */
function getReflectionStatus(dateStr, reflectionsByDay) {
  // Morning: localStorage key = morningReflection_YYYY-MM-DD
  let morning = false;
  try {
    const morningData = localStorage.getItem('morningReflection_' + dateStr);
    if (morningData) {
      const parsed = JSON.parse(morningData);
      morning = parsed.completed === true;
    }
  } catch (e) {
    // Invalid JSON — treat as not completed
  }

  // Evening: IndexedDB reflection object (has mood field)
  const eveningRef = reflectionsByDay[dateStr];
  const evening = !!(eveningRef && eveningRef.mood);

  // Debug: Log today's status
  if (dateStr === new Date().toISOString().slice(0, 10)) {
    console.log(`[Dots] Today ${dateStr}: morning=${morning}, evening=${evening}`, eveningRef || 'no reflection');
  }

  return { morning, evening };
}

/**
 * Render a single dot element with reflection-based state.
 * dotClass: 'week-circle' or 'history-dot'
 * useEmoji: true for large dots (dashboard), false for small dots (history)
 */
function renderDot(dotClass, dateStr, todayStr, today, status, hasPoints, useEmoji) {
  const dot = document.createElement('div');
  dot.className = dotClass;

  const { morning, evening } = status;
  const isFuture = new Date(dateStr + 'T12:00:00') > today && dateStr !== todayStr;

  if (dateStr === todayStr) {
    dot.classList.add('today');
  }

  if (isFuture) {
    dot.classList.add('future');
  }

  if (morning && evening) {
    // Stufe 3: Beides erledigt — voller Amber-Kreis mit ✓
    dot.classList.add('dot-both');
    if (useEmoji) {
      dot.textContent = '✓';
    }
  } else if (morning) {
    // Stufe 2a: Nur Morgen — ☀️
    dot.classList.add('dot-half');
    if (useEmoji) {
      dot.textContent = '☀️';
    } else {
      dot.classList.add('dot-morning-half');
    }
  } else if (evening) {
    // Stufe 2b: Nur Abend — 🌙
    dot.classList.add('dot-half');
    if (useEmoji) {
      dot.textContent = '🌙';
    } else {
      dot.classList.add('dot-evening-half');
    }
  } else if (hasPoints) {
    // Hat SMALL-Punkte aber keine Reflexion
    dot.classList.add('dot-points');
  } else {
    // Stufe 1: Nichts gemacht
    dot.classList.add('empty');
  }

  return dot;
}

/**
 * Render week circles for the dashboard (current week).
 */
export function renderWeekCircles(container, points, reflections, onDayClick) {
  const today = new Date();
  const todayStr = formatDate(today);
  const monday = getMonday(today);

  const pointsByDay = groupByDate(points);
  const reflectionsByDay = groupReflectionsByDate(reflections);

  container.innerHTML = '';

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + i);
    const dateStr = formatDate(dayDate);

    const wrap = document.createElement('div');
    wrap.className = 'week-circle-wrap';

    const dayPoints = pointsByDay[dateStr] || [];
    const status = getReflectionStatus(dateStr, reflectionsByDay);

    const circle = renderDot('week-circle', dateStr, todayStr, today, status, dayPoints.length > 0, true);

    if (dayPoints.length > 0 || status.morning || status.evening) {
      circle.style.cursor = 'pointer';
      circle.addEventListener('click', () => onDayClick && onDayClick(dateStr));
    }

    const label = document.createElement('div');
    label.className = 'week-day-label';
    label.textContent = DAY_LABELS[i];

    wrap.appendChild(circle);
    wrap.appendChild(label);
    container.appendChild(wrap);
  }
}

/**
 * Render week dots for history view (any week).
 */
export function renderHistoryWeekDots(container, mondayDate, points, reflections, onDayClick) {
  const today = new Date();
  const todayStr = formatDate(today);

  const pointsByDay = groupByDate(points);
  const reflectionsByDay = groupReflectionsByDate(reflections);

  container.innerHTML = '';

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(mondayDate);
    dayDate.setDate(mondayDate.getDate() + i);
    const dateStr = formatDate(dayDate);

    const wrap = document.createElement('div');
    wrap.className = 'history-dot-wrap';

    const dayPoints = pointsByDay[dateStr] || [];
    const status = getReflectionStatus(dateStr, reflectionsByDay);

    const dot = renderDot('history-dot', dateStr, todayStr, today, status, dayPoints.length > 0, false);

    if (dayPoints.length > 0 || status.morning || status.evening) {
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

// Legacy export for dashboard.js (old name)
export { renderWeekCircles as renderWeekDots };
