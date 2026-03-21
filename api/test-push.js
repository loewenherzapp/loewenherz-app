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
  // Schritt 2: Alle Player abrufen (Legacy API)
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

  const players = playersData?.players || [];

  // ============================================================
  // Schritt 3: Force-Tags setzen (nur 3 Tags — Free Plan!)
  // Nur wenn ?force_tags=true
  // ============================================================
  const forceTagResults = [];

  if (req.query?.force_tags === 'true') {
    const testTags = {
      morning_utc: '05:00',
      evening_utc: '18:30',
      small_enabled: 'true'
    };

    for (const player of players) {
      try {
        const resp = await fetch(
          `https://onesignal.com/api/v1/players/${player.id}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${API_KEY}`
            },
            body: JSON.stringify({
              app_id: APP_ID,
              tags: testTags
            })
          }
        );
        const data = await resp.json();
        forceTagResults.push({
          player_id: player.id,
          device_type: player.device_type,
          status: resp.status,
          result: data
        });
      } catch (e) {
        forceTagResults.push({
          player_id: player.id,
          error: e.message
        });
      }
    }
  }

  // ============================================================
  // Schritt 4: Test-Notification an ALLE (Segment)
  // ============================================================
  let segmentResult = null;
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
        contents: { en: 'Wenn du das siehst, funktioniert die Pipeline!' },
        url: 'https://loewenherz-app.vercel.app/?tab=heute',
        chrome_web_icon: 'https://loewenherz-app.vercel.app/assets/icons/icon-192.png'
      })
    });
    segmentResult = await response.json();
  } catch (e) {
    segmentResult = { error: e.message };
  }

  // ============================================================
  // Schritt 5: Tag-basierte Notification testen (morning_utc exists)
  // ============================================================
  let tagTestResult = null;
  try {
    const tagResp = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${API_KEY}`
      },
      body: JSON.stringify({
        app_id: APP_ID,
        filters: [
          { field: 'tag', key: 'morning_utc', relation: 'exists' }
        ],
        headings: { en: 'Tag-Filter Test' },
        contents: { en: 'Tag-basierte Notification funktioniert!' },
        url: 'https://loewenherz-app.vercel.app/?tab=heute',
        chrome_web_icon: 'https://loewenherz-app.vercel.app/assets/icons/icon-192.png'
      })
    });
    tagTestResult = await tagResp.json();
  } catch (e) {
    tagTestResult = { error: e.message };
  }

  // ============================================================
  // Diagnose-Report
  // ============================================================
  const playerSummary = players.map(p => ({
    id: p.id,
    device_type: p.device_type,
    last_active: p.last_active,
    tags: p.tags,
    notification_types: p.notification_types
  }));

  return res.status(200).json({
    timestamp: new Date().toISOString(),

    api_check: {
      key_valid: !!appData?.name,
      app_name: appData?.name || 'NOT FOUND'
    },

    subscribers: {
      total: playersData?.total_count || 0,
      details: playerSummary
    },

    segment_test: segmentResult,
    tag_filter_test: tagTestResult,

    force_tag_results: forceTagResults.length > 0
      ? forceTagResults
      : 'Add ?force_tags=true to set test tags (3 tags: morning_utc, evening_utc, small_enabled)',

    hints: {
      notification_types: '1=subscribed, -2=unsubscribed',
      device_type: '0=iOS, 1=Android, 5=Chrome, 7=Safari, 17=Safari(macOS)'
    }
  });
}
