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

  // Tags bei jedem App-Start synchen (nach erfolgreicher Init)
  syncOneSignalTags();

  // Debug: Subscription-Status loggen
  console.log('[Löwenherz Push] OneSignal initialized');
  console.log('[Löwenherz Push] Permission:', Notification.permission);
  console.log('[Löwenherz Push] OptedIn:', OneSignal.User.PushSubscription.optedIn);
  console.log('[Löwenherz Push] SubscriptionId:', OneSignal.User.PushSubscription.id);
});

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

// --- OneSignal Tag Sync (UTC-based, 4 tags only) ---

export function syncOneSignalTags() {
  const morningRaw = localStorage.getItem('loewenherz_morning_time') || '07:00';
  const eveningRaw = localStorage.getItem('loewenherz_evening_time') || '20:30';

  // Runden auf 15 Min
  const morning = roundTo15Min(morningRaw);
  const evening = roundTo15Min(eveningRaw);

  // UTC konvertieren
  const morningUTC = localTimeToUTC(morning);
  const eveningUTC = localTimeToUTC(evening);

  const smallEnabled = localStorage.getItem('loewenherz_small_reminders') !== 'false';
  const pushEnabled = localStorage.getItem('loewenherz_push_enabled') === 'true';

  // NUR diese 4 Tags — via Deferred-Queue für sichere Zustellung
  const tags = {
    morning_utc: morningUTC,
    evening_utc: eveningUTC,
    small_enabled: smallEnabled ? 'true' : 'false',
    push_enabled: pushEnabled ? 'true' : 'false'
  };

  console.log('[Löwenherz Push] Syncing tags:', tags);

  if (window.OneSignal && window.OneSignal.User) {
    OneSignal.User.addTags(tags);
  } else {
    // Fallback: über Deferred-Queue setzen falls OneSignal noch nicht ready
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function(OneSignal) {
      OneSignal.User.addTags(tags);
    });
  }
}

// --- Soft-Ask Overlay ---

export function showPushSoftAsk() {
  // Guard conditions
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

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => overlay.classList.add('active'));
  });

  // "Ja, gern →"
  document.getElementById('push-accept').addEventListener('click', () => {
    localStorage.setItem('loewenherz_push_asked', 'true');
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 300);

    // Set defaults
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

    // Trigger OneSignal permission
    if (window.OneSignal && OneSignal.Slidedown) {
      OneSignal.Slidedown.promptPush();
    } else if (typeof Notification !== 'undefined') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          localStorage.setItem('loewenherz_push_enabled', 'true');
          syncOneSignalTags();
        }
      });
    }
  });

  // "Später"
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
