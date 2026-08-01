# Play-Store-Launch — Arbeitsschritte für den Paket-Bau

Diese Notizen halten die Schritte fest, die beim Bau des TWA-Pakets (PWABuilder →
Play Console) sonst verloren gehen. Package Name: **`de.angstdoc.loewenherz`**.
Play-Store-Anzeigename (`Löwenherz – Die AngstDoc App`) lebt ausschließlich in der
Play Console und taucht im Repo bewusst nirgends auf. Manifest `name`/`short_name`
bleiben „Löwenherz".

Ergänzende Audit-Notizen (Install-Hinweise, Offline, Shortcuts, Datenschutz-URL):
siehe [store-readiness.md](store-readiness.md).

---

## a) Fingerprint-Loop — assetlinks scharf schalten

Google **re-signiert** das App Bundle via *Play App Signing*. Der finale
SHA-256-Fingerprint kommt deshalb aus der **Play Console**, NICHT aus PWABuilder.
Solange in [`/.well-known/assetlinks.json`](../.well-known/assetlinks.json) noch der
Platzhalter `PLATZHALTER_WIRD_NACH_PLAY_CONSOLE_UPLOAD_ERSETZT` steht, zeigt die TWA
beim Start die Browser-Adressleiste statt Vollbild.

1. App Bundle (`.aab` aus PWABuilder) in der Play Console hochladen — *Internal
   Testing* reicht, nichts muss veröffentlicht werden.
2. Play Console → **Setup/Einrichtung → App-Signatur** → **SHA-256-Fingerprint**
   kopieren (Format `AB:CD:EF:...`, 32 Hex-Paare).
3. Platzhalter in `assetlinks.json` ersetzen, committen, pushen (Vercel deployt
   automatisch).
4. Verifizieren — entweder mit dem
   [Statement-List-Tester](https://developers.google.com/digital-asset-links/tools/generator)
   oder durch Installation des Test-Builds: **keine Browser-Adressleiste = korrekt**.
5. **Empfohlen:** Das Array `sha256_cert_fingerprints` darf ZWEI Einträge enthalten —
   **Play-App-Signing-Key** (Schritt 2) *und* **Upload-Key** (Play Console →
   App-Signatur → *Upload-Key-Zertifikat*). Dann läuft auch ein lokal mit dem
   Upload-Key signiertes Test-APK ohne Adressleiste.

Detaillierte Variante mit Beispiel-JSON: [assetlinks-update.md](assetlinks-update.md).

**Auslieferung nach jedem Deploy prüfen:**

```bash
curl -i https://app.angstdoc.de/.well-known/assetlinks.json
```

Erwartung: **HTTP 200**, `Content-Type: application/json`, **kein Redirect**.
(Content-Type wird in [`vercel.json`](../vercel.json) erzwungen; die Datei ist
bewusst NICHT im Service-Worker-Precache, weil Google/Android sie extern abruft.)

---

## b) Werbe-ID-Check (AD_ID)

In der Play Console ist deklariert: **„keine Werbe-IDs"**. Die App ist werbefrei.

Beim fertigen Paket deshalb das **Merged Manifest** auf die Berechtigung
`com.google.android.gms.permission.AD_ID` prüfen — sie kann durch den TWA-Wrapper
oder eingebundene Play Services hereinkommen.

Prüfen (im generierten Android-Projekt):

```bash
grep -r "AD_ID" app/build/outputs/logs/manifest-merger-*.txt
# oder das gemergte Manifest im APK-Analyzer / bundletool inspizieren
```

Falls vorhanden — eine der beiden Optionen:

- **App bleibt werbefrei (bevorzugt):** Berechtigung im Manifest entfernen:

  ```xml
  <uses-permission android:name="com.google.android.gms.permission.AD_ID"
      tools:node="remove" />
  ```

- **Oder** die Deklaration in der Play Console (Datensicherheit) auf „Ja, Werbe-ID
  wird genutzt" korrigieren.

Wegen der Deklaration „keine Werbe-IDs" ist die erste Option der richtige Weg.

---

## c) Target-API-Merker

Play verlangt eine aktuelle Ziel-API (jährliche Deadline, aktuell **31.08.2026**).

- Bei einem **frischen PWABuilder-Bau** automatisch erfüllt — kein Handlungsbedarf.
- Bei **späteren Neu-Builds** (Update-Uploads) kurz gegenprüfen, dass `targetSdk`
  noch die von Play geforderte Mindestversion erreicht, sonst lehnt die Console den
  Upload ab.

---

## Maskable-Icon — provisorisch

`assets/icons/icon-512-maskable.png` ist eine **provisorische** Variante (bestehendes
512er-Icon auf ~80 % skaliert, zentriert auf App-Hintergrundfarbe als Safe Zone).
Das **finale Icon kommt vom Designer** (Vektor-Handoff läuft) und ersetzt dann diese
Datei — der Manifest-Eintrag (`purpose: "maskable"`) bleibt unverändert.

---

## Offene Punkte vor Launch

- [ ] SHA-256-Fingerprint in `assetlinks.json` nachtragen (nach Play-Console-Upload)
- [ ] Merged Manifest auf `AD_ID` prüfen (siehe b)
- [ ] Target-API gegen Play-Deadline (31.08.2026) gegenprüfen (siehe c)
- [ ] Provisorisches Maskable-Icon gegen finales Designer-Icon tauschen
- [ ] Disclaimer-Text juristisch prüfen lassen (aktuell Entwurf)
- [ ] Datenschutz-URL `https://app.angstdoc.de/datenschutz` (Konstante `PRIVACY_URL`
      in `js/config.js`) in der Play Console hinterlegen
