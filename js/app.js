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

  // Bind tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
    });
  });

  // Check profile
  profile = await getProfile();

  if (!profile || !profile.onboardingComplete) {
    // Check standalone
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

  // Also set up a way to proceed for testing (double-tap lion or wait)
  // In real use, user installs and reopens
  // For now, allow scrolling down to see a "Continue anyway" link for desktop testing
  const skipEl = document.createElement('button');
  skipEl.className = 'landing-toggle';
  skipEl.textContent = 'Trotzdem fortfahren \u2192';
  skipEl.style.marginTop = '32px';
  skipEl.addEventListener('click', () => {
    showOnboarding();
  });
  // Append after a delay to not distract
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
  // Re-bind header buttons to guarantee they work after shell becomes visible
  bindHeaderButtons();
  switchTab('today');
}

// Robust binding: both click and touchend for PWA / iOS reliability
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

async function switchTab(tab) {
  currentTab = tab;

  // Update tab bar active state
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

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

  // Re-fetch profile
  profile = await getProfile();

  await renderSettings(
    container,
    profile,
    // onBack
    () => showApp(),
    // onDataDeleted
    () => {
      window.location.reload();
    }
  );
}

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // SW scope relative to document
    const swUrl = new URL('sw.js', window.location.href.replace(/\/[^/]*$/, '/'));
    navigator.serviceWorker.register(swUrl.href).catch(() => {
      // SW registration failed \u2014 possibly in dev, ignore
    });
  });
}

// Boot
document.addEventListener('DOMContentLoaded', init);
