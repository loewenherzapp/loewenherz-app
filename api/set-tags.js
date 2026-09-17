// ============================================================
// Löwenherz — Server-Fallback für den Tag-Sync (nur Web)
// ============================================================
// POST /api/set-tags  { player_id, tags: { sched } }
//
// Erlaubt ist genau EIN Tag: `sched` trägt den kompletten Zeitplan
// (Aufbau siehe buildTags() in js/push.js und parseSched() in
// api/send-notifications.js). Der OneSignal-Plan dieser App erlaubt
// 3 Data-Tags pro Gerät und weist einen Schreibvorgang mit mehr Keys
// KOMPLETT ab — das alte 13-Key-Modell ist genau daran gescheitert.
// Wer hier wieder Keys hinzufügt, bringt diesen Fehler zurück.
//
// Der Endpunkt ist bewusst ohne Login (die App hat keine Konten). Deshalb
// wird alles geprüft, was in die OneSignal-URL oder den Tag läuft, und die
// Antwort verrät nichts über den Upstream.
// ============================================================

const APP_ID = '1aeeca68-13c9-400a-a243-dd749527c49f';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Leer (= Push aus) oder v1 mit Morgen, Abend, SMALL-Liste, optional Ton und Herkunft.
const SCHED_RE = /^$|^v1;m=\d{4};e=\d{4};s=(\d{4}(,\d{4}){0,9})?(;t=(ton-[1-6]|system))?(;o=[av])?$/;
const MAX_SCHED_LEN = 80;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'POST only' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const playerId = typeof body.player_id === 'string' ? body.player_id : '';
  const tags = body.tags && typeof body.tags === 'object' ? body.tags : null;
  if (!UUID_RE.test(playerId) || !tags || tags.sched === undefined) {
    return res.status(400).json({ success: false, error: 'Missing or invalid player_id/tags' });
  }
  const sched = String(tags.sched);
  if (sched.length > MAX_SCHED_LEN || !SCHED_RE.test(sched)) {
    return res.status(400).json({ success: false, error: 'Invalid sched' });
  }

  const API_KEY = process.env.ONESIGNAL_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ success: false, error: 'not configured' });
  }

  // Legacy Players API — PUT /api/v1/players/{player_id}
  // player_id = PushSubscription.id aus dem SDK
  try {
    const response = await fetch(`https://onesignal.com/api/v1/players/${playerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${API_KEY}` },
      body: JSON.stringify({ app_id: APP_ID, tags: { sched } })
    });
    const data = await response.json().catch(() => ({}));
    const success = response.ok && (data.success === true || data.success === 'true');
    if (!success) console.error(`[set-tags] ${playerId.slice(0, 8)}… fehlgeschlagen:`, response.status, data.errors || null);
    return res.status(200).json({ success });
  } catch (e) {
    console.error('[set-tags] Upstream-Fehler:', e.message);
    return res.status(500).json({ success: false, error: 'upstream error' });
  }
}
