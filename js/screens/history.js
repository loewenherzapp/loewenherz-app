// ============================================================
// History — "Verlauf" tab — Feed-UI (Phase 3)
// ============================================================

import { TEXTS } from '../../content/de.js';
import { getPointsByDate, getPointsByDateRange, getReflectionByDate, getReflectionsByDateRange } from '../db.js';
import { formatDate, getMonday, renderWeekCircles } from '../components/week-dots.js';
import { buildFeed, milestoneDisplayNames, milestoneIcons, milestoneTexts } from '../weekly-cards.js';


const MOOD_MAP = {};
TEXTS.ui.reflection.moods.forEach(m => { MOOD_MAP[m.key] = m; });

// --- Quatschi Wochen-Kommentare (für "Diese Woche" live-card) ---
const WEEK_QUATSCHI = [
  [
    "Ruhige Woche. Auch das gehört dazu.",
    "Keine Punkte, kein Urteil. Gundula wartet geduldig.",
    "Quatschi hat die Woche gewonnen. Aber Gundula führt im Gesamtklassement."
  ],
  [
    "Ein paar Momente. Mehr als null. Genau so.",
    "Quatschi findet, das zählt nicht. Gundula sieht das anders.",
    "Gundula hat das registriert. Leise, aber registriert."
  ],
  [
    "Dein Feldweg bekommt Reifenspuren.",
    "Quatschi hat dreimal versucht zu moderieren. Dreimal überstimmt.",
    "Gundula nickt öfter als sonst. Fällt dir das auf?"
  ],
  [
    "Quatschi verliert langsam die Übersicht. Gut so.",
    "Quatschi hat eine Beschwerde eingereicht. Abgelehnt.",
    "Gundula chillt im Schatten. Quatschi ist irritiert."
  ],
  [
    "Quatschi überlegt, ob er sich einen neuen Job suchen soll.",
    "Radio Bullshit meldet: Empfangsstörung. Bitte nicht beheben.",
    "Gundula hat die Autobahn-Ausfahrt dekoriert. Mit Blumen."
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
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return pool[dayOfYear % pool.length];
}

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

function buildSummary(reflCount, pointCount) {
  const parts = [];
  if (reflCount > 0) parts.push(`${reflCount} Refl.`);
  if (pointCount > 0) parts.push(`${pointCount} Punkte`);
  return parts.join(' · ');
}

/**
 * Day detail popup
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

// --- Date formatting helpers ---

const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

function formatDateRange(startStr, endStr) {
  const s = new Date(startStr + 'T12:00:00');
  const e = new Date(endStr + 'T12:00:00');
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()}.–${e.getDate()}. ${MONTH_NAMES[s.getMonth()]}`;
  }
  return `${s.getDate()}. ${MONTH_NAMES[s.getMonth()]} – ${e.getDate()}. ${MONTH_NAMES[e.getMonth()]}`;
}

function formatFullDate(isoStr) {
  const d = new Date(isoStr);
  return `${d.getDate()}. ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function getKW(weekId) {
  return weekId.replace(/^\d{4}-W0?/, 'KW ');
}

// --- SMALL letter display ---

const LETTER_DISPLAY = { S: 'S', M: 'M', A: 'A', L1: 'L', L2: 'L' };

// --- Feed Card Renderers ---

function renderWeekCard(item) {
  const d = item.data;
  const isZero = d.points === 0 && d.morningReflections === 0 && d.eveningReflections === 0;
  const kwLabel = getKW(d.id);
  const dateRange = formatDateRange(d.startDate, d.endDate);

  let html = `<div class="feed-card feed-week">`;
  html += `<div class="feed-card-header">${kwLabel} · ${dateRange}</div>`;

  if (!isZero) {
    // Stats
    const statParts = [];
    if (d.points > 0) statParts.push(`${d.points} Punkte`);
    if (d.activeDays > 0) statParts.push(`${d.activeDays} aktive Tage`);
    if (statParts.length > 0) {
      html += `<div class="feed-card-stats">${statParts.join(' · ')}</div>`;
    }

    // Reflexion emojis
    const sunCount = Math.min(d.morningReflections, 7);
    const moonCount = Math.min(d.eveningReflections, 7);
    if (sunCount > 0 || moonCount > 0) {
      let emojis = '☀️'.repeat(sunCount);
      if (sunCount > 0 && moonCount > 0) emojis += ' · ';
      emojis += '🌙'.repeat(moonCount);
      html += `<div class="feed-card-emojis">${emojis}</div>`;
    }

    // Top letter (only if points >= 5)
    if (d.topLetter && d.points >= 5) {
      html += `<div class="feed-card-topletter">Lieblingsbuchstabe: ${LETTER_DISPLAY[d.topLetter] || d.topLetter}</div>`;
    }
  }

  // Quatschi
  if (d.quatschiText) {
    const text = d.quatschiText.replace('[X]', String(d.points));
    html += `<div class="feed-quatschi">`;
    html += `<span class="feed-quatschi-tag">— QUATSCHI</span>`;
    html += `<span class="feed-quatschi-text">"${text}"</span>`;
    html += `</div>`;
  }

  // Gundula
  if (d.gundulaText) {
    html += `<div class="feed-gundula">${d.gundulaText}</div>`;
  }

  html += `</div>`;
  return html;
}

function renderPauseCard(item) {
  const d = item.data;
  let html = `<div class="feed-card feed-pause">`;
  html += `<div class="feed-pause-title">Eine Pause.</div>`;

  if (d.quatschiText) {
    html += `<div class="feed-quatschi">`;
    html += `<span class="feed-quatschi-tag">— QUATSCHI</span>`;
    html += `<span class="feed-quatschi-text">"${d.quatschiText}"</span>`;
    html += `</div>`;
  }
  if (d.gundulaText) {
    html += `<div class="feed-gundula">${d.gundulaText}</div>`;
  }

  html += `</div>`;
  return html;
}

function renderMilestoneCard(item) {
  const m = item.data;
  const name = milestoneDisplayNames[m.id] || m.id;
  const icon = milestoneIcons[m.id] || '🏔';
  const texts = milestoneTexts[m.id] || { q: null, g: null };
  const dateStr = formatFullDate(m.date);

  let html = `<div class="feed-card feed-milestone">`;
  html += `<div class="feed-milestone-icon">${icon}</div>`;
  html += `<div class="feed-milestone-name">${name}</div>`;
  html += `<div class="feed-milestone-date">${dateStr}</div>`;

  // Special renderings
  if (m.id === 'K10') {
    // Regieanweisung: Quatschi hat den Raum verlassen.
    html += `<div class="feed-stage-direction">Quatschi hat den Raum verlassen.</div>`;
  } else if (m.id === 'E6') {
    // Regieanweisung: Quatschi zieht den Hut.
    html += `<div class="feed-stage-direction">Quatschi zieht den Hut.</div>`;
    if (texts.g) {
      html += `<div class="feed-stage-direction">${texts.g}</div>`;
    }
  } else {
    // Normal Quatschi
    if (texts.q) {
      html += `<div class="feed-quatschi">`;
      html += `<span class="feed-quatschi-tag">— QUATSCHI</span>`;
      html += `<span class="feed-quatschi-text">"${texts.q}"</span>`;
      html += `</div>`;
    }
    if (texts.g) {
      html += `<div class="feed-gundula">${texts.g}</div>`;
    }
  }

  html += `</div>`;
  return html;
}

// --- Monats-Collapse ---

function groupByMonth(feedItems) {
  const months = {};
  for (const item of feedItems) {
    const d = new Date(item.feedDate + 'T12:00:00');
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!months[key]) months[key] = { key, items: [], label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` };
    months[key].items.push(item);
  }
  return Object.values(months).sort((a, b) => b.key.localeCompare(a.key));
}

function getMonthStats(items) {
  let weeks = 0, milestones = 0, points = 0;
  for (const item of items) {
    if (item.feedType === 'week') { weeks++; points += item.data.points || 0; }
    else if (item.feedType === 'milestone') milestones++;
    // pause cards don't count as weeks
  }
  return { weeks, milestones, points };
}

// ============================================================
// Main Render
// ============================================================

export async function renderHistory(container, profile) {
  const today = new Date();
  const todayStr = formatDate(today);
  const currentMonday = getMonday(today);

  // --- Data for Hero + Diese Woche ---
  const currentSunday = new Date(currentMonday);
  currentSunday.setDate(currentMonday.getDate() + 6);
  const thisWeekStart = formatDate(currentMonday);
  const thisWeekEnd = formatDate(currentSunday);

  const allTimePoints = await getPointsByDateRange('2020-01-01', todayStr);
  const allTimeReflections = await getReflectionsByDateRange('2020-01-01', todayStr);
  const allMorningCount = countAllMorningReflections();
  const totalMoments = allTimePoints.length;
  const totalReflections = allTimeReflections.length + allMorningCount;

  let daysSinceStart = 0;
  const earliestPointDate = allTimePoints.length > 0 ? allTimePoints[0].date : null;
  const earliestMorning = getEarliestMorningDate();
  const earliestReflection = allTimeReflections.length > 0 ? allTimeReflections[0].date : null;
  const candidates = [earliestPointDate, earliestMorning, earliestReflection].filter(Boolean);
  if (candidates.length > 0) {
    const earliest = candidates.sort()[0];
    daysSinceStart = Math.floor((today - new Date(earliest + 'T12:00:00')) / 86400000) + 1;
  }

  const hasAnyActivity = totalMoments > 0 || totalReflections > 0;

  // Diese Woche data
  const thisWeekPoints = allTimePoints.filter(p => p.date >= thisWeekStart && p.date <= thisWeekEnd);
  const thisWeekReflections = allTimeReflections.filter(r => r.date >= thisWeekStart && r.date <= thisWeekEnd);
  const thisWeekMornings = countMorningReflections(thisWeekStart, thisWeekEnd);
  const thisWeekReflCount = thisWeekReflections.length + thisWeekMornings;
  const thisWeekSummary = buildSummary(thisWeekReflCount, thisWeekPoints.length);
  const quatschiComment = getQuatschiWeekComment(thisWeekReflCount, thisWeekPoints.length);

  // --- Build Feed ---
  const feed = await buildFeed();

  // --- Build HTML ---
  let html = `<div class="history-screen">`;

  // === Hero ===
  html += `<div class="history-hero">`;
  if (hasAnyActivity) {
    html += `<div class="history-hero-number">${totalMoments}</div>`;
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

  // === Diese Woche ===
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

  // === Feed ===
  html += `<div class="feed-container" id="feed-container">`;

  if (feed.length === 0 && !hasAnyActivity) {
    html += `<div class="feed-card feed-empty">`;
    html += `<div class="feed-empty-text">Dein erster SMALL-Punkt startet deinen Verlauf.</div>`;
    html += `<a class="feed-empty-cta" id="feed-to-dashboard">Zum Dashboard →</a>`;
    html += `</div>`;
  } else if (feed.length > 0) {
    // Determine which items to show open vs collapsed
    const COLLAPSE_THRESHOLD = 8;
    const RECENT_WEEKS = 4;

    if (feed.length <= COLLAPSE_THRESHOLD) {
      // All open
      feed.forEach((item, i) => {
        html += renderFeedItem(item, i);
      });
    } else {
      // Find cutoff: show recent items open, collapse older by month
      // Recent = items from the last RECENT_WEEKS completed weeks
      const recentCutoff = new Date(currentMonday);
      recentCutoff.setDate(recentCutoff.getDate() - RECENT_WEEKS * 7);
      const recentCutoffStr = formatDate(recentCutoff);

      const recentItems = feed.filter(f => f.feedDate >= recentCutoffStr);
      const olderItems = feed.filter(f => f.feedDate < recentCutoffStr);

      // Render recent items open
      recentItems.forEach((item, i) => {
        html += renderFeedItem(item, i);
      });

      // Group older items by month and render collapsed
      if (olderItems.length > 0) {
        const months = groupByMonth(olderItems);
        months.forEach(month => {
          const stats = getMonthStats(month.items);
          const statParts = [];
          if (stats.weeks > 0) statParts.push(`${stats.weeks} Woche${stats.weeks > 1 ? 'n' : ''}`);
          if (stats.milestones > 0) statParts.push(`${stats.milestones} Meilenstein${stats.milestones > 1 ? 'e' : ''}`);

          html += `<div class="feed-month-collapse" data-month="${month.key}">`;
          html += `<div class="feed-month-header">`;
          html += `<span class="feed-month-chevron">▸</span>`;
          html += `<div class="feed-month-info">`;
          html += `<span class="feed-month-label">${month.label}</span>`;
          if (statParts.length > 0) html += `<span class="feed-month-stats">${statParts.join(' · ')}</span>`;
          if (stats.points > 0) html += `<span class="feed-month-points">${stats.points} Punkte</span>`;
          html += `</div>`;
          html += `</div>`;
          html += `<div class="feed-month-content">`;
          month.items.forEach((item, i) => {
            html += renderFeedItem(item, i);
          });
          html += `</div>`;
          html += `</div>`;
        });
      }
    }
  }

  html += `</div>`; // feed-container
  html += `</div>`; // history-screen

  container.innerHTML = html;

  // --- Dots for "Diese Woche" ---
  const currentDotsEl = document.getElementById('hw-current-dots');
  if (currentDotsEl) {
    renderWeekCircles(currentDotsEl, thisWeekPoints, thisWeekReflections, (dateStr) => showDayDetail(dateStr));
  }

  // --- Month collapse handlers ---
  document.querySelectorAll('.feed-month-header').forEach(header => {
    header.addEventListener('click', () => {
      const collapse = header.closest('.feed-month-collapse');
      const content = collapse.querySelector('.feed-month-content');
      const chevron = collapse.querySelector('.feed-month-chevron');
      const isOpen = collapse.classList.contains('open');

      if (isOpen) {
        // Close: capture height for smooth transition
        const height = content.scrollHeight;
        content.style.maxHeight = height + 'px';
        requestAnimationFrame(() => {
          content.style.maxHeight = '0px';
        });
        collapse.classList.remove('open');
        chevron.textContent = '▸';
      } else {
        // Open
        content.style.maxHeight = content.scrollHeight + 'px';
        collapse.classList.add('open');
        chevron.textContent = '▾';
        // After transition, remove max-height for dynamic content
        content.addEventListener('transitionend', () => {
          if (collapse.classList.contains('open')) {
            content.style.maxHeight = 'none';
          }
        }, { once: true });
      }
    });
  });

  // --- CTA links ---
  const ctaLink = document.getElementById('history-to-reflection');
  if (ctaLink) {
    ctaLink.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelector('.nav-tab[data-tab="reflection"]').click();
    });
  }
  const dashCta = document.getElementById('feed-to-dashboard');
  if (dashCta) {
    dashCta.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelector('.nav-tab[data-tab="today"]').click();
    });
  }

  // --- FadeUp animation ---
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReduced) {
    const cards = container.querySelectorAll('.feed-card, .feed-month-collapse');
    const maxAnimate = 8;
    cards.forEach((card, i) => {
      if (i < maxAnimate) {
        card.style.opacity = '0';
        card.style.transform = 'translateY(12px)';
        setTimeout(() => {
          card.style.transition = 'opacity 0.35s ease-out, transform 0.35s ease-out';
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        }, 50 * i);
      }
    });
  }
}

function renderFeedItem(item, index) {
  if (item.feedType === 'week') return renderWeekCard(item);
  if (item.feedType === 'pause') return renderPauseCard(item);
  if (item.feedType === 'milestone') return renderMilestoneCard(item);
  return '';
}
