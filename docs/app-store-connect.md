# App Store Connect — Einreichung Löwenherz

Arbeitsdokument für die iOS-Einreichung. Gegenstück zu
[play-store-launch-notes.md](play-store-launch-notes.md); der fertige Review-Notes-Text
steht in [app-store-review-notes.md](app-store-review-notes.md).

Stand: 28.08.2026. Bundle-ID **`de.angstdoc.loewenherz`**, Team **794H5P8UPY**.

---

## Aus der Play Console übernommen (Stand 28.08.2026)

Damit beide Stores dasselbe erzählen. Quelle ist die Play Console, nicht das Repo —
`play-store-launch-notes.md` schreibt den Namen **ohne** Bindestrich („AngstDoc App"),
die Console führt ihn **mit**. Die Console gilt.

| Feld | Wert | Apple-Grenze |
|---|---|---|
| App-Name | `Löwenherz – Die AngstDoc-App` | 28/30 Zeichen — passt |
| Kurzbeschreibung (Play, 80) | `Angst verstehen reicht nicht. Diese App bringt dich ins Handeln.` | 64 Zeichen; Apple-Untertitel erlaubt 30 → **muss gekürzt werden** |
| Vollständige Beschreibung | 1574 Zeichen, siehe unten | Apple erlaubt 4000 — passt unverändert |
| Kategorie | Gesundheit & Fitness, Tag „Selbsthilfe" | Apple: **Health & Fitness** |
| Support-E-Mail | anfrage@angstdoc.de | |
| Telefon | +4915156315884 | |
| Website | https://app.angstdoc.de | |
| Datenschutz-URL | https://app.angstdoc.de/datenschutz | Pflichtfeld bei Apple |

### Beschreibungstext (unverändert aus der Play Console)

```
Angst verstehen reicht nicht.

Du hast das Buch gelesen, vieles verstanden — und stehst im echten Moment trotzdem da:
im Supermarkt, an der Tür, um drei Uhr nachts. Das Wissen ist da. Es greift nur nicht.

Das ist die Lücke zwischen Verstehen und Können. Genau hier setzt die App an: Sie
trainiert die Fähigkeit, deine Werkzeuge dann anzuwenden, wenn du sie wirklich brauchst.

Das passiert über drei kleine Routinen, die sich in deinen Tag legen:

🧭 Morgenritual — eine kurze Ausrichtung, bevor der Autopilot übernimmt.
🦁 SMALL-Punkte — kleine Selbstfürsorge-Momente, die du über den Tag sammelst.
🌙 Abendreflexion — ein Abschluss für den Tag, ein Feierabend für deinen Kopf.

Werkzeuge, die du nur kennst, helfen im Anfall wenig. Werkzeuge, die du geübt hast,
sind plötzlich da. Du schärfst deine Wahrnehmung, arbeitest mit Gedanken und Gefühlen
und bleibst dran, ohne hart zu dir selbst zu sein. So wird aus ich weiß ein ich kann.

Und ja, es darf Spaß machen. Mit dabei: Quatschi, dein innerer Kommentator, der es gut
meint und maßlos übertreibt. Und Gundula, die alte Schildkröte, die dir mit einem
Augenzwinkern zeigt, wie entspannt es in dir gerade wirklich aussieht.

Dazu dein Verlauf zum Mitverfolgen und sanfte Erinnerungen zu deinen Zeiten — falls du
sie willst.
Die App ist ein Selbsthilfe-Werkzeug, kein Ersatz für Diagnose oder Behandlung. Deine
Daten bleiben lokal auf deinem Gerät: keine Anmeldung, kein Konto, kein Tracking.

Entwickelt von Dr. med. Patrick Eberle — dem AngstDoc. Das Buch hat dir gezeigt, was
geht. Die App sorgt dafür, dass du's tust.
```

---

## Datenerhebung — aus dem Code abgeleitet

Die Play-Datensicherheits-Angaben wurden **nicht** ausgelesen (der Fragebogen-Entwurf
sollte nicht angefasst werden). Stattdessen der Befund aus dem Quelltext — belastbarer,
weil überprüfbar.

**Keine Analytics-Bibliotheken.** Kein gtag, kein Plausible, kein Matomo, kein Sentry,
kein Facebook-Pixel. Verifiziert per Volltextsuche über `js/` und alle HTML-Dateien.

**Genau zwei ausgehende Endpunkte der App:**

| Endpunkt | Nutzlast | Wann |
|---|---|---|
| `POST /api/subscribe` | `{ email }` — sonst nichts, kein Name, keine Gerätedaten | nur wenn der Nutzer sich aktiv zum Newsletter anmeldet |
| `POST /api/set-tags` | `{ player_id, tags }` — OneSignal-Abo-ID + der eine `sched`-Tag | wenn Push aktiv ist und Zeiten geändert werden |

**Dazu das OneSignal-SDK selbst.** Das erhebt mehr, als die App aktiv sendet — im
Dashboard nachprüfbar am eigenen Gerät sichtbar: Abo-ID, OneSignal-ID, Gerätemodell,
OS-Version, Sprache, Zeitzone, **aus der IP abgeleitetes Land**, Sitzungszahl und
Nutzungsdauer.

**Reflexionen, SMALL-Punkte, Stimmungen, Name: bleiben lokal** (IndexedDB/localStorage),
verlassen das Gerät nie.

### Daraus für Apples Fragebogen

| Apple-Kategorie | Erhoben? | Verknüpft? | Zweck |
|---|---|---|---|
| Contact Info → Email Address | Ja, **nur bei Newsletter-Opt-in** | ja | Developer's Marketing |
| Identifiers → User ID | Ja (OneSignal-Abo-ID, Push-Token) | ja | App Functionality |
| Usage Data → Product Interaction | Ja (Sitzungen, Nutzungsdauer via OneSignal) | ja | App Functionality |
| Diagnostics | nein | | |
| Health & Fitness | **nein** — bleibt lokal | | |
| Location | **Entscheidung offen**, siehe unten | | |

**Tracking im Sinne der ATT: nein.** Nichts davon wird für Werbung oder
App-übergreifendes Tracking genutzt. Kein ATT-Dialog nötig.

### Standort — geklärt über die Privacy Manifests (28.08.2026)

Apple verlangt von Dritt-SDKs ein eigenes `PrivacyInfo.xcprivacy`. Auswertung aller
im Bundle liegenden Manifeste:

| Framework | deklariert |
|---|---|
| **OneSignalLocation** | **CoarseLocation + PreciseLocation** (Zweck Analytics) |
| OneSignalUser / -Framework / -Extension | UserID (AppFunctionality), ProductInteraction (Analytics) |
| OneSignalFramework | zusätzlich PurchaseHistory (Analytics) — von der App nicht genutzt |
| OneSignalNotifications / -InAppMessages / -Outcomes / -LiveActivities | ProductInteraction (Analytics) |
| Capacitor, Cordova, OneSignalCore, OneSignalOSCore | erhebt nichts |
| **App.app (eigenes Manifest)** | **leer** — siehe offene Punkte |

Alle mit `NSPrivacyTracking = false`, alle `Linked = false`.

`OneSignalLocation.framework` liegt im Bundle. **Erheben kann es trotzdem nichts:**

1. In `ios/App/App/Info.plist` steht **kein einziger `NSLocation*`-Schlüssel** — ohne den
   kann iOS eine Standortfreigabe technisch gar nicht erteilen.
2. Im gesamten JS gibt es keinen Standortcode (kein `geolocation`, kein
   `OneSignal.Location`).
3. Seit 28.08.2026 zusätzlich abgesichert: `OneSignal.Location.setShared(false)` direkt
   nach `initialize()` in `js/push-native.js` — hält auch dann, wenn später jemand
   einen `NSLocation*`-Schlüssel einträgt.

**Damit ist „kein Standort" keine Abwägung mehr, sondern belegbar.**

Bleibt allein das aus der IP abgeleitete **Land**, das OneSignal serverseitig zur
Subscription speichert (im Dashboard „DE"). Das ist kein Gerätestandort, sondern ein
Nebenprodukt der Netzverbindung. Bewertung dazu im Chat vom 28.08.2026.

---

## Positionierung — die Leitentscheidung (28.08.2026)

**Die App wird nicht über die App-Store-Suche gefunden und soll es auch nicht.**
Sie ist die Begleit-App zum Buch. Wer auf der Store-Seite landet, kommt per Link und
hat das Buch gelesen. Die Seite muss deshalb **Wiedererkennung** leisten, keine
Kaltakquise.

Folgen, die in allen Store-Texten durchgehalten werden müssen:

- **Untertitel:** `Von Verstehen zu Veränderung` (28/30). Bewusst ohne das Suchwort
  „Angst" — ASO ist kein Kriterium. Der Satz ist die Brücke vom Buch zur App und
  spiegelt den Beschreibungsschluss („Das Buch hat dir gezeigt, was geht. Die App
  sorgt dafür, dass du's tust.").
- **Wiedererkennung leistet der Name**, nicht der Untertitel: „Löwenherz – Die
  AngstDoc-App" ist Buchtitel + Autorenmarke.
- **Screenshots** zeigen, was ein Leser aus dem Buch kennt — Quatschi, Gundula,
  SMALL-Punkte, Reflexion. Keine generischen Nutzenversprechen-Kacheln.
- **Keywords** sind nahezu belanglos; Feld trotzdem füllen, kostet nichts.

### Achtung: zwei Publika, zwei Botschaften

Nach außen ist es eine **Begleit-App zum Buch**. Im Review-Notes-Feld muss dagegen die
**Eigenständigkeit** betont werden — Apples Richtlinie 4.2 (Minimum Functionality)
zielt genau auf Apps, die ohne ein anderes Produkt sinnlos sind. „Companion to a book"
ist dort ein Reizwort.

Kein Widerspruch in der Sache: Die App ist ohne Buch vollständig benutzbar, und
[app-store-review-notes.md](app-store-review-notes.md) argumentiert das bereits sauber
(eigene Logik, Offline-Betrieb, native Funktionen). Aber die beiden Texte **nicht
angleichen** — Nutzertext sagt „Begleiter", Review-Text sagt „standalone".

---

## Was Apple zusätzlich verlangt, was Play nicht wollte

- **Untertitel, 30 Zeichen.** Die Play-Kurzbeschreibung (64) ist zu lang. Neu formulieren.
- **Keywords, 100 Zeichen**, kommagetrennt. Bei Play gibt es das nicht.
- **Screenshots in Apple-Formaten** — u.a. 6,9″ (iPhone 16 Pro Max, 1320×2868).
  Patricks iPhone 16 hat dieses Format nicht → müssen aus dem Simulator kommen.
- **Altersfreigabe** über Apples eigenen Fragebogen.
- **Export-Compliance** (Verschlüsselung): App nutzt nur HTTPS → Standardausnahme.

---

## Stand der Einreichung

- [x] **28.08.2026 — App-Eintrag angelegt.** Plattform iOS, Name
      `Löwenherz – Die AngstDoc-App`, Primärsprache Deutsch, Bundle-ID
      `de.angstdoc.loewenherz`, SKU `loewenherz-ios-001`, Benutzerzugriff Vollzugriff.
      Status: *In Vorbereitung zur Übermittlung*.

- [x] **28.08.2026 — Versionsdaten 1.0 eingetragen und gespeichert:** Beschreibung
      (1565 Z.), Schlüsselwörter (86 Z.), Support-URL `https://app.angstdoc.de`,
      Marketing-URL `https://angstdoc.de`, Copyright `2026 Patrick Eberle`,
      Review-Anmerkungen (2573 Z., englische Fassung aus
      [app-store-review-notes.md](app-store-review-notes.md)), Kontakt Patrick Eberle /
      +4915156315884 / anfrage@angstdoc.de, **„Anmeldung erforderlich" ausgehakt**
      (war standardmäßig AN — Apple hätte Demo-Zugangsdaten erwartet).

- [x] **28.08.2026 — App-Informationen:** Untertitel `Von Verstehen zu Veränderung`,
      Kategorie **Gesundheit und Fitness** (= Play), Primärsprache Deutsch.
- [x] **28.08.2026 — Preis: kostenlos**, 175 Länder/Regionen, Basisregion USA (bei 0,00
      folgenlos). **App-Verfügbarkeit noch nicht konfiguriert** — offene Entscheidung.
- [x] **28.08.2026 — Inhaltsrechte:** „Ja, hat die erforderlichen Rechte an Inhalten
      Dritter." Grundlage: die drei Pixabay-Töne (siehe [sound-licenses.md](sound-licenses.md))
      und Bilder aus Bilddatenbanken laut Impressum.
- [x] **28.08.2026 — Reguliertes Medizinprodukt: Nein.** Keine Diagnose, Prävention,
      Überwachung oder Behandlung — die vier Zwecke der EU-MDR; der In-App-Disclaimer
      schließt sie ausdrücklich aus.
- [x] **28.08.2026 — App-Verschlüsselung:** nichts zu tun, `ITSAppUsesNonExemptEncryption
      = false` steht bereits in der Info.plist, App nutzt nur HTTPS.

- [x] **28.08.2026 — App-Verfügbarkeit: weltweit**, 175 Länder oder Regionen.
      Begründung: Die App ist deutschsprachig, das filtert von selbst; eine Begrenzung
      auf DE/AT/CH würde deutschsprachige Leser im Ausland ohne Gewinn ausschließen.
- [x] **28.08.2026 — Datenschutz-URL** `https://app.angstdoc.de/datenschutz` gesetzt.
- [x] **28.08.2026 — App-Datenschutz-Fragebogen ausgefüllt** (noch NICHT veröffentlicht,
      siehe unten):

| Datentyp | Zweck | Verknüpft | Tracking |
|---|---|---|---|
| Kontaktdaten → E-Mail-Adresse | Werbung/Marketing des Entwicklers | ja | nein |
| Kennungen → Benutzer-ID | App-Funktionalität | ja | nein |
| Nutzungsdaten → Produktinteraktion | Analyse | ja | nein |

Nicht deklariert: Gesundheit, Standort, Diagnose, Finanzen, Kontakte, Fotos,
Suchverlauf. Kein Tracking → **kein ATT-Dialog**.

**Bewusste Abweichung von OneSignals Manifesten:** Die deklarieren `Linked = false`.
Hier steht überall „verknüpft", weil das Dashboard es anders zeigt — Sitzungen,
Nutzungsdauer und der `sched`-Tag hängen sichtbar an einer dauerhaften Abo-ID. Im Sinne
Apples ist das eine Verknüpfung; untertreiben wäre das größere Risiko.

**Offen: der Knopf „Veröffentlichen"** auf der App-Datenschutz-Seite. Bewusst Patrick
überlassen — er schaltet die Angaben öffentlich.

### Altersfreigabe: 13+ (entschieden 28.08.2026)

Ergebnis: **13+** in 172 Ländern, 12+ in Vietnam und Südkorea, A12 in Brasilien;
für Betriebssysteme älter als Version 26 global 12+.

Antworten: Schritt 1 alle **Nein** (auch „Uneingeschränkter Internetzugriff" — es gibt
neun fest verdrahtete Ziele, kein Adressfeld, und Links öffnen im
SFSafariViewController, siehe `js/external-links.js`). Schritt 2 **„Selten" bei
vulgärer Sprache** — „Radio Bullshit" kommt achtmal vor und ist sogar ein UI-Label,
„Nie" wäre nachweisbar falsch. Schritt 3 **„Selten" bei medizinischen/Behandlungs-
informationen** und **Ja** bei Gesundheits-/Wellness-Themen. Schritte 4–6 alle **Nie**.

**Die eine echte Abwägung war Schritt 3.** Gemessen, nicht geraten:
„Häufig" ergibt **16+**, „Selten" ergibt **13+**. Ausschlaggebend für „Selten":
16+ sperrt Jugendliche mit Bildschirmzeit-Beschränkung aus — also gerade Betroffene.
Und sachlich: Die Psychoedukation steckt im **Buch**, die App ist das Übungswerkzeug;
ihre tägliche Oberfläche sind Punkte, Stimmung, Reflexion, keine Erklärtexte.

Falls Apple widerspricht, ist der Weg nach oben offen („Auf höhere Altersfreigabe
überschreiben"); der Weg zurück kostet eine Prüfrunde.

- [x] **29./30.08.2026 — Screenshots hochgeladen.** Vier Stück, 1320 × 2868, im
      **6,9-Zoll-Slot der Medienverwaltung**; der 6,5-Zoll-Slot leitet sie automatisch
      ab („6,9" Display verwenden"). Reihenfolge: **Dashboard → Abendreflexion →
      Verlauf → Morgenkompass**. Beispielnutzerin **Lena** (bewusst nicht Patrick — der
      Leser soll sich selbst dort sehen).

- [x] **30.08.2026 — Build 1.0 (1) hochgeladen** über Xcode-Organizer → Distribute App →
      App Store Connect. Signiert mit **Apple Distribution: Patrick Eberle (794H5P8UPY)**.

- [x] **01.09.2026 — Build 1.0 (2) hochgeladen.** Grund: Build 1 war veraltet — er kannte
      nur 3 Töne (Samtpfote/Aufatmen/Nachhall), inzwischen sind es **6**
      (König der Welt, Radau, Sofalöwe, Räuspern, Aufatmen, Nachhall) plus Änderungen in
      `app.js` und `styles.css`. `CURRENT_PROJECT_VERSION` von 1 auf 2 erhöht (zwei
      Stellen in project.pbxproj) — Apple lehnt gleiche Version+Build ab.
- [x] **01.09.2026 — App-Datenschutz veröffentlicht.**
- [x] **01.09.2026 — Build 1.0 (2) der Version zugewiesen.**
- [x] **01.09.2026 — ZUR PRÜFUNG EINGEREICHT.** Status: *1.0 Bereit zur Prüfung*.
      Apple nennt bis zu 48 Stunden, Rückmeldung per E-Mail.

### Ablehnung 02.09.2026 — Guideline 2.1 Information Needed

**Keine Ablehnung wegen eines Mangels.** Standard-Nachfrage bei Konten ohne
Prüfhistorie („a developer account that has a limited App Review history").
Submission-ID `634e1634-e9a5-4a36-9bd9-d18aa2539faf`, Status *1.0 Abgelehnt*,
Grund im Portal: *2.1.0 Performance: App Completeness*.

Apple fordert sechs Dinge. Stand 06.09.2026:

- [x] **Notes-Feld** neu befüllt (3953 Zeichen): Zweck, Zielgruppe, Zugang ohne Konto,
      Feature-Wegweiser, externe Dienste, regionale Gleichheit, Regulierungsstatus,
      Drittanbieter-Material, „keine nutzergenerierten Inhalte".
- [x] **Antwort an die App-Prüfung als Entwurf gesichert** (3877 Zeichen), beantwortet
      Punkte 1–6. Volltext auch in [app-store-review-reply.md](app-store-review-reply.md).
- [x] **08.09.2026 — Antwort abgesendet**, inklusive Bildschirmaufnahme (68 s, iPhone,
      384×848 nach WhatsApp-Kompression, lesbar geprüft). Zeigt Onboarding,
      E-Mail-Seite mit „Erstmal ohne", Push-Erklärung, SMALL-Auswahl, **laufende
      Abendreflexion**, Einstellungen. Nachrichtenverlauf steht auf 2.

**Kein erneutes Einreichen nötig — und auch nicht möglich.** „Erneut zur App-Prüfung
übermitteln" ist nach der Antwort **deaktiviert**. Bei einer 2.1-Informationsanfrage
nimmt der Prüfer die Antwort selbst auf; es wird nichts neu eingereicht.

**Zeitsteuerung der Reflexion im Antworttext ergänzt** (Morgen 5–11, Abend ab 18 Uhr).
Grund: Ein Prüfer, der die App mittags öffnet, sieht sonst zwei ausgegraute Karten und
könnte das für einen Defekt halten — genau der abgelehnte Punkt.

**Falle beim Anhängen:** Der Upload meldete zweimal „never delivered", ging aber beide
Male durch — die Datei hing doppelt dran. Nach einem solchen Fehler **immer im Dialog
nachsehen**; Löschen geht über den roten Knopf, der erst beim Überfahren erscheint.

**Wichtig für den Ablauf:** Der Antwort-Dialog kennt „Entwurf sichern" und
„Datei anhängen". Der Entwurf bleibt im Nachrichtenverlauf stehen und lässt sich über
„Entwurf fortsetzen" wieder öffnen.

**Der Zurücksetzen-Trick für das Video:** In der App unter Zahnrad → „Alle Daten
löschen" wird IndexedDB *und* localStorage geleert (`clearAllData()` +
`localStorage.clear()` in `js/screens/settings.js`). Danach startet die App wieder mit
dem Onboarding — ohne die App zu löschen oder neu zu installieren.

### Falle: ITMS-90683 — fehlender Zweck-Text für Standort

Nach dem Upload von Build 2 kam per Mail die Warnung ITMS-90683
(`NSLocationWhenInUseUsageDescription` fehlt). **Keine Ablehnung** — „delivery was
successful, you may want to correct this in your next delivery".

Ursache: `OneSignalLocation.framework` liegt im Bundle und referenziert Standort-APIs.

**Nicht** den `NSLocation*`-Schlüssel eintragen — das würde behaupten, die App wolle
Standortdaten, und der veröffentlichten Datenschutzangabe „kein Standort" widersprechen.

**Richtige Reparatur, zwei Teile, gehören zusammen — umgesetzt am 20.09.2026 für 1.0.1 (3):**
1. Mit `ONESIGNAL_DISABLE_LOCATION=true` bauen. Das Plugin wertet die Variable in seiner
   `Package.swift` aus und lässt `OneSignalLocation` dann weg. **Die Variable muss in dem
   Prozess gesetzt sein, der die Swift-Packages auflöst** — also bei `xcodebuild` bzw. beim
   Start von Xcode, nicht bei `cap sync`:
   ```bash
   # Kommandozeile
   ONESIGNAL_DISABLE_LOCATION=true xcodebuild -project ios/App/App.xcodeproj -scheme App …
   # Xcode-Oberfläche (Product → Archive): vor dem Start von Xcode setzen, danach Xcode
   # komplett beenden und neu öffnen; File → Packages → Reset Package Caches
   launchctl setenv ONESIGNAL_DISABLE_LOCATION true
   ```
   Gegenprobe am fertigen Bundle/Archiv — darf nichts finden:
   ```bash
   find <App.app> -iname "*Location*"
   ```
2. `OneSignal.Location.setShared(false)` in `js/push-native.js` steht jetzt in einem
   try/catch ohne await. Der Aufruf bleibt als zweite Sicherung für Builds MIT dem Modul;
   fehlt es, kann er die Push-Initialisierung nicht mehr abbrechen.

### Falle: Inhaltsrechte fallen zurück

Die am 28.08. gesetzte Inhaltsrechte-Angabe war am 01.09. **wieder leer** und blockierte
die Einreichung („Kann nicht zur Prüfung hinzugefügt werden — Richte die Informationen zu
den Inhaltsrechten in den App-Informationen ein"). Vor jeder Einreichung gegenprüfen:
App-Informationen → Inhaltsrechte.

**Wichtig zur Fehlersuche:** Diese Blockade steht als roter Kasten **oben** auf der
Versionsseite. Der Knopf „Zur Prüfung hinzufügen" bleibt dabei aktiv und reagiert
scheinbar gar nicht — ohne Scrollen nach oben sieht man den Grund nicht.

**Zweite Falle:** Ein Klick auf den Knopf über die Element-Referenz (DOM) löst nichts
aus; nötig ist ein echter Koordinaten-Klick. Danach öffnet sich rechts der
„Übermittlungsentwurf" mit dem eigentlichen Knopf **„Zur Prüfung übermitteln"**.

### Falle: Distribution-Zertifikat und Organizer

**Es gab kein Apple-Distribution-Zertifikat.** `xcodebuild … archive` weicht in dem Fall
**stumm** auf das Development-Zertifikat aus — kein Fehler, keine Warnung. Das Archiv
ist dann nicht store-tauglich. Immer gegenprüfen:

```bash
codesign -dvvv <archive>/Products/Applications/App.app 2>&1 | grep Authority
```

**Xcode Settings → Accounts → Manage Certificates → + → Apple Distribution schlug
ebenfalls stumm fehl** (kein Zertifikat, keine Meldung). Was funktioniert hat:
`xcodebuild -exportArchive` mit `method: app-store-connect` und
`-allowProvisioningUpdates` — dieser Schritt legt das Distribution-Zertifikat selbst an
und signiert korrekt.

**Der Organizer zeigt nur Archive, die Xcode selbst gebaut hat.** Ein per
`xcodebuild -archivePath` erzeugtes Archiv nach
`~/Library/Developer/Xcode/Archives/<Datum>/` zu kopieren reicht **nicht** — es bleibt
unsichtbar. Für den Upload-Knopf muss **Product → Archive** in Xcode laufen.

Beim ersten Archivieren fragt Xcode nach **Xcode Cloud** — „Remind Me Later" wegklicken,
sonst blockiert der Dialog den Lauf.

**Für den Upload wurden keine Zugangsdaten gebraucht** — der Organizer nutzt die in
Xcode angemeldete Apple ID. Das ist der Weg, der ohne API-Schlüssel und ohne
app-spezifisches Passwort auskommt.

### Falle: Screenshots — Format und Reihenfolge

**Der Slot auf der Versionsseite nimmt nur 6,5 Zoll** (1242 × 2688 / 1284 × 2778) und
weist 1320 × 2868 ab. Der passende 6,9-Zoll-Slot liegt in der **Medienverwaltung**
(„Alle Größen in Medienverwaltung anzeigen"), standardmäßig **zugeklappt**. Dort hoch-
laden, nicht auf der Versionsseite.

**Reihenfolge lässt sich nicht per Drag sortieren** (der Zug wird als Hover gewertet).
Sie ergibt sich aus der Upload-Reihenfolge — aber nur, wenn **einzeln nacheinander**
hochgeladen wird. Ein Mehrfach-Upload landet in unvorhersehbarer Ordnung. Zwischen den
Einzeluploads jeweils ~15 s warten und den Zähler prüfen.

Die ersten drei Bilder erscheinen im Installationsdialog — das stärkste gehört nach vorn.

### Screenshot-Erzeugung (reproduzierbar)

Simulator **iPhone 17 Pro Max** liefert nativ 1320 × 2868. Ablauf:

```bash
xcodebuild -project ios/App/App.xcodeproj -scheme App -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,id=<UDID>' build
xcrun simctl install <UDID> <DerivedData>/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch <UDID> de.angstdoc.loewenherz
xcrun simctl io <UDID> screenshot shot.png
```

**Der Simulator-MCP ist unbrauchbar** — er meldet „Xcode is installed but not selected"
und verlangt `sudo xcode-select -s …`, obwohl `xcode-select -p` bereits korrekt auf
`/Applications/Xcode.app/Contents/Developer` zeigt. Die Meldung führt in die Irre.
Eingaben stattdessen über die allgemeine Bildschirmsteuerung des Simulator-Fensters;
Aufnahmen über `simctl` (volle Auflösung statt Fensterskalierung).

**Tipp-Falle:** Schnelles Tippen im Simulator löst den Akzent-Auswahldialog aus
(„Lena" wurde zu „A"). Zeichenweise mit Pausen tippen.

### Falle: Zeichensatz im Beschreibungsfeld

App Store Connect lehnt die Beschreibung mit „Dieses Feld enthält mindestens ein
ungültiges Zeichen" ab, wenn Zeichen außerhalb von **Latin-1** vorkommen. Konkret
abgelehnt wurde der Aufzählungspunkt **•** (U+2022). Umlaute und ß sind unproblematisch.

Der Play-Store-Text enthält Emoji (🧭 🦁 🌙) und Aufzählungspunkte — die müssen für
Apple ersetzt werden. Aktuell stehen dort schlichte Zeilenanfänge ohne Aufzählungs-
zeichen und **Bindestriche statt Gedankenstrichen**. Ob der Gedankenstrich — (U+2014)
wirklich abgelehnt wird, ist **nicht abschließend geprüft**; er wurde vorsorglich mit
ersetzt. Ein späterer Versuch, ihn zurückzuholen, ist möglich.

### Falle: Texteingabe per Automation

Zwei Verhaltensweisen dieser Seite, die Zeit gekostet haben:

1. **Der „Leave site?"-Dialog hängt dauerhaft** — er erscheint auch dann, wenn alles
   gespeichert ist. Er taugt **nicht** als Prüfung, ob gespeichert wurde. Verlässlich
   ist nur: die Seite in einem zweiten Tab frisch laden und die Werte auslesen.
2. **Programmatisches Setzen von `.value` wirkt nicht** (React merkt es nicht) und
   `element.focus()` per JS reicht für `Cmd+A` nicht aus. Nötig ist ein echter
   Mausklick ins Feld, dann `Cmd+A`, dann Tippen. Sonst landen Sonderzeichen als
   Müll am Feldanfang — genau das ist einmal passiert und wurde mitgespeichert.

### Zwei rechtliche Sperren vor der Einreichung (nur Patrick)

Beide standen schon als Warnbanner in App Store Connect, bevor der Eintrag angelegt
wurde. Sie blockieren das **Einreichen**, nicht das Vorbereiten:

1. **Aktualisierter Lizenzvertrag des Apple Developer Program.** Muss vom
   Accountinhaber geprüft und akzeptiert werden — developer.apple.com/account.
   Ohne das lassen sich keine neuen Apps einreichen.
2. **Händlerstatus (Trader Status, EU Digital Services Act).** Ohne Angabe werden Apps
   im EU-App-Store entfernt. Verlangt Name, Anschrift, Telefon, E-Mail des Händlers —
   personenbezogene Rechtsangaben.

## Offene Punkte

- [x] Untertitel entschieden: `Von Verstehen zu Veränderung`
- [ ] Keywords (100 Zeichen) festlegen
- [x] **20.09.2026 — Eigenes Privacy Manifest deklariert die E-Mail-Adresse**
      (`ios/App/App/PrivacyInfo.xcprivacy`): verknüpft, kein Tracking, Zweck
      Developer's Advertising/Marketing — deckungsgleich mit dem Fragebogen oben.
      Benutzer-ID und Produktinteraktion kommen aus den OneSignal-Manifesten.
- [x] **21.09.2026 — Xcode 27 fertig eingerichtet** (`sudo xcodebuild -runFirstLaunch`, „Install
      Succeeded"). Vorher meldete `xcodebuild` „CoreSimulator is out of date", Simulator und
      Geräte waren abgeschaltet, `xcrun simctl` hing. Merker für das nächste Xcode-Update.
- [x] **21.09.2026 — Simulator-Test 1.0.1 (3) ohne Location-Modul bestanden** (iPhone 17,
      iOS 26.5, Push-Zustand im Scratch-Build vorbelegt). Konsole: `initialize` →
      `setLocationShared` → `addListener` → `permissionNative` →
      „[Push] Natives SDK initialisiert, Permission: default". Keine Abstürze.
      **Erwartete Logzeile, kein Fehler:** `ERROR: OneSignalLocation not found. In order to
      use OneSignal's location features the OneSignalLocation module must be added.` — sie
      stammt vom abgesicherten `setShared(false)` und erscheint bei jedem Start. Der Aufruf
      bleibt trotzdem: Vergisst jemand die Umgebungsvariable beim Bauen, ist er das Einzige,
      was „kein Standort" noch garantiert.
- [x] **21.09.2026 — 1.0.1 (3) archiviert und exportiert, komplett über die Kommandozeile**
      (keine Xcode-Oberfläche, keine Schlüsselbund-Abfrage):
      ```bash
      ONESIGNAL_DISABLE_LOCATION=true xcodebuild -project ios/App/App.xcodeproj -scheme App \
        -configuration Release -destination 'generic/platform=iOS' \
        -archivePath ~/Library/Developer/Xcode/Archives/2026-09-21/Loewenherz-1.0.1-3.xcarchive \
        -allowProvisioningUpdates archive
      xcodebuild -exportArchive -archivePath <…>.xcarchive -exportPath <…>-export \
        -exportOptionsPlist ExportOptions.plist -allowProvisioningUpdates
      # ExportOptions: method app-store-connect, destination export (oder upload),
      # signingStyle automatic, teamID 794H5P8UPY, manageAppVersionAndBuildNumber false
      ```
      Das Archiv selbst ist mit *Apple Development* signiert (`aps-environment development`) —
      das ist normal. Erst der Export signiert neu. Geprüft an der IPA: *Apple Distribution:
      Patrick Eberle (794H5P8UPY)*, `aps-environment production`, `get-task-allow false`,
      Version 1.0.1 (3), 11 Frameworks ohne OneSignalLocation, `codesign --verify --deep
      --strict` ok, Privacy Manifest mit E-Mail, sechs Töne. Achtung bei der Gegenprobe:
      `find … -iname "*Location*"` trifft im Archiv die dSYM-Ordner „Relocations" — die sind
      harmlos; maßgeblich ist `ls App.app/Frameworks`.
      IPA: `~/Library/Developer/Xcode/Archives/2026-09-21/Loewenherz-1.0.1-3-export/App.ipa`
      **Am selben Tag neu gebaut** (Build 3 war noch nicht hochgeladen, Nummer bleibt): enthält
      zusätzlich den einmaligen Hinweis am Zahnrad „Hier bestimmst du, wie oft ich mich melde
      und mit welchem Ton." (Commit `8b212ef`). Alle Gegenproben erneut bestanden.
- [x] **21.09.2026, 08:03 — 1.0.1 (3) zu App Store Connect hochgeladen** („Upload succeeded",
      „Uploaded package is processing"). Ebenfalls per Kommandozeile: derselbe
      `-exportArchive`-Aufruf, in der ExportOptions.plist `destination` = `upload` statt
      `export`. Nutzt die in Xcode angemeldete Apple ID, keine Zugangsdaten nötig. Damit
      entfällt der Umweg über Product → Archive und den Organizer komplett.
- [x] **21.09.2026, 08:09 — Version 1.0.1 angelegt, Build 3 gewählt, „Neues in dieser Version"
      eingetragen, ZUR PRÜFUNG EINGEREICHT.** Status: *1.0.1 Warten auf Prüfung*. Apple nennt
      bis zu 48 Stunden, Rückmeldung per E-Mail. Keine Zusatzfragen beim Einreichen.
      Einstellungen: automatische Veröffentlichung nach Freigabe, sofort für alle Nutzer,
      bestehende Bewertung bleibt. In der Build-Liste tragen 1.0 (1) und 1.0 (2) ein
      Warnsymbol, 1.0.1 (3) nicht — die ITMS-90683-Warnung ist weg.
      Eingetragener Text: „Krisenhilfe zeigt jetzt Notruf 112, 116 117 sowie Nummern für
      Österreich und die Schweiz. Kalenderwochen im Verlauf stimmen. Doppel-Tipper zählen nur
      noch einmal. Leisere Erinnerungstöne, und ein kurzer Hinweis zeigt dir, wo du Ton und
      Häufigkeit einstellst. Dazu viele kleine Verbesserungen unter der Haube."
      Weg in App Store Connect: Vertrieb → Plus neben „iOS-App" → Version eingeben → Text →
      Sichern → Build hinzufügen → Sichern → „Zur Prüfung hinzufügen" → im
      Übermittlungsentwurf „Zur Prüfung übermitteln".
- [x] **21.09.2026, 22:27 MESZ — 1.0.1 FREIGEGEBEN UND LIVE.** Prüfung in unter 14 Stunden,
      keine Rückfragen (Submission-ID `3e39e7a8-6a91-4f68-93d7-5d2910cf8983`). Automatische
      Veröffentlichung hat gegriffen; die Lookup-API zeigt Version 1.0.1 mit dem eingetragenen
      Text. Merker: Mit Prüfhistorie läuft die Prüfung deutlich schneller als beim Erstantrag.
- [ ] **Gerätetest mit der Store-Version 1.0.1:** Ton „iOS-Standardton" (Server sendet jetzt
      `ios_sound: default`) und der Zahnrad-Hinweis nach „Ja, erinner mich". Bestandsnutzer
      mit laufenden Erinnerungen sehen den Hinweis einmalig beim ersten Start nach dem Update. 1.0 ist im Store, deshalb
      neue Versionsnummer statt nur Build 3. Enthält: ITMS-90683-Reparatur, Privacy
      Manifest, leisere Töne (drei Commits vom 1.–5.9.), alle Web-Korrekturen aus dem
      Audit (Krisennummern, Escaping, Doppel-Tap, Push-Widerruf …). Vor dem Upload im
      Archiv prüfen: `codesign -d --entitlements :- App.app | grep -A1 aps-environment`
      muss `production` zeigen.
      Vorschlag „Neuheiten in dieser Version" (zur Auswahl, Patrick entscheidet):
      „Krisenhilfe zeigt jetzt Notruf 112, 116 117 sowie Nummern für Österreich und die
      Schweiz. Kalenderwochen im Verlauf stimmen. Doppel-Tipper zählen nur noch einmal.
      Leisere Erinnerungstöne, und ein kurzer Hinweis zeigt dir, wo du Ton und Häufigkeit
      einstellst. Dazu viele kleine Verbesserungen unter der Haube."
- [ ] Screenshots aus dem Simulator erzeugen
- [ ] Archiv bauen und hochladen
- [ ] Disclaimer-Text juristisch prüfen (steht schon als offener Punkt in den
      Play-Notizen — gilt für beide Stores)
