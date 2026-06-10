// ============================================================
// E-Mail-Anmeldung — gemeinsame Logik
// Genutzt von: Gate-Screen, Settings, Soft-Prompt (A3)
// Macht KEIN UI — jeder Aufrufer baut sein eigenes.
// ============================================================

// Lockere Validierung — fängt grobe Tippfehler, lässt valide Adressen durch.
// Brevo validiert serverseitig nochmal.
export function isValidEmail(email) {
  return typeof email === 'string'
    && email.length > 0
    && email.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Sendet die E-Mail an den Endpoint und gibt ein klares Ergebnis zurück.
// Rückgabe: { ok: true } | { ok: false, error: "<Text für den User>" }
export async function subscribeEmail(email) {
  try {
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) return { ok: true };
    return { ok: false, error: data.error || 'Gerade nicht möglich — versuch es später nochmal' };
  } catch {
    return { ok: false, error: 'Gerade nicht möglich — versuch es später nochmal' };
  }
}

// Sperrt einen Button für `seconds` Sekunden (Missbrauchs-Schutz,
// kein Server-seitiges Rate Limiting).
export function lockButton(btn, seconds = 60) {
  btn.disabled = true;
  setTimeout(() => { btn.disabled = false; }, seconds * 1000);
}
