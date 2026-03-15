// ============================================================
// Reflection — Tab with default view and 3-step flow
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

  // Sort by date desc to find the last one
  recentReflections.sort((a, b) => b.date.localeCompare(a.date));
  const lastReflection = recentReflections.length > 0 ? recentReflections[0] : null;

  // Build default view
  let html = `<div class="reflection-screen">`;
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
          <span style="color:var(--text-secondary);font-size:12px;margin-left:auto;">${dateLabel}</span>
        </div>
      </div>
    `;
  } else {
    html += `<p style="color:var(--text-secondary);text-align:center;margin-bottom:20px;">${t.noReflection}</p>`;
  }

  // Last 7 days emoji row
  if (recentReflections.length > 0) {
    html += `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">${t.lastDays}</div>`;
    html += `<div class="reflection-emoji-row">`;
    // Show last 7 days in order
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = formatDate(d);
      const ref = recentReflections.find(r => r.date === ds);
      const emoji = ref && MOOD_MAP[ref.mood] ? MOOD_MAP[ref.mood].emoji : '';
      html += `<div class="reflection-emoji-day">${emoji}</div>`;
    }
    html += `</div>`;
  }

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
  let helpedAlt = null; // 'dontknow' or 'survived'
  let gratitudeText = '';

  renderStep1();

  function renderStep1() {
    const title = t.title.replace('{name}', name);
    let html = `<div class="reflection-screen">`;
    html += `<h2 class="flow-title">${title}</h2>`;
    html += `<div class="mood-list" id="mood-list">`;

    t.moods.forEach(m => {
      html += `
        <button class="mood-option" data-mood="${m.key}">
          <span class="mood-emoji">${m.emoji}</span>
          <span>${m.label}</span>
        </button>
      `;
    });

    html += `</div>`;
    html += `<button class="btn-primary" id="mood-next" disabled>${TEXTS.ui.onboarding.next}</button>`;
    html += `</div>`;

    container.innerHTML = html;

    const btns = container.querySelectorAll('.mood-option');
    const nextBtn = document.getElementById('mood-next');

    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedMood = btn.dataset.mood;
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
      const display = letter === 'L1' ? 'L₁' : letter === 'L2' ? 'L₂' : letter;
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
        // Deselect alts
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
        // Deselect letters
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

    // Stimmungsbasierter Abschluss-Kommentar aus Pool
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
    html += `<div class="reflection-end-emoji">🦁</div>`;
    html += `<p class="reflection-end-comment">${comment}</p>`;
    html += `<p class="reflection-end-gn">${t.goodNight}</p>`;
    html += `<button class="btn-primary" id="reflection-close">${t.close}</button>`;
    html += `</div></div>`;

    container.innerHTML = html;

    document.getElementById('reflection-close').addEventListener('click', () => {
      renderReflection(container, profile);
    });
  }
}
