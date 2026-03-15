// ============================================================
// Onboarding — 2 screens, first launch only
// ============================================================

import { TEXTS } from '../../content/de.js';
import { saveProfile } from '../db.js';

export function renderOnboarding(container, onComplete) {
  let step = 1;
  let name = '';
  let reminders = {
    morning: { time: '08:00', enabled: true },
    midday: { time: '13:00', enabled: true },
    evening: { time: '18:00', enabled: true }
  };

  const t = TEXTS.ui.onboarding;

  function renderStep1() {
    container.innerHTML = `
      <div class="onboarding-screen">
        <h1 class="onboarding-welcome">${t.welcome}</h1>
        <label class="onboarding-label">${t.askName}</label>
        <input type="text" class="onboarding-input" id="onboarding-name"
               placeholder="${t.namePlaceholder}" autocomplete="given-name" maxlength="30">
        <div class="mt-24">
          <button class="btn-primary" id="onboarding-next" disabled>${t.next}</button>
        </div>
      </div>
    `;

    const nameInput = document.getElementById('onboarding-name');
    const nextBtn = document.getElementById('onboarding-next');

    nameInput.addEventListener('input', () => {
      name = nameInput.value.trim();
      nextBtn.disabled = name.length < 1;
    });

    nextBtn.addEventListener('click', () => {
      if (name.length >= 1) {
        step = 2;
        renderStep2();
      }
    });

    // Focus input after a short delay
    setTimeout(() => nameInput.focus(), 300);
  }

  function renderStep2() {
    const title = t.reminderTitle.replace('{name}', name);
    container.innerHTML = `
      <div class="onboarding-screen">
        <h2 class="onboarding-reminder-title">${title}</h2>
        <p class="onboarding-reminder-hint">${t.reminderHint}</p>

        <div class="reminder-slot">
          <div class="reminder-left">
            <span class="reminder-label">${t.morning}</span>
            <input type="time" class="reminder-time" id="rem-morning-time" value="${reminders.morning.time}">
          </div>
          <label class="toggle">
            <input type="checkbox" id="rem-morning-toggle" ${reminders.morning.enabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="reminder-slot">
          <div class="reminder-left">
            <span class="reminder-label">${t.midday}</span>
            <input type="time" class="reminder-time" id="rem-midday-time" value="${reminders.midday.time}">
          </div>
          <label class="toggle">
            <input type="checkbox" id="rem-midday-toggle" ${reminders.midday.enabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="reminder-slot">
          <div class="reminder-left">
            <span class="reminder-label">${t.evening}</span>
            <input type="time" class="reminder-time" id="rem-evening-time" value="${reminders.evening.time}">
          </div>
          <label class="toggle">
            <input type="checkbox" id="rem-evening-toggle" ${reminders.evening.enabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="mt-24">
          <button class="btn-primary" id="onboarding-go">${t.go}</button>
        </div>
      </div>
    `;

    // Bind time/toggle changes
    document.getElementById('rem-morning-time').addEventListener('change', (e) => reminders.morning.time = e.target.value);
    document.getElementById('rem-midday-time').addEventListener('change', (e) => reminders.midday.time = e.target.value);
    document.getElementById('rem-evening-time').addEventListener('change', (e) => reminders.evening.time = e.target.value);
    document.getElementById('rem-morning-toggle').addEventListener('change', (e) => reminders.morning.enabled = e.target.checked);
    document.getElementById('rem-midday-toggle').addEventListener('change', (e) => reminders.midday.enabled = e.target.checked);
    document.getElementById('rem-evening-toggle').addEventListener('change', (e) => reminders.evening.enabled = e.target.checked);

    document.getElementById('onboarding-go').addEventListener('click', async () => {
      const profile = {
        name,
        createdAt: new Date().toISOString(),
        remindersV2: [
          { id: 1, time: reminders.morning.time, enabled: reminders.morning.enabled },
          { id: 2, time: reminders.midday.time, enabled: reminders.midday.enabled },
          { id: 3, time: reminders.evening.time, enabled: reminders.evening.enabled },
          { id: 4, time: '09:00', enabled: false },
          { id: 5, time: '10:00', enabled: false },
          { id: 6, time: '12:00', enabled: false },
          { id: 7, time: '15:00', enabled: false },
          { id: 8, time: '20:00', enabled: false }
        ],
        morningRitual: { time: '07:00', enabled: true },
        eveningReflection: { time: '21:00', enabled: true },
        onboardingComplete: true
      };
      await saveProfile(profile);
      onComplete(profile);
    });
  }

  renderStep1();
}
