# Play-Store-Readiness (TWA) — Audit-Notizen

Begleitend zu Prompt B1. Package Name: **`de.angstdoc.loewenherz`**.
Fingerprint-Nachtrag: siehe [assetlinks-update.md](assetlinks-update.md).

## Install-Hinweise im Standalone-Kontext (Task 3)

**Geprüft — bereits korrekt, kein Umbau nötig.**

Die einzige Install-Anleitung der App ist die Landing-Page
(`js/screens/landing.js`, „Zum Homescreen hinzufügen", iOS/Android-Schritte).
Sie wird in `js/app.js` ausschließlich für **Neu-User außerhalb des
Standalone-Modus** gerendert:

```js
if (!profile || !profile.onboardingComplete) {
  if (!isStandalone()) {   // app.js
    showLanding();         // Install-Anleitung
  } else {
    showOnboarding();      // im TWA/Standalone direkt ins Onboarding
  }
}
```

`isStandalone()` prüft `display-mode: standalone` **und** `navigator.standalone`.
In der TWA (Standalone) erscheint die Install-Anleitung also nie. Es gibt kein
`beforeinstallprompt`-Banner in der App selbst — der einzige `beforeinstallprompt`-
Handler liegt in der separaten Seite `install.html`, die außerhalb der App-Shell
läuft und nicht gecacht wird.

> Ergänzung B1: Die `android-app://`-Referrer-Erkennung aus dem Prompt ist hier nicht
> nötig, weil die TWA über `display-mode: standalone` zuverlässig erkannt wird. Die
> bestehende Logik deckt den Fall ab.

## Offline-Verhalten (Task 6)

**Geprüft (Code-Review von `sw.js` / `OneSignalSDKWorker.js`, Cache `loewenherz-v85`) — funktioniert.**

- **Precache:** `install`-Event cached die komplette App-Shell: `./`, `index.html`,
  `manifest.json`, `css/styles.css`, alle JS-Module (inkl. neu `js/config.js`),
  `content/de.js`, Icons, Gundula-Bilder und Fonts.
- **Fetch-Strategie:** Cache-First mit Netzwerk-Fallback. Für `navigate`-Requests
  gibt es einen expliziten Offline-Fallback auf `./index.html` → **kein weißer Screen**
  beim Offline-Start nach dem ersten Besuch.
- **Bewusst nicht gecacht:** `install.html`, `confirmed.html` (immer Netzwerk).
- **`/.well-known/assetlinks.json`** ist NICHT im Precache (wird extern von
  Google/Android abgerufen, läuft am Service Worker vorbei).

Cache-Strategie wurde **nicht** umgebaut (Constraint B1).

## Manifest-Shortcuts (Task 7 — optional)

**Übersprungen.** Grund: Die App hat kein Routing, das einen Direkteinstieg in die
Reflexion über einen Query-Parameter erlaubt. Der Reflexions-Tab wird über
`switchTab()` gesteuert und der Modus (Morgen/Abend) wird intern bestimmt — ein
`?shortcut=morgen|abend` würde App-Logik-Umbau erfordern (Param-Parsing nach
App-Init + erzwungener Modus-Wechsel). Laut B1 in diesem Fall weglassen.
Nachrüstbar, sobald ein solcher Einstieg ohnehin gebaut wird.

## Datenschutz-URL (Task 5)

Kanonische URL: **`https://app.angstdoc.de/datenschutz`**
(Konstante `PRIVACY_URL` in `js/config.js`).

- Öffentliche Seite: `datenschutz.html` → via Rewrite in `vercel.json` unter
  `/datenschutz` erreichbar (kein PDF, indexierbar).
- In-App: identischer Inhalt im Modal (`LEGAL_CONTENT.datenschutz` in
  `js/screens/settings.js`), mit „Online"-Link auf die kanonische URL.
- `confirmed.html` (E-Mail-DOI-Landing) verlinkt ebenfalls auf diese URL.
- **Diese URL in der Play Console eintragen.**
- ⚠️ Wartung: Bei Inhaltsänderungen `datenschutz.html` und das In-App-Modal
  synchron halten (kein Build-Schritt im Repo, der das automatisch tut).

## Offene Punkte vor Launch

- [ ] SHA-256-Fingerprint in `assetlinks.json` nachtragen (nach Play-Console-Upload)
- [ ] Finales Designer-Icon gegen das provisorische maskable Icon tauschen
- [ ] Disclaimer-Text juristisch prüfen lassen (aktuell Entwurf)
- [ ] `PRIVACY_URL` in der Play Console hinterlegen
