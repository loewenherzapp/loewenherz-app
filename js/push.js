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

  console.log('[Push] OneSignal initialized');
  console.log('[Push] OptedIn:', OneSignal.User.PushSubscription.optedIn);
  console.log('[Push] PushSubscription.id:', OneSignal.User.PushSubscription.id);

  // Auf Subscription-Änderung lauschen
  OneSignal.User.PushSubscription.addEventListener('change', function(event) {
    console.log('[Push] Subscription changed:', event.current);
    if (event.current.optedIn) {
      attemptTagSync(0);
    }
  });

  // Tags synchen — mit Polling bis PushSubscription.id bereit
  attemptTagSync(0);
});

// --- Polling: Warte bis PushSubscription.id bereit ist ---

function attemptTagSync(attempt) {
  const MAX_ATTEMPTS = 15;
  const INTERVAL_MS = 2000;

  if (!window.OneSignal || !window.OneSignal.User) {
    if (attempt < MAX_ATTEMPTS) {
      setTimeout(() => attemptTagSync(attempt + 1), INTERVAL_MS);
    }
    return;
  }

  const optedIn = OneSignal.User.PushSubscription.optedIn;
  const subId = OneSignal.User.PushSubscription.id;

  console.log(`[Push] Attempt ${attempt + 1}: optedIn=${optedIn}, subId=${subId}`);

  if (optedIn && subId) {
    syncTagsToOneSignal();
  } else if (attempt < MAX_ATTEMPTS) {
    setTimeout(() => attemptTagSync(attempt + 1), INTERVAL_MS);
  } else {
    console.log('[Push] Max attempts reached.');
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

// --- Tag Sync: 7 Tags ---
// morning_utc, evening_utc, small_1_utc .. small_5_utc
// push_enabled entfällt — wenn Push aus: alle Tags löschen

function buildTags() {
  const pushEnabled = localStorage.getItem('loewenherz_push_enabled') !== 'false';

  // Push deaktiviert → alle Tags löschen (leerer String = Tag wird gelöscht)
  if (!pushEnabled) {
    const tags = { morning_utc: '', evening_utc: '' };
    for (let i = 1; i <= 5; i++) tags[`small_${i}_utc`] = '';
    return tags;
  }

  const morningRaw = localStorage.getItem('loewenherz_morning_time') || '07:00';
  const eveningRaw = localStorage.getItem('loewenherz_evening_time') || '20:30';
  const morning = roundTo15Min(morningRaw);
  const evening = roundTo15Min(eveningRaw);
  const morningUTC = localTimeToUTC(morning);
  const eveningUTC = localTimeToUTC(evening);

  const tags = {
    morning_utc: morningUTC,
    evening_utc: eveningUTC
  };

  // 5 SMALL slots: enabled → UTC time, disabled → '' (delete tag)
  for (let i = 1; i <= 5; i++) {
    const enabled = localStorage.getItem(`loewenherz_small_${i}_enabled`) !== 'false';
    if (enabled) {
      const raw = localStorage.getItem(`loewenherz_small_${i}_time`) || '12:00';
      tags[`small_${i}_utc`] = localTimeToUTC(roundTo15Min(raw));
    } else {
      tags[`small_${i}_utc`] = '';
    }
  }

  return tags;
}

function syncTagsToOneSignal() {
  const tags = buildTags();
  console.log('[Push] Syncing tags:', tags);

  // Client-seitig via SDK
  try {
    if (window.OneSignal && window.OneSignal.User) {
      OneSignal.User.addTags(tags);
      console.log('[Push] Client addTags() called');
    }
  } catch (e) {
    console.warn('[Push] Client addTags() error:', e);
  }

  // Server-Fallback nach 3s (Legacy Players API — funktioniert mit PushSubscription.id)
  setTimeout(() => {
    syncTagsViaServer(tags);
  }, 3000);
}

function syncTagsViaServer(tags) {
  let subscriptionId = null;

  try {
    if (window.OneSignal && window.OneSignal.User && window.OneSignal.User.PushSubscription) {
      subscriptionId = OneSignal.User.PushSubscription.id;
    }
  } catch (e) {
    console.warn('[Push] Error reading PushSubscription.id:', e);
  }

  if (!subscriptionId) {
    console.log('[Push] No PushSubscription.id — skipping server sync');
    return;
  }

  console.log('[Push] Server sync for:', subscriptionId);

  fetch('/api/set-tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_id: subscriptionId, tags: tags })
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
    // Initialize 5 SMALL slots (3 on, 2 off) if not yet set
    const defaultSlots = [
      { id: 1, time: '09:30', enabled: true },
      { id: 2, time: '12:30', enabled: true },
      { id: 3, time: '15:30', enabled: true },
      { id: 4, time: '11:00', enabled: false },
      { id: 5, time: '17:00', enabled: false }
    ];
    for (const s of defaultSlots) {
      if (!localStorage.getItem(`loewenherz_small_${s.id}_time`)) {
        localStorage.setItem(`loewenherz_small_${s.id}_time`, s.time);
        localStorage.setItem(`loewenherz_small_${s.id}_enabled`, String(s.enabled));
      }
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
