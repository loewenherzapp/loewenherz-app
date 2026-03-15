// ============================================================
// Settings Screen
// ============================================================

import { TEXTS } from '../../content/de.js';
import { getProfile, saveProfile, clearAllData, getReminders, saveReminders, migrateReminders } from '../db.js';
import { openCrisis } from '../components/crisis-modal.js';

const MAX_REMINDERS = 8;

/**
 * Generate next custom reminder ID based on existing ones.
 */
function nextCustomId(reminders) {
  let max = 0;
  for (const r of reminders) {
    if (r.type === 'custom') {
      const num = parseInt(r.id.replace('reminder_custom_', ''), 10);
      if (num > max) max = num;
    }
  }
  return `reminder_custom_${max + 1}`;
}

/**
 * Get the next full hour as HH:MM string.
 */
function nextFullHour() {
  const now = new Date();
  let h = now.getHours() + 1;
  if (h > 23) h = 8;
  return `${String(h).padStart(2, '0')}:00`;
}

/**
 * Sort reminders by time (earliest first).
 */
function sortByTime(reminders) {
  return [...reminders].sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * Render a single reminder slot HTML.
 */
function renderReminderSlot(r, t) {
  const isCustom = r.type === 'custom';
  const labelValue = isCustom ? (r.label || '') : r.label;

  let html = `<div class="reminder-slot reminder-slot-managed" data-reminder-id="${r.id}">`;
  html += `<div class="reminder-left">`;

  if (isCustom) {
    html += `<input type="text" class="reminder-custom-label" data-field="label" maxlength="30" placeholder="${t.customLabelPlaceholder}" value="${labelValue}">`;
  } else {
    html += `<span class="reminder-label">${labelValue}</span>`;
  }

  html += `<input type="time" class="reminder-time" data-field="time" value="${r.time}">`;
  html += `</div>`;

  html += `<div class="reminder-right">`;
  html += `<label class="toggle">`;
  html += `<input type="checkbox" data-field="toggle" ${r.enabled ? 'checked' : ''}>`;
  html += `<span class="toggle-slider"></span>`;
  html += `</label>`;

  if (isCustom) {
    html += `<button class="reminder-delete-btn" data-field="delete" aria-label="Löschen">×</button>`;
  }

  html += `</div>`;
  html += `</div>`;
  return html;
}

export async function renderSettings(container, profile, onBack, onDataDeleted) {
  const t = TEXTS.ui.settings;

  // Migrate reminders if needed (first time opening settings after update)
  let reminders = await getReminders();
  if (!profile.remindersList) {
    reminders = migrateReminders(profile);
    profile.remindersList = reminders;
    await saveProfile(profile);
  }

  const sorted = sortByTime(reminders);
  const customCount = reminders.filter(r => r.type === 'custom').length;
  const atMax = reminders.length >= MAX_REMINDERS;

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

      <!-- Reminders -->
      <div class="settings-section">
        <div class="settings-label">${t.remindersLabel}</div>
        <div class="settings-card" id="reminders-card">
          <div id="reminders-list">
            ${sorted.map(r => renderReminderSlot(r, t)).join('')}
          </div>
          <button class="btn-add-reminder ${atMax ? 'disabled' : ''}" id="btn-add-reminder" ${atMax ? 'disabled' : ''}>
            ${atMax ? t.maxReached : t.addReminder}
          </button>
          <p class="settings-hint">${t.pushHint}</p>
        </div>
      </div>

      <!-- Reflection Time -->
      <div class="settings-section">
        <div class="settings-label">${t.reflectionTimeLabel}</div>
        <div class="settings-card">
          <div class="reminder-slot">
            <div class="reminder-left">
              <span class="reminder-label">${t.reflectionTimeLabel}</span>
              <input type="time" class="reminder-time" id="set-reflection-time" value="${profile.reflectionTime || '21:00'}">
            </div>
            <label class="toggle">
              <input type="checkbox" id="set-reflection-toggle" ${profile.reflectionEnabled !== false ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
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

  // ---- Reminder slot event delegation ----
  const remindersCard = document.getElementById('reminders-card');

  remindersCard.addEventListener('change', async (e) => {
    const slot = e.target.closest('.reminder-slot-managed');
    if (!slot) return;
    const id = slot.dataset.reminderId;
    const field = e.target.dataset.field;
    if (!id || !field) return;

    const idx = reminders.findIndex(r => r.id === id);
    if (idx === -1) return;

    if (field === 'time') {
      reminders[idx].time = e.target.value;
      await saveReminders(reminders);
      // Re-sort and re-render
      reRenderList();
    } else if (field === 'toggle') {
      reminders[idx].enabled = e.target.checked;
      await saveReminders(reminders);
    }
  });

  remindersCard.addEventListener('input', async (e) => {
    const slot = e.target.closest('.reminder-slot-managed');
    if (!slot) return;
    const id = slot.dataset.reminderId;
    const field = e.target.dataset.field;
    if (!id || !field) return;

    if (field === 'label') {
      const idx = reminders.findIndex(r => r.id === id);
      if (idx === -1) return;
      reminders[idx].label = e.target.value;
      // Debounced save
      clearTimeout(remindersCard._labelTimeout);
      remindersCard._labelTimeout = setTimeout(async () => {
        await saveReminders(reminders);
      }, 500);
    }
  });

  remindersCard.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('[data-field="delete"]');
    if (!deleteBtn) return;
    const slot = deleteBtn.closest('.reminder-slot-managed');
    if (!slot) return;
    const id = slot.dataset.reminderId;

    const idx = reminders.findIndex(r => r.id === id);
    if (idx === -1) return;
    if (reminders[idx].type === 'default') return; // safety check

    reminders.splice(idx, 1);
    await saveReminders(reminders);
    reRenderList();
    updateAddButton();
  });

  // Add reminder button
  document.getElementById('btn-add-reminder').addEventListener('click', async () => {
    if (reminders.length >= MAX_REMINDERS) return;

    const newReminder = {
      id: nextCustomId(reminders),
      type: 'custom',
      label: '',
      time: nextFullHour(),
      enabled: true,
      order: reminders.length
    };

    reminders.push(newReminder);
    await saveReminders(reminders);
    reRenderList();
    updateAddButton();
  });

  // Reflection time
  document.getElementById('set-reflection-time').addEventListener('change', async (e) => {
    profile.reflectionTime = e.target.value;
    await saveProfile(profile);
  });
  document.getElementById('set-reflection-toggle').addEventListener('change', async (e) => {
    profile.reflectionEnabled = e.target.checked;
    await saveProfile(profile);
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

  // ---- Helper: re-render reminder list ----
  function reRenderList() {
    const listEl = document.getElementById('reminders-list');
    const sorted = sortByTime(reminders);
    listEl.innerHTML = sorted.map(r => renderReminderSlot(r, t)).join('');
  }

  function updateAddButton() {
    const btn = document.getElementById('btn-add-reminder');
    const atMax = reminders.length >= MAX_REMINDERS;
    btn.disabled = atMax;
    btn.textContent = atMax ? t.maxReached : t.addReminder;
    btn.classList.toggle('disabled', atMax);
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
