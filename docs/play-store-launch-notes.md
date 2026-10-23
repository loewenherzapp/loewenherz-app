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

- [ ] **Dankes-Mail an die Tester** (Patrick, 20.10.2026): Test abgeschlossen; Dank — das Feedback
      war sehr wertvoll, dadurch konnten schon einige Bugs behoben werden; Frage nach weiterem
      Feedback; Hinweis, dass vor dem Android-Update ein Backup exportiert und danach wieder
      eingelesen werden kann (Einstellungen → Backup). Wenige Tester, etwa die Hälfte Freunde und
      Familie — persönlicher Ton.

- [x] SHA-256-Fingerprint in `assetlinks.json` nachtragen — erledigt (`bad710d`); beide
      Fingerprints live, `curl` liefert HTTP 200
- [x] Merged Manifest auf `AD_ID` prüfen (siehe b) — v2 enthält die Berechtigung nicht
- [x] Target-API gegen Play-Deadline gegenprüfen (siehe c) — v2 baut auf `targetSdk 36`
- [x] Provisorisches Maskable-Icon gegen finales Designer-Icon tauschen — final seit
      `bd42ca1`, in v2 enthalten
- [ ] Disclaimer-Text juristisch prüfen lassen (aktuell Entwurf)
- [x] Datenschutz-URL `https://app.angstdoc.de/datenschutz` (Konstante `PRIVACY_URL`
      in `js/config.js`) in der Play Console hinterlegen — erledigt 08.09.2026, siehe oben
- [x] Testerliste für den geschlossenen Test eintragen — 12 Anmeldungen am 04.10.2026 erreicht

## To-do nach dem geschlossenen Test

- [x] **Android von TWA auf Capacitor umstellen (wie iOS).** Entschieden 10.10.2026, umgesetzt
      am 20.10.2026 als Version 1.1.0 (versionCode 5) — Bau-Protokoll und Architektur im
      Abschnitt [Capacitor-Bau v5](#capacitor-bau-v5-110-20102026) unten.
      Anlass: Die TWA speichert alles im Browser-Speicher (Chrome bzw. Samsung Internet).
      „Browserdaten löschen" mit „Cookies und Websitedaten" löscht damit auch Profil, Punkte
      und Reflexionen. Am 10.10.2026 bestätigt bei einer Testerin (Samsung A25): Browserdaten
      gelöscht → App fragte wieder nach Name und E-Mail. Kein Code-Fehler.
      Mit Capacitor liegen die Daten im eigenen App-Speicher und sind vom Browser getrennt.
      Zu klären/erledigen: OneSignal-Push nativ für Android (FCM) anbinden, gleiche
      Paket-ID `de.angstdoc.loewenherz` und denselben Upload-Key behalten, damit es ein Update
      bleibt; Bestandsdaten der TWA-Nutzer liegen im Browser und wandern nicht automatisch mit
      (Weg über Sicherung exportieren/importieren anbieten); `assetlinks.json` wird dann nicht
      mehr gebraucht.

---

## Capacitor-Bau v5 (1.1.0, 20.10.2026)

Ab versionCode 5 ist die Android-App **keine TWA mehr**, sondern — wie iOS seit 1.0 — eine
Capacitor-8-Hülle mit gebündelten Web-Assets im Ordner `android/` des Repos. Paketname
`de.angstdoc.loewenherz` und Upload-Key sind dieselben wie bei v1–v4, damit Play das Paket
als Update annimmt. Architektur und Web/Native-Weiche: [ios-capacitor-notes.md](ios-capacitor-notes.md)
gilt 1:1; dieser Abschnitt hält nur fest, was Android anders macht.

### Warum (Kurzfassung)

- TWA-Daten liegen im Chrome-Speicher: „Browserdaten löschen" löschte Profil und Punkte
  (zweimal bei Testerinnen). Capacitor speichert in der WebView der App, getrennt von Chrome.
- Web-Push im Android-Doze kommt erst im Wartungsfenster (Emulator-Beleg 18./19.10.2026).
  Die native App bekommt FCM-Push mit `priority: 10` — der weckt das Gerät.

### Toolchain (einmalig)

```bash
brew install openjdk@21        # Capacitor 8 verlangt Java 21 (keg-only, nicht im PATH)
npm install                    # @capacitor/android steht in package.json
```

Android-SDK wie bisher unter `/opt/homebrew/share/android-commandlinetools` (platforms;android-36,
build-tools;36.1.0). Gradle 8.14.3 lädt der Wrapper beim ersten Bau selbst. Android Studio ist
nicht nötig.

### Bauen

```bash
npm run build:android          # Web-Bundle (scripts/build-www.mjs) + cap sync android
npm run release:android        # signiertes .aab + .apk, Signatur- und Manifest-Prüfung, Ablage
```

`scripts/release-android.mjs` setzt JAVA_HOME (openjdk@21), ANDROID_HOME,
`ONESIGNAL_DISABLE_LOCATION=true` (kein Standort-Modul im SDK, wie iOS seit 1.0.1) und die
Signatur-Variablen `LH_KEYSTORE_*` aus `signing-key-info.txt` (CRLF-Falle wird dort entschärft).
Ablage: `/Users/Katana/Buch/Löwenherz - Google Play package v5 (versionCode 5)/` mit
`Löwenherz-v5.aab`, `Löwenherz-v5.apk` und `build-info.txt`. Der Keystore bleibt in
`…/Löwenherz - Google Play package/` (nicht im Repo).

Das Skript bricht laut ab, wenn der Fingerabdruck nicht der Upload-Key ist oder das Merged
Manifest `AD_ID` bzw. eine Standort-Berechtigung enthält (Play-Deklarationen „keine Werbe-ID",
kein Standort).

Nach jeder Web-Änderung, die nativ landen soll: `npm run build:android` genügt für den Emulator
(`./gradlew assembleDebug` in `android/`), fürs Play-Paket immer `npm run release:android`.

### Was Android anders macht als iOS

| Thema | Umsetzung |
|---|---|
| Plattform-Weiche | `isAndroid()` in `js/platform.js` — nur für Zurück-Taste, Benachrichtigungskanal, Sprung in die Android-Einstellungen. Alles andere läuft über `isNative()`. |
| Push | Dasselbe `@onesignal/capacitor-plugin`, dieselbe App-ID, derselbe **eine** `sched`-Tag (inkl. `z=`). Subscription-Typ im Dashboard: Android (device_type 1). Voraussetzung im OneSignal-Dashboard: Firebase-Service-Account-JSON unter Push & In-App → Platforms → Google Android (FCM) — **eingerichtet 23.10.2026**: Firebase-Projekt `loewenherz-1bc36` („Loewenherz", Organisation angstdoc.de, Spark-Tarif, ohne Analytics/Gemini), Dienstkonto `firebase-adminsdk-fbsvc@loewenherz-1bc36.iam.gserviceaccount.com`, Sender-ID 912728478406. Die Organisationsrichtlinie „Dienstkonto-Schlüssel dürfen nicht erstellt werden" (Google-Standard für Workspace-Organisationen) ist **nur für dieses Projekt** auf „nicht erzwungen" gesetzt (Cloud Console → Organisationsrichtlinien); dafür hat Patrick die Rolle „Organisationsrichtlinien-Administrator". Neuer Schlüssel bei Bedarf: Firebase → Projekteinstellungen → Dienstkonten → „Neuen privaten Schlüssel generieren" → bei OneSignal hochladen. |
| Ton | Android 8+ hängt den Ton an den **Benachrichtigungskanal**; ein Kanal-Ton ist nach dem Anlegen fix. Deshalb trägt die Kanal-ID den Ton (`lh-ton-4`, `lh-system`): `ensureAndroidChannel()` in `js/push-native.js` legt vor SDK-Init und vor jedem Tag-Sync den Kanal zum gewählten Ton an, `ErinnerungskanalPlugin.java` löscht die anderen sowie den Kanal „General" (`general_channel_id`), den Chrome für die TWA-Push-Delegation in der App angelegt hatte und der das Update überlebt (in den Android-Einstellungen steht so genau ein Kanal „Erinnerungen"). Server: `existing_android_channel_id: 'lh-<Kennung>'` in `api/send-notifications.js` — fehlt der Kanal auf dem Gerät, nimmt das SDK seinen Standardkanal (Systemton). Ton-Dateien: `android/app/src/main/res/raw/lh_ton_N.mp3` (Kopien der Vorschau-MP3s aus `assets/sounds/`). |
| Zurück-Taste | `js/back-nav.js` bleibt die Logik (Schutz-Eintrag im Verlauf). Neu: Listener auf `App.backButton` — Verlauf vorhanden → `history.back()`, sonst `minimizeApp()`. Ohne den Listener bliebe die App im Startzustand bei der Zurück-Taste einfach stehen. |
| Blockierter Push | Button „Einstellungen öffnen" springt über `ErinnerungskanalPlugin.einstellungenOeffnen()` in die Benachrichtigungsseite der App (iOS: `app-settings:` via AppLauncher). |
| Haptik | Haptics-Plugin + Schalter wie iOS; die `navigator.vibrate()`-Aufrufe (Dashboard, Sheets, Picker) sind in der nativen App abgeschaltet — sonst vibriert jeder Tap doppelt. |
| Icon | Adaptive Icon: Vordergrund `mipmap-*/ic_launcher_foreground.png`, Hintergrund `@color/ic_launcher_background` = Petrol. Legacy/Round-Icons für Android 7. **Benachrichtigungs-Symbol `ic_stat_onesignal_default` = weiße Löwen-Silhouette MIT Alphakanal** (das v2–v4-Problem „gefülltes Quadrat"), Akzentfarbe Petrol (`onesignal_notification_accent_color`), großes Bild `ic_onesignal_large_icon_default`. Alle Bitmaps erzeugt `swift scripts/android-assets.swift` aus `scripts/android-assets/icon-1254.png` — nie von Hand nachmalen. |
| Splash | Petrol (Entscheidung 23.09.2026): Systemsplash ab Android 12 (`windowSplashScreenBackground`) und Plugin-Splash (`drawable*/splash.png`, `androidScaleType: CENTER_CROP`) beide Petrol mit Löwe 120dp mittig — gehen nahtlos ineinander über. iOS bleibt Creme. |
| Statusleiste | Capacitor 8 ist edge-to-edge. Mit WebView ≥ 140 reicht Capacitor die Safe-Area-Insets an `env(safe-area-inset-*)` durch (wie iOS, dunkle Reflexion bis unter die Statusleiste). Ältere WebViews bekommen ein Padding; der Streifen dahinter ist `windowBackground` = Creme (`styles.xml`). |
| Theme | `Theme.AppCompat.Light` statt DayNight — die App hat feste Farben, der System-Dunkelmodus darf das Fenster nicht schwarz färben. Hochformat erzwungen (`screenOrientation`). |
| Origin | Die WebView läuft unter `https://localhost` (Capacitor-Default `androidScheme`); in `api/subscribe.js` als CORS-Origin freigeschaltet (iOS: `capacitor://localhost`). |
| Backup | Export über Share-Sheet (gleicher Code wie iOS, `Filesystem` + `Share`), Import über den Android-Dateidialog. Android Auto Backup bleibt an (`allowBackup`, wie iCloud auf iOS) — `res/xml/backup_rules.xml` und `data_extraction_rules.xml` schließen nur die OneSignal-Identität (`OneSignal.xml`, `GTPlayerPurchases.xml`) aus, sonst teilten sich altes und neues Gerät nach einer Wiederherstellung ein Abo. |
| Berechtigungen | `INTERNET`, `POST_NOTIFICATIONS` (OneSignal), `VIBRATE` (Haptics), kein `AD_ID`, kein Standort — `build-info.txt` listet den Stand jedes Baus. |
| assetlinks.json | Nicht mehr nötig (keine TWA-Verifikation), bleibt vorerst liegen: Solange Nutzer noch v4 haben, braucht die TWA sie. |

### Bestandsnutzer der TWA — der Umzug

Die TWA-Daten liegen im Chrome-Speicher und sind aus der WebView der nativen App nicht lesbar.
Es gibt keinen automatischen Weg; der Weg ist das vorhandene Backup (Einstellungen → Backup
exportieren / importieren). Eine Umzugskarte in der TWA und ein Import-Link im Onboarding waren
gebaut und im Emulator geprüft, **Patrick hat beides am 20.10.2026 gestrichen**: Die Testerliste
ist klein und persönlich, er sagt den Testern direkt, dass sie vorher ein Backup exportieren und es
nach dem Update einlesen können (siehe To-do „Dankes-Mail an die Tester").

Ablauf für eine Testerin: In der alten App Einstellungen → Backup exportieren (Chrome legt
`loewenherz-backup-<Datum>.json` in Downloads ab). Nach dem Update die neue App mit beliebigem
Namen durchs Onboarding bringen, dann Einstellungen → Backup importieren → Datei aus Downloads
wählen → Neustart mit allen Daten. Auch ohne Backup vorher nichts verloren: Chrome behält die
Daten der Domain — `app.angstdoc.de` in Chrome öffnen, dort exportieren.

Push nach dem Import: Die Zusage (`loewenherz_push_asked` + `_enabled`) steckt im Backup, die
Android-Erlaubnis für die neue App aber nicht. Deshalb startet die App das SDK wie für jeden
Bestandsnutzer und holt den Android-Dialog („Löwenherz Benachrichtigungen senden?") einmal beim
Start nach (`nachholenNativeErlaubnis()` in `js/push.js`). Dafür unterscheidet
`js/push-native.js` auf Android per `canRequestPermission()` zwischen „nie gefragt" ('default')
und „verweigert" ('denied') — ohne das stünde nach dem Import „blockiert" in den Einstellungen.
Im Emulator (20.10.2026) geprüft: Import → Dialog → Allow → Tag `sched` (gleiches Format wie
iOS/Web, inkl. `z=`) → Abo vom Typ Android (device_type 1) im Dashboard.

Nicht mitgenommen: die E-Mail-Anzeige in den Einstellungen (`userEmail` ist nicht im Backup;
die Brevo-Anmeldung selbst bleibt bestehen).

### Push-Nachweis im Emulator (23.10.2026, nach der FCM-Einrichtung)

Ablauf `scratchpad/push-test.sh` + `doze-test.sh` der Sitzung (Debug-Build, lh35, Android 15):
Backup der TWA importiert → Android-Dialog beim Start → Allow → Abo `6d8a1732-…` mit
FCM-Token, Server: device_type 1, `invalid_identifier: false`, Tag
`sched: v1;m=0600;e=1930;s=0815,1345,1730;z=60`. Test-Push per REST
(`include_subscription_ids`, `priority 10`, `ttl 10800`, `existing_android_channel_id: lh-ton-4`)
→ Mitteilung nach 5 s auf Kanal `lh-ton-4`, kleines Symbol = Löwen-Silhouette (Petrol), großes
Bild = Löwe. **Doze:** `dumpsys battery unplug` + `dumpsys deviceidle force-idle` (deep: IDLE) →
Push → neue Mitteilung nach **3 s**, Gerät weiter im Doze. Der eigentliche Gewinn der
Umstellung gegenüber Web-Push (dort erst im Wartungsfenster, 18./19.10.2026) ist damit belegt.
Zustellung immer am Gerät prüfen (`dumpsys notification --noredact`), OneSignals „successful"
heißt nur „an FCM übergeben".

### Gerätetest Xiaomi 13T (HyperOS 2 / Android 15, 23.10.2026)

Signiertes Release-APK über die Dateien-App installiert (HyperOS blockt `adb install` ohne
„Über USB installieren" und `adb shell input`; `adb push` nach Downloads + Installation am Gerät
funktioniert). Onboarding → SMALL-Punkt → Soft-Ask → Android-Dialog → Abo `ab970612-…` mit
Token, Kanal `lh-ton-4` mit Sound, Tag `sched` korrekt. **Doze:** `dumpsys battery unplug` +
`deviceidle force-idle` (deep IDLE) → Push → Mitteilung nach **3 s** auf dem echten Gerät, mit
Löwen-Silhouette und großem Bild. Pushes bei geöffneter App erscheinen bewusst nicht
(`foregroundWillDisplay` → `preventDefault`, wie iOS) — beim Test zweimal „nicht angekommen",
weil die App im Vordergrund war. Vor dem Play-Update muss diese lokal signierte Testversion vom
Handy deinstalliert werden (Play signiert mit einem anderen Schlüssel).

### Play-Release 5 (1.1.0) im geschlossenen Test (23.10.2026)

- Release „5 (1.1.0)“ im Track „Geschlossener Test - Alpha“ angelegt und gespeichert, Bundle
  `Löwenherz-v5.aab` (versionCode 5, API 24+, Ziel-SDK 36), v4 nicht eingeschlossen (wird
  ersetzt). Versionshinweise de-DE: Umstieg auf eigenständige App, Daten im App-Speicher,
  pünktliche Erinnerungen, Backup-Hinweis (vorher exportieren, danach importieren).
- Keine Fehler, drei Warnungen: 26 Geräte fallen raus (6 Tablets, 3 TV, 17 Auto — Hochformat
  erzwungen; Telefone unverändert 12.413), Download ~9 MB statt ~1,4 MB, keine
  Offenlegungsdatei (kein R8 im Einsatz).
- „Verwaltete Veröffentlichung“ ist AUS: Nach Googles Freigabe geht der Release sofort an die
  Tester. Eingereicht wird über „Veröffentlichungen – Übersicht“ → „1 Änderung zur Überprüfung
  einreichen“ (einzige offene Änderung).
- Produktionszugriff: Der Antrag vom 20.10.2026 wurde am 21.10.2026 abgelehnt („Wir haben
  deinen Antrag geprüft und festgestellt, dass deine App noch weiter getestet werden muss“).
  Der geschlossene Test läuft also weiter; neuer Antrag nach weiterer Testphase.
- Patricks Xiaomi trägt die lokal signierte Testversion (Upload-Key). Vor dem Play-Update
  deinstallieren, sonst lehnt Android das Update wegen abweichender Signatur ab. Sein altes
  Web-Push-Abo (29b80f89, device_type 5) hat OneSignal nach der Deinstallation der TWA als
  ungültig markiert — keine doppelten Erinnerungen. Ob die Web-Abos der Tester nach dem
  *Update* (statt Deinstallation) ebenfalls ungültig werden, ist offen: falls nicht, kann eine
  Erinnerung zeitweise doppelt kommen (Chrome + App), wie beim iOS-Umstieg.

### Release 6 statt 5 und neuer Newsletter-Einwilligungstext (23.10.2026)

- Patrick verschickt über die App-Liste bei Brevo künftig seinen allgemeinen Newsletter
  (Impulse, Neues aus seiner Arbeit, gelegentlich Angebote). Die alte Einwilligung lautete
  nur „Impulse rund um das Buch und die App“ und deckte Angebote nicht ab.
- Neu formuliert (SW v131): Einwilligungssatz unter allen drei E-Mail-Formularen
  (`emailGate.infoPre` in `content/de.js`: Gate, Soft-Prompt, Einstellungen), die Einleitung von
  Gate und Soft-Prompt, der Einstellungen-Link, die Bestätigungsseite `confirmed.html` und
  Abschnitt 4 der Datenschutzerklärung (beide Fassungen, jetzt „Newsletter über Brevo“, mit dem
  Satz „Deine Einwilligung umfasst ausdrücklich auch diese werblichen Inhalte.“).
- Weil der Text im App-Paket steckt, wurde das hochgeladene, nie eingereichte Bundle 5 durch
  **versionCode 6** (weiter versionName 1.1.0) ersetzt: neuer Release-Entwurf im Alpha-Track
  mit `Löwenherz-v6.aab` (von Claude selbst hochgeladen, 9,4 MB) und denselben
  Versionshinweisen; der gespeicherte Release 5 ist damit hinfällig. In
  „Veröffentlichungen – Übersicht“ stehen genau zwei Änderungen: „6 (1.1.0) Vollständigen
  Roll-out starten“ und „Datensicherheit“. Einreichen klickt Patrick. Dabei sind die Querformat-Startbilder
  weggefallen (App ist auf Hochformat festgelegt), das Bundle ist dadurch gut 2 MB kleiner.
- **Offen:** Wer sich vor dem 23.10.2026 eingetragen hat, hat nur der alten Beschreibung
  zugestimmt. Vor der ersten Mail mit Angeboten an diese Adressen eine neue Zustimmung
  einholen (z. B. kurze Mail mit Bestätigungsknopf). Die Brevo-Bestätigungsmail (Vorlage 2)
  konnte per API nicht gelesen werden — ihren Text gegen die neue Beschreibung prüfen.
  Die iOS-App (1.0.2) zeigt den alten Einwilligungstext bis zum nächsten iOS-Build.

### Offen / zu prüfen

- [x] **Datensicherheit in der Play Console neu ausgefüllt (23.10.2026, Freigabe Patrick).**
  Vorher stand „keine Nutzerdaten erhoben“, für die native App unzutreffend. Jetzt: Daten werden
  erhoben, Übertragung verschlüsselt, keine Konten. Erhoben (nicht geteilt, nicht nur
  sitzungsspezifisch, für Nutzer freiwillig): E-Mail-Adresse (Mitteilungen des Entwicklers,
  Brevo), App-Interaktionen (Analyse, OneSignal-Sitzungsdaten), Geräte- oder andere IDs
  (Funktionen der App, Push-Token/OneSignal-ID). Nachtrag 23.10.: Für die E-Mail-Adresse
  zusätzlich „Werbung oder Marketing“, weil Patrick über die Liste seinen Newsletter
  verschickt, der gelegentlich Angebote enthalten kann. Die optionale Frage „Können Nutzer das
  Löschen ihrer Daten anfordern?“ bleibt bewusst unbeantwortet: Ein „Ja“ verlangt eine eigene
  Lösch-Anleitungsseite mit Datenarten und Aufbewahrungsfristen, die es noch nicht gibt. Die
  Betroffenenrechte stehen in der Datenschutzerklärung (Abschnitt 10). Falls gewünscht: eigene
  Lösch-Seite anlegen und hier nachtragen. Eingereicht zusammen mit Release 5 (eine Prüfung).

- Neue Berechtigung `POST_NOTIFICATIONS` kommt aus dem OneSignal-SDK (hatte v4 schon).
  Datensicherheits-Formular: Android-App erhebt dieselben OneSignal-Gerätedaten wie iOS —
  Datenschutzerklärung (`settings.js` LEGAL_CONTENT + `datenschutz.html`) nennt bisher nur die
  iOS-App beim nativen SDK und Apple als Zwischenstation; Google (FCM) ergänzen.
- `android:allowBackup="true"` (Capacitor-Default, OneSignal-Dateien ausgenommen): Android Auto
  Backup sichert den WebView-Speicher verschlüsselt in Google Drive, analog zum iCloud-Backup auf
  iOS. Steht so nicht in der Datenschutzerklärung („kein Cloud-Backup").
- Play Console nach dem Upload: App-Signatur-Seite muss weiterhin den Upload-Key zeigen;
  Gerätekatalog-Verluste prüfen (minSdk bleibt 24).
