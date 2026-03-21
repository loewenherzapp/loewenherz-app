export default async function handler(req, res) {
  // Nur GET oder POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth-Check
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.CRON_SECRET;
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const ONESIGNAL_APP_ID = '1aeeca68-13c9-400a-a243-dd749527c49f';
  const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

  if (!ONESIGNAL_API_KEY) {
    return res.status(500).json({ error: 'ONESIGNAL_API_KEY not configured' });
  }

  // Aktuellen UTC-Zeitslot berechnen (auf 15 Min gerundet)
  const now = new Date();
  const utcH = now.getUTCHours();
  const utcM = Math.floor(now.getUTCMinutes() / 15) * 15;
  const currentSlot = `${String(utcH).padStart(2, '0')}:${String(utcM).padStart(2, '0')}`;

  const dayOfYear = getDayOfYear();
  const results = [];

  // ============================================================
  // MORGEN-NOTIFICATION
  // ============================================================
  const morningTexts = [
    "Guten Morgen, Löwenherz. Wie willst du heute sein?",
    "Quatschi ist schon wach. Du auch — und du hast einen Plan.",
    "Die Weiche stellt sich nicht von allein.",
    "Bevor der Autopilot übernimmt: Was ist dir heute wichtig?",
    "Gundula ist schon wach. Gib ihr eine Richtung, bevor Quatschi es tut."
  ];

  try {
    const morningResult = await sendNotification({
      appId: ONESIGNAL_APP_ID,
      apiKey: ONESIGNAL_API_KEY,
      filters: [
        { field: 'tag', key: 'morning_utc', relation: '=', value: currentSlot },
        { operator: 'AND' },
        { field: 'tag', key: 'push_enabled', relation: '=', value: 'true' }
      ],
      title: 'Löwenherz',
      body: morningTexts[dayOfYear % morningTexts.length],
      url: 'https://loewenherz-app.vercel.app/?tab=reflexion'
    });
    results.push({ type: 'morning', ...morningResult });
  } catch (e) {
    results.push({ type: 'morning', error: e.message });
  }

  // ============================================================
  // ABEND-NOTIFICATION
  // Offset +2 damit Morgen und Abend nie den gleichen Vibe-Index haben
  // ============================================================
  const eveningTexts = [
    "Der Tag kann warten. Zwei Minuten für dich.",
    "Offene Schleifen? Quatschi nimmt die sonst mit ins Bett.",
    "Kurz innehalten. Nicht grübeln — reflektieren.",
    "Quatschi hatte seinen Auftritt. Jetzt bist du dran.",
    "Was zählt heute aufs Gelassenheitskonto? Auch Kleinigkeiten zählen."
  ];

  try {
    const eveningResult = await sendNotification({
      appId: ONESIGNAL_APP_ID,
      apiKey: ONESIGNAL_API_KEY,
      filters: [
        { field: 'tag', key: 'evening_utc', relation: '=', value: currentSlot },
        { operator: 'AND' },
        { field: 'tag', key: 'push_enabled', relation: '=', value: 'true' }
      ],
      title: 'Löwenherz',
      body: eveningTexts[(dayOfYear + 2) % eveningTexts.length],
      url: 'https://loewenherz-app.vercel.app/?tab=reflexion'
    });
    results.push({ type: 'evening', ...eveningResult });
  } catch (e) {
    results.push({ type: 'evening', error: e.message });
  }

  // ============================================================
  // SMALL-REMINDER
  // Sendet an alle User mit small_enabled=true UND push_enabled=true,
  // ABER nur wenn currentSlot zwischen morning_utc und evening_utc liegt
  // und nicht gleich morning_utc oder evening_utc ist (kein Doppel).
  // ============================================================
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

  try {
    const smallResult = await sendNotification({
      appId: ONESIGNAL_APP_ID,
      apiKey: ONESIGNAL_API_KEY,
      filters: [
        { field: 'tag', key: 'push_enabled', relation: '=', value: 'true' },
        { operator: 'AND' },
        { field: 'tag', key: 'small_enabled', relation: '=', value: 'true' },
        { operator: 'AND' },
        // Nicht senden wenn dieser Slot = morning_utc (Doppel vermeiden)
        { field: 'tag', key: 'morning_utc', relation: '!=', value: currentSlot },
        { operator: 'AND' },
        // Nicht senden wenn dieser Slot = evening_utc (Doppel vermeiden)
        { field: 'tag', key: 'evening_utc', relation: '!=', value: currentSlot },
        { operator: 'AND' },
        // Nur senden wenn currentSlot NACH morning_utc liegt
        { field: 'tag', key: 'morning_utc', relation: '<', value: currentSlot },
        { operator: 'AND' },
        // Nur senden wenn currentSlot VOR evening_utc liegt
        { field: 'tag', key: 'evening_utc', relation: '>', value: currentSlot }
      ],
      title: 'SMALL-Reminder',
      body: smallTexts[(dayOfYear + parseInt(currentSlot.replace(':', ''), 10)) % smallTexts.length],
      url: 'https://loewenherz-app.vercel.app/?tab=heute'
    });
    results.push({ type: 'small', ...smallResult });
  } catch (e) {
    results.push({ type: 'small', error: e.message });
  }

  return res.status(200).json({
    slot: currentSlot,
    timestamp: now.toISOString(),
    calls: results.length,
    results: results
  });
}

// ============================================================
// Hilfsfunktionen
// ============================================================

async function sendNotification({ appId, apiKey, filters, title, body, url }) {
  const response = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${apiKey}`
    },
    body: JSON.stringify({
      app_id: appId,
      filters: filters,
      headings: { en: title },
      contents: { en: body },
      url: url,
      chrome_web_icon: 'https://loewenherz-app.vercel.app/assets/icons/icon-192.png',
      ttl: 900 // 15 Minuten — danach nicht mehr zustellen
    })
  });

  const data = await response.json();

  // OneSignal gibt recipients=0 zurück wenn kein User den Filter matcht
  // Das ist kein Fehler, nur "niemand fällig"
  return {
    sent: true,
    recipients: data.recipients || 0,
    body: body,
    onesignal_id: data.id || null,
    errors: data.errors || null
  };
}

function getDayOfYear() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now - start) / (1000 * 60 * 60 * 24));
}
