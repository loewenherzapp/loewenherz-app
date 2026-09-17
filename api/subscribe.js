// ============================================================
// Löwenherz — E-Mail-Anmeldung an Brevo (Double-Opt-in)
// ============================================================
// POST /api/subscribe  { email }
// 201 Brevo → neuer Kontakt, DOI-Mail raus
// 204 Brevo → schon registriert (Body leer! defensiv parsen)
// 401/403 Brevo → unsere Config, niemals als „E-Mail ungültig" zeigen
// ============================================================

const ALLOWED_ORIGINS = [
  'https://app.angstdoc.de',
  'https://loewenherz-app.vercel.app',
  'capacitor://localhost',
  'http://localhost'
];

// Locker bewusst — Brevo validiert selbst.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 254;

// Einfaches Rate-Limit pro IP, im Speicher der Function-Instanz. Kein
// vollwertiger Schutz (jede Instanz zählt für sich), aber es stoppt das
// Skript, das in einer Schleife DOI-Mails an fremde Adressen auslöst.
const LIMIT_ANFRAGEN = 5;
const LIMIT_FENSTER_MS = 10 * 60 * 1000;
const anfragenJeIp = new Map();

function rateLimited(ip) {
  const jetzt = Date.now();
  const liste = (anfragenJeIp.get(ip) || []).filter((t) => jetzt - t < LIMIT_FENSTER_MS);
  if (liste.length >= LIMIT_ANFRAGEN) { anfragenJeIp.set(ip, liste); return true; }
  liste.push(jetzt);
  anfragenJeIp.set(ip, liste);
  // Karteileichen anderer IPs gelegentlich wegräumen
  if (anfragenJeIp.size > 1000) {
    for (const [k, v] of anfragenJeIp) if (!v.some((t) => jetzt - t < LIMIT_FENSTER_MS)) anfragenJeIp.delete(k);
  }
  return false;
}

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unbekannt';
}

// Datenminimierung: E-Mail in Logs maskieren (p***@beispiel.de)
function maskEmail(email) {
  const at = email.indexOf('@');
  if (at < 1) return '***';
  return email[0] + '***' + email.slice(at);
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  applyCors(req, res);
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};

  // Honeypot: das unsichtbare Feld `website` füllt nur ein Bot. Still mit
  // Erfolg antworten, damit er nichts lernt — Brevo wird nicht angefasst.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return res.status(200).json({ success: true, message: 'Bestätigungsmail gesendet' });
  }

  if (rateLimited(clientIp(req))) {
    return res.status(429).json({ success: false, error: 'Zu viele Versuche — bitte in ein paar Minuten nochmal' });
  }

  // --- Eigen-Validierung ---
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!email || email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email)) {
    return res.status(400).json({ success: false, error: 'Ungültige E-Mail-Adresse' });
  }

  const API_KEY = process.env.API_APP_Brevo;
  const LIST_ID = parseInt(process.env.LIST_APP_Brevo, 10);
  const TEMPLATE_ID = parseInt(process.env.TEMPLATE_APP_Brevo, 10);

  if (!API_KEY || !LIST_ID || !TEMPLATE_ID) {
    console.error('[Subscribe] Config fehlt:',
      { hasKey: !!API_KEY, listId: LIST_ID, templateId: TEMPLATE_ID });
    return res.status(500).json({ success: false, error: 'Gerade nicht möglich — versuch es später nochmal' });
  }

  // --- Brevo DOI-Call ---
  let response;
  try {
    response = await fetch('https://api.brevo.com/v3/contacts/doubleOptinConfirmation', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': API_KEY
      },
      body: JSON.stringify({
        email,
        includeListIds: [LIST_ID],
        templateId: TEMPLATE_ID,
        redirectionUrl: 'https://app.angstdoc.de/confirmed.html'
      })
    });
  } catch (e) {
    console.error(`[Subscribe] ${maskEmail(email)} → Brevo nicht erreichbar:`, e.message);
    return res.status(500).json({ success: false, error: 'Gerade nicht möglich — versuch es später nochmal' });
  }

  const brevoStatus = response.status;

  // Defensiv lesen — 204 hat keinen Body, response.json() würde werfen.
  const rawBody = await response.text();
  let brevoBody = null;
  if (rawBody) {
    try { brevoBody = JSON.parse(rawBody); } catch { brevoBody = rawBody; }
  }

  console.log(`[Subscribe] ${maskEmail(email)} → Brevo ${brevoStatus}:`, JSON.stringify(brevoBody));

  // 201 = neuer Kontakt, DOI-Mail raus | 204 = war schon da → beides Erfolg für User
  if (brevoStatus === 201 || brevoStatus === 204) {
    return res.status(200).json({ success: true, message: 'Bestätigungsmail gesendet' });
  }

  // Auth-/Config-Fehler: unser Problem — Hinweis fürs Log, User kriegt generischen 500.
  if (brevoStatus === 401 || brevoStatus === 403) {
    console.error(`[Subscribe] Brevo Auth-Fehler ${brevoStatus} — API-Key / List-ID / Template-ID prüfen`);
  }

  // Alles andere (inkl. Brevo-400 trotz bestandener Eigen-Validierung) → Serverfehler.
  // Format wurde oben geprüft, also blamen wir NICHT den User.
  return res.status(500).json({ success: false, error: 'Gerade nicht möglich — versuch es später nochmal' });
}
