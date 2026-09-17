// ============================================================
// Landing Page — Install Instructions
// ============================================================

import { TEXTS } from '../../content/de.js';
import { APP_STORE_URL } from '../config.js';

/**
 * @param {HTMLElement} container
 * @param {function} onContinue  Ausweg für alle, die ohne Installation
 *                               weiterwollen (Desktop, unpassender Browser).
 */
export function renderLanding(container, onContinue) {
  const t = TEXTS.ui.landing;
  let showAndroid = false;

  function render() {
    // iPhone: nativer Weg über den App Store statt Homescreen-Anleitung.
    const appStore = `
      <a class="btn-primary landing-appstore" href="${APP_STORE_URL}" target="_blank" rel="noopener noreferrer">${t.appStoreButton}</a>
    `;

    const androidSteps = `
      <div class="landing-step"><span class="step-number">1</span><span class="step-text">${t.androidStep1}</span></div>
      <div class="landing-step"><span class="step-number">2</span><span class="step-text">${t.androidStep2}</span></div>
      <div class="landing-step"><span class="step-number">3</span><span class="step-text">${t.androidStep3}</span></div>
    `;

    container.innerHTML = `
      <div class="landing-screen">
        <img src="assets/icons/icon-192.png" alt="Löwenherz" class="landing-lion" width="96" height="96">
        <h1 class="landing-title">${t.title}</h1>
        <p class="landing-subtitle">${showAndroid ? t.subtitle : t.appStoreSubtitle}</p>
        <div class="landing-steps">
          ${showAndroid ? androidSteps : appStore}
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
