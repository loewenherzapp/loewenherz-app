export default async function handler(req, res) {
  // Auth-Check
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.CRON_SECRET;
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const API_KEY = process.env.ONESIGNAL_API_KEY;
  const APP_ID = '1aeeca68-13c9-400a-a243-dd749527c49f';

  if (!API_KEY) {
    return res.status(500).json({ error: 'ONESIGNAL_API_KEY not configured' });
  }

  // ============================================================
  // Schritt 1: API Key validieren
  // ============================================================
  let appData = null;
  try {
    const appCheck = await fetch(`https://onesignal.com/api/v1/apps/${APP_ID}`, {
      headers: { 'Authorization': `Basic ${API_KEY}` }
    });
    appData = await appCheck.json();
  } catch (e) {
    appData = { error: e.message };
  }

  // ============================================================
  // Schritt 2: Alle Player/Subscriptions abrufen (Diagnose)
  // ============================================================
  let playersData = null;
  try {
    const playersCheck = await fetch(
      `https://onesignal.com/api/v1/players?app_id=${APP_ID}&limit=10`,
      { headers: { 'Authorization': `Basic ${API_KEY}` } }
    );
    playersData = await playersCheck.json();
  } catch (e) {
    playersData = { error: e.message };
  }

  // ============================================================
  // Schritt 3: Test-Notification an ALLE senden (Total Subscriptions)
  // ============================================================
  let notificationResult = null;
  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${API_KEY}`
      },
      body: JSON.stringify({
        app_id: APP_ID,
        included_segments: ['Total Subscriptions'],
        headings: { en: 'Löwenherz Test' },
        contents: { en: 'Wenn du das siehst, funktioniert die Pipeline! 🦁' },
        url: 'https://loewenherz-app.vercel.app/?tab=heute',
        chrome_web_icon: 'https://loewenherz-app.vercel.app/assets/icons/icon-192.png'
      })
    });
    notificationResult = await response.json();
  } catch (e) {
    notificationResult = { error: e.message };
  }

  // ============================================================
  // Schritt 4: Fallback — "Subscribed Users" Segment versuchen
  // ============================================================
  let fallbackResult = null;
  if (notificationResult && notificationResult.errors) {
    try {
      const response2 = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${API_KEY}`
        },
        body: JSON.stringify({
          app_id: APP_ID,
          included_segments: ['Subscribed Users'],
          headings: { en: 'Löwenherz Test' },
          contents: { en: 'Wenn du das siehst, funktioniert die Pipeline! 🦁' },
          url: 'https://loewenherz-app.vercel.app/?tab=heute',
          chrome_web_icon: 'https://loewenherz-app.vercel.app/assets/icons/icon-192.png'
        })
      });
      fallbackResult = await response2.json();
    } catch (e) {
      fallbackResult = { error: e.message };
    }
  }

  // ============================================================
  // Schritt 5: Auch Tag-basierte Notification testen (wie die echte Route)
  // ============================================================
  let tagTestResult = null;
  try {
    const now = new Date();
    const utcH = now.getUTCHours();
    const utcM = Math.floor(now.getUTCMinutes() / 15) * 15;
    const currentSlot = `${String(utcH).padStart(2, '0')}:${String(utcM).padStart(2, '0')}`;

    const tagResponse = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${API_KEY}`
      },
      body: JSON.stringify({
        app_id: APP_ID,
        filters: [
          { field: 'tag', key: 'push_enabled', relation: '=', value: 'true' }
        ],
        headings: { en: 'Löwenherz Tag-Test' },
        contents: { en: `Tag-Filter Test (Slot: ${currentSlot})` },
        url: 'https://loewenherz-app.vercel.app/?tab=heute',
        chrome_web_icon: 'https://loewenherz-app.vercel.app/assets/icons/icon-192.png'
      })
    });
    tagTestResult = await tagResponse.json();
  } catch (e) {
    tagTestResult = { error: e.message };
  }

  // ============================================================
  // Diagnose-Report
  // ============================================================
  const players = playersData?.players || [];
  const playerSummary = players.map(p => ({
    id: p.id,
    device_type: p.device_type, // 5=Chrome, 0=iOS, 1=Android
    created_at: p.created_at,
    last_active: p.last_active,
    invalid_identifier: p.invalid_identifier,
    tags: p.tags,
    notification_types: p.notification_types // -2=unsubscribed, 1=subscribed
  }));

  return res.status(200).json({
    timestamp: new Date().toISOString(),

    api_check: {
      key_valid: !!appData?.name,
      app_name: appData?.name || 'NOT FOUND',
      errors: appData?.errors || null
    },

    subscribers: {
      total: playersData?.total_count || 0,
      details: playerSummary
    },

    segment_test: {
      total_subscriptions: notificationResult,
      subscribed_users_fallback: fallbackResult
    },

    tag_filter_test: tagTestResult,

    hint: 'notification_types: 1=subscribed, -2=unsubscribed. device_type: 0=iOS, 1=Android, 5=Chrome, 7=Safari'
  });
}
