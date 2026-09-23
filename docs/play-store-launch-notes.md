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

---

## Bau-Protokoll v2 (01.09.2026, versionCode 2)

Gebaut **lokal mit Bubblewrap** statt über die PWABuilder-Website — dieselbe Engine,
die PWABuilder intern benutzt, nur ohne Keystore-Upload im Browser.

Anlass: Der Wrapper lädt die Website live, inhaltliche Änderungen brauchen also
**keinen** neuen Build. Das **Icon** steckt dagegen fest im Paket — das hochgeladene
v1 (21.07.2026) trug auf Launcher, Splash und Benachrichtigungen noch das alte Icon.
Der Neubau hebt nebenbei `targetSdk` von 35 auf 36.

| | v1 (21.07.2026) | v2 (01.09.2026) |
|---|---|---|
| versionCode / versionName | 1 / 1.0.0.0 | 2 / 1.0.1 |
| targetSdk / compileSdk | 35 / 36 | 36 / 36 |
| minSdk | 23 | 23 |
| Icon | alt (oranger Löwe auf Creme) | neu (Petrol-Designer-Icon) |
| `AD_ID` im Merged Manifest | nein | nein |

Ablage des Pakets: `/Users/Katana/Buch/Löwenherz - Google Play package v2 (versionCode 2)/`
(nicht im Repo — `.aab`, `.apk`, Store-Icon, `twa-manifest.json`).

**Hochgeladen am 08.09.2026** in den Track *Interner Test*, Release „2 (1.0.1)", vollständiger
Roll-out. Das alte Bundle 1 (1.0.0.0) wurde dabei bewusst **nicht** mit eingeschlossen und ist
damit ersetzt. Google meldete keine Geräteverluste; Downloadgröße 1,46 MB (+207 KB).

Toolchain, einmalig eingerichtet:

```bash
brew install openjdk@17
brew install --cask android-commandlinetools
```

`~/.bubblewrap/config.json`:

```json
{"jdkPath":"/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk",
 "androidSdkPath":"/opt/homebrew/share/android-commandlinetools"}
```

Bau ohne die interaktiven `init`-Fragen: `twa-manifest.json` von Hand schreiben, dann
`bubblewrap update --skipVersionUpgrade` und `bubblewrap build --skipPwaValidation`.
Passwörter über `BUBBLEWRAP_KEYSTORE_PASSWORD` / `BUBBLEWRAP_KEY_PASSWORD`.

### Fallen aus diesem Bau

- **Bubblewraps eigener JDK-Download ist kaputt** (`end of central directory record
  signature not found`). JDK deshalb über Homebrew. Auf macOS muss `jdkPath` auf den
  Ordner zeigen, der `Contents/Home/bin/java` *enthält* — also
  `…/openjdk@17/libexec/openjdk.jdk`, nicht auf `Contents/Home` selbst.
- **Bubblewrap sucht `sdkmanager` unter `<sdk>/bin/` oder `<sdk>/tools/bin/`.** Der
  Homebrew-Cask legt ihn nach `<sdk>/cmdline-tools/latest/bin/` → Symlink nötig:
  `ln -sfn "$SDK/cmdline-tools/latest/bin" "$SDK/bin"`.
- **`signing-key-info.txt` hat CRLF-Zeilenenden.** Ein daraus gelesenes Passwort trägt
  ein `\r` am Ende, und apksigner meldet dann irreführend
  `keystore password was incorrect / Password is not ASCII`. Immer `tr -d '\r\n'`.

### Nach dem Bau verifiziert

- APK-Signatur-Fingerprint `8D:94:10:…:A0:70:71` — identisch mit dem Upload-Key in der
  live ausgelieferten `assetlinks.json`. Play akzeptiert das Update.
- Kein `AD_ID` im Merged Manifest (beide Merge-Stufen geprüft).
- `POST_NOTIFICATIONS` und `DelegationService` vorhanden — Web-Push wird weiter an die
  App delegiert.

### Designentscheidung Splash: Android Petrol, iOS Creme (entschieden 23.09.2026)

In v2 steht `backgroundColor` auf `#f7ead8` (Creme). Weil das Icon einen vollflächigen
Petrol-Hintergrund mitbringt, zeigt der Startbildschirm ein hartkantiges Petrol-Quadrat
auf Creme. Das wirkt wie ein eingeklebtes Bild und passt nicht zum runden
Systemsplash ab Android 12, der direkt davor erscheint.

**Entscheidung:** Auf Android wird der Splash-Hintergrund Petrol `#39828b`. Das Quadrat
verschmilzt dann mit dem Hintergrund, und es bleibt nur der goldene Löwe auf Petrol. Der
Systemsplash (Löwe im Petrol-Kreis) und der TWA-Splash gehen nahtlos ineinander über.
Der Wechsel zur cremefarbenen App läuft über die bestehende Überblendung (300 ms).

**iOS bleibt Creme ohne Logo.** Dort nutzt der Splash kein Icon, sondern entspricht nach
Apples Vorgabe dem ersten Bildschirm. Es gibt also kein Quadratproblem und keinen Grund,
das zu ändern.

Umsetzung:
- Web-Manifest `background_color` → `#39828b` (SW v123). Das wirkt sofort auf den
  Splash der über Chrome installierten Web-App und dient als Quelle für künftige Bauten.
- `twa-manifest.json` → `"backgroundColor": "#39828b"` **beim nächsten Android-Bau (v3)**.
  Bewusst kein Einzel-Bau nur dafür: v3 bündelt das mit dem neuen Monochrom-Icon (s. u.),
  damit es nur eine Google-Prüfung braucht. `themeColor`/`navigationColor` bleiben Creme,
  weil sie zur laufenden App passen müssen.

### Benachrichtigungs-Icon in v2 ist das Farb-Icon (zu reparieren in v3)

Geprüft am 23.09.2026 per `aapt2 dump resources`: `drawable/ic_notification_icon`
(24–96 px) ist das vollfarbige Petrol-Icon **ohne Transparenz**. Android färbt das
kleine Benachrichtigungssymbol selbst ein und wertet dabei nur den Alphakanal aus. In der
Statusleiste erscheint deshalb ein **gefülltes Quadrat statt eines Löwen**. Das große
Bild rechts in der Benachrichtigung (`chrome_web_icon`, 192er-PNG) zeigt den Löwen
dagegen korrekt.

Fix für v3: Die einfarbige Löwen-Silhouette der Designerin (PNG mit transparentem Grund)
als `"monochromeIconUrl"` in die `twa-manifest.json` eintragen. Bubblewrap erzeugt daraus
das Benachrichtigungs-Icon und das Themed Icon ab Android 13.

---

## Geschlossener Test (Stand 08.09.2026)

Der geschlossene Test ist die Pflichtstation vor dem Produktionszugriff — bei privaten
Entwicklerkonten verlangt Google einen bestandenen geschlossenen Test. Der **interne**
Test zählt dafür nicht.

**Verbindliche Kriterien** (aus der Play Console, nicht aus dem Hilfe-Center):

- Einen Release im geschlossenen Test veröffentlichen
- **Mindestens 12 Tester müssen sich anmelden** — Anmelden heißt: den Opt-in-Link öffnen
  und annehmen. Auf der Liste stehen genügt nicht.
- Test mit mindestens 12 Testern **mindestens 14 Tage** laufen lassen

Track: **„Geschlossener Test - Alpha"** (`tracks/4700151773270654677`).

Eingerichtet am 08.09.2026:

- Release-Entwurf „2 (1.0.1)" mit Bundle versionCode 2 (aus der Bibliothek, kein zweiter Upload)
- Versionshinweise de-DE für die Tester
- **177 Länder/Regionen** (alle) — bewusst nicht auf DACH begrenzt, damit kein Proband
  wegen seines Play-Store-Landes aus der Anmeldezahl fällt
- Offen: Testerliste, danach Vorschau bestätigen und zur Prüfung einreichen

**Anders als beim internen Test geht dieser Release durch Googles Prüfung.** Mit ihm gehen
alle offenen Änderungen aus „Veröffentlichungen – Übersicht" mit raus.

### Datenschutz-URL korrigiert (08.09.2026)

In der Play Console stand `https://angstdoc.de/datenschutz` — die Praxis-Seite, generischer
Boilerplate über 92.000 Zeichen ohne eine einzige Erwähnung von OneSignal oder Löwenherz.
Ersetzt durch `https://app.angstdoc.de/datenschutz`, die app-spezifische Erklärung (nennt
OneSignal, die Push-Verarbeitung und Apple/Google als Empfänger) und die kanonische URL
laut [store-readiness.md](store-readiness.md).

Warum das zählt: Google gleicht die Datensicherheits-Angaben gegen die verlinkte Erklärung
ab. Eine Erklärung, die die deklarierte Datenverarbeitung nicht beschreibt, ist ein
Ablehnungsgrund — und unabhängig davon ein DSGVO-Problem.

### App-Inhalte sind vollständig

Am 08.09.2026 geprüft: „App-Inhalte → Überprüfung erforderlich" meldet **„Alles erledigt"**,
10 abgeschlossene Deklarationen (Gesundheits-Apps, Werbe-ID, Finanzfunktionen, Behörden-Apps,
Datensicherheit, Zielgruppe, Altersfreigaben, Anzeigen, Anmeldedaten, Datenschutzerklärung).
Store-Eintrag de-DE und Kategorie „Gesundheit & Fitness" ebenfalls gesetzt.

---

## Identitätsbestätigung für Android-Entwickler (Frist 30.09.2026)

**Nichts zu tun — am 08.09.2026 in der Play Console geprüft.**

Google verschickt dazu Erinnerungsmails („Registriere deine Apps und Signaturschlüssel bis
zum 30. September 2026"). Der Stand für dieses Konto:

- `de.angstdoc.loewenherz` → Status **Registriert**, 1 Schlüssel, seit 20.07.2026.
- Identität (Name + Anschrift) wird automatisch aus dem Entwicklerkonto übernommen.

Warum ohne Zutun erfüllt: Die App läuft über **Play App Signing**, also hat Google den
Verteilschlüssel selbst registriert. Der Upload-Key muss **nicht** zusätzlich eingetragen
werden — registrierungspflichtig sind nur Schlüssel, mit denen *ausgelieferte* Pakete
signiert werden. Löwenherz wird ausschließlich über Google Play vertrieben, also entfällt
auch der Punkt „Apps außerhalb von Google Play registrieren".

Falls das je relevant wird: Der Status steht unter *Identitätsbestätigung für
Android-Entwickler* im Menü des Entwicklerkontos (nicht auf App-Ebene).

## Offene Punkte vor Launch

- [x] SHA-256-Fingerprint in `assetlinks.json` nachtragen — erledigt (`bad710d`); beide
      Fingerprints live, `curl` liefert HTTP 200
- [x] Merged Manifest auf `AD_ID` prüfen (siehe b) — v2 enthält die Berechtigung nicht
- [x] Target-API gegen Play-Deadline gegenprüfen (siehe c) — v2 baut auf `targetSdk 36`
- [x] Provisorisches Maskable-Icon gegen finales Designer-Icon tauschen — final seit
      `bd42ca1`, in v2 enthalten
- [ ] Disclaimer-Text juristisch prüfen lassen (aktuell Entwurf)
- [x] Datenschutz-URL `https://app.angstdoc.de/datenschutz` (Konstante `PRIVACY_URL`
      in `js/config.js`) in der Play Console hinterlegen — erledigt 08.09.2026, siehe oben
- [ ] Testerliste für den geschlossenen Test eintragen (mindestens 12 Anmeldungen nötig)
