// ============================================================
// Löwenherz PWA — Push Notifications (Server-Side Scheduling)
// ============================================================

// --- OneSignal Initialization ---

window.OneSignalDeferred = window.OneSignalDeferred || [];
OneSignalDeferred.push(async function(OneSignal) {
  await OneSignal.init({
    appId: "1aeeca68-13c9-400a-a243-dd749527c49f",
    serviceWorkerParam: { scope: "/" },
    serviceWorkerPath: "OneSignalSDKWorker.js",
    notifyButton: { enable: false },
    welcomeNotification: { disable: true }
  });

  // Debug: Subscription-Status loggen
  console.log('[Push] OneSignal initialized');
  console.log('[Push] Permission:', Notification.permission);
  console.log('[Push] OptedIn:', OneSignal.User.PushSubscription.optedIn);
  console.log('[Push] PushSubscription.id:', OneSignal.User.PushSubscription.id);
  console.log('[Push] User.onesignalId:', OneSignal.User.onesignalId);

  // Auf Subscription-Änderung lauschen (z.B. User opted gerade ein)
  OneSignal.User.PushSubscription.addEventListener('change', function(event) {
    console.log('[Push] Subscription changed:', event.current);
    if (event.current.optedIn) {
      attemptTagSync(0);
    }
  });

  // Tags synchen — mit Polling falls IDs noch nicht ready
  attemptTagSync(0);
});

// --- Polling: Warte bis Subscription + onesignalId bereit sind ---

function attemptTagSync(attempt) {
  const MAX_ATTEMPTS = 15;
  const INTERVAL_MS = 2000;

  if (!window.OneSignal || !window.OneSignal.User) {
    if (attempt < MAX_ATTEMPTS) {
      console.log(`[Push] OneSignal.User not ready, retry ${attempt + 1}/${MAX_ATTEMPTS}...`);
      setTimeout(() => attemptTagSync(attempt + 1), INTERVAL_MS);
    }
    return;
  }

  const optedIn = OneSignal.User.PushSubscription.optedIn;
  const onesignalId = OneSignal.User.onesignalId;
  const subId = OneSignal.User.PushSubscription.id;

  console.log(`[Push] Attempt ${attempt + 1}: optedIn=${optedIn}, onesignalId=${onesignalId}, subId=${subId}`);

  if (optedIn && onesignalId) {
    // User ist subscribed und hat eine onesignalId → Tags synchen
    syncTagsToOneSignal();
  } else if (attempt < MAX_ATTEMPTS) {
    setTimeout(() => attemptTagSync(attempt + 1), INTERVAL_MS);
  } else {
    console.log('[Push] Max attempts reached. optedIn:', optedIn, 'onesignalId:', onesignalId);
    // Letzter Versuch: trotzdem Client-seitig addTags aufrufen
    if (optedIn) {
      console.log('[Push] Trying addTags anyway (no onesignalId)...');
      const tags = buildTags();
      try { OneSignal.User.addTags(tags); } catch (e) { /* ignore */ }
    }
  }
}

// --- Time Helpers ---

export function roundTo15Min(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const rounded = Math.round(m / 15) * 15;
  const finalM = rounded === 60 ? 0 : rounded;
  const finalH = rounded === 60 ? (h + 1) % 24 : h;
  return `${String(finalH).padStart(2, '0')}:${String(finalM).padStart(2, '0')}`;
}

export function localTimeToUTC(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const now = new Date();
  now.setHours(h, m, 0, 0);
  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();
  return `${String(utcH).padStart(2, '0')}:${String(utcM).padStart(2, '0')}`;
}

// --- Tag Sync: Dual-Strategie (Client + Server) ---

function buildTags() {
  const morningRaw = localStorage.getItem('loewenherz_morning_time') || '07:00';
  const eveningRaw = localStorage.getItem('loewenherz_evening_time') || '20:30';
  const morning = roundTo15Min(morningRaw);
  const evening = roundTo15Min(eveningRaw);
  const morningUTC = localTimeToUTC(morning);
  const eveningUTC = localTimeToUTC(evening);
  const smallEnabled = localStorage.getItem('loewenherz_small_reminders') !== 'false';
  const pushEnabled = localStorage.getItem('loewenherz_push_enabled') === 'true';

  return {
    morning_utc: morningUTC,
    evening_utc: eveningUTC,
    small_enabled: smallEnabled ? 'true' : 'false',
    push_enabled: pushEnabled ? 'true' : 'false'
  };
}

function syncTagsToOneSignal() {
  const tags = buildTags();
  console.log('[Push] Syncing tags:', tags);

  // Ansatz A: Client-seitig via SDK
  try {
    if (window.OneSignal && window.OneSignal.User) {
      OneSignal.User.addTags(tags);
      console.log('[Push] Client addTags() called');
    }
  } catch (e) {
    console.warn('[Push] Client addTags() error:', e);
  }

  // Ansatz B: Server-seitig via REST API (nach 3s als Absicherung)
  setTimeout(() => {
    syncTagsViaServer(tags);
  }, 3000);
}

function syncTagsViaServer(tags) {
  // onesignalId ist die korrekte ID für die neue User API
  let onesignalId = null;

  try {
    if (window.OneSignal && window.OneSignal.User) {
      onesignalId = OneSignal.User.onesignalId;
    }
  } catch (e) {
    console.warn('[Push] Error reading onesignalId:', e);
  }

  if (!onesignalId) {
    console.log('[Push] No onesignalId — skipping server sync');
    return;
  }

  console.log('[Push] Server sync for onesignalId:', onesignalId);

  fetch('/api/set-tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ onesignal_id: onesignalId, tags: tags })
  })
    .then(r => r.json())
    .then(data => {
      console.log('[Push] Server sync result:', data);
    })
    .catch(err => {
      console.warn('[Push] Server sync failed:', err);
    });
}

// --- Exportierte Sync-Funktion (für Settings-Screen) ---

export function syncOneSignalTags() {
  syncTagsToOneSignal();
}

// --- Soft-Ask Overlay ---

export function showPushSoftAsk() {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'default') return;
  if (localStorage.getItem('loewenherz_push_asked')) return;

  const overlay = document.createElement('div');
  overlay.className = 'push-soft-ask-overlay';
  overlay.innerHTML = `
    <div class="push-soft-ask-content">
      <div class="push-soft-ask-icon">🔔</div>
      <h2 class="push-soft-ask-title">Soll ich dich erinnern?</h2>
      <p class="push-soft-ask-text">
        Morgens an deine Intention.<br>
        Abends an deine Reflexion.<br>
        Und zwischendurch an einen SMALL-Moment.
      </p>
      <button class="btn-primary push-soft-ask-accept" id="push-accept">Ja, gern →</button>
      <button class="push-soft-ask-later" id="push-later">Später</button>
    </div>
  `;

  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => overlay.classList.add('active'));
  });

  document.getElementById('push-accept').addEventListener('click', () => {
    localStorage.setItem('loewenherz_push_asked', 'true');
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 300);

    if (!localStorage.getItem('loewenherz_push_enabled')) {
      localStorage.setItem('loewenherz_push_enabled', 'true');
    }
    if (!localStorage.getItem('loewenherz_morning_time')) {
      localStorage.setItem('loewenherz_morning_time', '07:00');
    }
    if (!localStorage.getItem('loewenherz_evening_time')) {
      localStorage.setItem('loewenherz_evening_time', '20:30');
    }
    if (!localStorage.getItem('loewenherz_small_reminders')) {
      localStorage.setItem('loewenherz_small_reminders', 'true');
    }

    if (window.OneSignal && OneSignal.Slidedown) {
      OneSignal.Slidedown.promptPush();
    } else if (typeof Notification !== 'undefined') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          localStorage.setItem('loewenherz_push_enabled', 'true');
          attemptTagSync(0);
        }
      });
    }
  });

  document.getElementById('push-later').addEventListener('click', () => {
    localStorage.setItem('loewenherz_push_asked', 'true');
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 300);
  });
}

// --- Check Soft-Ask after Reflexion ---

export function checkSoftAskAfterReflexion() {
  setTimeout(() => {
    if (
      typeof Notification !== 'undefined' &&
      Notification.permission === 'default' &&
      !localStorage.getItem('loewenherz_push_asked')
    ) {
      showPushSoftAsk();
    }
  }, 1500);
}
