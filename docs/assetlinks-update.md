# Digital Asset Links — Fingerprint nachtragen

Die Datei [`/.well-known/assetlinks.json`](../.well-known/assetlinks.json) verknüpft die
Domain `app.angstdoc.de` mit der Android-App `de.angstdoc.loewenherz`. Solange der
**echte SHA-256-Fingerprint** noch nicht eingetragen ist, zeigt die TWA beim Start die
Browser-Adressleiste (Chrome-Custom-Tab-Fallback) statt im Vollbild zu laufen.

## Warum erst nach dem Upload?

Google **re-signiert** das App Bundle über *Play App Signing*. Der Schlüssel, mit dem
deine App am Ende auf den Geräten landet, gehört also Google — nicht PWABuilder. Der
finale Fingerprint kommt deshalb **aus der Play Console**, nicht aus dem PWABuilder-Output.

## Schritte

1. **App Bundle hochladen** — das von PWABuilder erzeugte `.aab` in der Play Console
   hochladen. *Internal Testing* reicht völlig, es muss nichts veröffentlicht werden.
2. **Fingerprint kopieren** — Play Console → **Setup → App signing** →
   Abschnitt *App signing key certificate* → **SHA-256 certificate fingerprint** kopieren
   (Format: `AB:CD:EF:...`, 32 Hex-Paare).
3. **Platzhalter ersetzen** — in `.well-known/assetlinks.json` den String
   `PLATZHALTER_WIRD_NACH_PLAY_CONSOLE_UPLOAD_ERSETZT` durch den kopierten Fingerprint
   ersetzen, committen und pushen (Vercel deployt automatisch).
4. **Verifizieren** — entweder
   - mit dem [Statement-List-Tester](https://developers.google.com/digital-asset-links/tools/generator), oder
   - durch Installation des Test-Builds: **keine Browser-Adressleiste sichtbar = korrekt**.

## Empfohlen: zwei Fingerprints

Das Array `sha256_cert_fingerprints` darf **mehrere** Fingerprints enthalten. Trägst du
sowohl den **Play-App-Signing-Key** (Schritt 2) als auch den **Upload-Key**
(Play Console → App signing → *Upload key certificate*) ein, läuft auch ein lokal mit dem
Upload-Key signiertes Test-APK ohne Adressleiste:

```json
"sha256_cert_fingerprints": [
  "<Play-App-Signing-Key SHA-256>",
  "<Upload-Key SHA-256>"
]
```

## Auslieferung prüfen (nach jedem Deploy)

```bash
curl -i https://app.angstdoc.de/.well-known/assetlinks.json
```

Erwartung: **HTTP 200**, `Content-Type: application/json`, **kein Redirect**.
