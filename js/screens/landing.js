// ============================================================
// Landing Page — Install Instructions
// ============================================================

import { TEXTS } from '../../content/de.js';
import { APP_STORE_URL, PLAY_STORE_URL } from '../config.js';

/**
 * @param {HTMLElement} container
 * @param {function} onContinue  Ausweg für alle, die ohne Installation
 *                               weiterwollen (Desktop, unpassender Browser).
 */
export function renderLanding(container, onContinue) {
  const t = TEXTS.ui.landing;
  // Android-Handys sehen zuerst Google Play, alle anderen den App Store.
  // Seit dem Play-Start (09.11.2026) gibt es für beide nur noch den Weg
  // über den Store, die Homescreen-Anleitung für den Browser entfällt.
  let showAndroid = /Android/i.test(navigator.userAgent);

  function render() {
    const appStore = `
      <a class="btn-primary landing-appstore" href="${APP_STORE_URL}" target="_blank" rel="noopener noreferrer">${t.appStoreButton}</a>
    `;

    const playStore = `
      <a class="btn-primary landing-appstore" href="${PLAY_STORE_URL}" target="_blank" rel="noopener noreferrer">${t.playStoreButton}</a>
    `;

    container.innerHTML = `
      <div class="landing-screen">
        <img src="assets/icons/logo-288.png" alt="Löwenherz" class="landing-lion" width="96" height="96">
        <h1 class="landing-title">${t.title}</h1>
        <p class="landing-subtitle">${showAndroid ? t.playStoreSubtitle : t.appStoreSubtitle}</p>
        <div class="landing-steps">
          ${showAndroid ? playStore : appStore}
        </div>
        <button class="landing-toggle" id="landing-toggle-btn">
          ${showAndroid ? t.iosToggle : t.androidToggle}
        </button>
        <button class="landing-toggle landing-skip" id="landing-skip-btn">${t.continueAnyway}</button>
      </div>
    `;

    document.getElementById('landing-toggle-btn').addEventListener('click', () => {
      showAndroid = !showAndroid;
      render();
    });

    // Muss im Template stehen, nicht nachträglich angehängt werden:
    // render() ersetzt das gesamte innerHTML, ein von außen eingefügter
    // Button verschwand beim ersten Umschalten iOS/Android spurlos.
    document.getElementById('landing-skip-btn').addEventListener('click', onContinue);
  }

  render();
}
