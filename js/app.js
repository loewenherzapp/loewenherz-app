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

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

async function init() {
  await initDB();
  initBottomSheet();
  initCrisisModal();

  const tabTexts = TEXTS.ui.tabs;
  document.getElementById('tab-label-today').textContent = tabTexts.today;
  document.getElementById('tab-label-reflection').textContent = tabTexts.reflection;
  document.getElementById('tab-label-history').textContent = tabTexts.history;

  document.getElementById('crisis-btn').addEventListener('click', openCrisis);
  document.getElementById('settings-btn').addEventListener('click', showSettings);

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  profile = await getProfile();

  if (!profile || !profile.onboardingComplete) {
    if (!isStandalone()) { showLanding(); } else { showOnboarding(); }
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
  skipEl.textContent = 'Trotzdem fortfahren →';
  skipEl.style.marginTop = '32px';
  skipEl.addEventListener('click', () => showOnboarding());
  setTimeout(() => {
    const landingScreen = container.querySelector('.landing-screen');
    if (landingScreen) landingScreen.appendChild(skipEl);
  }, 500);
}

function showOnboarding() {
  hideAll();
  const container = document.getElementById('onboarding-container');
  container.classList.remove('hidden');
  renderOnboarding(container, (savedProfile) => { profile = savedProfile; showApp(); });
}

function showApp() {
  hideAll();
  document.getElementById('app-shell').classList.remove('hidden');
  switchTab('today');
}

async function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  profile = await getProfile();
  const contentEl = document.getElementById('main-content');
  if (tab === 'today') { await renderDashboard(contentEl, profile); }
  else if (tab === 'reflection') { await renderReflection(contentEl, profile); }
  else if (tab === 'history') { await renderHistory(contentEl, profile); }
}

async function showSettings() {
  hideAll();
  const container = document.getElementById('settings-container');
  container.classList.remove('hidden');
  profile = await getProfile();
  await renderSettings(container, profile, () => showApp(), () => window.location.reload());
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = new URL('sw.js', window.location.href.replace(/\/[^/]*$/, '/'));
    navigator.serviceWorker.register(swUrl.href).catch(() => {});
  });
}

document.addEventListener('DOMContentLoaded', init);
