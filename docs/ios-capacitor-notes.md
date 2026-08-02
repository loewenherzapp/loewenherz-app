# iOS-Build (Capacitor) — Fundament, Arbeitsschritte, Architektur

Die iOS-App ist eine Capacitor-8-Hülle mit **gebündelten Web-Assets** — die native App lädt alles lokal aus dem App-Bundle, kein Remote-URL-Wrapper. Eine Quelle der Wahrheit: dasselbe Repo, derselbe Code wie app.angstdoc.de. Bundle-ID **`de.angstdoc.loewenherz`** (identisch zum Android-Paketnamen), Homescreen-Name **`Löwenherz`**. Stand: **C2** (Fundament + nativer Push). Native Politur (Haptics/Splash/StatusBar) = C3.

Verwandte Dokumente: [play-store-launch-notes.md](play-store-launch-notes.md) (Android/TWA), [store-readiness.md](store-readiness.md), [../scripts/build-ios.mjs](../scripts/build-ios.mjs).

---

## a) Build-Flow

```bash
npm run build:ios    # kopiert Web-Assets nach www/ + npx cap sync ios
npx cap open ios     # öffnet ios/App/App.xcodeproj in Xcode → Simulator-Build
```

Erwartung: `[build-ios] OK — ~48 Dateien in www/`, danach `Sync finished`.

- **Nach jeder Code-Änderung**, die auch nativ landen soll: `npm run build:ios` erneut ausführen (kein Watch-Mode — bewusst simpel).
- Voraussetzung fürs Bauen: **Xcode 26+** mit akzeptierter Lizenz (`sudo xcodebuild -license accept`). `cap sync` selbst läuft auch ohne Xcode.
- **Paketmanager: SPM** (Swift Package Manager, Capacitor-8-Default), nicht CocoaPods. Grund: CocoaPods ist seit 2024 im Maintenance-Mode, das OneSignal-Capacitor-Plugin (`@onesignal/capacitor-plugin`, für C2) unterstützt SPM. CocoaPods 1.17 ist via Homebrew installiert, falls je ein Plugin es braucht — Umstieg wäre `npx cap add ios --packagemanager Cocoapods` in frischem `ios/`.

## b) Konditionale Web/Native-Logik

**Eine** Detection-Quelle: [`js/platform.js`](../js/platform.js) → `isNative()`. `window.Capacitor` darf nirgendwo sonst abgefragt werden (Grep-Check: einziger Treffer ist platform.js).

| Stelle | Verhalten nativ |
|---|---|
| `index.html` (Inline-Modul) | Keine SW-Registrierung, kein Vercel-Insights-Script |
| `js/app.js` → `isStandalone()` | `true` → Neu-User landen im Onboarding, nie auf der PWA-Install-Landing |
| `js/push.js` → `ensureOneSignalLoaded()` | Lädt statt des **Web**-SDKs den nativen Adapter `js/push-native.js` (seit C2) |
| `js/push.js` → Auto-Load-IIFE, `checkSoftAskAfterReflexion()`, `syncTagsToOneSignal()`, `requestPushPermission()`, `getPermissionState()` | Plattform-Zweig statt Early-Return — Details in [Abschnitt f](#f-push-nativ-c2) |
| `js/config.js` → `API_BASE` | Nativ `https://app.angstdoc.de`, im Web `''` — beide `fetch`-Aufrufe (`/api/subscribe`, `/api/set-tags`) nutzen sie |

Im Web (`isNative() === false`) ist jeder Pfad funktional identisch zu vorher; `reflection.js` brauchte keine Änderung, weil alle Aufrufe durch die verzweigenden push.js-Funktionen laufen. `settings.js` liest den Permission-Status seit C2 über `getPermissionState()` statt direkt über `Notification.permission` — im Web derselbe Wert.

## c) Warum kein Service Worker in der nativen App

WKWebView (Capacitor-iOS) **unterstützt keine Service Worker** — und braucht auch keinen: Die Assets liegen im App-Bundle, offline ist der Normalfall. Deshalb sind `sw.js` und `OneSignalSDKWorker.js` **bewusst nicht im Bundle**: Würde je Code versuchen, sie zu registrieren, schlägt das laut fehl (404) statt einen Geister-SW zu installieren. Kein nativer Code darf auf eine SW-Registration warten.

Fürs **Web gilt weiter** die Doppel-Regel aus CLAUDE.md: Cache-Version bei jeder Änderung in **beiden** SW-Dateien hochzählen, neue Client-Dateien in **beide** `URLS_TO_CACHE` (so kam `js/platform.js` mit v88 hinein).

## d) Bundle-Inhalt (Allowlist)

`scripts/build-ios.mjs` kopiert **nur**: `index.html`, `manifest.json`, `css/`, `js/`, `content/`, `assets/`. Alles andere bleibt draußen (u.a. `api/`, `docs/`, `.well-known/`, `ios/`, `install.html`, `confirmed.html`, `datenschutz.html`, `preview-*.html`, beide SW-Dateien, Config-Dateien). Allowlist statt Ausschlussliste: neuer Root-Junk kann nie versehentlich ins Bundle rutschen; das Script bricht laut ab, wenn eine Quelle fehlt oder Verbotenes in `www/` auftaucht. `manifest.json` bleibt im Bundle (index.html verlinkt es — erspart einen 404; nativ sonst wirkungslos). `www/` ist gitignored.

## e) Vercel-Abschirmung

Das Repo hat jetzt `package.json` + `ios/` — beides darf den Web-Deploy nicht verändern:

- **`.vercelignore`** hält `ios/`, `www/`, `node_modules/`, `scripts/`, `package.json`, `package-lock.json`, `capacitor.config.json`, `.gitattributes` aus dem Deployment (nichts davon öffentlich abrufbar).
- **`vercel.json` → `"installCommand": ""`** überspringt `npm install` beim Deploy — Pipeline byte-identisch zu vorher. ⚠️ Falls `api/`-Functions je npm-Dependencies bekommen, muss diese Zeile raus.

Prüf-Kommando nach Deploys:

```bash
curl -s -o /dev/null -w '%{http_code}' https://app.angstdoc.de/package.json
```

Erwartung: **404** (ebenso `ios/App/App/Info.plist`, `capacitor.config.json`).

## f) Push nativ (C2)

Push läuft über **eine** OneSignal-App-ID für alle Plattformen (`ONESIGNAL_APP_ID` in [`js/config.js`](../js/config.js), von Web- und Nativ-Pfad geteilt). iOS ist im OneSignal-Dashboard nur eine zusätzliche Plattform derselben App. **Der Server filtert weiter nach denselben Tags und erreicht damit Web- UND iOS-Subscriptions** — `api/send-notifications.js`, das Cron-Setup und Brevo blieben unangetastet (einzige Ausnahme: `web_url`, siehe unten).

**Die Facade.** `js/push.js` kapselt beide Plattformen und verzweigt intern nach `isNative()`; `js/push-native.js` ist der Adapter fürs `@onesignal/capacitor-plugin`. Außerhalb dieser beiden Dateien gibt es **keinen** direkten OneSignal- oder `Notification.`-Zugriff mehr (Grep-Probe).

| Funktion | Web | Nativ |
|---|---|---|
| Init | Web SDK v16 vom CDN, lazy | `OneSignal.initialize(ONESIGNAL_APP_ID)` |
| Permission anfragen | `OneSignal.Slidedown.promptPush()` | `Notifications.requestPermission(false)` |
| Permission lesen | `Notification.permission` | `permissionNative()`, gecacht für synchronen Zugriff |
| Tags setzen | `User.addTags()` + Server-Fallback | `User.addTags()` / `removeTags()` |

**Tags sind formatidentisch — per Konstruktion.** `roundTo15Min()`, `localTimeToUTC()` und `buildTags()` leben in `js/push.js`; der native Pfad bekommt das **fertige** Objekt übergeben und rechnet nichts nach. Kein Duplikat, das auseinanderlaufen könnte. Einziger Unterschied: leere Werte gehen nativ als `removeTags()` raus statt als `addTags('')` — das Web-SDK behandelt `''` als Löschen, das native würde den leeren String schreiben. Für den Server-Filter gleichwertig, im Dashboard nur so identisch.

**Kein `api/set-tags.js` nativ.** Der Endpunkt hat kein CORS-Handling und ist aus `capacitor://localhost` nicht erreichbar. Der native Pfad schreibt ausschließlich übers SDK — der Server-Doppelschreiber des Web-Pfads entfällt dort bewusst.

**DSGVO: gleiches Lazy-Gate wie im Web.** `initialize()` läuft **nicht** beim App-Start, sondern erst bei Zustimmung im Soft-Ask bzw. für Bestandsuser mit aktivem Push. Vor der Einwilligung fließt nichts an OneSignal — dieselbe Zusage wie im Web, die Datenschutzerklärung bleibt gültig. Bewusste Abweichung von der OneSignal-Standardempfehlung („init beim App-Start").

**Soft-Ask: gleiche UI, gleiche localStorage-Keys.** Ablauf nativ: unser Overlay → erst bei „Ja, gern" `requestPermission(false)` → Apple-System-Dialog. „Später" ⇒ gar kein System-Dialog. ⚠️ **Der Apple-Dialog ist ein One-Shot.** Lehnt der User dort ab, wird nie wieder gefragt: kein Nag-Screen, und das `false` unterdrückt bewusst auch den automatischen Sprung in die iOS-Einstellungen (V1).

**Foreground: unterdrückt.** `addEventListener('foregroundWillDisplay', e => e.preventDefault())`. Grund: Es sind Reminder („öffne die App"). Wer die App gerade offen hat, braucht den Reminder nicht — ein Banner über der offenen App wirkt kaputt. `preventDefault()` muss **synchron** im Listener fallen; das Plugin ruft direkt danach `proceedWithWillDisplay()`.

**Notification-Click: nur App öffnen.** Kein Deep-Link, kein Routing nach Typ (V1), deshalb auch kein `click`-Listener. Dafür war **eine** Server-Zeile nötig: `url:` → `web_url:` in `api/send-notifications.js`. `url` gilt laut OneSignal-Doku für *alle* Plattformen und wäre auf iOS die Launch-URL — der Tap hätte die Website geöffnet statt der App. `web_url` zielt nur auf Web-Push; das Web-Verhalten ist unverändert.

**Vendor-Bundling — die einzige Nicht-Repo-Datei im Bundle.** Die App hat keinen Bundler, ein Capacitor-Plugin braucht aber `registerPlugin` aus `@capacitor/core`. Der native Bridge-Inject (`native-bridge.js`) liefert nur `isNativePlatform`/`Plugins`, **nicht** `registerPlugin` — ohne `@capacitor/core` im Web-Layer ist kein Plugin ansprechbar. Deshalb erzeugt `scripts/build-ios.mjs` beim Build `www/js/vendor/`:

| Datei | Quelle | Transform |
|---|---|---|
| `capacitor-core.js` | `@capacitor/core/dist/index.js` | keine (self-contained ESM) |
| `onesignal.js` | `@onesignal/capacitor-plugin/dist/index.js` | der eine Bare-Import `from "@capacitor/core"` → `from "./capacitor-core.js"` |

Trifft der Replace nicht **exakt einmal**, bricht der Build laut ab statt still ein kaputtes Bundle auszuliefern. Konsequenz: `js/` und `www/js/` sind **nicht mehr byte-identisch** — `js/vendor/` existiert nur in `www/`, nicht im Repo, nicht auf Vercel, nicht im SW-Precache. Der Web-Pfad lädt es nie (der dynamische Import steckt hinter dem `isNative()`-Zweig).

**Zeitzonen-Drift — und warum der Fix gerade nativ nötig war.** Die Tags speichern absolute UTC-Zeiten, gerechnet mit dem Offset vom Tag des Schreibens. „07:00 Ortszeit" ist im Sommer `"05:00"`, im Winter `"06:00"`. Nach einer Zeitumstellung feuert der Server weiter zur alten UTC-Zeit — der Morgen-Reminder käme im Herbst **eine Stunde zu früh**. Beim App-**Start** werden die Tags ohnehin neu geschrieben, das Problem heilt sich also beim Kaltstart. Die Lücke ist iOS-spezifisch: Dort werden Apps **suspendiert statt beendet**, der WKWebView bleibt im Speicher und `js/push.js` wird beim Zurückholen aus dem Hintergrund **nicht neu ausgewertet**. Wer nie kalt startet, bekäme nie einen Re-Sync.

Deshalb merkt sich `syncTagsToOneSignal()` den verwendeten Offset in `loewenherz_tz_offset`, und ein `visibilitychange`-Listener schreibt die Tags neu, sobald er abweicht. Deckt Zeitumstellung **und** Reisen ab, mit einem Listener für beide Plattformen — `@capacitor/app` wäre dafür nicht nötig. Der Listener sitzt bewusst in `push.js` statt in `app.js` (wo sonst globale Listener liegen): Er braucht weder DOM noch Tab-Zustand, und `app.js` soll nichts von Zeitzonen wissen. Der Key ist abgeleiteter Zustand und deshalb **nicht** im Backup (`js/data-export.js`) — ein Import würde sonst den Offset des Quellgeräts wiederherstellen.

⚠️ **Bewusst offen:** Wer die App über die Umstellung hinweg gar nicht öffnet, bekommt seinen nächsten Reminder trotzdem eine Stunde verschoben. Das ließe sich nur serverseitig lösen (Ortszeit + Offset als Tags, Auflösung im Server) — das Migrationsrisiko an einer lebenden Subscriber-Basis wiegt schwerer als ein bis zwei verschobene Reminder pro Jahr. Neu bewerten, falls die App nennenswert außerhalb der DACH-Zeitzone genutzt wird.

**Doppel-Subscriptions.** iOS-User, die vorher die PWA mit Web-Push hatten, existieren nach dem Wechsel **doppelt**: alte Safari-Web-Subscription plus neue iOS-Subscription. Beide tragen dieselben Tags, beide bekommen den Reminder — je nachdem, ob die PWA noch installiert ist, sieht der User ihn also unter Umständen zweimal. Kosmetisch, kein Fix geplant. Wichtig fürs Lesen der OneSignal-Statistiken: Subscription-Zahlen sind ab jetzt **keine** User-Zahlen.

**Keine Notification Service Extension (V1).** Simple Text-Reminder brauchen keine NSE. Was sie später brächte: Rich Media (Bilder/Audio im Push), **Confirmed Delivery** (echte Zustellraten statt nur „gesendet") und serverseitig gesteuerte Badge-Zahlen. Nachrüstbar als separates Xcode-Target ohne jede Änderung am Client-Code — die Entscheidung ist also folgenlos umkehrbar.

**Manuell in Xcode (macht Patrick, nicht das Skript):** App-Target → Signing & Capabilities → **Push Notifications** + **Background Modes → Remote notifications**. Ein Signing-Team ist noch nicht gesetzt. Dazu im OneSignal-Dashboard: iOS-Plattform zur bestehenden App hinzufügen und den APNs-Key (.p8) hinterlegen.

## Bekannte Einschränkungen (Stand C2 — gewollt)

- **Datenexport bricht nativ:** `js/data-export.js` nutzt Blob-Download via `<a download>` — funktioniert in WKWebView nicht. Fix in C3 (`@capacitor/filesystem` + `@capacitor/share`).
- **Native App startet bei null:** iOS-PWA-Bestandsdaten (IndexedDB/localStorage aus Safari) werden nicht migriert — bewusste Entscheidung.

## Simulator-Smoke-Test — Ergebnis 02.08.2026 (iPhone 17, iOS 26.5)

Erledigt und bestanden:

- [x] Xcode 26.6 + Lizenz; Simulator-Runtime via `xcodebuild -downloadPlatform iOS` (8,5 GB, separat seit Xcode 26)
- [x] Build erfolgreich (`App.xcodeproj`, Scheme `App`; Erstbuild ~24 Min wegen Capacitor-SPM-Kompilierung)
- [x] Start ins **Onboarding**, nicht in die Install-Landing → `isNative()`-Guard in `isStandalone()` greift
- [x] **Null** Service-Worker-Registrierungen (`Library/Caches/…/WebKit/ServiceWorkers` leer), **kein** CacheStorage
- [x] **Null** Netzwerk-Requests an app.angstdoc.de / cdn.onesignal.com / `_vercel/insights`; WebKit-NetworkCache enthält nur die 8-Byte-`salt`-Systemdatei → Assets kommen vollständig aus dem Bundle
- [x] IndexedDB `loewenherz-db` mit korrektem Schema (`userProfile`, `smallPoints`, `reflections`, `milestones`)
- [x] E-Mail-Gate erscheint, „Erstmal ohne" setzt `emailGateSeen`/`emailGateComplete`/`emailSkipped`
- [x] Persistenz über App-Neustart: Profil, SMALL-Punkte, Milestones, Morgen-Intention alle erhalten

Nützlich fürs nächste Mal: Die **Morgen-Intention liegt in localStorage** (`morningReflection_<datum>`, `reflection.js:59`), die **Abend-Reflexion in IndexedDB** (`saveReflection()`, `reflection.js:508`) — ein leerer `reflections`-Store nach einer Morgen-Reflexion ist also korrekt, kein Bug.

Verifikation ohne Xcode-GUI (praktisch für Regressionstests):

```bash
xcrun simctl launch booted de.angstdoc.loewenherz
xcrun simctl io booted screenshot /tmp/shot.png
```

Datenstand direkt lesbar unter `~/Library/Developer/CoreSimulator/Devices/<UDID>/data/Containers/Data/Application/<APP-UUID>/Library/WebKit/de.angstdoc.loewenherz/WebsiteData/` (IndexedDB + localStorage als SQLite).

## Offene Punkte vor C3

- [x] C2: OneSignal-Migration (natives SDK, Tags, Soft-Ask) — Code steht, siehe Abschnitt f
- [ ] C2-Gerätetest (echtes iPhone, APNs-Key + Xcode-Capabilities Voraussetzung): Soft-Ask vor Apple-Dialog, iOS-Subscription im Dashboard, 7 Tags mit **denselben Wertformaten wie eine Web-Subscription** (direkt vergleichen), Test-Push im Hintergrund, kein Banner im Vordergrund, Zeitänderung aktualisiert den Tag
- [ ] C2-Cron-Realtest: Erinnerungszeit auf +20 min, App schließen, warten — kommt der Reminder über die bestehende Server-Route an, ist die Kette Server → OneSignal → APNs → Gerät komplett
- [ ] `tel:`-Links im Krisen-Modal aus WKWebView testen (müssen den Dialer öffnen — kritisch!)
- [ ] Externe Links (`buch.angstdoc.de`, Datenschutz) öffnen in Safari, nicht in der WebView
- [ ] C3: Splash/StatusBar/Haptics, App-Icon, Datenexport-Fix, App-Store-Connect-Name
