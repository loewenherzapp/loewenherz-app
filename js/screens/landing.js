// ============================================================
// Landing Page — app.angstdoc.de für neue Besucher im Browser
// ============================================================
//
// Hierhin führen der QR-Code und die Adresse im Buch. Die Seite hat eine
// Aufgabe: Besucher in den passenden Store bringen. Beide Stores stehen
// immer nebeneinander (keine Geräte-Erkennung, kein Umschalter), der
// App Store zuerst und beide gleich groß — so verlangen es die
// Marken-Richtlinien von Apple und Google.
//
// Oben stehen die offiziellen Badges (unveränderte Dateien von Apple und
// Google, Regeln in docs/landing-page.md). Apple erlaubt sein Badge nur
// einmal pro Seite, deshalb stehen am Schluss Text-Knöpfe.
//
// In den nativen Apps und in der installierten Web-App erscheint diese
// Seite nie (siehe isStandalone() in app.js). Die Bilder liegen deshalb
// in /landing und nicht in /assets: So landen sie nicht im App-Bundle.

import { TEXTS } from '../../content/de.js';
import { APP_STORE_URL, PLAY_STORE_URL } from '../config.js';
import { showLegalPage } from './settings.js';

const BOOK_URL = 'https://buch.angstdoc.de/';
const SITE_URL = 'https://angstdoc.de/';

/**
 * @param {HTMLElement} container
 * @param {function} onContinue  Ausweg für alle, die Löwenherz ohne Store
 *                               im Browser nutzen wollen.
 */
export function renderLanding(container, onContinue) {
  const t = TEXTS.ui.landing;
  const ts = TEXTS.ui.settings;

  // Store-Links öffnen im selben Tab: Auf dem Handy übernimmt sofort die
  // Store-App, ein neuer Tab bliebe als leere Seite zurück.
  const storeButtons = `
    <a class="landing-store" href="${APP_STORE_URL}">${t.appStoreButton}</a>
    <a class="landing-store" href="${PLAY_STORE_URL}">${t.playStoreButton}</a>
  `;

  const screens = t.screens.map((s, i) => `
    <li class="landing-shot">
      <div class="landing-phone">
        <img src="${s.img}" alt="${s.alt}" width="720" height="1280" ${i > 1 ? 'loading="lazy"' : ''} decoding="async">
      </div>
      <p class="landing-when">${s.when}</p>
      <h3 class="landing-shot-title">${s.title}</h3>
      <p class="landing-shot-text">${s.text}</p>
    </li>
  `).join('');

  const faq = t.faq.map((f) => `
    <details class="landing-faq-item">
      <summary>${f.q}</summary>
      <div class="landing-faq-answer">
        <p>${f.a}</p>
        ${f.browser ? `<button type="button" class="landing-link landing-browser">${t.browserLink} →</button>` : ''}
      </div>
    </details>
  `).join('');

  container.innerHTML = `
    <div class="landing-page">

      <header class="landing-hero">
        <div class="landing-wrap">
          <img src="assets/icons/logo-288.png" alt="" class="landing-logo" width="88" height="88">
          <h1 class="landing-brand">
            <span class="landing-wordmark">${t.brand}</span>
            <span class="landing-tagline">${t.tagline}</span>
          </h1>
          <p class="landing-claim">${t.claimLead} <em>${t.claimAccent}</em></p>
          <p class="landing-intro">${t.intro}</p>
          <div class="landing-badges">
            <a class="landing-badge" href="${APP_STORE_URL}">
              <img src="landing/badge-app-store-de.svg" alt="${t.appStoreBadgeAlt}" width="120" height="40">
            </a>
            <a class="landing-badge landing-badge-play" href="${PLAY_STORE_URL}">
              <img src="landing/badge-google-play-de.png" alt="${t.playStoreBadgeAlt}" width="646" height="250">
            </a>
          </div>
          <p class="landing-meta">${t.meta}</p>
          <div class="landing-qr">
            <img src="landing/qr-app.svg" alt="${t.qrAlt}" width="96" height="96" loading="lazy">
            <p>${t.qrHint}</p>
          </div>
        </div>
      </header>

      <main>
        <section class="landing-section">
          <div class="landing-wrap">
            <p class="landing-label">${t.dayLabel}</p>
            <h2 class="landing-h2">${t.dayTitle}</h2>
            <p class="landing-lead">${t.dayLead}</p>
            <ul class="landing-shots" aria-label="${t.screensLabel}" tabindex="0">${screens}</ul>
          </div>
        </section>

        <section class="landing-section">
          <div class="landing-wrap">
            <p class="landing-label">${t.castLabel}</p>
            <h2 class="landing-h2">${t.castTitle}</h2>
            <div class="landing-card landing-cast">
              <img src="landing/quatschi.webp" alt="${t.quatschiAlt}" class="landing-cast-img" width="544" height="452" loading="lazy" decoding="async">
              <div class="landing-cast-body">
                <div>
                  <p class="landing-speaker">${t.quatschiName}</p>
                  <p class="landing-quote">${t.quatschiQuote}</p>
                  <p class="landing-cast-text">${t.quatschiText}</p>
                </div>
                <div>
                  <p class="landing-speaker">${t.gundulaName}</p>
                  <div class="landing-gundula">
                    <img src="assets/gundula/gundula-entspannt-112.png" alt="" width="56" height="56" loading="lazy">
                    <span>${t.gundulaLine}</span>
                  </div>
                  <p class="landing-cast-text">${t.gundulaText}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="landing-section">
          <div class="landing-wrap landing-trust">
            <div class="landing-card landing-trust-item">
              <img src="landing/patrick-eberle.webp" alt="${t.authorAlt}" class="landing-author-img" width="72" height="72" loading="lazy" decoding="async">
              <div>
                <h3 class="landing-trust-title">${t.authorTitle}</h3>
                <p class="landing-trust-text">${t.authorText}</p>
              </div>
            </div>
            <div class="landing-card landing-trust-item">
              <span class="landing-trust-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/></svg>
              </span>
              <div>
                <h3 class="landing-trust-title">${t.privacyTitle}</h3>
                <p class="landing-trust-text">${t.privacyText}</p>
              </div>
            </div>
          </div>
        </section>

        <section class="landing-section">
          <div class="landing-wrap">
            <div class="landing-book">
              <img src="landing/buch.webp" alt="${t.bookAlt}" class="landing-book-img" width="480" height="618" loading="lazy" decoding="async">
              <div class="landing-book-body">
                <p class="landing-label">${t.bookLabel}</p>
                <h2 class="landing-h2">${t.bookTitle}</h2>
                <p class="landing-book-text">${t.bookText}</p>
                <a class="landing-link" href="${BOOK_URL}" target="_blank" rel="noopener">${t.bookLink} →</a>
              </div>
            </div>
          </div>
        </section>

        <section class="landing-section">
          <div class="landing-wrap landing-faq">
            <h2 class="landing-h2">${t.faqTitle}</h2>
            ${faq}
          </div>
        </section>
      </main>

      <footer class="landing-end">
        <div class="landing-wrap">
          <h2 class="landing-h2">${t.endTitle}</h2>
          <p class="landing-end-text">${t.endText}</p>
          <div class="landing-stores">${storeButtons}</div>
          <p class="landing-end-browser">${t.browserHint} <button type="button" class="landing-link landing-browser">${t.browserLink} →</button></p>

          <div class="landing-footer">
            <p>${t.footerLine}</p>
            <p>${t.disclaimer}</p>
            <p class="landing-footer-links">
              <button type="button" class="landing-link" data-legal="impressum">${ts.impressum}</button>
              <button type="button" class="landing-link" data-legal="datenschutz">${ts.datenschutz}</button>
              <a class="landing-link" href="${SITE_URL}" target="_blank" rel="noopener">${t.footerSite}</a>
            </p>
            <p class="landing-footer-marks">${t.trademarks}</p>
          </div>
        </div>
      </footer>

    </div>
  `;

  // Chrome auf Android bietet installierbare Web-Apps von sich aus zum
  // Installieren an. Auf dieser Seite soll nichts mit den Store-Knöpfen
  // konkurrieren. Wer sich für den Browser entscheidet, bekommt das Angebot
  // wieder (über das Browser-Menü geht es ohnehin immer).
  const keineWebInstallation = (e) => e.preventDefault();
  window.addEventListener('beforeinstallprompt', keineWebInstallation);

  container.querySelectorAll('.landing-browser').forEach((btn) => {
    btn.addEventListener('click', () => {
      window.removeEventListener('beforeinstallprompt', keineWebInstallation);
      onContinue();
    });
  });

  container.querySelectorAll('[data-legal]').forEach((btn) => {
    btn.addEventListener('click', () => showLegalPage(btn.dataset.legal, ts[btn.dataset.legal]));
  });
}
