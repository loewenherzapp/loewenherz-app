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
  switchTab('today');
}

function bindHeaderButtons() {
  const crisisBtn = document.getElementById('crisis-btn');
  const settingsBtn = document.getElementById('settings-btn');

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

  if (tab === 'today') {
    await renderDashboard(contentEl, profile);
  } else if (tab === 'reflection') {
    await renderReflection(contentEl, profile);
  } else if (tab === 'history') {
    await renderHistory(contentEl, profile);
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

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = new URL('sw.js', window.location.href.replace(/\/[^/]*$/, '/'));
    navigator.serviceWorker.register(swUrl.href).catch(() => {});
  });
}

// Boot
document.addEventListener('DOMContentLoaded', init);
