// ============================================================
// E-Mail Soft-Prompt (A3) — einmalige Nachfrage für Gate-Skipper
// ============================================================
// Zweistufig: Meilenstein P2/P3/P4 setzt nur ein Flag (kein UI,
// keine Kollision mit dem Toast-System). Beim nächsten App-Öffnen
// bzw. Dashboard-Wechsel erscheint das Modal — genau einmal.
// Keine Consent-Checkbox: DOI ist der Nachweis, Info-Zeile wie im Gate.
// Kein Auto-Close bei Erfolg: Success-State mit DOI-Anweisung bleibt
// stehen, bis der User schließt (Bestätigungsrate, wie Gate-Screen).
// ============================================================

import { TEXTS } from '../../content/de.js';
import { isValidEmail, subscribeEmail, lockButton } from '../emailSignup.js';
import { showLegalPage } from '../screens/settings.js';

const TRIGGER_MILESTONES = ['P2', 'P3', 'P4'];

// Stufe 1: Flag setzen im Hintergrund.
// Handler arbeitet komplett synchron — P2 und P3 können im selben
// Tick nacheinander feuern, das zweite Event sieht das Flag bereits.
export function initEmailSoftPrompt() {
  window.addEventListener('milestoneReached', (e) => {
    if (!TRIGGER_MILESTONES.includes(e.detail.id)) return;
    if (localStorage.getItem('emailSkipped') !== 'true') return;
    if (localStorage.getItem('emailSoftPromptShown')) return;
    if (localStorage.getItem('emailSoftPromptReady')) return;
    localStorage.setItem('emailSoftPromptReady', 'true');
  });
}

// Stufe 2: Beim App-Öffnen / Dashboard-Wechsel aufrufen.
export function maybeShowEmailSoftPrompt() {
  if (localStorage.getItem('emailSoftPromptReady') !== 'true') return;

  // Flags sofort umdrehen — egal wie das Modal endet, es kommt nie wieder.
  localStorage.removeItem('emailSoftPromptReady');
  localStorage.setItem('emailSoftPromptShown', 'true');

  // Zwischenzeitlich über die Settings eingetragen? Dann nur aufräumen.
  if (localStorage.getItem('emailSkipped') !== 'true') return;

  showModal();
}

function showModal() {
  const t = TEXTS.ui.softPrompt;
  const tg = TEXTS.ui.emailGate;
  const ts = TEXTS.ui.settings;

  const el = document.createElement('div');
  el.className = 'soft-prompt-overlay';
  el.innerHTML = `
    <div class="soft-prompt-modal" role="dialog" aria-modal="true">
      <button type="button" class="soft-prompt-close" id="soft-prompt-close" aria-label="Schließen">✕</button>
      <div id="soft-prompt-body">
        <h2 class="soft-prompt-headline">${t.headline}</h2>
        <p class="soft-prompt-copy">${t.copy}</p>
        <form id="soft-prompt-form" novalidate>
          <input type="email" class="onboarding-input" id="soft-prompt-input"
                 placeholder="${tg.placeholder}" autocomplete="email" inputmode="email" maxlength="254">
          <div class="email-gate-error hidden" id="soft-prompt-error"></div>
          <div class="mt-16">
            <button type="submit" class="btn-primary" id="soft-prompt-submit">${t.submit}</button>
          </div>
          <p class="email-gate-info">${tg.infoPre} <a href="#" id="soft-prompt-privacy">${tg.infoLink}</a></p>
        </form>
        <button type="button" class="email-gate-skip soft-prompt-decline" id="soft-prompt-decline">${t.decline}</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);

  // fadeIn Backdrop + Scale-up Modal (CSS-Transition via .active)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add('active'));
  });

  const body = el.querySelector('#soft-prompt-body');
  const form = el.querySelector('#soft-prompt-form');
  const input = el.querySelector('#soft-prompt-input');
  const errorEl = el.querySelector('#soft-prompt-error');
  const submitBtn = el.querySelector('#soft-prompt-submit');

  function close() {
    document.removeEventListener('keydown', onKeydown);
    el.classList.remove('active');
    setTimeout(() => el.remove(), 250);
  }

  function onKeydown(e) {
    if (e.key === 'Escape') close();
  }
  document.addEventListener('keydown', onKeydown);

  // Tap außerhalb des Modals = schließen
  el.addEventListener('click', (e) => {
    if (e.target === el) close();
  });

  el.querySelector('#soft-prompt-close').addEventListener('click', close);
  el.querySelector('#soft-prompt-decline').addEventListener('click', close);

  el.querySelector('#soft-prompt-privacy').addEventListener('click', (e) => {
    e.preventDefault();
    showLegalPage('datenschutz', ts.datenschutz);
  });

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
  }

  // Success-State bleibt stehen bis der User schließt —
  // die DOI-Anweisung soll gelesen werden (wie beim Gate).
  function renderSuccess() {
    body.innerHTML = `
      <div class="soft-prompt-success-icon">📬</div>
      <h2 class="soft-prompt-headline">${tg.successTitle}</h2>
      <p class="soft-prompt-copy">${tg.successText}</p>
      <p class="email-gate-hint">${tg.successHint}</p>
      <div class="mt-16">
        <button type="button" class="btn-primary" id="soft-prompt-success-close">${t.successClose}</button>
      </div>
    `;
    body.querySelector('#soft-prompt-success-close').addEventListener('click', close);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('hidden');

    const email = input.value.trim();
    if (!email) { showError(tg.errEmpty); return; }
    if (!isValidEmail(email)) { showError(tg.errInvalid); return; }

    // 60-Sek-Sperre + Ladestate (gemeinsames Modul)
    lockButton(submitBtn, 60);
    submitBtn.textContent = tg.sending;

    const result = await subscribeEmail(email);

    if (result.ok) {
      localStorage.setItem('userEmail', email);
      localStorage.setItem('emailGateComplete', 'true');
      localStorage.removeItem('emailSkipped');
      renderSuccess();
    } else {
      // Modal offen lassen, emailSkipped behalten — Retry möglich,
      // Button wird nach Ablauf der 60-Sek-Sperre wieder aktiv.
      showError(result.error);
      submitBtn.textContent = t.submit;
    }
  });
}
