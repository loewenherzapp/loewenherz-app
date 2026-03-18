// ============================================================
// Reflection — Morgen/Abend Hub + Abend-Flow
// ============================================================

import { TEXTS } from '../../content/de.js';
import { getReflectionByDate, getReflectionsByDateRange, saveReflection, addSmallPoint } from '../db.js';
import { formatDate } from '../components/week-dots.js';
import { getReflectionEndComment } from '../quatschi.js';

const MOOD_MAP = {};
TEXTS.ui.reflection.moods.forEach(m => { MOOD_MAP[m.key] = m; });

// Quatschi-Sprüche für Erledigt-States
const MORNING_DONE_QUATSCHI = [
  "Quatschi hatte andere Pläne für deinen Morgen. Pech.",
  "Erledigt. Quatschi ist noch nicht mal wach.",
  "Weiche gestellt. Der Rest ist Bonus.",
  "Quatschi wollte moderieren. Zu spät.",
  "Morgenreflexion gemacht. Quatschi ist irritiert."
];

const EVENING_DONE_QUATSCHI = [
  "Tag abgehakt. Quatschi muss warten bis morgen.",
  "Reflexion gemacht. Gundula nickt zufrieden.",
  "Erledigt. Der Tag gehört dir.",
  "Quatschi wollte noch grübeln. Zu spät, Feierabend.",
  "Gute Nacht, Quatschi. Morgen darfst du wieder."
];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Morning reflection localStorage helpers
function saveMorningReflectionDone(dateStr, chipId, customText) {
  localStorage.setItem('morningReflection_' + dateStr, JSON.stringify({
    completed: true,
    completedAt: new Date().toISOString(),
    chip: chipId,
    customText: customText || null,
    points: 3
  }));
}

function isMorningReflectionDone(dateStr) {
  const data = localStorage.getItem('morningReflection_' + dateStr);
  return data ? JSON.parse(data).completed : false;
}

// Intention chips config
const INTENTION_CHIPS = [
  { id: 'wie-wasser', label: 'Wie Wasser' },
  { id: 'neugierig', label: 'Neugierig' },
  { id: 'machen-statt-denken', label: 'Machen statt denken' },
  { id: 'dran-bleiben', label: 'Dran bleiben' },
  { id: 'freundlich-mit-mir', label: 'Freundlich mit mir' },
  { id: 'eigene', label: 'Eigene…' }
];

const WENN_DANN_TEXTS = {
  'wie-wasser': 'Irgendwann heute wird es eng. Du merkst es\u2009—\u2009atmest aus und lässt es durch. Nicht dein Kampf.',
  'neugierig': 'Irgendwann heute schlägt Quatschi Alarm. Du merkst es\u2009—\u2009trittst einen Schritt zurück und schaust zu. Was passiert hier eigentlich?',
  'machen-statt-denken': 'Irgendwann heute will dein Kopf ein Problem endlos drehen. Du merkst es\u2009—\u2009und tust den nächsten Schritt, egal wie klein.',
  'dran-bleiben': 'Heute wird ein Moment kommen, in dem du denkst: Egal. Du merkst es\u2009—\u2009und machst weiter. Nicht perfekt. Einfach weiter.',
  'freundlich-mit-mir': 'Heute wirst du streng mit dir sein. Du merkst es\u2009—\u2009und stellst dir vor, wie du mit einer Freundin reden würdest. Genau so.',
  'eigene': 'Du hast dir vorgenommen, wie du heute sein willst. Irgendwann wird ein Moment kommen, der das testet. Du merkst es\u2009—\u2009und erinnerst dich: Das war mein Plan.'
};

export async function renderReflection(container, profile) {
  const todayStr = formatDate(new Date());
  const hour = new Date().getHours();

  // Check statuses
  const morningDone = isMorningReflectionDone(todayStr);
  const eveningReflection = await getReflectionByDate(todayStr);
  const eveningDone = !!eveningReflection;

  // Time windows (DEBUG: temporarily always active — revert after testing)
  const morningActive = true; // hour >= 5 && hour <= 11;
  const eveningActive = true; // hour >= 18 || hour <= 4;

  // Get recent reflections for emoji row
  const sevenAgo = new Date();
  sevenAgo.setDate(sevenAgo.getDate() - 7);
  const recentReflections = await getReflectionsByDateRange(formatDate(sevenAgo), todayStr);

  let html = `<div class="reflection-screen" style="justify-content:flex-start;padding-top:16px;">`;

  // Hub cards
  html += `<div class="ref-hub-cards">`;

  // === Morning Card ===
  const morningClass = morningDone ? 'done' : (!morningActive ? 'inactive' : '');
  html += `<div class="ref-hub-card ref-card-morning ${morningClass}">`;
  html += `<div class="ref-card-header"><span class="ref-card-icon">☀️</span><span class="ref-card-title">Morgenreflexion</span></div>`;

  if (morningDone) {
    html += `<div class="ref-card-sub done-quatschi">${randomFrom(MORNING_DONE_QUATSCHI)}</div>`;
    html += `<div class="ref-card-points">+3 Gundula-Punkte ✓</div>`;
  } else if (morningActive) {
    html += `<div class="ref-card-sub">Wie willst du heute sein?</div>`;
    html += `<button class="ref-card-btn" id="morning-start">Jetzt starten</button>`;
  } else {
    html += `<div class="ref-card-sub">Morgen wieder ab 5 Uhr</div>`;
  }

  html += `</div>`;

  // === Evening Card ===
  const eveningClass = eveningDone ? 'done' : (!eveningActive ? 'inactive' : '');
  html += `<div class="ref-hub-card ref-card-evening ${eveningClass}">`;
  html += `<div class="ref-card-header"><span class="ref-card-icon">🌙</span><span class="ref-card-title">Abendreflexion</span></div>`;

  if (eveningDone) {
    html += `<div class="ref-card-sub done-quatschi">${randomFrom(EVENING_DONE_QUATSCHI)}</div>`;
    html += `<div class="ref-card-points">+2 Gundula-Punkte ✓</div>`;
  } else if (eveningActive) {
    html += `<div class="ref-card-sub">Zwei Minuten für dich. Der Tag kann warten.</div>`;
    html += `<button class="ref-card-btn" id="evening-start">Jetzt reflektieren</button>`;
  } else {
    html += `<div class="ref-card-sub">Ab 18 Uhr</div>`;
  }

  html += `</div>`;
  html += `</div>`; // end ref-hub-cards

  // 7-day emoji row
  const dayLabels = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const t = TEXTS.ui.reflection;
  html += `<div style="font-size:11px;color:var(--ref-muted);margin-bottom:8px;">${t.lastDays}</div>`;
  html += `<div class="reflection-emoji-row">`;
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = formatDate(d);
    const ref = recentReflections.find(r => r.date === ds);
    const emoji = ref && MOOD_MAP[ref.mood] ? MOOD_MAP[ref.mood].emoji : '';
    const dayLabel = dayLabels[d.getDay()];
    html += `<div class="reflection-day-wrap"><div class="reflection-emoji-day">${emoji}</div><div class="reflection-day-label">${dayLabel}</div></div>`;
  }
  html += `</div>`;

  html += `</div>`; // end reflection-screen

  container.innerHTML = html;

  // Event handlers
  const morningBtn = document.getElementById('morning-start');
  if (morningBtn) {
    morningBtn.addEventListener('click', () => {
      startMorningFlow(container, profile);
    });
  }

  const eveningBtn = document.getElementById('evening-start');
  if (eveningBtn) {
    eveningBtn.addEventListener('click', () => {
      startReflectionFlow(container, profile);
    });
  }
}

function startMorningFlow(container, profile) {
  let selectedChip = null;
  let customText = '';

  // Set morning gradient
  const appEl = document.getElementById('app');
  appEl.setAttribute('data-mood', 'morning');

  renderMorningStep1();

  function morningProgressDots(activeStep) {
    return `<div class="progress-dots">${[1,2].map(i =>
      `<div class="progress-dot${i === activeStep ? ' active' : ''}"></div>`
    ).join('')}</div>`;
  }

  function renderMorningStep1() {
    let html = `<div class="reflection-screen">`;
    html += morningProgressDots(1);
    html += `<div class="ref-question">Wie willst du heute sein?</div>`;
    html += `<div class="intention-chips" id="intention-chips">`;

    INTENTION_CHIPS.forEach(chip => {
      const isCustom = chip.id === 'eigene';
      html += `<button class="intention-chip${isCustom ? ' intention-chip-custom' : ''}" data-chip="${chip.id}">${chip.label}</button>`;
    });

    html += `</div>`;
    html += `<div class="intention-custom-wrap hidden" id="custom-wrap">`;
    html += `<input type="text" class="intention-custom-input" id="custom-input" placeholder="Meine Haltung heute…" maxlength="50">`;
    html += `</div>`;
    html += `<button class="btn-primary" id="morning-next" disabled>Weiter →</button>`;
    html += `</div>`;

    container.innerHTML = html;

    const chips = container.querySelectorAll('.intention-chip');
    const nextBtn = document.getElementById('morning-next');
    const customWrap = document.getElementById('custom-wrap');
    const customInput = document.getElementById('custom-input');

    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const chipId = chip.dataset.chip;

        // Deselect all
        chips.forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');

        if (chipId === 'eigene') {
          customWrap.classList.remove('hidden');
          customWrap.classList.add('visible');
          selectedChip = 'eigene';
          customText = customInput.value.trim();
          nextBtn.disabled = customText.length === 0;
          setTimeout(() => customInput.focus(), 200);
        } else {
          customWrap.classList.remove('visible');
          customWrap.classList.add('hidden');
          customText = '';
          selectedChip = chipId;
          nextBtn.disabled = false;
        }
      });
    });

    customInput.addEventListener('input', () => {
      customText = customInput.value.trim();
      nextBtn.disabled = customText.length === 0;
    });

    nextBtn.addEventListener('click', () => {
      if (selectedChip) renderMorningStep2();
    });
  }

  function renderMorningStep2() {
    const wennDannText = WENN_DANN_TEXTS[selectedChip];
    const showCustomLabel = selectedChip === 'eigene' && customText;

    let html = `<div class="reflection-screen">`;
    html += morningProgressDots(2);
    html += `<div class="morning-viz">`;
    html += `<div class="morning-sun">☀️</div>`;

    if (showCustomLabel) {
      html += `<div class="morning-custom-label">${customText}</div>`;
    }

    html += `<div class="morning-wenn-dann">${wennDannText}</div>`;
    html += `</div>`;

    // Separator + Closer
    html += `<div class="goodnight">`;
    html += `<div class="goodnight-line"></div>`;
    html += `<div class="goodnight-text">Guten Morgen, Löwenherz.</div>`;
    html += `</div>`;

    html += `<div class="mt-24">`;
    html += `<button class="btn-primary" id="morning-close">Schließen</button>`;
    html += `</div>`;

    html += `</div>`;

    container.innerHTML = html;

    document.getElementById('morning-close').addEventListener('click', async () => {
      const todayStr = formatDate(new Date());
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

      // +3 Gundula-Punkte
      // Gundula-Score is day-based (unique days with ≥1 point in last 7 days)
      // Adding 3 points increases today's total but thresholds are day-based, not point-based
      // TODO: Schwellenwerte prüfen falls nötig — neuer theoretischer Max-Tagesscore ist 10 statt 5 (3 Morgen + 5 SMALL + 2 Abend)
      await addSmallPoint({ date: todayStr, time: timeStr, letter: 'S', category: 'morning-reflection', categoryLabel: 'Morgenreflexion' });
      await addSmallPoint({ date: todayStr, time: timeStr, letter: 'M', category: 'morning-reflection', categoryLabel: 'Morgenreflexion' });
      await addSmallPoint({ date: todayStr, time: timeStr, letter: 'A', category: 'morning-reflection', categoryLabel: 'Morgenreflexion' });

      // Save to localStorage
      saveMorningReflectionDone(todayStr, selectedChip, customText);

      // Remove morning gradient
      appEl.removeAttribute('data-mood');

      // Direct back to hub
      renderReflection(container, profile);
    });
  }
}

function startReflectionFlow(container, profile) {
  const name = profile.name;
  const t = TEXTS.ui.reflection;
  let selectedMood = null;
  let selectedHelped = [];
  let helpedAlt = null;
  let gratitudeText = '';

  renderStep1();

  function progressDots(activeStep) {
    return `<div class="progress-dots">${[1,2,3].map(i =>
      `<div class="progress-dot${i === activeStep ? ' active' : ''}"></div>`
    ).join('')}</div>`;
  }

  function setMoodGradient(moodKey) {
    const appEl = document.getElementById('app');
    if (moodKey) {
      appEl.setAttribute('data-mood', moodKey);
    } else {
      appEl.removeAttribute('data-mood');
    }
  }

  function renderStep1() {
    const title = t.title.replace('{name}', name);
    let html = `<div class="reflection-screen">`;
    html += progressDots(1);
    html += `<div class="ref-question">${title}</div>`;
    html += `<div class="mood-list" id="mood-list">`;

    t.moods.forEach(m => {
      html += `<button class="mood-btn" data-mood="${m.key}" aria-label="${m.label}">${m.emoji}</button>`;
    });

    html += `</div>`;
    html += `<button class="btn-primary" id="mood-next" disabled>${TEXTS.ui.onboarding.next}</button>`;
    html += `</div>`;

    container.innerHTML = html;

    const btns = container.querySelectorAll('.mood-btn');
    const nextBtn = document.getElementById('mood-next');

    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedMood = btn.dataset.mood;
        setMoodGradient(selectedMood);
        nextBtn.disabled = false;
      });
    });

    nextBtn.addEventListener('click', () => {
      if (selectedMood) renderStep2();
    });
  }

  function renderStep2() {
    let html = `<div class="reflection-screen">`;
    html += progressDots(2);
    html += `<h2 class="flow-title">${t.helpedTitle}</h2>`;
    html += `<div class="helped-grid" id="helped-grid">`;

    const labels = TEXTS.ui.smallLabels;
    ['S', 'M', 'A', 'L1', 'L2'].forEach(letter => {
      html += `<button class="helped-btn" data-letter="${letter}">${labels[letter]}</button>`;
    });

    html += `</div>`;
    html += `<div class="helped-divider">`;
    html += `<button class="helped-alt" data-alt="dontknow">${t.helpedDontKnow}</button>`;
    html += `<button class="helped-alt" data-alt="survived">${t.helpedSurvived}</button>`;
    html += `</div>`;
    html += `<button class="btn-primary" id="helped-next" disabled>${TEXTS.ui.onboarding.next}</button>`;
    html += `</div>`;

    container.innerHTML = html;

    const letterBtns = container.querySelectorAll('.helped-btn');
    const altBtns = container.querySelectorAll('.helped-alt');
    const nextBtn = document.getElementById('helped-next');

    function updateNext() {
      nextBtn.disabled = (selectedHelped.length === 0 && !helpedAlt);
    }

    letterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const letter = btn.dataset.letter;
        helpedAlt = null;
        altBtns.forEach(a => a.classList.remove('selected'));

        if (selectedHelped.includes(letter)) {
          selectedHelped = selectedHelped.filter(l => l !== letter);
          btn.classList.remove('selected');
        } else {
          selectedHelped.push(letter);
          btn.classList.add('selected');
        }
        updateNext();
      });
    });

    altBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        selectedHelped = [];
        letterBtns.forEach(b => b.classList.remove('selected'));
        altBtns.forEach(a => a.classList.remove('selected'));

        helpedAlt = btn.dataset.alt;
        btn.classList.add('selected');
        updateNext();
      });
    });

    nextBtn.addEventListener('click', () => {
      renderStep3();
    });
  }

  function renderStep3() {
    let html = `<div class="reflection-screen">`;
    html += progressDots(3);
    html += `<h2 class="flow-title">${t.gratitudeTitle}</h2>`;
    html += `<input type="text" class="gratitude-input" id="gratitude-input" placeholder="${t.gratitudePlaceholder}" maxlength="200">`;
    html += `<div class="gratitude-buttons">`;
    html += `<button class="btn-secondary" id="gratitude-skip">${t.gratitudeSkip}</button>`;
    html += `<button class="btn-primary" id="gratitude-done">${t.gratitudeDone}</button>`;
    html += `</div></div>`;

    container.innerHTML = html;

    const input = document.getElementById('gratitude-input');
    const skipBtn = document.getElementById('gratitude-skip');
    const doneBtn = document.getElementById('gratitude-done');

    skipBtn.addEventListener('click', () => {
      gratitudeText = '';
      finishReflection();
    });

    doneBtn.addEventListener('click', () => {
      gratitudeText = input.value.trim();
      finishReflection();
    });

    setTimeout(() => input.focus(), 300);
  }

  async function finishReflection() {
    const todayStr = formatDate(new Date());
    const helped = helpedAlt ? [helpedAlt] : selectedHelped;

    const endComment = getReflectionEndComment(selectedMood, name);

    await saveReflection({
      date: todayStr,
      mood: selectedMood,
      helped: helped,
      gratitude: gratitudeText,
      quatschiComment: endComment
    });

    // Add 2 Gundula points for evening reflection
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    await addSmallPoint({ date: todayStr, time: timeStr, letter: 'S', category: 'reflection', categoryLabel: 'Abendreflexion' });
    await addSmallPoint({ date: todayStr, time: timeStr, letter: 'M', category: 'reflection', categoryLabel: 'Abendreflexion' });

    renderCompletion(endComment);
  }

  function renderCompletion(comment) {
    let html = `<div class="reflection-screen">`;
    html += progressDots(3);
    html += `<div class="reflection-end">`;

    // Quote block with animated text
    html += `<div class="ref-quote-block">`;
    html += `<div class="ref-quotemark">"</div>`;
    html += `<div class="ref-quote-text">${comment}</div>`;
    html += `</div>`;

    // Goodnight
    html += `<div class="goodnight">`;
    html += `<div class="goodnight-line"></div>`;
    html += `<div class="goodnight-text">${t.goodNight}</div>`;
    html += `</div>`;

    html += `<div class="mt-24">`;
    html += `<button class="btn-primary" id="reflection-close">${t.close}</button>`;
    html += `</div>`;

    html += `</div></div>`;

    container.innerHTML = html;

    document.getElementById('reflection-close').addEventListener('click', () => {
      setMoodGradient(null);
      // Show points feedback
      container.innerHTML = `<div class="reflection-screen">
        <div class="points-feedback">+2 Gundula-Punkte</div>
      </div>`;
      setTimeout(() => {
        renderReflection(container, profile);
      }, 2500);
    });
  }
}
