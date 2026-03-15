// ============================================================
// Settings Screen — v2 (8 fixed alarm slots, morning ritual, evening reflection)
// ============================================================

import { TEXTS } from '../../content/de.js';
import { getProfile, saveProfile, clearAllData, migrateToV2, saveRemindersV2, saveMorningRitual, saveEveningReflection } from '../db.js';
import { openCrisis } from '../components/crisis-modal.js';

/**
 * Sort reminders by time (earliest first).
 */
function sortByTime(reminders) {
  return [...reminders].sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * Render a single alarm slot: time + toggle. Identical for all 8.
 */
function renderAlarmSlot(r) {
  return `<div class="reminder-slot reminder-slot-managed" data-slot-id="${r.id}">
    <div class="reminder-left">
      <input type="time" class="reminder-time" data-field="time" value="${r.time}">
    </div>
    <div class="reminder-right">
      <label class="toggle">
        <input type="checkbox" data-field="toggle" ${r.enabled ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
    </div>
  </div>`;
}

/**
 * Render a single-line section (Morgenritual or Abendreflexion): time + toggle + description.
 */
function renderRitualSlot(data, sectionId) {
  return `<div class="reminder-slot" id="${sectionId}-slot">
    <div class="reminder-left">
      <input type="time" class="reminder-time" data-field="time" value="${data.time}">
    </div>
    <div class="reminder-right">
      <label class="toggle">
        <input type="checkbox" data-field="toggle" ${data.enabled ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
    </div>
  </div>`;
}

export async function renderSettings(container, profile, onBack, onDataDeleted) {
  const t = TEXTS.ui.settings;

  // Run v2 migration if needed
  profile = await migrateToV2(profile);

  const reminders = profile.remindersV2;
  const morningRitual = profile.morningRitual;
  const eveningReflection = profile.eveningReflection;

  const sorted = sortByTime(reminders);

  container.innerHTML = `
    <header class="app-header">
      <button class="header-crisis" id="settings-crisis-header" aria-label="Krisenhilfe">♡</button>
      <div></div>
    </header>
    <div class="settings-screen">
      <button class="settings-back" id="settings-back">${t.back}</button>
      <h2 class="settings-title">${t.title}</h2>

      <!-- Name -->
      <div class="settings-section">
        <div class="settings-label">${t.nameLabel}</div>
        <div class="settings-card">
          <input type="text" class="settings-input" id="settings-name" value="${profile.name}" maxlength="30">
        </div>
      </div>

      <!-- Erinnerungen (8 fixed alarm slots) -->
      <div class="settings-section">
        <div class="settings-label">${t.remindersLabel}</div>
        <div class="settings-card" id="reminders-card">
          <div id="reminders-list">
            ${sorted.map(r => renderAlarmSlot(r)).join('')}
          </div>
          <p class="settings-hint">${t.pushHint}</p>
        </div>
      </div>

      <!-- Morgenritual -->
      <div class="settings-section">
        <div class="settings-label">${t.morningRitualLabel}</div>
        <div class="settings-card" id="morning-ritual-card">
          ${renderRitualSlot(morningRitual, 'morning-ritual')}
          <p class="settings-hint">${t.morningRitualHint}</p>
        </div>
      </div>

      <!-- Abendreflexion -->
      <div class="settings-section">
        <div class="settings-label">${t.reflectionTimeLabel}</div>
        <div class="settings-card" id="evening-reflection-card">
          ${renderRitualSlot(eveningReflection, 'evening-reflection')}
          <p class="settings-hint">${t.eveningReflectionHint}</p>
        </div>
      </div>

      <!-- Data Privacy -->
      <div class="settings-section">
        <div class="settings-label">${t.dataLabel}</div>
        <div class="settings-disclaimer">${t.dataHint}</div>
      </div>

      <!-- Crisis -->
      <div class="settings-section">
        <div class="settings-card" style="cursor:pointer;" id="settings-crisis">
          <div class="settings-link">
            <span class="settings-link-text" style="color:var(--crisis-red);">♡ ${t.crisisLink}</span>
            <span class="settings-link-arrow">›</span>
          </div>
        </div>
      </div>

      <!-- About -->
      <div class="settings-section">
        <div class="settings-label">${t.aboutTitle}</div>
        <div class="settings-card">
          <div class="settings-about">
            <div>${t.version}</div>
            <div>${t.madeBy}</div>
            <div><a href="${t.bookUrl}" target="_blank" rel="noopener noreferrer">${t.bookLink}</a></div>
          </div>
        </div>
      </div>

      <!-- Disclaimer -->
      <div class="settings-section">
        <div class="settings-disclaimer">${t.disclaimer}</div>
      </div>

      <!-- Legal -->
      <div class="settings-section">
        <div class="settings-card">
          <div class="settings-link" id="settings-impressum">
            <span class="settings-link-text">${t.impressum}</span>
            <span class="settings-link-arrow">›</span>
          </div>
          <div class="settings-link" id="settings-datenschutz">
            <span class="settings-link-text">${t.datenschutz}</span>
            <span class="settings-link-arrow">›</span>
          </div>
        </div>
      </div>

      <!-- Delete -->
      <div class="settings-section" style="padding-bottom:24px;">
        <button class="btn-danger" id="settings-delete">${t.deleteData}</button>
      </div>
    </div>
  `;

  // ---- Event Bindings ----

  // Back button
  document.getElementById('settings-back').addEventListener('click', onBack);

  // Crisis header
  document.getElementById('settings-crisis-header').addEventListener('click', openCrisis);

  // Auto-save name
  let nameTimeout;
  document.getElementById('settings-name').addEventListener('input', (e) => {
    clearTimeout(nameTimeout);
    nameTimeout = setTimeout(async () => {
      profile.name = e.target.value.trim() || profile.name;
      await saveProfile(profile);
    }, 500);
  });

  // ---- Alarm slots: event delegation on #reminders-card ----
  const remindersCard = document.getElementById('reminders-card');
  let timeDebounceTimers = {};

  remindersCard.addEventListener('change', async (e) => {
    const slot = e.target.closest('.reminder-slot-managed');
    if (!slot) return;
    const id = parseInt(slot.dataset.slotId, 10);
    const field = e.target.dataset.field;
    if (!id || !field) return;

    const reminder = reminders.find(r => r.id === id);
    if (!reminder) return;

    if (field === 'toggle') {
      reminder.enabled = e.target.checked;
      await saveRemindersV2(reminders);
    }
  });

  // Time picker: debounce 1.5s on change (iOS closes picker on change)
  remindersCard.addEventListener('change', (e) => {
    if (e.target.dataset.field !== 'time') return;
    const slot = e.target.closest('.reminder-slot-managed');
    if (!slot) return;
    const id = parseInt(slot.dataset.slotId, 10);

    clearTimeout(timeDebounceTimers[id]);
    timeDebounceTimers[id] = setTimeout(async () => {
      const reminder = reminders.find(r => r.id === id);
      if (!reminder) return;
      reminder.time = e.target.value;
      await saveRemindersV2(reminders);
      reRenderList();
    }, 1500);
  });

  // Also save on blur (reliable on desktop/Android)
  remindersCard.addEventListener('focusout', (e) => {
    if (e.target.dataset.field !== 'time') return;
    const slot = e.target.closest('.reminder-slot-managed');
    if (!slot) return;
    const id = parseInt(slot.dataset.slotId, 10);

    // Cancel the debounce timer if blur fires first
    clearTimeout(timeDebounceTimers[id]);

    const reminder = reminders.find(r => r.id === id);
    if (!reminder || reminder.time === e.target.value) return;

    reminder.time = e.target.value;
    saveRemindersV2(reminders);
    reRenderList();
  });

  // ---- Morning Ritual ----
  const morningCard = document.getElementById('morning-ritual-card');
  let morningTimeTimer;

  morningCard.addEventListener('change', async (e) => {
    const field = e.target.dataset.field;
    if (field === 'toggle') {
      morningRitual.enabled = e.target.checked;
      await saveMorningRitual(morningRitual);
    } else if (field === 'time') {
      clearTimeout(morningTimeTimer);
      morningTimeTimer = setTimeout(async () => {
        morningRitual.time = e.target.value;
        await saveMorningRitual(morningRitual);
      }, 1500);
    }
  });

  morningCard.addEventListener('focusout', (e) => {
    if (e.target.dataset.field !== 'time') return;
    clearTimeout(morningTimeTimer);
    if (morningRitual.time === e.target.value) return;
    morningRitual.time = e.target.value;
    saveMorningRitual(morningRitual);
  });

  // ---- Evening Reflection ----
  const eveningCard = document.getElementById('evening-reflection-card');
  let eveningTimeTimer;

  eveningCard.addEventListener('change', async (e) => {
    const field = e.target.dataset.field;
    if (field === 'toggle') {
      eveningReflection.enabled = e.target.checked;
      await saveEveningReflection(eveningReflection);
    } else if (field === 'time') {
      clearTimeout(eveningTimeTimer);
      eveningTimeTimer = setTimeout(async () => {
        eveningReflection.time = e.target.value;
        await saveEveningReflection(eveningReflection);
      }, 1500);
    }
  });

  eveningCard.addEventListener('focusout', (e) => {
    if (e.target.dataset.field !== 'time') return;
    clearTimeout(eveningTimeTimer);
    if (eveningReflection.time === e.target.value) return;
    eveningReflection.time = e.target.value;
    saveEveningReflection(eveningReflection);
  });

  // Crisis
  document.getElementById('settings-crisis').addEventListener('click', openCrisis);

  // Impressum
  document.getElementById('settings-impressum').addEventListener('click', () => {
    showLegalPopup(t.impressum, t.impressumText);
  });

  // Datenschutz
  document.getElementById('settings-datenschutz').addEventListener('click', () => {
    showLegalPopup(t.datenschutz, t.datenschutzText);
  });

  // Delete
  document.getElementById('settings-delete').addEventListener('click', () => {
    showDeleteConfirm(t, onDataDeleted);
  });

  // ---- Helper: re-render alarm list (sorted) ----
  function reRenderList() {
    const listEl = document.getElementById('reminders-list');
    const sorted = sortByTime(reminders);
    listEl.innerHTML = sorted.map(r => renderAlarmSlot(r)).join('');
  }
}

function showLegalPopup(title, text) {
  const el = document.createElement('div');
  el.innerHTML = `
    <div class="detail-popup-overlay" id="legal-overlay">
      <div class="detail-popup">
        <div style="font-size:16px;font-weight:600;margin-bottom:12px;">${title}</div>
        <p style="font-size:13px;color:var(--text-secondary);line-height:1.6;margin-bottom:16px;">${text}</p>
        <button class="btn-secondary" id="legal-close">${TEXTS.ui.reflection.close}</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);

  document.getElementById('legal-close').addEventListener('click', () => el.remove());
  document.getElementById('legal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) el.remove();
  });
}

function showDeleteConfirm(t, onConfirm) {
  const el = document.createElement('div');
  el.innerHTML = `
    <div class="confirm-overlay" id="confirm-overlay">
      <div class="confirm-dialog">
        <p class="confirm-text">${t.deleteConfirm}</p>
        <div class="confirm-buttons">
          <button class="btn-secondary" id="confirm-no">${t.deleteNo}</button>
          <button class="btn-danger" id="confirm-yes">${t.deleteYes}</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(el);

  document.getElementById('confirm-no').addEventListener('click', () => el.remove());
  document.getElementById('confirm-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) el.remove();
  });
  document.getElementById('confirm-yes').addEventListener('click', async () => {
    el.remove();
    await clearAllData();
    onConfirm();
  });
}
