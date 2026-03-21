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
  // Schritt 2: Alle User abrufen via neue User API (Diagnose)
  // Fallback: Legacy Players API für Subscriber-Liste
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
  // Schritt 3: Für jeden Player die User-Details via neue API holen
  // (zeigt Tags wie sie auf dem Server sind)
  // ============================================================
  const players = playersData?.players || [];
  const userDetails = [];

  for (const player of players) {
    // Versuche User-Details via onesignal_id (= player.id in Legacy API)
    try {
      const userResp = await fetch(
        `https://api.onesignal.com/apps/${APP_ID}/users/by/onesignal_id/${player.id}`,
        { headers: { 'Authorization': `Basic ${API_KEY}` } }
      );
      const userData = await userResp.json();
      userDetails.push({
        player_id: player.id,
        device_type: player.device_type,
        notification_types: player.notification_types,
        last_active: player.last_active,
        legacy_tags: player.tags,
        user_api_tags: userData?.properties?.tags || 'NOT FOUND',
        user_api_status: userResp.status,
        subscriptions: (userData?.subscriptions || []).map(s => ({
          id: s.id,
          type: s.type,
          enabled: s.enabled,
          notification_types: s.notification_types
        }))
      });
    } catch (e) {
      userDetails.push({
        player_id: player.id,
        device_type: player.device_type,
        error: e.message
      });
    }
  }

  // ============================================================
  // Schritt 4: Test-Notification an ALLE senden (Segment)
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

  // Fallback Segment
  let fallbackResult = null;
  if (segmentResult?.errors) {
    try {
      const resp2 = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${API_KEY}`
        },
        body: JSON.stringify({
          app_id: APP_ID,
          included_segments: ['Subscribed Users'],
          headings: { en: 'Löwenherz Test' },
          contents: { en: 'Wenn du das siehst, funktioniert die Pipeline!' },
          url: 'https://loewenherz-app.vercel.app/?tab=heute',
          chrome_web_icon: 'https://loewenherz-app.vercel.app/assets/icons/icon-192.png'
        })
      });
      fallbackResult = await resp2.json();
    } catch (e) {
      fallbackResult = { error: e.message };
    }
  }

  // ============================================================
  // Schritt 5: Tag-basierte Notification testen (push_enabled=true)
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
          { field: 'tag', key: 'push_enabled', relation: '=', value: 'true' }
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
  // Schritt 6: Force-Tags via NEUE User API setzen
  // Nur wenn ?force_tags=true
  // ============================================================
  const forceTagResults = [];

  if (req.query?.force_tags === 'true') {
    for (const detail of userDetails) {
      const playerId = detail.player_id;
      if (!playerId) continue;

      const testTags = {
        morning_utc: '05:00',
        evening_utc: '18:30',
        small_enabled: 'true',
        push_enabled: 'true'
      };

      // Methode 1: Neue User API (PATCH)
      let newApiResult = null;
      try {
        const resp = await fetch(
          `https://api.onesignal.com/apps/${APP_ID}/users/by/onesignal_id/${playerId}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${API_KEY}`
            },
            body: JSON.stringify({
              properties: { tags: testTags }
            })
          }
        );
        newApiResult = { status: resp.status, body: await resp.json() };
      } catch (e) {
        newApiResult = { error: e.message };
      }

      // Methode 2: Legacy Players API (PUT) als Backup
      let legacyResult = null;
      try {
        const resp2 = await fetch(
          `https://onesignal.com/api/v1/players/${playerId}`,
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
        legacyResult = { status: resp2.status, body: await resp2.json() };
      } catch (e) {
        legacyResult = { error: e.message };
      }

      forceTagResults.push({
        player_id: playerId,
        device_type: detail.device_type,
        new_api_result: newApiResult,
        legacy_api_result: legacyResult
      });
    }
  }

  // ============================================================
  // Diagnose-Report
  // ============================================================
  return res.status(200).json({
    timestamp: new Date().toISOString(),

    api_check: {
      key_valid: !!appData?.name,
      app_name: appData?.name || 'NOT FOUND',
      errors: appData?.errors || null
    },

    subscribers: {
      total: playersData?.total_count || 0,
      details: userDetails
    },

    segment_test: {
      total_subscriptions: segmentResult,
      subscribed_users_fallback: fallbackResult
    },

    tag_filter_test: tagTestResult,

    force_tag_results: forceTagResults.length > 0
      ? forceTagResults
      : 'Add ?force_tags=true to set test tags on all subscribers (via BOTH new + legacy API)',

    hints: {
      notification_types: '1=subscribed, -2=unsubscribed',
      device_type: '0=iOS, 1=Android, 5=Chrome, 7=Safari',
      next_step: 'If force_tags shows success, wait 30s then call this endpoint again WITHOUT force_tags to verify tags are set'
    }
  });
}
