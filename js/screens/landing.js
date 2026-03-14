// ============================================================
// Landing Page — Install Instructions
// ============================================================

import { TEXTS } from '../../content/de.js';

export function renderLanding(container) {
  const t = TEXTS.ui.landing;
  let showAndroid = false;

  function render() {
    const iosSteps = `
      <div class="landing-step"><span class="step-number">1</span><span class="step-text">${t.step1}</span></div>
      <div class="landing-step"><span class="step-number">2</span><span class="step-text">${t.step2}</span></div>
      <div class="landing-step"><span class="step-number">3</span><span class="step-text">${t.step3}</span></div>
      <div class="landing-step"><span class="step-number">4</span><span class="step-text">${t.step4}</span></div>
    `;
    const androidSteps = `
      <div class="landing-step"><span class="step-number">1</span><span class="step-text">${t.androidStep1}</span></div>
      <div class="landing-step"><span class="step-number">2</span><span class="step-text">${t.androidStep2}</span></div>
      <div class="landing-step"><span class="step-number">3</span><span class="step-text">${t.androidStep3}</span></div>
    `;
    container.innerHTML = `
      <div class="landing-screen">
        <div class="landing-lion">🦁</div>
        <h1 class="landing-title">${t.title}</h1>
        <p class="landing-subtitle">${t.subtitle}</p>
        <div class="landing-steps">${showAndroid ? androidSteps : iosSteps}</div>
        <button class="landing-toggle" id="landing-toggle-btn">${showAndroid ? '← iOS' : t.androidToggle}</button>
      </div>
    `;
    document.getElementById('landing-toggle-btn').addEventListener('click', () => { showAndroid = !showAndroid; render(); });
  }

  render();
}
