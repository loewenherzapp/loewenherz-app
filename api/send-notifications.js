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
  // Filter: morning_utc = currentSlot
  // (push_enabled entfällt — wer Tags hat, will Push.
  //  Wer Push deaktiviert, bekommt leere Tags → matcht nicht.)
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
        { field: 'tag', key: 'morning_utc', relation: '=', value: currentSlot }
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
        { field: 'tag', key: 'evening_utc', relation: '=', value: currentSlot }
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
  // SMALL-REMINDER (10 individual slots)
  // Each user has up to 10 tags: small_1_utc .. small_10_utc
  // Send to anyone whose ANY slot matches currentSlot
  //
  // Die Zeiten sind clientseitig gewürfelt (js/small-schedule.js) und
  // wechseln täglich. Für den Server ändert das nichts — er filtert
  // weiterhin nur auf exakte Tag-Werte und kennt keine Nutzer.
  // ============================================================
  const smallTexts = [
    "Kurzer Check: Schultern unten? Atem fließt?",
    "Quatschi-Alarm? Einen Schritt zurücktreten.",
    "Autopilot oder bewusst? Kurzer Check, ehrliche Antwort.",
    "Gerade am Grübeln? Laufband oder Joggen — du hast die Wahl.",
    "Schultern auf Ohrhöhe? Dachte ich mir. Runter damit.",
    "Quatschi redet seit Minuten. Wusstest du das?",
    "SMALL-Check. Welcher Buchstabe ist gerade dran?",
    "Aufmerksamkeit ist Dünger. Worauf richtest du sie?",
    "Schultern, Kiefer, Cocktail — kurzer Scan?",
    "Schultern runter. Atmen. Weiter.",
    "Schultern an den Ohren? Zwei Zentimeter runter.",
    "Dein Cocktail könnte einen Check vertragen.",
    "Quatschi sendet live. Du musst nicht zuhören.",
    "Quatschi empfiehlt absagen. Musst du nicht.",
    "Stopp. Drei Sekunden. Was ist gerade los?",
    "Kurz rauszoomen. Was siehst du?",
    "Dein Autopilot hat gerade die Fernbedienung.",
    "Film oder Kino? Kurzer Check.",
    "Gundula macht Gundula-Sachen. Alles normal.",
    "Wann hast du zuletzt was getrunken?",
    "Radio Bullshit sendet wieder. Regler ist bei dir.",
    "Radio Bullshit: heute nur Wiederholungen.",
    "Gundula meldet Feueralarm. Ist nur der Toast.",
    "Gundula ist heute anstrengend. Sie meint es gut.",
    "Schluck Wasser. Zählt schon.",
    "Kurze Pause ist auch ein SMALL-Punkt.",
    "Etwas gegessen, getrunken, bewegt? Eins reicht.",
    "Frische Luft abgekriegt heute? Gundula mag das.",
    "Wie redest du gerade mit dir? Nur mal gefragt.",
    "Innerer Ton gerade okay? Nur eine Frage.",
    "Nein ist ein vollständiger Satz.",
    "Ein bisschen Freundlichkeit. Für dich, meine ich.",
    "Vermeiden fühlt sich gut an. Kurz. Dann nicht mehr.",
    "Der Weltuntergang fand übrigens nicht statt.",
    "Mood follows Action. Nur als Erinnerung.",
    "Was würdest du tun, wenn Gundula grad Pause hätte?",
    "Was ist das Gefühl gerade? Ein Wort reicht.",
    "Gefühle sind Daten, keine Anweisungen.",
    "Quatschis Trefferquote bisher: überschaubar.",
    "Kiefer locker? Stirn auch?",
    "Magst du kurz bei Gundula vorbeischauen?",
    "Gundula wartet. Ganz entspannt, aber sie wartet.",
    "Kurzbesuch bei Gundula? Sie beißt nicht.",
    "Ein SMALL-Punkt aufs Konto? Kleiner Einsatz reicht.",
    "Kleine Einzahlung aufs Gelassenheitskonto?",
    "Ein Punkt aufs Konto? Alles über null zählt."
  ];

  try {
    // OR-combined: match if ANY of the 10 slots equals currentSlot
    const smallFilters = [];
    for (let i = 1; i <= 10; i++) {
      if (i > 1) smallFilters.push({ operator: 'OR' });
      smallFilters.push({ field: 'tag', key: `small_${i}_utc`, relation: '=', value: currentSlot });
    }

    const smallResult = await sendNotification({
      appId: ONESIGNAL_APP_ID,
      apiKey: ONESIGNAL_API_KEY,
      filters: smallFilters,
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
      // web_url statt url: `url` gilt für ALLE Plattformen und wäre auf iOS
      // die Launch-URL — der Tap würde die Website öffnen statt der App.
      // web_url zielt nur auf Web-Push; iOS-Taps öffnen damit die App (V1:
      // kein Deep-Link, kein Routing). Web-Verhalten unverändert.
      web_url: url,
      chrome_web_icon: 'https://loewenherz-app.vercel.app/assets/icons/icon-192.png',
      ttl: 900 // 15 Minuten — danach nicht mehr zustellen
    })
  });

  const data = await response.json();

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
