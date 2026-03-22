// ============================================================
// Löwenherz PWA — Wochen-Card-Engine
// Data + Logic + Texte. Kein UI-Rendering.
// ============================================================

import { getAllPoints, getAllReflections } from './db.js';
import { getAllMilestones } from './milestones.js';
import { formatDate, getMonday } from './components/week-dots.js';

// --- Quatschi-Texte ---

export const weeklyQuatschiTexts = {
  zero: {
    quatschi: [
      "War ja klar.",
      "Eine Woche ohne dich. Ich hab's genossen. (Nein, hab ich nicht.)",
      "Null Punkte. Wie in den guten alten Zeiten."
    ],
    gundula: "Ein Punkt reicht. Gundula merkt sich den."
  },

  low: [
    "Das zählt nicht. Gundula sieht das anders.",
    "[X] Punkte. Da hab ich mehr Ausreden an einem Tag.",
    "Besser als nichts. Wobei — ist es das?",
    "Fast unsichtbar. (Gundula sieht trotzdem hin.)"
  ],

  medium: [
    "Ganz okay. Also für deine Verhältnisse.",
    "Das wird langsam unangenehm für mich.",
    "Ich will ja nichts sagen, aber das sieht nach System aus.",
    "[X] Punkte. Nicht beeindruckend. (Okay. Ein bisschen.)"
  ],

  high: [
    "Das muss ein Fehler in der App sein.",
    "Kannst du mal damit aufhören? Das wird peinlich. Für mich.",
    "[X] Punkte. Manche sagen beeindruckend. Ich sage verdächtig.",
    "Okay. Okay. Ich gebe zu: Damit hab ich nicht gerechnet."
  ],

  extreme: [
    "Ich möchte mich beschweren, aber mir fehlen die Argumente.",
    "Das ist lächerlich. Wirklich. (Fast ein Kompliment.)",
    "Ich brauche eine Pause. Ausgerechnet ich."
  ],

  firstWeekEver: {
    quatschi: "Deine erste Woche. Viel zu früh zum Feiern.",
    gundula: "Gundula feiert nicht. Aber sie vergisst auch nicht."
  },

  allSevenDays: "Jeden. Einzelnen. Tag. Ich verlange eine Erklärung.",

  pauseCard: {
    quatschi: "Oh, hallo. Ich hatte mich schon gemütlich eingerichtet hier.",
    gundula: "Ein Punkt reicht. Gundula merkt sich den."
  }
};

// --- Meilenstein Display-Namen, Icons, Texte ---

export const milestoneDisplayNames = {
  P1: "Dein erster bewusster Moment",
  P2: "Deine erste Reflexion",
  P3: "Morgens und abends",
  P4: "Alle fünf an einem Tag",
  P5: "Deine erste Woche",
  K1: "10 bewusste Momente",
  K2: "25 bewusste Momente",
  K3: "50 bewusste Momente",
  K4: "100 bewusste Momente",
  K5: "250 bewusste Momente",
  K6: "500 bewusste Momente",
  K7: "1.000 bewusste Momente",
  K8: "2.500 bewusste Momente",
  K9: "5.000 bewusste Momente",
  K10: "10.000 bewusste Momente",
  E1: "Dein erster Löwenherz-Moment",
  E2: "5 Wochen dabei",
  E3: "10 Wochen dabei",
  E4: "20 Wochen dabei",
  E5: "30 Wochen dabei",
  E6: "Ein ganzes Jahr"
};

export const milestoneIcons = {
  P1: "🌱", P2: "🌱", P3: "🌱", P4: "🌱", P5: "🌱",
  K1: "🏔", K2: "🏔", K3: "🏔", K4: "🏔", K5: "🏔",
  K6: "🏔", K7: "🏔", K8: "🏔", K9: "🏔", K10: "🏔",
  E1: "🦁", E2: "🦁", E3: "🦁", E4: "🦁", E5: "🦁", E6: "🦁"
};

export const milestoneTexts = {
  P1: { q: "Einer. Das ist kein Moment, das ist ein Zufall.", g: "Gundula hat ihn sich gemerkt." },
  P2: { q: "Na toll, jetzt redest du auch noch mit dir selbst.", g: "Gundula hört hin." },
  P3: { q: "Morgens UND abends? Das hält keine Woche.", g: "Gundula kennt keine Woche. Nur heute." },
  P4: { q: "Alle fünf an einem Tag? Anfängerglück.", g: "Gundula braucht kein Glück. Nur Wiederholung." },
  P5: { q: "Eine Woche. Meld dich in einem Jahr nochmal.", g: "Gundula meldet sich jetzt schon." },
  K1: { q: "Zehn? Andere machen das vor dem Frühstück.", g: "Gundula vergleicht nicht. Sie addiert." },
  K2: { q: "Statistisch noch irrelevant.", g: "Gundula kennt keine Statistik. Nur Erfahrung." },
  K3: { q: "Okay, fünfzig. Aber das beweist noch gar nichts.", g: null },
  K4: { q: "Hundert? Wahrscheinlich hast du falsch gezählt.", g: null },
  K5: { q: "Ich sage nicht, dass ich nervös werde. Ich sage nur: das ist ungewöhnlich.", g: null },
  K6: { q: "Fünfhundert. Das muss ein technischer Fehler sein.", g: null },
  K7: { q: "…", g: null },
  K8: { q: "Ich hätte da noch was zu sagen. Aber ich lass es mal.", g: null },
  K9: { q: "Ich bin noch da. Falls du dich gefragt hast.", g: null },
  K10: { q: null, g: null },
  E1: { q: "Löwenherz-Mood? Bisschen übertrieben, findest du nicht?", g: "Gundula übertreibt nie." },
  E2: { q: "Fünf Wochen. Anfängerglück hält normalerweise drei.", g: null },
  E3: { q: "Ich dachte, du hörst längst wieder auf.", g: null },
  E4: { q: "Das ist fast… nein. Nein, ich sag jetzt nichts.", g: null },
  E5: { q: "Ich hab ehrlich gesagt nichts mehr vorbereitet ab hier.", g: null },
  E6: { q: null, g: "Gundula auch." }
};

const earlyGundulaLines = [
  "Gundula nickt.",
  "Gundula hört hin.",
  "Gundula vergisst das nicht.",
  "Gundula zählt leise mit."
];

// --- Deterministic hash ---

function stableHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function stableIndex(weekId, arrayLength) {
  return stableHash(weekId) % arrayLength;
}

// --- ISO week helpers ---

function getISOWeekId(date) {
  const d = new Date(date);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 4);
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getMondayOfISOWeek(weekId) {
  // Parse "2026-W12" → Monday date
  const [yearStr, weekStr] = weekId.split('-W');
  const year = parseInt(yearStr);
  const week = parseInt(weekStr);

  // Jan 4 is always in ISO week 1
  const jan4 = new Date(year, 0, 4);
  const jan4DayOfWeek = (jan4.getDay() + 6) % 7; // Mon=0
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - jan4DayOfWeek + (week - 1) * 7);
  return monday;
}

function getSundayOfWeek(monday) {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return sunday;
}

// --- Morning reflections from localStorage ---

function getMorningReflectionDates() {
  const dates = new Set();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('morningReflection_')) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        if (data && data.completed) {
          dates.add(key.replace('morningReflection_', ''));
        }
      } catch (e) { /* skip */ }
    }
  }
  return dates;
}

// --- Quatschi level ---

function getQuatschiLevel(points) {
  if (points === 0) return 'zero';
  if (points <= 5) return 'low';
  if (points <= 15) return 'medium';
  if (points <= 30) return 'high';
  return 'extreme';
}

// --- Top letter ---

function getTopLetter(weekPoints) {
  if (weekPoints.length === 0) return null;
  const counts = {};
  for (const p of weekPoints) {
    counts[p.letter] = (counts[p.letter] || 0) + 1;
  }
  let topLetter = null;
  let topCount = 0;
  // Deterministic: alphabetical order for tie-breaking
  const sorted = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [letter, count] of sorted) {
    if (count > topCount) {
      topCount = count;
      topLetter = letter;
    }
  }
  return topLetter;
}

// --- Text selection ---

function selectQuatschiText(weekId, card, weekIndex) {
  const { quatschiLevel, allSevenDays, isFirstWeekEver, points } = card;

  // Priority 1: First week ever
  if (isFirstWeekEver) {
    return {
      quatschiText: weeklyQuatschiTexts.firstWeekEver.quatschi,
      gundulaText: weeklyQuatschiTexts.firstWeekEver.gundula
    };
  }

  // Priority 2: allSevenDays AND NOT extreme
  if (allSevenDays && quatschiLevel !== 'extreme') {
    return {
      quatschiText: weeklyQuatschiTexts.allSevenDays,
      gundulaText: null // Will be set by Gundula strategy below
    };
  }

  // Priority 3+4: Level-based text
  if (quatschiLevel === 'zero') {
    const idx = stableIndex(weekId, weeklyQuatschiTexts.zero.quatschi.length);
    return {
      quatschiText: weeklyQuatschiTexts.zero.quatschi[idx],
      gundulaText: weeklyQuatschiTexts.zero.gundula // Always for zero
    };
  }

  const pool = weeklyQuatschiTexts[quatschiLevel];
  const idx = stableIndex(weekId, pool.length);
  return {
    quatschiText: pool[idx],
    gundulaText: null
  };
}

function applyGundulaStrategy(card, weekId, weekIndex) {
  // weekIndex: 0-based chronological index of this card among all cards

  // Zero weeks and firstWeekEver already have Gundula set
  if (card.quatschiLevel === 'zero' || card.isFirstWeekEver) return;

  // First 4 weeks: add Gundula unless text already contains "Gundula"
  if (weekIndex < 4) {
    if (card.quatschiText && card.quatschiText.includes('Gundula')) return;
    const gundulaIdx = stableHash(weekId + '_gundula') % earlyGundulaLines.length;
    card.gundulaText = earlyGundulaLines[gundulaIdx];
  }
  // After week 4: no Gundula except for zero/pause/firstWeek (already handled)
}

// --- Card generation ---

let cachedCards = null;
let cachedLastWeekId = null;
let cachedPointsTotal = null;

function invalidateCache() {
  cachedCards = null;
  cachedLastWeekId = null;
  cachedPointsTotal = null;
}

export async function getWeeklyCards() {
  // Check if cache is still valid
  const currentTotal = localStorage.getItem('smallPointsTotal') || '0';
  if (cachedCards && cachedPointsTotal === currentTotal) {
    // Check if new weeks need to be added
    const today = new Date();
    const currentMonday = getMonday(today);
    const currentWeekId = getISOWeekId(currentMonday);

    // Last completed week = week before current
    const lastCompletedMonday = new Date(currentMonday);
    lastCompletedMonday.setDate(lastCompletedMonday.getDate() - 7);
    const lastCompletedWeekId = getISOWeekId(lastCompletedMonday);

    if (cachedLastWeekId === lastCompletedWeekId) {
      return cachedCards; // Cache still valid
    }
  }

  // Rebuild
  const allPoints = await getAllPoints();
  const allReflections = await getAllReflections();
  const morningDates = getMorningReflectionDates();

  // Find earliest activity
  let earliestDate = null;
  if (allPoints.length > 0) {
    const sorted = allPoints.map(p => p.date).sort();
    earliestDate = sorted[0];
  }
  for (const d of morningDates) {
    if (!earliestDate || d < earliestDate) earliestDate = d;
  }
  if (allReflections.length > 0) {
    const sorted = allReflections.map(r => r.date).sort();
    if (!earliestDate || sorted[0] < earliestDate) earliestDate = sorted[0];
  }

  if (!earliestDate) {
    cachedCards = [];
    cachedPointsTotal = currentTotal;
    return [];
  }

  // Determine week range
  const earliestMonday = getMonday(new Date(earliestDate + 'T12:00:00'));
  const today = new Date();
  const currentMonday = getMonday(today);

  // Group points by date
  const pointsByDate = {};
  for (const p of allPoints) {
    if (!pointsByDate[p.date]) pointsByDate[p.date] = [];
    pointsByDate[p.date].push(p);
  }

  // Group reflections by date
  const reflectionsByDate = {};
  for (const r of allReflections) {
    reflectionsByDate[r.date] = r;
  }

  // Generate cards for each completed week
  const cards = [];
  let isFirstWeekFound = false;
  const monday = new Date(earliestMonday);

  while (monday < currentMonday) {
    const weekId = getISOWeekId(monday);
    const sunday = getSundayOfWeek(monday);
    const startStr = formatDate(monday);
    const endStr = formatDate(sunday);

    // Collect week data
    let weekPoints = [];
    let morningCount = 0;
    let eveningCount = 0;
    const activeDaysSet = new Set();

    const d = new Date(monday);
    for (let i = 0; i < 7; i++) {
      const dateStr = formatDate(d);
      const dayPoints = pointsByDate[dateStr] || [];
      weekPoints = weekPoints.concat(dayPoints);
      if (dayPoints.length > 0) activeDaysSet.add(dateStr);
      if (morningDates.has(dateStr)) {
        morningCount++;
        activeDaysSet.add(dateStr);
      }
      if (reflectionsByDate[dateStr]) {
        eveningCount++;
        activeDaysSet.add(dateStr);
      }
      d.setDate(d.getDate() + 1);
    }

    const points = weekPoints.length;
    const activeDays = activeDaysSet.size;
    const hasActivity = points > 0 || morningCount > 0 || eveningCount > 0;

    // First week ever
    let isFirstWeekEver = false;
    if (!isFirstWeekFound && hasActivity) {
      isFirstWeekEver = true;
      isFirstWeekFound = true;
    }

    const quatschiLevel = getQuatschiLevel(points);

    const card = {
      id: weekId,
      startDate: startStr,
      endDate: endStr,
      feedDate: endStr,
      type: 'week',
      points,
      activeDays,
      morningReflections: morningCount,
      eveningReflections: eveningCount,
      topLetter: getTopLetter(weekPoints),
      allSevenDays: activeDays === 7,
      quatschiLevel,
      quatschiText: null,
      gundulaText: null,
      isFirstWeekEver
    };

    cards.push(card);

    // Advance to next Monday
    monday.setDate(monday.getDate() + 7);
  }

  // Apply text selection + Gundula strategy
  let cardIndex = 0;
  for (const card of cards) {
    if (card.type === 'week') {
      const texts = selectQuatschiText(card.id, card, cardIndex);
      card.quatschiText = texts.quatschiText;
      card.gundulaText = texts.gundulaText;
      applyGundulaStrategy(card, card.id, cardIndex);
      cardIndex++;
    }
  }

  // Collapse consecutive zero-weeks into pause cards
  const finalCards = collapsePauses(cards);

  // Cache
  const lastCompletedMonday = new Date(currentMonday);
  lastCompletedMonday.setDate(lastCompletedMonday.getDate() - 7);
  cachedCards = finalCards;
  cachedLastWeekId = getISOWeekId(lastCompletedMonday);
  cachedPointsTotal = currentTotal;

  const pauseCount = finalCards.filter(c => c.type === 'pause').length;
  const weekCount = finalCards.filter(c => c.type === 'week').length;
  console.log(`[WeeklyCards] Generated ${weekCount} week cards, ${pauseCount} pause cards`);

  // Debug
  window.debugWeeklyCards = finalCards;

  return finalCards;
}

// --- Pause collapse ---

function collapsePauses(cards) {
  const result = [];
  let pauseRun = [];

  function flushPauseRun() {
    if (pauseRun.length >= 2) {
      // Collapse into single pause card
      const first = pauseRun[0];
      const last = pauseRun[pauseRun.length - 1];
      result.push({
        id: `pause-${first.id}-${last.id}`,
        type: 'pause',
        feedDate: last.endDate,
        startWeek: first.id,
        endWeek: last.id,
        weeksCount: pauseRun.length,
        quatschiText: weeklyQuatschiTexts.pauseCard.quatschi,
        gundulaText: weeklyQuatschiTexts.pauseCard.gundula
      });
    } else if (pauseRun.length === 1) {
      // Single zero-week stays as normal card
      result.push(pauseRun[0]);
    }
    pauseRun = [];
  }

  for (const card of cards) {
    const isZero = card.type === 'week' && card.points === 0
      && card.morningReflections === 0 && card.eveningReflections === 0;

    if (isZero && !card.isFirstWeekEver) {
      pauseRun.push(card);
    } else {
      flushPauseRun();
      result.push(card);
    }
  }
  flushPauseRun();

  return result;
}

// --- Feed builder (merges milestones + week cards) ---

export async function buildFeed() {
  const weekCards = await getWeeklyCards();
  const milestones = await getAllMilestones();

  const feed = [];

  // Add week cards
  for (const card of weekCards) {
    feed.push({
      feedType: card.type, // "week" or "pause"
      feedDate: card.feedDate,
      data: card
    });
  }

  // Add milestones
  for (const m of milestones) {
    // Extract date part from ISO string
    const dateStr = m.date.substring(0, 10);
    feed.push({
      feedType: 'milestone',
      feedDate: dateStr,
      data: m
    });
  }

  // Sort: newest first. Same date: milestones before week cards
  feed.sort((a, b) => {
    const cmp = b.feedDate.localeCompare(a.feedDate);
    if (cmp !== 0) return cmp;
    // Same date: milestone first
    if (a.feedType === 'milestone' && b.feedType !== 'milestone') return -1;
    if (b.feedType === 'milestone' && a.feedType !== 'milestone') return 1;
    return 0;
  });

  window.debugFeed = feed;

  return feed;
}

// --- Cache invalidation (for external use) ---

export { invalidateCache as invalidateWeeklyCardsCache };
