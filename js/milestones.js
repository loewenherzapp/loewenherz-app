// ============================================================
// Löwenherz PWA — Milestone Engine
// Data + Logic only. No UI.
// ============================================================

import { getAllPoints, getAllReflections, getAllMilestonesDB, getMilestone, saveMilestone, getPointsByDate } from './db.js';

// --- Milestone Catalog ---

const MILESTONES = {
  // Premieren 🌱
  P1: { type: 'premiere', check: (ctx) => ctx.totalPoints >= 1 },
  P2: { type: 'premiere', check: (ctx) => ctx.totalReflections >= 1 },
  P3: { type: 'premiere', check: (ctx) => ctx.daysWithBothReflections >= 1 },
  P4: { type: 'premiere', check: (ctx) => ctx.daysWithAll5Letters >= 1 },
  P5: { type: 'premiere', check: (ctx) => ctx.weeksWithActivity >= 1 },

  // Kumulativ 🏔
  K1:  { type: 'cumulative', check: (ctx) => ctx.totalPoints >= 10 },
  K2:  { type: 'cumulative', check: (ctx) => ctx.totalPoints >= 25 },
  K3:  { type: 'cumulative', check: (ctx) => ctx.totalPoints >= 50 },
  K4:  { type: 'cumulative', check: (ctx) => ctx.totalPoints >= 100 },
  K5:  { type: 'cumulative', check: (ctx) => ctx.totalPoints >= 250 },
  K6:  { type: 'cumulative', check: (ctx) => ctx.totalPoints >= 500 },
  K7:  { type: 'cumulative', check: (ctx) => ctx.totalPoints >= 1000 },
  K8:  { type: 'cumulative', check: (ctx) => ctx.totalPoints >= 2500 },
  K9:  { type: 'cumulative', check: (ctx) => ctx.totalPoints >= 5000 },
  K10: { type: 'cumulative', check: (ctx) => ctx.totalPoints >= 10000 },

  // Entdeckungen 🦁
  E1: { type: 'discovery', check: (ctx) => ctx.lionMoodCount >= 1 },
  E2: { type: 'discovery', check: (ctx) => ctx.weeksWithActivity >= 5 },
  E3: { type: 'discovery', check: (ctx) => ctx.weeksWithActivity >= 10 },
  E4: { type: 'discovery', check: (ctx) => ctx.weeksWithActivity >= 20 },
  E5: { type: 'discovery', check: (ctx) => ctx.weeksWithActivity >= 30 },
  E6: { type: 'discovery', check: (ctx) => ctx.weeksWithActivity >= 52 },
};

// --- ISO Week helper ---

function getISOWeek(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 4);
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// --- Morning reflection helper ---

function getAllMorningReflections() {
  const results = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('morningReflection_')) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        if (data && data.completed) {
          results.push({ date: key.replace('morningReflection_', ''), data });
        }
      } catch (e) { /* skip */ }
    }
  }
  return results;
}

// --- Build context from all data ---

async function buildContext() {
  const allPoints = await getAllPoints();
  const allReflections = await getAllReflections();
  const morningReflections = getAllMorningReflections();

  const totalPoints = allPoints.length;
  const totalReflections = allReflections.length + morningReflections.length;

  // Days with both morning AND evening reflection
  const morningDates = new Set(morningReflections.map(r => r.date));
  const eveningDates = new Set(allReflections.map(r => r.date));
  let daysWithBothReflections = 0;
  for (const d of morningDates) {
    if (eveningDates.has(d)) daysWithBothReflections++;
  }

  // Days with all 5 SMALL letters
  const dayLetters = {};
  for (const p of allPoints) {
    if (!dayLetters[p.date]) dayLetters[p.date] = new Set();
    dayLetters[p.date].add(p.letter);
  }
  let daysWithAll5Letters = 0;
  for (const date in dayLetters) {
    const letters = dayLetters[date];
    if (letters.has('S') && letters.has('M') && letters.has('A') && letters.has('L1') && letters.has('L2')) {
      daysWithAll5Letters++;
    }
  }

  // Unique ISO weeks with at least 1 point
  const weekSet = new Set();
  for (const p of allPoints) {
    weekSet.add(getISOWeek(p.date));
  }
  const weeksWithActivity = weekSet.size;

  // Lion mood count (E1)
  const lionMoodCount = allReflections.filter(r => r.mood === 'lion').length;

  return {
    totalPoints,
    totalReflections,
    daysWithBothReflections,
    daysWithAll5Letters,
    weeksWithActivity,
    lionMoodCount,
    allPoints,
    allReflections,
    morningReflections
  };
}

// --- Find retroactive date for a milestone ---

function findRetroactiveDate(milestoneId, ctx) {
  const { allPoints, allReflections, morningReflections } = ctx;

  // Sort points by date ascending
  const sortedPoints = [...allPoints].sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));

  switch (milestoneId) {
    case 'P1': return sortedPoints[0]?.date || null;
    case 'P2': {
      const dates = [
        ...allReflections.map(r => r.date),
        ...morningReflections.map(r => r.date)
      ].sort();
      return dates[0] || null;
    }
    case 'P3': {
      const morningDates = new Set(morningReflections.map(r => r.date));
      const eveningDates = allReflections.map(r => r.date).sort();
      for (const d of eveningDates) {
        if (morningDates.has(d)) return d;
      }
      return null;
    }
    case 'P4': {
      const dayLetters = {};
      for (const p of sortedPoints) {
        if (!dayLetters[p.date]) dayLetters[p.date] = new Set();
        dayLetters[p.date].add(p.letter);
        if (dayLetters[p.date].size >= 5) return p.date;
      }
      return null;
    }
    case 'P5': return sortedPoints[0]?.date || null;

    // Cumulative: find the point at which threshold was reached
    case 'K1': case 'K2': case 'K3': case 'K4': case 'K5':
    case 'K6': case 'K7': case 'K8': case 'K9': case 'K10': {
      const thresholds = { K1: 10, K2: 25, K3: 50, K4: 100, K5: 250, K6: 500, K7: 1000, K8: 2500, K9: 5000, K10: 10000 };
      const threshold = thresholds[milestoneId];
      if (sortedPoints.length >= threshold) {
        return sortedPoints[threshold - 1].date;
      }
      return null;
    }

    case 'E1': {
      const lionRefl = allReflections.filter(r => r.mood === 'lion').sort((a, b) => a.date.localeCompare(b.date));
      return lionRefl[0]?.date || null;
    }

    // Discovery E2-E6: find the date when Nth unique week was reached
    case 'E2': case 'E3': case 'E4': case 'E5': case 'E6': {
      const thresholds = { E2: 5, E3: 10, E4: 20, E5: 30, E6: 52 };
      const threshold = thresholds[milestoneId];
      const seenWeeks = new Set();
      for (const p of sortedPoints) {
        seenWeeks.add(getISOWeek(p.date));
        if (seenWeeks.size >= threshold) return p.date;
      }
      return null;
    }

    default: return null;
  }
}

// --- Check and award milestones ---

async function checkAndAward(ctx, retroactive = false) {
  const existing = await getAllMilestonesDB();
  const existingIds = new Set(existing.map(m => m.id));
  const newMilestones = [];

  for (const [id, def] of Object.entries(MILESTONES)) {
    if (existingIds.has(id)) continue;

    if (def.check(ctx)) {
      let dateStr;
      if (retroactive) {
        const retroDate = findRetroactiveDate(id, ctx);
        dateStr = retroDate ? new Date(retroDate + 'T12:00:00').toISOString() : new Date().toISOString();
      } else {
        dateStr = new Date().toISOString();
      }

      const milestone = {
        id,
        type: def.type,
        date: dateStr,
        retroactive,
        seen: false
      };

      await saveMilestone(milestone);
      newMilestones.push(milestone);
      console.log(`[Milestone] ${id} reached at ${dateStr}${retroactive ? ' (retroactive)' : ''}`);

      // Fire event for UI (badge-dot, toast)
      try {
        window.dispatchEvent(new CustomEvent('milestoneReached', {
          detail: { id, type: def.type, date: dateStr, retroactive }
        }));
      } catch (e) { /* SSR safety */ }
    }
  }

  return newMilestones;
}

// --- Public API ---

/**
 * Run after a SMALL-tap or reflection completion.
 * Async, non-blocking — call with fire-and-forget.
 */
export async function checkMilestones() {
  try {
    // Update smallPointsTotal cache
    const allPoints = await getAllPoints();
    localStorage.setItem('smallPointsTotal', String(allPoints.length));

    const ctx = await buildContext();
    const newMilestones = await checkAndAward(ctx, false);

    if (newMilestones.length > 0) {
      console.log(`[Milestone] ${newMilestones.length} new milestone(s) awarded`);
    }

    return newMilestones;
  } catch (e) {
    console.warn('[Milestone] Check failed:', e);
    return [];
  }
}

/**
 * Run once on first load when milestones store is empty but data exists.
 * Reconstructs all already-earned milestones from historical data.
 */
export async function retroactiveScan() {
  try {
    const existing = await getAllMilestonesDB();
    if (existing.length > 0) return; // Already scanned

    const allPoints = await getAllPoints();
    if (allPoints.length === 0) return; // No data to scan

    console.log('[Milestone] Retroactive scan starting...');

    // Init smallPointsTotal
    localStorage.setItem('smallPointsTotal', String(allPoints.length));

    const ctx = await buildContext();
    const newMilestones = await checkAndAward(ctx, true);

    console.log(`[Milestone] Retroactive scan: found ${newMilestones.length} milestones`);
    return newMilestones;
  } catch (e) {
    console.warn('[Milestone] Retroactive scan failed:', e);
    return [];
  }
}

/**
 * Mark all unseen milestones as seen. Call when Verlauf-Tab is opened.
 */
export async function markMilestonesSeen() {
  try {
    const all = await getAllMilestonesDB();
    for (const m of all) {
      if (!m.seen) {
        m.seen = true;
        await saveMilestone(m);
      }
    }
  } catch (e) {
    console.warn('[Milestone] markSeen failed:', e);
  }
}

/**
 * Get count of unseen milestones (for badge dot).
 */
export async function getUnseenMilestoneCount() {
  try {
    const all = await getAllMilestonesDB();
    return all.filter(m => !m.seen).length;
  } catch (e) {
    return 0;
  }
}

/**
 * Get all milestones sorted by date (newest first).
 */
export async function getAllMilestones() {
  try {
    const all = await getAllMilestonesDB();
    return all.sort((a, b) => b.date.localeCompare(a.date));
  } catch (e) {
    return [];
  }
}

/**
 * Initialize: run retroactive scan on first load, init smallPointsTotal.
 */
export async function initMilestones() {
  try {
    // Ensure smallPointsTotal is in sync
    const allPoints = await getAllPoints();
    localStorage.setItem('smallPointsTotal', String(allPoints.length));

    // Retroactive scan if milestones store is empty
    await retroactiveScan();
  } catch (e) {
    console.warn('[Milestone] Init failed:', e);
  }
}
