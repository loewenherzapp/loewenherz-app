// ============================================================
// Löwenherz PWA — Push Notifications & Reminder Engine
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
});

// --- Notification Texts ---

const morningTexts = [
  "Guten Morgen, Löwenherz. Wie willst du heute sein?",
  "Quatschi ist schon wach. Du auch — und du hast einen Plan.",
  "Die Weiche stellt sich nicht von allein.",
  "Bevor der Autopilot übernimmt: Was ist dir heute wichtig?",
  "Gundula ist schon wach. Gib ihr eine Richtung, bevor Quatschi es tut."
];

const eveningTexts = [
  "Der Tag kann warten. Zwei Minuten für dich.",
  "Offene Schleifen? Quatschi nimmt die sonst mit ins Bett.",
  "Kurz innehalten. Nicht grübeln — reflektieren.",
  "Quatschi hatte seinen Auftritt. Jetzt bist du dran.",
  "Was zählt heute aufs Gelassenheitskonto? Auch Kleinigkeiten zählen."
];

const smallTexts = [
  "Kurzer Check: Schultern unten? Atem fließt?",
  "Quatschi-Alarm? Einen Schritt zurücktreten.",
  "Autopilot oder bewusst? Kurzer Check, ehrliche Antwort.",
  "Gerade am Grübeln? Laufband oder Joggen — du hast die Wahl.",
  "Schultern auf Ohrhöhe? Dachte ich mir. Runter damit.",
  "Quatschi redet seit Minuten. Wusstest du das?",
  "SMALL-Check. Welcher Buchstabe ist gerade dran?",
  "Aufmerksamkeit ist Dünger. Worauf richtest du sie?"
];

// --- Text Rotation ---

function getNextText(textsArray, indexKey) {
  let index = parseInt(localStorage.getItem(indexKey) || '0');
  const text = textsArray[index % textsArray.length];
  localStorage.setItem(indexKey, String((index + 1) % textsArray.length));
  return text;
}

// --- Reminder Engine ---

let scheduledTimeoutIds = [];

function clearAllScheduledReminders() {
  scheduledTimeoutIds.forEach(id => clearTimeout(id));
  scheduledTimeoutIds = [];
}

function parseTime(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function scheduleIfFuture(targetTime, callback) {
  const now = new Date();
  const delay = targetTime.getTime() - now.getTime();
  if (delay > 0) {
    const id = setTimeout(callback, delay);
    scheduledTimeoutIds.push(id);
  }
}

function calculateSmallTimes(start, end, count) {
  const startMs = start.getTime();
  const endMs = end.getTime();

  // Mindestabstand zum Abend-Reminder: 20 Minuten
  const safeEndMs = endMs - 20 * 60 * 1000;
  if (safeEndMs <= startMs) return [];

  const interval = (safeEndMs - startMs) / (count + 1);
  const times = [];

  for (let i = 1; i <= count; i++) {
    const t = new Date(startMs + interval * i);
    const h = t.getHours();
    // Keine Zeiten zwischen 23:00–05:00
    if (h >= 5 && h < 23) {
      times.push(t);
    }
  }

  return times;
}

function showNotification(title, body, deepLink) {
  if (Notification.permission !== 'granted') return;

  // Keine Notification wenn App im Vordergrund
  if (document.visibilityState === 'visible') return;

  const notification = new Notification(title, {
    body: body,
    icon: '/assets/icons/icon-192.png',
    badge: '/assets/icons/icon-192.png',
    tag: 'loewenherz-' + Date.now(),
  });

  notification.onclick = function () {
    window.focus();
    window.location.href = deepLink;
    notification.close();
  };
}

export function scheduleReminders() {
  clearAllScheduledReminders();

  // Prüfen ob Push aktiv
  if (localStorage.getItem('loewenherz_push_enabled') !== 'true') return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  // Morgen-Reminder
  const morningTime = parseTime(localStorage.getItem('loewenherz_morning_time') || '07:00');
  scheduleIfFuture(morningTime, () => {
    showNotification(
      'Löwenherz',
      getNextText(morningTexts, 'loewenherz_morning_text_index'),
      'https://loewenherz-app.vercel.app/?tab=reflexion'
    );
  });

  // Abend-Reminder
  const eveningTime = parseTime(localStorage.getItem('loewenherz_evening_time') || '20:30');
  scheduleIfFuture(eveningTime, () => {
    showNotification(
      'Löwenherz',
      getNextText(eveningTexts, 'loewenherz_evening_text_index'),
      'https://loewenherz-app.vercel.app/?tab=reflexion'
    );
  });

  // SMALL-Reminder (8 Stück zwischen Morgen und Abend)
  if (localStorage.getItem('loewenherz_small_reminders') !== 'false') {
    const smallTimes = calculateSmallTimes(morningTime, eveningTime, 8);
    smallTimes.forEach(time => {
      scheduleIfFuture(time, () => {
        showNotification(
          'SMALL-Reminder',
          getNextText(smallTexts, 'loewenherz_small_text_index'),
          'https://loewenherz-app.vercel.app/?tab=heute'
        );
      });
    });
  }
}

// --- Visibility Change: reschedule when tab regains focus ---

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    scheduleReminders();
  }
});

// --- OneSignal Tag Sync ---

export function syncOneSignalTags() {
  if (window.OneSignal) {
    OneSignal.User.addTags({
      morning_time: localStorage.getItem('loewenherz_morning_time') || '07:00',
      evening_time: localStorage.getItem('loewenherz_evening_time') || '20:30',
      small_reminders: localStorage.getItem('loewenherz_small_reminders') || 'true',
      push_enabled: localStorage.getItem('loewenherz_push_enabled') || 'false'
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
          scheduleReminders();
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
