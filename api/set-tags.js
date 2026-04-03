export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { player_id, tags } = req.body;
  if (!player_id || !tags) {
    return res.status(400).json({ error: 'Missing player_id or tags' });
  }

  const API_KEY = process.env.ONESIGNAL_API_KEY;
  const APP_ID = '1aeeca68-13c9-400a-a243-dd749527c49f';

  if (!API_KEY) {
    return res.status(500).json({ error: 'ONESIGNAL_API_KEY not configured' });
  }

  // Erlaubte Tags: morning, evening + 5 SMALL slots
  const allowedKeys = ['morning_utc', 'evening_utc', 'small_1_utc', 'small_2_utc', 'small_3_utc', 'small_4_utc', 'small_5_utc'];
  const safeTags = {};
  for (const key of allowedKeys) {
    if (tags[key] !== undefined) {
      safeTags[key] = String(tags[key]);
    }
  }

  // Legacy Players API — PUT /api/v1/players/{player_id}
  // player_id = PushSubscription.id aus dem SDK
  try {
    const response = await fetch(
      `https://onesignal.com/api/v1/players/${player_id}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${API_KEY}`
        },
        body: JSON.stringify({
          app_id: APP_ID,
          tags: safeTags
        })
      }
    );

    const data = await response.json();
    console.log(`[set-tags] ${player_id}:`, safeTags, '→', data);

    return res.status(200).json({
      success: data.success === true || data.success === 'true',
      tags_set: safeTags,
      onesignal_response: data
    });
  } catch (e) {
    console.error('[set-tags] Error:', e);
    return res.status(500).json({ error: e.message });
  }
}
