// ============================================================
// Settings Screen — v3 (unified push settings, 5 SMALL slots)
// ============================================================

import { TEXTS } from '../../content/de.js';
import { saveProfile, clearAllData, migrateToV2 } from '../db.js';
import { openCrisis } from '../components/crisis-modal.js';
import { syncOneSignalTags, roundTo15Min } from '../push.js';

// Default SMALL reminder slots (3 enabled, 2 disabled)
const DEFAULT_SMALL_SLOTS = [
  { id: 1, time: '09:30', enabled: true },
  { id: 2, time: '12:30', enabled: true },
  { id: 3, time: '15:30', enabled: true },
  { id: 4, time: '11:00', enabled: false },
  { id: 5, time: '17:00', enabled: false }
];

function initSmallSlotsIfNeeded() {
  for (const slot of DEFAULT_SMALL_SLOTS) {
    if (localStorage.getItem(`loewenherz_small_${slot.id}_time`) === null) {
      localStorage.setItem(`loewenherz_small_${slot.id}_time`, slot.time);
      localStorage.setItem(`loewenherz_small_${slot.id}_enabled`, String(slot.enabled));
    }
  }
}

function getSmallSlots() {
  return DEFAULT_SMALL_SLOTS.map(slot => ({
    id: slot.id,
    time: localStorage.getItem(`loewenherz_small_${slot.id}_time`) || slot.time,
    enabled: localStorage.getItem(`loewenherz_small_${slot.id}_enabled`) !== 'false'
  }));
}

function renderSmallSlot(slot) {
  return `<div class="push-small-slot" data-slot-id="${slot.id}">
    <input type="time" class="reminder-time" data-field="time" step="900" value="${slot.time}">
    <label class="toggle">
      <input type="checkbox" data-field="toggle" ${slot.enabled ? 'checked' : ''}>
      <span class="toggle-slider"></span>
    </label>
  </div>`;
}

export async function renderSettings(container, profile, onBack, onDataDeleted) {
  const t = TEXTS.ui.settings;

  // Run v2 migration if needed (keeps DB clean)
  profile = await migrateToV2(profile);

  // Initialize SMALL slots in localStorage if first time
  initSmallSlotsIfNeeded();

  // Migrate old push defaults if needed
  if (!localStorage.getItem('loewenherz_morning_time')) {
    localStorage.setItem('loewenherz_morning_time', '07:00');
  }
  if (!localStorage.getItem('loewenherz_evening_time')) {
    localStorage.setItem('loewenherz_evening_time', '20:30');
  }

  const pushEnabled = localStorage.getItem('loewenherz_push_enabled') !== 'false';
  const smallSlots = getSmallSlots();
  const sortedSlots = [...smallSlots].sort((a, b) => a.time.localeCompare(b.time));

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

      <!-- Push-Benachrichtigungen (unified) -->
      <div class="settings-section" id="push-settings-section">
        <div class="settings-label">Erinnerungen</div>
        <div class="settings-card" id="push-settings-card">
          <!-- Master Toggle -->
          <div class="push-setting-row">
            <div class="push-setting-labels">
              <div class="push-setting-label">Push-Benachrichtigungen</div>
              <div class="push-setting-sublabel">Morgen- & Abendreflexion, SMALL-Reminder</div>
            </div>
            <label class="toggle">
              <input type="checkbox" id="push-main-toggle" ${pushEnabled ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="push-blocked-hint hidden" id="push-blocked-hint">Push-Benachrichtigungen sind im Browser blockiert. Bitte aktiviere sie in deinen Browser-Einstellungen.</div>

          <div id="push-sub-settings" class="${!pushEnabled ? 'push-settings-disabled' : ''}">
            <div class="push-settings-divider"></div>

            <!-- Morning / Evening times (always active when push is on) -->
            <div class="push-setting-time">
              <div class="push-setting-label">Morgenreflexion</div>
              <input type="time" class="reminder-time" id="push-morning-time" step="900" value="${localStorage.getItem('loewenherz_morning_time') || '07:00'}">
            </div>
            <div class="push-setting-time">
              <div class="push-setting-label">Abendreflexion</div>
              <input type="time" class="reminder-time" id="push-evening-time" step="900" value="${localStorage.getItem('loewenherz_evening_time') || '20:30'}">
            </div>

            <div class="push-settings-divider"></div>

            <!-- SMALL Reminder Slots -->
            <div class="push-setting-label push-small-header">SMALL-Reminder</div>
            <div class="push-setting-sublabel push-small-sublabel">Kurze Impulse zwischen Morgen und Abend</div>
            <div id="push-small-slots">
              ${sortedSlots.map(s => renderSmallSlot(s)).join('')}
            </div>
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

  // ---- Push Master Toggle ----
  const pushMainToggle = document.getElementById('push-main-toggle');
  const pushSubSettings = document.getElementById('push-sub-settings');
  const pushBlockedHint = document.getElementById('push-blocked-hint');

  function updatePushSubState() {
    const enabled = localStorage.getItem('loewenherz_push_enabled') !== 'false';
    if (enabled) {
      pushSubSettings.classList.remove('push-settings-disabled');
    } else {
      pushSubSettings.classList.add('push-settings-disabled');
    }
  }

  pushMainToggle.addEventListener('change', () => {
    if (pushMainToggle.checked) {
      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
        pushBlockedHint.classList.remove('hidden');
        pushMainToggle.checked = false;
        return;
      }
      pushBlockedHint.classList.add('hidden');

      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        if (window.OneSignal && OneSignal.Slidedown) {
          OneSignal.Slidedown.promptPush();
        } else {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              localStorage.setItem('loewenherz_push_enabled', 'true');
              updatePushSubState();
              syncOneSignalTags();
            } else {
              pushMainToggle.checked = false;
              localStorage.setItem('loewenherz_push_enabled', 'false');
              updatePushSubState();
            }
          });
        }
      }

      localStorage.setItem('loewenherz_push_enabled', 'true');
      updatePushSubState();
      syncOneSignalTags();
    } else {
      localStorage.setItem('loewenherz_push_enabled', 'false');
      updatePushSubState();
      syncOneSignalTags();
    }
  });

  // ---- Morning / Evening time pickers ----
  const pushMorningTime = document.getElementById('push-morning-time');
  const pushEveningTime = document.getElementById('push-evening-time');

  function saveTime(inputEl, storageKey) {
    const rounded = roundTo15Min(inputEl.value);
    inputEl.value = rounded;
    localStorage.setItem(storageKey, rounded);
    syncOneSignalTags();
  }

  let pushMorningTimer;
  pushMorningTime.addEventListener('change', () => {
    clearTimeout(pushMorningTimer);
    pushMorningTimer = setTimeout(() => saveTime(pushMorningTime, 'loewenherz_morning_time'), 1500);
  });
  pushMorningTime.addEventListener('focusout', () => {
    clearTimeout(pushMorningTimer);
    saveTime(pushMorningTime, 'loewenherz_morning_time');
  });

  let pushEveningTimer;
  pushEveningTime.addEventListener('change', () => {
    clearTimeout(pushEveningTimer);
    pushEveningTimer = setTimeout(() => saveTime(pushEveningTime, 'loewenherz_evening_time'), 1500);
  });
  pushEveningTime.addEventListener('focusout', () => {
    clearTimeout(pushEveningTimer);
    saveTime(pushEveningTime, 'loewenherz_evening_time');
  });

  // ---- SMALL Slots: event delegation ----
  const smallSlotsEl = document.getElementById('push-small-slots');
  let smallTimers = {};

  smallSlotsEl.addEventListener('change', (e) => {
    const slotEl = e.target.closest('.push-small-slot');
    if (!slotEl) return;
    const id = slotEl.dataset.slotId;
    const field = e.target.dataset.field;

    if (field === 'toggle') {
      localStorage.setItem(`loewenherz_small_${id}_enabled`, e.target.checked ? 'true' : 'false');
      syncOneSignalTags();
    } else if (field === 'time') {
      clearTimeout(smallTimers[id]);
      smallTimers[id] = setTimeout(() => {
        const rounded = roundTo15Min(e.target.value);
        e.target.value = rounded;
        localStorage.setItem(`loewenherz_small_${id}_time`, rounded);
        syncOneSignalTags();
        reRenderSmallSlots();
      }, 1500);
    }
  });

  smallSlotsEl.addEventListener('focusout', (e) => {
    if (e.target.dataset.field !== 'time') return;
    const slotEl = e.target.closest('.push-small-slot');
    if (!slotEl) return;
    const id = slotEl.dataset.slotId;
    clearTimeout(smallTimers[id]);
    const rounded = roundTo15Min(e.target.value);
    e.target.value = rounded;
    localStorage.setItem(`loewenherz_small_${id}_time`, rounded);
    syncOneSignalTags();
    reRenderSmallSlots();
  });

  function reRenderSmallSlots() {
    const slots = getSmallSlots();
    const sorted = [...slots].sort((a, b) => a.time.localeCompare(b.time));
    smallSlotsEl.innerHTML = sorted.map(s => renderSmallSlot(s)).join('');
  }

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
}

const LEGAL_CONTENT = {
  impressum: `
    <h2>Impressum</h2>
    <p>Angaben gemäß EU-Verordnung (E-Commerce-Richtlinie 2000/31/EG):</p>
    <p><strong>Der AngstDoc und Kollegen S.R.L.</strong><br>
    Inh. Dr. med. Patrick Eberle<br>
    Strada C.C. Arion 11<br>
    011082 Bukarest<br>
    Rumänien</p>
    <p>Mobil: <a href="tel:+4915156315884">+49 151 5631 5884</a><br>
    E-Mail: <a href="mailto:pe@angstdoc.de">pe@angstdoc.de</a></p>
    <p>Handelsregister: Rumänisches Handelsregister<br>
    VAT: RO48978340</p>
    <div class="legal-notice">
      <p><strong>Hinweis:</strong> Diese App dient ausschließlich der allgemeinen Information und Selbstreflexion. Sie ersetzt keine ärztliche oder psychotherapeutische Behandlung. Bei akuten psychischen Krisen wende dich bitte an den ärztlichen Bereitschaftsdienst (116 117), die Telefonseelsorge (0800 111 0 111 / 0800 111 0 222) oder den Notruf (112).</p>
    </div>
  `,
  datenschutz: `
    <h2>Datenschutzerklärung</h2>
    <p class="legal-meta">Stand: März 2026</p>

    <h3>1. Verantwortlicher</h3>
    <p>Der AngstDoc und Kollegen S.R.L.<br>
    Inh. Dr. med. Patrick Eberle<br>
    Strada C.C. Arion 11<br>
    011082 Bukarest, Rumänien<br>
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
