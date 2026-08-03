// ============================================================
// Onboarding — 2 screens, first launch only
// ============================================================

import { TEXTS } from '../../content/de.js';
import { saveProfile } from '../db.js';
import { roundTo15Min } from '../push.js';
import { openTimePicker, renderTimeButton, setTimeButtonValue } from '../components/time-picker.js';

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
            ${renderTimeButton('id="rem-morning-time"', reminders.morning.time)}
          </div>
          <label class="toggle">
            <input type="checkbox" id="rem-morning-toggle" ${reminders.morning.enabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="reminder-slot">
          <div class="reminder-left">
            <span class="reminder-label">${t.midday}</span>
            ${renderTimeButton('id="rem-midday-time"', reminders.midday.time)}
          </div>
          <label class="toggle">
            <input type="checkbox" id="rem-midday-toggle" ${reminders.midday.enabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="reminder-slot">
          <div class="reminder-left">
            <span class="reminder-label">${t.evening}</span>
            ${renderTimeButton('id="rem-evening-time"', reminders.evening.time)}
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
    function bindTime(btnId, label, slot) {
      const btn = document.getElementById(btnId);
      btn.addEventListener('click', () => {
        openTimePicker(label, btn.dataset.time, (picked) => {
          setTimeButtonValue(btn, picked);
          slot.time = picked;
        });
      });
    }
    bindTime('rem-morning-time', t.morning, reminders.morning);
    bindTime('rem-midday-time', t.midday, reminders.midday);
    bindTime('rem-evening-time', t.evening, reminders.evening);

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
      persistReminderTimes();
      onComplete(profile);
    });
  }

  /**
   * Die im Onboarding gewählten Zeiten in die Keys schreiben, die das
   * Push-System wirklich liest. Vorher landeten sie nur als `remindersV2`
   * im Profil — und das liest niemand: Der User stellte Erinnerungen ein,
   * die es im Push-Pfad nie gab.
   *
   * Gefragt wird „wann soll ich dich an SMALL erinnern?" — also mappen die
   * drei Slots auf small_1..3. Morgen-/Abend-Erinnerung stehen im Onboarding
   * fest verdrahtet und werden vom User gar nicht gewählt; sie bleiben bei
   * den Push-Vorgaben, die Soft-Ask und Settings absenzgeschützt setzen.
   *
   * Bewusst NICHT gesetzt: loewenherz_push_asked / _push_enabled. Das
   * Onboarding speichert eine Präferenz, es erteilt keine Einwilligung —
   * würden wir den Riegel hier setzen, käme der Soft-Ask nie.
   */
  function persistReminderTimes() {
    try {
      const slots = [reminders.morning, reminders.midday, reminders.evening];
      slots.forEach((slot, i) => {
        const id = i + 1;
        const time = roundTo15Min(slot.time);
        // Ungültig = Feld wurde geleert. Slot komplett auslassen, dann
        // setzt initSmallSlotsIfNeeded() in den Settings den Default —
        // besser als eine halb geschriebene Zeit ohne _enabled.
        if (!time) return;
        localStorage.setItem(`loewenherz_small_${id}_time`, time);
        // _enabled IMMER mitschreiben: Ein fehlender Wert gilt in
        // buildTags() und getSmallSlots() als „an" (!== 'false') — ein
        // ausgeschalteter Slot würde sonst stillschweigend anspringen.
        localStorage.setItem(`loewenherz_small_${id}_enabled`, String(slot.enabled));
      });
    } catch (e) {
      // Silent — ein fehlgeschlagener Schreibvorgang darf das Onboarding
      // nicht blockieren; Settings und Soft-Ask setzen dann die Vorgaben.
    }
  }

  renderStep1();
}
