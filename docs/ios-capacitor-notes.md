# iOS-Build (Capacitor) — Fundament, Arbeitsschritte, Architektur

Die iOS-App ist eine Capacitor-8-Hülle mit **gebündelten Web-Assets** — die native App lädt alles lokal aus dem App-Bundle, kein Remote-URL-Wrapper. Eine Quelle der Wahrheit: dasselbe Repo, derselbe Code wie app.angstdoc.de. Bundle-ID **`de.angstdoc.loewenherz`** (identisch zum Android-Paketnamen), Homescreen-Name **`Löwenherz`**. Stand: C1 (Fundament). OneSignal-Push nativ = C2, native Politur (Haptics/Splash/StatusBar) = C3.

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
| `js/push.js` → `ensureOneSignalLoaded()` | Lädt das OneSignal-**Web**-SDK nie (lasttragender Guard; Rückgabe `Promise.resolve(null)`) |
| `js/push.js` → Auto-Load-IIFE, `checkSoftAskAfterReflexion()`, `syncTagsToOneSignal()` | Early-Return — Soft-Ask und Tag-Sync sind C2-Andockpunkte |
| `js/config.js` → `API_BASE` | Nativ `https://app.angstdoc.de`, im Web `''` — beide `fetch`-Aufrufe (`/api/subscribe`, `/api/set-tags`) nutzen sie |

Im Web (`isNative() === false`) ist jeder Pfad funktional identisch zu vorher; `settings.js`/`reflection.js` brauchten keine Änderung, weil alle Aufrufe durch die geguardeten push.js-Funktionen laufen.

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

## Bekannte Einschränkungen (Stand C1 — gewollt)

- **Push nativ: aus.** OneSignal-Web-SDK lädt nie; der Settings-Push-Toggle speichert nur localStorage-Zeiten, bewirkt nativ nichts. C2 bringt `@onesignal/capacitor-plugin`. Merker für C2: Es sind **7 Tags** (`morning_utc`, `evening_utc`, `small_1..5_utc` — nicht 3), und `api/set-tags.js` hat **kein CORS-Handling** (nativ nötig, sobald der Server-Fallback aus der App aufgerufen wird).
- **Datenexport bricht nativ:** `js/data-export.js` nutzt Blob-Download via `<a download>` — funktioniert in WKWebView nicht. Fix in C3 (`@capacitor/filesystem` + `@capacitor/share`).
- **Native App startet bei null:** iOS-PWA-Bestandsdaten (IndexedDB/localStorage aus Safari) werden nicht migriert — bewusste Entscheidung.

## Offene Punkte vor C2/C3

- [ ] Xcode-Lizenz akzeptieren (`sudo xcodebuild -license accept`) + iOS-Simulator-Runtime laden
- [ ] Simulator-Smoke-Test: Offline-Start, Onboarding statt Install-Landing, Reflexion → App-Neustart → Daten da, Konsole ohne SW-/OneSignal-Fehler
- [ ] `tel:`-Links im Krisen-Modal aus WKWebView testen (müssen den Dialer öffnen — kritisch!)
- [ ] Externe Links (`buch.angstdoc.de`, Datenschutz) öffnen in Safari, nicht in der WebView
- [ ] C2: OneSignal-Migration (natives SDK, Tags, Soft-Ask-Ersatz)
- [ ] C3: Splash/StatusBar/Haptics, App-Icon, Datenexport-Fix, App-Store-Connect-Name
