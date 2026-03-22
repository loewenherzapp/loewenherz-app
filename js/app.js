// ============================================================
// Löwenherz PWA — Main App Controller
// ============================================================

import { TEXTS } from '../content/de.js';
import { initDB, getProfile } from './db.js';
import { initBottomSheet } from './components/bottom-sheet.js';
import { initCrisisModal, openCrisis } from './components/crisis-modal.js';
import { renderLanding } from './screens/landing.js';
import { renderOnboarding } from './screens/onboarding.js';
import { renderDashboard } from './screens/dashboard.js';
import { renderReflection } from './screens/reflection.js';
import { renderHistory } from './screens/history.js';
import { renderSettings } from './screens/settings.js';
import './push.js'; // OneSignal init (side-effect import)

let currentTab = 'today';
let profile = null;

// Check if running as installed PWA
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

async function init() {
  await initDB();

  // Init components
  initBottomSheet();
  initCrisisModal();

  // Set tab labels from TEXTS
  const tabTexts = TEXTS.ui.tabs;
  document.getElementById('tab-label-today').textContent = tabTexts.today;
  document.getElementById('tab-label-reflection').textContent = tabTexts.reflection;
  document.getElementById('tab-label-history').textContent = tabTexts.history;

  // Bind header buttons (click + touch for reliable mobile response)
  bindHeaderButtons();

  // Bind tab buttons (new class: .nav-tab)
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
    });
  });

  // Check profile
  profile = await getProfile();

  if (!profile || !profile.onboardingComplete) {
    if (!isStandalone()) {
      showLanding();
    } else {
      showOnboarding();
    }
  } else {
    showApp();
  }
}

function hideAll() {
  document.getElementById('landing-container').classList.add('hidden');
  document.getElementById('onboarding-container').classList.add('hidden');
  document.getElementById('app-shell').classList.add('hidden');
  document.getElementById('settings-container').classList.add('hidden');
}

function showLanding() {
  hideAll();
  const container = document.getElementById('landing-container');
  container.classList.remove('hidden');
  renderLanding(container);

  const skipEl = document.createElement('button');
  skipEl.className = 'landing-toggle';
  skipEl.textContent = TEXTS.ui.landing.continueAnyway;
  skipEl.style.marginTop = '32px';
  skipEl.addEventListener('click', () => {
    showOnboarding();
  });
  setTimeout(() => {
    const landingScreen = container.querySelector('.landing-screen');
    if (landingScreen) landingScreen.appendChild(skipEl);
  }, 500);
}

function showOnboarding() {
  hideAll();
  const container = document.getElementById('onboarding-container');
  container.classList.remove('hidden');
  renderOnboarding(container, (savedProfile) => {
    profile = savedProfile;
    showApp();
  });
}

function showApp() {
  hideAll();
  document.getElementById('app-shell').classList.remove('hidden');
  bindHeaderButtons();

  // Deep-link: open target tab from notification URL, or default to today
  const params = new URLSearchParams(window.location.search);
  const targetTab = params.get('tab');
  if (targetTab) {
    const tabMap = { 'heute': 'today', 'today': 'today', 'reflexion': 'reflection', 'reflection': 'reflection', 'verlauf': 'history', 'history': 'history' };
    switchTab(tabMap[targetTab] || 'today');
    window.history.replaceState({}, '', window.location.pathname);
  } else {
    switchTab('today');
  }

  // Coach-Mark Tooltip beim Erststart
  if (!localStorage.getItem('hasSeenInfo')) {
    setTimeout(() => showCoachMark(), 800);
  }
}

function bindHeaderButtons() {
  const crisisBtn = document.getElementById('crisis-btn');
  const settingsBtn = document.getElementById('settings-btn');
  const infoBtn = document.getElementById('header-info-btn');

  if (crisisBtn && !crisisBtn._bound) {
    crisisBtn.addEventListener('click', openCrisis);
    crisisBtn.addEventListener('touchend', (e) => { e.preventDefault(); openCrisis(); });
    crisisBtn._bound = true;
  }
  if (settingsBtn && !settingsBtn._bound) {
    settingsBtn.addEventListener('click', showSettings);
    settingsBtn.addEventListener('touchend', (e) => { e.preventDefault(); showSettings(); });
    settingsBtn._bound = true;
  }
  if (infoBtn && !infoBtn._bound) {
    infoBtn.addEventListener('click', showAppInfo);
    infoBtn._bound = true;
  }
}

// Update theme-color meta tag
function setThemeColor(color) {
  const meta = document.getElementById('theme-color-meta');
  if (meta) meta.setAttribute('content', color);
}

async function switchTab(tab) {
  currentTab = tab;

  // Update tab bar active state
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  // Header: prominent title + info button on dashboard only
  const headerTitle = document.querySelector('.header-title');
  const headerInfoBtn = document.getElementById('header-info-btn');
  if (headerTitle) headerTitle.classList.toggle('prominent', tab === 'today');
  if (headerInfoBtn) headerInfoBtn.classList.toggle('hidden', tab !== 'today');

  // Reflexion mode: toggle dark class on #app
  const appEl = document.getElementById('app');
  if (tab === 'reflection') {
    appEl.classList.add('reflexion-mode');
    setThemeColor('#1a1714');
  } else {
    appEl.classList.remove('reflexion-mode');
    appEl.removeAttribute('data-mood');
    setThemeColor('#f5efe3');
  }

  // Re-fetch profile in case name changed
  profile = await getProfile();

  const contentEl = document.getElementById('main-content');

  // Tab crossfade: fade out old content → render new → fade in
  // Skip fade-out on initial load (no content yet) or reduced motion
  const skipAnim = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasContent = contentEl.innerHTML.trim().length > 0;

  if (!skipAnim && hasContent) {
    contentEl.classList.add('tab-fade-out');
    await new Promise(r => setTimeout(r, 150));
  }

  if (tab === 'today') {
    await renderDashboard(contentEl, profile);
  } else if (tab === 'reflection') {
    await renderReflection(contentEl, profile);
  } else if (tab === 'history') {
    await renderHistory(contentEl, profile);
  }

  if (!skipAnim && hasContent) {
    void contentEl.offsetHeight;
    contentEl.classList.remove('tab-fade-out');
  }
}

async function showSettings() {
  hideAll();
  const container = document.getElementById('settings-container');
  container.classList.remove('hidden');

  // Remove reflexion mode when going to settings
  const appEl = document.getElementById('app');
  appEl.classList.remove('reflexion-mode');
  appEl.removeAttribute('data-mood');
  setThemeColor('#f5efe3');

  profile = await getProfile();

  await renderSettings(
    container,
    profile,
    () => showApp(),
    () => { window.location.reload(); }
  );
}

function dismissCoachMark() {
  const mark = document.getElementById('coach-mark');
  if (mark) {
    mark.classList.remove('active');
    setTimeout(() => mark.remove(), 300);
  }
  localStorage.setItem('hasSeenInfo', 'true');
}

function showCoachMark() {
  const infoBtn = document.getElementById('header-info-btn');
  if (!infoBtn) return;

  const mark = document.createElement('div');
  mark.id = 'coach-mark';
  mark.className = 'coach-mark';
  mark.innerHTML = `
    <div class="coach-mark-bubble">
      <div class="coach-mark-arrow"></div>
      <span class="coach-mark-icon">ⓘ</span>
      Tippe hier für eine kurze Orientierung
    </div>
  `;

  // Position unter dem ⓘ-Button
  const rect = infoBtn.getBoundingClientRect();
  mark.style.position = 'fixed';
  mark.style.top = (rect.bottom + 8) + 'px';
  mark.style.right = '16px';
  mark.style.zIndex = '500';

  document.body.appendChild(mark);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => mark.classList.add('active'));
  });

  // Tap on bubble → open Info-Sheet directly
  mark.querySelector('.coach-mark-bubble').addEventListener('click', (e) => {
    e.stopPropagation();
    dismissCoachMark();
    document.removeEventListener('click', dismiss, true);
    showAppInfo();
  });

  // Tap anywhere else dismisses (without opening info)
  const dismiss = (e) => {
    if (mark.contains(e.target)) return; // bubble handles itself
    if (infoBtn.contains(e.target)) {
      dismissCoachMark();
      document.removeEventListener('click', dismiss, true);
      return;
    }
    dismissCoachMark();
    document.removeEventListener('click', dismiss, true);
  };
  setTimeout(() => {
    document.addEventListener('click', dismiss, true);
  }, 100);
}

function showAppInfo() {
  const existing = document.getElementById('app-info-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'app-info-overlay';
  overlay.className = 'info-sheet-overlay';

  overlay.innerHTML = `
    <div class="info-sheet">
      <div class="info-sheet-grip"></div>
      <h3>Löwenherz</h3>
      <p class="info-subtitle">Angst wird erlernt. Gelassenheit auch.</p>
      <p>Die Begleit-App zum Buch.</p>
      <p><strong>Heute-Tab:</strong> Tippe die SMALL-Buchstaben, wenn du einen bewussten Moment hattest — jeder Tap zählt als Punkt. Gundula zeigt dir, wie dein System gerade steht.</p>
      <p><strong>Reflexion-Tab:</strong> Morgens eine Intention setzen, abends kurz reflektieren — zwei Minuten, die den Tag einrahmen.</p>
      <p>Kein Programm. Drei Leitplanken. Alles über null ist Gewinn.</p>
      <button class="info-sheet-close">Verstanden</button>
    </div>
  `;

  document.body.appendChild(overlay);

  dismissCoachMark();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => overlay.classList.add('active'));
  });

  const close = () => {
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 300);
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector('.info-sheet-close').addEventListener('click', close);
}

// Service Worker: OneSignal handles registration of OneSignalSDKWorker.js automatically.
// Manual registration removed to avoid conflicts.

// Boot
document.addEventListener('DOMContentLoaded', init);
