// ============================================================
// Settings Screen
// ============================================================

import { TEXTS } from '../../content/de.js';
import { getProfile, saveProfile, clearAllData } from '../db.js';
import { openCrisis } from '../components/crisis-modal.js';

export async function renderSettings(container, profile, onBack, onDataDeleted) {
  const t = TEXTS.ui.settings;

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
        <div class="settings-card">
          <div class="reminder-slot" style="margin-bottom:8px;">
            <div class="reminder-left">
              <span class="reminder-label">${t.morning}</span>
              <input type="time" class="reminder-time" id="set-rem-morning-time" value="${profile.reminders?.morning?.time || '08:00'}">
            </div>
            <label class="toggle">
              <input type="checkbox" id="set-rem-morning-toggle" ${profile.reminders?.morning?.enabled ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="reminder-slot" style="margin-bottom:8px;">
            <div class="reminder-left">
              <span class="reminder-label">${t.midday}</span>
              <input type="time" class="reminder-time" id="set-rem-midday-time" value="${profile.reminders?.midday?.time || '13:00'}">
            </div>
            <label class="toggle">
              <input type="checkbox" id="set-rem-midday-toggle" ${profile.reminders?.midday?.enabled ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="reminder-slot">
            <div class="reminder-left">
              <span class="reminder-label">${t.evening}</span>
              <input type="time" class="reminder-time" id="set-rem-evening-time" value="${profile.reminders?.evening?.time || '18:00'}">
            </div>
            <label class="toggle">
              <input type="checkbox" id="set-rem-evening-toggle" ${profile.reminders?.evening?.enabled ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
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

  // Back button
  document.getElementById('settings-back').addEventListener('click', onBack);

  // Crisis header in settings
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

  // Auto-save reminders
  function bindReminder(id, path) {
    const timeEl = document.getElementById(`set-rem-${id}-time`);
    const toggleEl = document.getElementById(`set-rem-${id}-toggle`);

    timeEl.addEventListener('change', async () => {
      if (!profile.reminders) profile.reminders = {};
      if (!profile.reminders[path]) profile.reminders[path] = {};
      profile.reminders[path].time = timeEl.value;
      await saveProfile(profile);
    });

    toggleEl.addEventListener('change', async () => {
      if (!profile.reminders) profile.reminders = {};
      if (!profile.reminders[path]) profile.reminders[path] = {};
      profile.reminders[path].enabled = toggleEl.checked;
      await saveProfile(profile);
    });
  }

  bindReminder('morning', 'morning');
  bindReminder('midday', 'midday');
  bindReminder('evening', 'evening');

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
