// ============================================================
// Week Circles Component — 3-level glow system, no numbers
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
 * 3-level state: empty / low / active
 */
function getDayCircleState(pointCount) {
  if (pointCount >= 5) return 'active';
  if (pointCount >= 1) return 'low';
  return 'empty';
}

/**
 * Render week circles for the dashboard (current week).
 */
export function renderWeekCircles(container, points, reflections, onDayClick) {
  const today = new Date();
  const todayStr = formatDate(today);
  const monday = getMonday(today);

  const pointsByDay = groupByDate(points);

  container.innerHTML = '';

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + i);
    const dateStr = formatDate(dayDate);

    const wrap = document.createElement('div');
    wrap.className = 'week-circle-wrap';

    const circle = document.createElement('div');
    circle.className = 'week-circle';

    const dayPoints = pointsByDay[dateStr] || [];
    const state = getDayCircleState(dayPoints.length);
    circle.classList.add(state);

    if (dateStr === todayStr) {
      circle.classList.add('today');
    }

    if (dayPoints.length > 0) {
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
 * Render week dots for history view (any week) — uses same 3-level system.
 */
export function renderHistoryWeekDots(container, mondayDate, points, reflections, onDayClick) {
  const today = new Date();
  const todayStr = formatDate(today);

  const pointsByDay = groupByDate(points);

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

    if (dayDate > today && dateStr !== todayStr) {
      dot.classList.add('future');
    }

    const dayPoints = pointsByDay[dateStr] || [];
    const state = getDayCircleState(dayPoints.length);
    dot.classList.add(state);

    if (dayPoints.length > 0) {
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
