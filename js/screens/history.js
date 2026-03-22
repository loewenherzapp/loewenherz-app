// ============================================================
// History — "Verlauf" tab — Phase 1 Redesign
// ============================================================

import { TEXTS } from '../../content/de.js';
import { getPointsByDate, getPointsByDateRange, getReflectionByDate, getReflectionsByDateRange } from '../db.js';
import { formatDate, getMonday, renderWeekCircles, renderHistoryWeekDots } from '../components/week-dots.js';


const MOOD_MAP = {};
TEXTS.ui.reflection.moods.forEach(m => { MOOD_MAP[m.key] = m; });

// --- Quatschi Wochen-Kommentare nach Level ---
const WEEK_QUATSCHI = [
  // Level 0: keine Aktivität
  [
    "Ruhige Woche. Auch das gehört dazu.",
    "Keine Punkte, kein Urteil. Nächste Woche ist noch da."
  ],
  // Level 1: 1-2 Reflexionen oder 1-5 SMALL-Punkte
  [
    "Ein paar Momente. Mehr als null. Genau so.",
    "Quatschi findet, das zählt nicht. Gundula sieht das anders."
  ],
  // Level 2: 3-5 Reflexionen oder 6-15 SMALL-Punkte
  [
    "Quatschi verliert langsam die Übersicht. Gut so.",
    "Dein Feldweg bekommt Reifenspuren."
  ],
  // Level 3: 6+ Reflexionen oder 16+ SMALL-Punkte
  [
    "Quatschi hat eine Beschwerde eingereicht. Abgelehnt.",
    "Die Autobahn hat Konkurrenz bekommen."
  ],
  // Level 4: 8+ Reflexionen UND 20+ SMALL-Punkte
  [
    "Quatschi überlegt, ob er sich einen neuen Job suchen soll.",
    "Radio Bullshit meldet: Empfangsstörung. Bitte nicht beheben."
  ]
];

function getWeekLevel(reflCount, pointCount) {
  if (reflCount >= 8 && pointCount >= 20) return 4;
  if (reflCount >= 6 || pointCount >= 16) return 3;
  if (reflCount >= 3 || pointCount >= 6) return 2;
  if (reflCount >= 1 || pointCount >= 1) return 1;
  return 0;
}

function getQuatschiWeekComment(reflCount, pointCount) {
  const level = getWeekLevel(reflCount, pointCount);
  const pool = WEEK_QUATSCHI[level];
  // Pick based on day-of-year for deterministic variety
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return pool[dayOfYear % pool.length];
}

// Count morning reflections from localStorage for a date range
function countMorningReflections(startDate, endDate) {
  let count = 0;
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T23:59:59');
  const d = new Date(start);
  while (d <= end) {
    const key = 'morningReflection_' + formatDate(d);
    try {
      const data = localStorage.getItem(key);
      if (data && JSON.parse(data).completed) count++;
    } catch (e) { /* skip */ }
    d.setDate(d.getDate() + 1);
  }
  return count;
}

// Count ALL morning reflections ever (for hero)
function countAllMorningReflections() {
  let count = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('morningReflection_')) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        if (data && data.completed) count++;
      } catch (e) { /* skip */ }
    }
  }
  return count;
}

// Get earliest activity date
function getEarliestMorningDate() {
  let earliest = null;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('morningReflection_')) {
      const dateStr = key.replace('morningReflection_', '');
      if (!earliest || dateStr < earliest) earliest = dateStr;
    }
  }
  return earliest;
}

/**
 * Show day detail popup.
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

  if (reflection) {
    const mood = MOOD_MAP[reflection.mood];
    html += `<div class="detail-popup-mood">
      <span>${mood ? mood.emoji : ''}</span>
      <span>${mood ? mood.label : ''}</span>
    </div>`;
  }

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

/**
 * Build summary text (hides zeros)
 */
function buildSummary(reflCount, pointCount) {
  const parts = [];
  if (reflCount > 0) parts.push(`${reflCount} Refl.`);
  if (pointCount > 0) parts.push(`${pointCount} Punkte`);
  return parts.join(' · ');
}

// ============================================================
// Main Render
// ============================================================

export async function renderHistory(container, profile) {
  const name = profile.name;
  const today = new Date();
  const todayStr = formatDate(today);
  const currentMonday = getMonday(today);

  // --- Fetch ALL data in two big queries ---
  const eightWeeksAgo = new Date(currentMonday);
  eightWeeksAgo.setDate(currentMonday.getDate() - 7 * 7); // 7 previous weeks
  const currentSunday = new Date(currentMonday);
  currentSunday.setDate(currentMonday.getDate() + 6);

  const allStartStr = formatDate(eightWeeksAgo);
  const allEndStr = formatDate(currentSunday);

  const allPoints = await getPointsByDateRange(allStartStr, allEndStr);
  const allReflections = await getReflectionsByDateRange(allStartStr, allEndStr);

  // --- Hero: Cumulative counts ---
  // Get ALL-TIME data for hero (wider range)
  const allTimePoints = await getPointsByDateRange('2020-01-01', todayStr);
  const allTimeReflections = await getReflectionsByDateRange('2020-01-01', todayStr);
  const allMorningCount = countAllMorningReflections();
  const totalMoments = allTimePoints.length;
  const totalReflections = allTimeReflections.length + allMorningCount;

  // "seit X Tagen dabei"
  let daysSinceStart = 0;
  const earliestPointDate = allTimePoints.length > 0 ? allTimePoints[0].date : null;
  const earliestMorning = getEarliestMorningDate();
  const earliestReflection = allTimeReflections.length > 0 ? allTimeReflections[0].date : null;
  const candidates = [earliestPointDate, earliestMorning, earliestReflection].filter(Boolean);
  if (candidates.length > 0) {
    const earliest = candidates.sort()[0];
    const earliestDate = new Date(earliest + 'T12:00:00');
    daysSinceStart = Math.floor((today - earliestDate) / 86400000) + 1;
  }

  const hasAnyActivity = totalMoments > 0 || totalReflections > 0;

  // --- Build HTML ---
  let html = `<div class="history-screen">`;

  // === Ebene 1: Hero ===
  html += `<div class="history-hero">`;
  if (hasAnyActivity) {
    const heroNumber = totalMoments;
    html += `<div class="history-hero-number">${heroNumber}</div>`;
    html += `<div class="history-hero-label">SMALL-Punkte</div>`;
    const detailParts = [];
    if (totalReflections > 0) detailParts.push(`${totalReflections} Reflexionen`);
    if (daysSinceStart > 1) detailParts.push(`seit ${daysSinceStart} Tagen dabei`);
    if (detailParts.length > 0) {
      html += `<div class="history-hero-detail">${detailParts.join(' · ')}</div>`;
    }
  } else {
    html += `<div class="history-hero-empty-title">Dein Weg beginnt hier.</div>`;
    html += `<div class="history-hero-empty-sub">Jeder Moment zählt — auch der erste.</div>`;
    html += `<a class="history-hero-cta" id="history-to-reflection">Zur Reflexion →</a>`;
  }
  html += `</div>`;

  // === Ebene 2: Diese Woche (große Card) ===
  const thisWeekEnd = formatDate(currentSunday);
  const thisWeekStart = formatDate(currentMonday);
  const thisWeekPoints = allPoints.filter(p => p.date >= thisWeekStart && p.date <= thisWeekEnd);
  const thisWeekReflections = allReflections.filter(r => r.date >= thisWeekStart && r.date <= thisWeekEnd);
  const thisWeekMornings = countMorningReflections(thisWeekStart, thisWeekEnd);
  const thisWeekReflCount = thisWeekReflections.length + thisWeekMornings;
  const thisWeekSummary = buildSummary(thisWeekReflCount, thisWeekPoints.length);
  const quatschiComment = getQuatschiWeekComment(thisWeekReflCount, thisWeekPoints.length);

  html += `<div class="history-week history-week-current">`;
  html += `<div class="history-week-header">DIESE WOCHE</div>`;
  html += `<div class="history-dots-large" id="hw-current-dots"></div>`;
  if (thisWeekSummary) {
    html += `<div class="history-week-summary">${thisWeekSummary}</div>`;
  }
  html += `<div class="history-quatschi">`;
  html += `<span class="history-quatschi-tag">— QUATSCHI</span>`;
  html += `<span class="history-quatschi-text">${quatschiComment}</span>`;
  html += `</div>`;
  html += `</div>`;

  // === Ebene 3: Vorwochen (kompakte Cards) ===
  const weekLabels = ['LETZTE WOCHE', 'VOR 2 WOCHEN', 'VOR 3 WOCHEN', 'VOR 4 WOCHEN', 'VOR 5 WOCHEN', 'VOR 6 WOCHEN', 'VOR 7 WOCHEN'];

  for (let w = 1; w <= 7; w++) {
    const monday = new Date(currentMonday);
    monday.setDate(currentMonday.getDate() - (w * 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const startStr = formatDate(monday);
    const endStr = formatDate(sunday);

    const weekPoints = allPoints.filter(p => p.date >= startStr && p.date <= endStr);
    const weekReflections = allReflections.filter(r => r.date >= startStr && r.date <= endStr);
    const weekMornings = countMorningReflections(startStr, endStr);
    const weekReflCount = weekReflections.length + weekMornings;
    const summary = buildSummary(weekReflCount, weekPoints.length);

    // Skip completely empty weeks at the end
    if (weekPoints.length === 0 && weekReflCount === 0) continue;

    html += `<div class="history-week history-week-past">`;
    html += `<div class="history-week-header-row">`;
    html += `<span class="history-week-header">${weekLabels[w - 1]}</span>`;
    if (summary) {
      html += `<span class="history-week-header-summary">${summary}</span>`;
    }
    html += `</div>`;
    html += `<div class="history-dots" id="hw-dots-${w}"></div>`;
    html += `</div>`;
  }

  html += `</div>`;
  container.innerHTML = html;

  // --- Render dots ---
  // Diese Woche: große Dots (gleich wie Dashboard)
  const currentDotsEl = document.getElementById('hw-current-dots');
  if (currentDotsEl) {
    renderWeekCircles(currentDotsEl, thisWeekPoints, thisWeekReflections, (dateStr) => showDayDetail(dateStr));
  }

  // Vorwochen: kleine Dots
  for (let w = 1; w <= 7; w++) {
    const dotsEl = document.getElementById(`hw-dots-${w}`);
    if (!dotsEl) continue;

    const monday = new Date(currentMonday);
    monday.setDate(currentMonday.getDate() - (w * 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const startStr = formatDate(monday);
    const endStr = formatDate(sunday);

    const weekPoints = allPoints.filter(p => p.date >= startStr && p.date <= endStr);
    const weekReflections = allReflections.filter(r => r.date >= startStr && r.date <= endStr);

    renderHistoryWeekDots(dotsEl, monday, weekPoints, weekReflections, (dateStr) => showDayDetail(dateStr));
  }

  // CTA link for empty state
  const ctaLink = document.getElementById('history-to-reflection');
  if (ctaLink) {
    ctaLink.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelector('.nav-tab[data-tab="reflection"]').click();
    });
  }
}
