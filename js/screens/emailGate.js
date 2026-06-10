// ============================================================
// E-Mail-Gate — Erststart-Screen nach Onboarding, vor Dashboard
// ============================================================
// Keine Consent-Checkbox: Die Einwilligung ist das Absenden selbst,
// der gerichtsfeste Nachweis ist Brevos Double-Opt-in-Protokoll.
// Info-Zeile unterm Button erklärt DOI + verlinkt die DSE.
// ============================================================

import { TEXTS } from '../../content/de.js';
import { isValidEmail, subscribeEmail, lockButton } from '../emailSignup.js';
import { showLegalPage } from './settings.js';

export function renderEmailGate(container, onDone) {
  const t = TEXTS.ui.emailGate;
  const ts = TEXTS.ui.settings;

  container.innerHTML = `
    <div class="onboarding-screen">
      <div class="email-gate-lion">🦁</div>
      <h1 class="onboarding-welcome">${t.headline}</h1>
      <p class="email-gate-copy">${t.copy}</p>
      <form id="email-gate-form" novalidate>
        <input type="email" class="onboarding-input" id="email-gate-input"
               placeholder="${t.placeholder}" autocomplete="email" inputmode="email" maxlength="254">
        <div class="email-gate-error hidden" id="email-gate-error"></div>
        <div class="mt-24">
          <button type="submit" class="btn-primary" id="email-gate-submit">${t.submit}</button>
        </div>
        <p class="email-gate-info">${t.infoPre} <a href="#" id="email-gate-privacy">${t.infoLink}</a></p>
      </form>
      <button type="button" class="email-gate-skip" id="email-gate-skip">${t.skip}</button>
    </div>
  `;

  const form = document.getElementById('email-gate-form');
  const input = document.getElementById('email-gate-input');
  const errorEl = document.getElementById('email-gate-error');
  const submitBtn = document.getElementById('email-gate-submit');

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
  }

  // Success-State bleibt stehen, bis der User weiterklickt —
  // ein Auto-Redirect würde die DOI-Anweisung unter der App begraben.
  function renderSuccess() {
    container.innerHTML = `
      <div class="onboarding-screen">
        <div class="email-gate-lion">📬</div>
        <h1 class="onboarding-welcome">${t.successTitle}</h1>
        <p class="email-gate-copy">${t.successText}</p>
        <p class="email-gate-hint">${t.successHint}</p>
        <div class="mt-24">
          <button type="button" class="btn-primary" id="email-gate-continue">${t.successCta}</button>
        </div>
      </div>
    `;
    document.getElementById('email-gate-continue').addEventListener('click', () => onDone());
  }

  // Datenschutz-Link → bestehende Legal-Seite (Modal)
  document.getElementById('email-gate-privacy').addEventListener('click', (e) => {
    e.preventDefault();
    showLegalPage('datenschutz', ts.datenschutz);
  });

  // Tastatur offen → Button sichtbar halten
  input.addEventListener('focus', () => {
    setTimeout(() => submitBtn.scrollIntoView({ block: 'nearest' }), 300);
  });

  // Enter im Input = Submit (form-submit deckt das ab)
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('hidden');

    const email = input.value.trim();
    if (!email) { showError(t.errEmpty); return; }
    if (!isValidEmail(email)) { showError(t.errInvalid); return; }

    // 60-Sek-Sperre + Ladestate
    lockButton(submitBtn, 60);
    submitBtn.textContent = t.sending;

    const result = await subscribeEmail(email);

    if (result.ok) {
      localStorage.setItem('userEmail', email);
      localStorage.setItem('emailGateComplete', 'true');
      renderSuccess();
    } else {
      // emailGateComplete NICHT setzen — User soll es erneut versuchen können.
      showError(result.error);
      submitBtn.textContent = t.submit;
    }
  });

  // „Erstmal ohne" — Notausgang, immer verfügbar
  document.getElementById('email-gate-skip').addEventListener('click', () => {
    localStorage.setItem('emailGateComplete', 'true');
    localStorage.setItem('emailSkipped', 'true');
    onDone();
  });
}
