export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { onesignal_id, tags } = req.body;
  if (!onesignal_id || !tags) {
    return res.status(400).json({ error: 'Missing onesignal_id or tags' });
  }

  const API_KEY = process.env.ONESIGNAL_API_KEY;
  const APP_ID = '1aeeca68-13c9-400a-a243-dd749527c49f';

  if (!API_KEY) {
    return res.status(500).json({ error: 'ONESIGNAL_API_KEY not configured' });
  }

  // Nur erlaubte Tags durchlassen
  const allowedKeys = ['morning_utc', 'evening_utc', 'small_enabled', 'push_enabled'];
  const safeTags = {};
  for (const key of allowedKeys) {
    if (tags[key] !== undefined) {
      safeTags[key] = String(tags[key]);
    }
  }

  // --- Neue OneSignal User API (nicht Legacy /players/) ---
  // PATCH /apps/{app_id}/users/by/onesignal_id/{onesignal_id}
  const url = `https://api.onesignal.com/apps/${APP_ID}/users/by/onesignal_id/${onesignal_id}`;

  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${API_KEY}`
      },
      body: JSON.stringify({
        properties: {
          tags: safeTags
        }
      })
    });

    const data = await response.json();
    console.log(`[set-tags] ${onesignal_id}:`, safeTags, '→', response.status, data);

    if (!response.ok) {
      return res.status(200).json({
        success: false,
        http_status: response.status,
        tags_attempted: safeTags,
        onesignal_error: data
      });
    }

    return res.status(200).json({
      success: true,
      tags_set: safeTags,
      onesignal_response: data
    });
  } catch (e) {
    console.error('[set-tags] Error:', e);
    return res.status(500).json({ error: e.message });
  }
}
