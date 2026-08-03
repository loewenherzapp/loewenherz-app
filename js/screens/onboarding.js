// ============================================================
// Onboarding — 2 screens, first launch only
// ============================================================

import { TEXTS } from '../../content/de.js';
import { saveProfile } from '../db.js';
import { openTimePicker, renderTimeButton } from '../components/time-picker.js';
import { getWindow, setSchedule, DEFAULT_COUNT } from '../small-schedule.js';

export function renderOnboarding(container, onComplete) {
  let step = 1;
  let name = '';

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
    const win = getWindow();
    container.innerHTML = `
      <div class="onboarding-screen">
        <h2 class="onboarding-reminder-title">${title}</h2>
        <p class="onboarding-reminder-hint">${t.reminderHint}</p>

        <div class="reminder-slot">
          <span class="reminder-label">${t.windowFrom}</span>
          ${renderTimeButton('id="rem-window-start"', win.start)}
        </div>

        <div class="reminder-slot">
          <span class="reminder-label">${t.windowTo}</span>
          ${renderTimeButton('id="rem-window-end"', win.end)}
        </div>

        <div class="mt-24">
          <button class="btn-primary" id="onboarding-go">${t.go}</button>
        </div>
      </div>
    `;

    // Nach jeder Auswahl neu rendern statt nur den Text zu tauschen:
    // setSchedule() klemmt das Ende auf mindestens Start + 1h, und diese
    // Korrektur muss der Nutzer sehen, statt sie erst beim Absenden zu
    // erleben.
    function bindWindow(btnId, label, feld) {
      const btn = document.getElementById(btnId);
      btn.addEventListener('click', () => {
        openTimePicker(label, btn.dataset.time, (picked) => {
          const aktuell = getWindow();
          setSchedule({ ...aktuell, count: DEFAULT_COUNT, [feld]: picked });
          renderStep2();
        });
      });
    }
    bindWindow('rem-window-start', t.windowFrom, 'start');
    bindWindow('rem-window-end', t.windowTo, 'end');

    document.getElementById('onboarding-go').addEventListener('click', async () => {
      const profile = {
        name,
        createdAt: new Date().toISOString(),
        // remindersV2 ist ein reines Profil-Altfeld — der Push-Pfad liest es
        // nicht (siehe f36d616). Es bleibt mit den Vorgaben stehen, damit
        // migrateToV2() in db.js nichts nachträglich umbauen muss.
        remindersV2: [
          { id: 1, time: '09:00', enabled: false },
          { id: 2, time: '10:00', enabled: false },
          { id: 3, time: '12:00', enabled: false },
          { id: 4, time: '15:00', enabled: false },
          { id: 5, time: '20:00', enabled: false }
        ],
        morningRitual: { time: '07:00', enabled: true },
        eveningReflection: { time: '21:00', enabled: true },
        onboardingComplete: true
      };
      await saveProfile(profile);
      persistWindow();
      onComplete(profile);
    });
  }

  /**
   * Das gewählte Zeitfenster in die Keys schreiben, die das Push-System
   * wirklich liest. Vorher landeten die Onboarding-Antworten nur als
   * `remindersV2` im Profil — und das liest niemand: Der Nutzer stellte
   * Erinnerungen ein, die es im Push-Pfad nie gab (behoben in f36d616).
   *
   * Die Anzahl wird hier still auf den Default gesetzt; sie zu erfragen
   * wäre eine Entscheidung zu viel für den ersten Kontakt. Feinjustiert
   * wird in den Einstellungen.
   *
   * Bewusst NICHT gesetzt: loewenherz_push_asked / _push_enabled. Das
   * Onboarding speichert eine Präferenz, es erteilt keine Einwilligung —
   * würden wir den Riegel hier setzen, käme der Soft-Ask nie.
   */
  function persistWindow() {
    try {
      const { start, end } = getWindow();
      setSchedule({ start, end, count: DEFAULT_COUNT });
    } catch (e) {
      // Silent — ein fehlgeschlagener Schreibvorgang darf das Onboarding
      // nicht blockieren; die Einstellungen zeigen dann die Vorgaben.
    }
  }

  renderStep1();
}
