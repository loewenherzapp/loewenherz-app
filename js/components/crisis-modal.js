// ============================================================
// Crisis Modal Component
// ============================================================

import { TEXTS } from '../../content/de.js';

let crisisEl = null;

export function initCrisisModal() {
  crisisEl = document.getElementById('crisis-modal');
  renderCrisisContent();
}

function renderCrisisContent() {
  const t = TEXTS.ui.crisis;
  crisisEl.innerHTML = `
    <div class="crisis-overlay" id="crisis-overlay">
      <div class="crisis-modal">
        <h2 class="crisis-title">${t.title}</h2>

        <div class="crisis-section">
          <div class="crisis-section-label">${t.telefonseelsorge}</div>
          <a href="tel:${t.phone1.replace(/\s/g, '')}" class="crisis-phone">${t.phone1}</a>
          <a href="tel:${t.phone2.replace(/\s/g, '')}" class="crisis-phone">${t.phone2}</a>
        </div>

        <div class="crisis-section">
          <div class="crisis-section-label">${t.krisentelefon}</div>
          <a href="tel:${t.phone3.replace(/\s/g, '')}" class="crisis-phone">${t.phone3}</a>
        </div>

        <div class="crisis-section">
          <div class="crisis-section-label">${t.online}</div>
          <a href="${t.onlineHref}" target="_blank" rel="noopener noreferrer" class="crisis-phone">${t.onlineUrl}</a>
        </div>

        <p class="crisis-footer">${t.footer}</p>

        <button class="btn-secondary crisis-close" id="crisis-close-btn">${t.close}</button>
      </div>
    </div>
  `;

  crisisEl.classList.add('hidden');

  const closeBtn = document.getElementById('crisis-close-btn');
  const overlay = document.getElementById('crisis-overlay');

  if (closeBtn) {
    closeBtn.addEventListener('click', closeCrisis);
    closeBtn.addEventListener('touchend', (e) => { e.preventDefault(); closeCrisis(); });
  }
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeCrisis();
    });
  }
}

export function openCrisis() {
  if (!crisisEl) return;
  crisisEl.classList.remove('hidden');
}

export function closeCrisis() {
  if (!crisisEl) return;
  crisisEl.classList.add('hidden');
}
