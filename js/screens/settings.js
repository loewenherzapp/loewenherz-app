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
    showLegalPage('impressum', t.impressum);
  });

  // Datenschutz
  document.getElementById('settings-datenschutz').addEventListener('click', () => {
    showLegalPage('datenschutz', t.datenschutz);
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

const LEGAL_CONTENT = {
  impressum: `
    <h2>Impressum</h2>
    <p>Angaben gemäß EU-Verordnung (E-Commerce-Richtlinie 2000/31/EG):</p>
    <p><strong>Der AngstDoc & Kollegen S.R.L.</strong><br>
    Strada C. C. Arion 11<br>
    011081 Bukarest<br>
    Rumänien</p>
    <p>E-Mail: <a href="mailto:pe@angstdoc.de">pe@angstdoc.de</a></p>
    <p>Vertreten durch: Patrick Elkuch</p>
    <p>Handelsregister: [HIER REGISTERNUMMER EINFÜGEN]<br>
    USt-IdNr.: [HIER UST-ID EINFÜGEN]</p>
    <div class="legal-notice">
      <p><strong>Hinweis:</strong> Diese App dient ausschließlich der allgemeinen Information und Selbstreflexion. Sie ersetzt keine ärztliche oder psychotherapeutische Behandlung. Bei akuten psychischen Krisen wende dich bitte an den ärztlichen Bereitschaftsdienst (116 117), die Telefonseelsorge (0800 111 0 111 / 0800 111 0 222) oder den Notruf (112).</p>
    </div>
  `,
  datenschutz: `
    <h2>Datenschutzerklärung</h2>
    <p class="legal-meta">Stand: März 2026</p>

    <h3>1. Verantwortlicher</h3>
    <p>Der AngstDoc & Kollegen S.R.L.<br>
    Strada C. C. Arion 11<br>
    011081 Bukarest, Rumänien<br>
    E-Mail: <a href="mailto:pe@angstdoc.de">pe@angstdoc.de</a></p>

    <h3>2. Datenverarbeitung in der App</h3>
    <p>Diese App speichert deine Daten (Reflexionen, Stimmungen, SMALL-Punkte, Einstellungen) ausschließlich lokal auf deinem Gerät (IndexedDB/LocalStorage). Es werden keine personenbezogenen Daten an unsere Server übertragen. Wir haben keinen Zugriff auf deine Eingaben.</p>
    <p>Wenn du die App oder deine Browserdaten löschst, werden alle gespeicherten Daten unwiderruflich entfernt.</p>

    <h3>3. Hosting</h3>
    <p>Die App wird über Vercel Inc. (440 N Barranca Ave #4133, Covina, CA 91723, USA) gehostet. Beim Aufruf der App werden automatisch technische Daten (u.a. IP-Adresse, Zeitpunkt des Zugriffs, Browsertyp) an Vercel-Server übermittelt. Diese Verarbeitung erfolgt auf Grundlage unseres berechtigten Interesses an der technischen Bereitstellung der App (Art. 6 Abs. 1 lit. f DSGVO).</p>
    <p>Vercel verarbeitet Daten teilweise in den USA. Die Übermittlung erfolgt auf Basis von EU-Standardvertragsklauseln.</p>
    <p>Mehr Informationen: <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">vercel.com/legal/privacy-policy</a></p>

    <h3>4. Webanalyse (Vercel Web Analytics)</h3>
    <p>Wir nutzen Vercel Web Analytics zur statistischen Auswertung der App-Nutzung. Dabei werden ausschließlich aggregierte, anonyme Daten erhoben — keine Cookies, keine persönlichen Daten, keine Nutzerprofile. Es ist keine Identifizierung einzelner Nutzer möglich.</p>
    <p>Rechtsgrundlage: Berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO).</p>

    <h3>5. Cookies</h3>
    <p>Diese App verwendet keine Cookies.</p>

    <h3>6. Keine Weitergabe an Dritte</h3>
    <p>Deine Daten werden nicht an Dritte weitergegeben, verkauft oder für Werbezwecke genutzt.</p>

    <h3>7. Deine Rechte</h3>
    <p>Du hast das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung deiner Daten sowie das Recht auf Datenübertragbarkeit und Widerspruch. Da alle Daten lokal auf deinem Gerät gespeichert werden, hast du jederzeit volle Kontrolle — du kannst sie über die Browsereinstellungen oder durch Löschen der App entfernen.</p>
    <p>Bei Fragen zum Datenschutz: <a href="mailto:pe@angstdoc.de">pe@angstdoc.de</a></p>

    <h3>8. Beschwerderecht</h3>
    <p>Du hast das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren. Die zuständige Behörde in Rumänien ist:</p>
    <p>Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP)<br>
    B-dul G-ral. Gheorghe Magheru 28-30, Sector 1, București<br>
    <a href="https://www.dataprotection.ro" target="_blank" rel="noopener noreferrer">www.dataprotection.ro</a></p>
  `
};

function showLegalPage(key, title) {
  const el = document.createElement('div');
  el.className = 'legal-page';
  el.innerHTML = `
    <header class="app-header">
      <button class="legal-back" id="legal-back">← ${title}</button>
      <div></div>
    </header>
    <div class="legal-content">
      ${LEGAL_CONTENT[key]}
    </div>
  `;
  document.body.appendChild(el);

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add('active'));
  });

  document.getElementById('legal-back').addEventListener('click', () => {
    el.classList.remove('active');
    setTimeout(() => el.remove(), 300);
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
