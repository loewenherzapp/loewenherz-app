// ============================================================
// Reflection — Tab with dark mode, circle mood buttons, and
//              3-step flow with quote animation
// ============================================================

import { TEXTS } from '../../content/de.js';
import { getReflectionByDate, getReflectionsByDateRange, saveReflection } from '../db.js';
import { formatDate } from '../components/week-dots.js';
import { getReflectionEndComment } from '../quatschi.js';

const MOOD_MAP = {};
TEXTS.ui.reflection.moods.forEach(m => { MOOD_MAP[m.key] = m; });

export async function renderReflection(container, profile) {
  const name = profile.name;
  const t = TEXTS.ui.reflection;
  const todayStr = formatDate(new Date());

  // Get recent reflections (last 7 days)
  const sevenAgo = new Date();
  sevenAgo.setDate(sevenAgo.getDate() - 7);
  const recentReflections = await getReflectionsByDateRange(formatDate(sevenAgo), todayStr);

  recentReflections.sort((a, b) => b.date.localeCompare(a.date));
  const lastReflection = recentReflections.length > 0 ? recentReflections[0] : null;

  let html = `<div class="reflection-screen reflection-landing">`;
  html += `<h2 class="reflection-title">${t.tabTitle}</h2>`;

  if (lastReflection) {
    const mood = MOOD_MAP[lastReflection.mood];
    const dateObj = new Date(lastReflection.date + 'T12:00:00');
    const dateLabel = dateObj.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    html += `
      <div class="reflection-last">
        <div class="reflection-last-header">${t.pastTitle}</div>
        <div class="reflection-last-mood">
          <span>${mood ? mood.emoji : ''}</span>
          <span>${mood ? mood.label : ''}</span>
          <span style="color:var(--ref-muted);font-size:11px;margin-left:auto;">${dateLabel}</span>
        </div>
      </div>
    `;
  } else {
    html += `<p style="color:var(--ref-muted);text-align:center;margin-bottom:20px;">${t.noReflection}</p>`;
  }

  // Last 7 days emoji row with day labels
  const dayLabels = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
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

  html += `
    <div class="mt-24">
      <button class="btn-primary" id="start-reflection">${t.startNow}</button>
    </div>
  </div>`;

  container.innerHTML = html;

  document.getElementById('start-reflection').addEventListener('click', () => {
    startReflectionFlow(container, profile);
  });
}

function startReflectionFlow(container, profile) {
  const name = profile.name;
  const t = TEXTS.ui.reflection;
  let selectedMood = null;
  let selectedHelped = [];
  let helpedAlt = null;
  let gratitudeText = '';

  renderStep1();

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
    html += `<h2 class="flow-title">${t.helpedTitle}</h2>`;
    html += `<div class="helped-grid" id="helped-grid">`;

    const labels = TEXTS.ui.smallLabels;
    ['S', 'M', 'A', 'L1', 'L2'].forEach(letter => {
      const display = letter === 'L1' ? 'L' : letter === 'L2' ? 'L' : letter;
      html += `<button class="helped-btn" data-letter="${letter}">${display} ${labels[letter]}</button>`;
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

    renderCompletion(endComment);
  }

  function renderCompletion(comment) {
    let html = `<div class="reflection-screen">`;
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
      renderReflection(container, profile);
    });
  }
}
