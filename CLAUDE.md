# Löwenherz — Projektanweisungen für Claude

## Chat-Abkürzungen

| Kürzel | Bedeutung |
|--------|-----------|
| **r** | Reflexion aus 4 Perspektiven auf das zuletzt Besprochene. Bei Texten: Varianten vorstellen, nicht direkt einbauen. |
| **r** auf [Datei/Thema] | Reflexion aus 4 passenden Perspektiven auf das genannte Objekt |
| **m** oder **ja** oder **los** | Sofort umsetzen, nicht nochmal nachfragen |

## Autonomie

- **Committen & Pushen: JA** — Eigenständig committen und `git push origin main` ohne nachzufragen. Commit-Messages auf Deutsch, kurz, prägnant.
- **SW-Cache-Version: IMMER hochzählen** nach jeder Änderung an gecachten Dateien. In BEIDEN Dateien: `OneSignalSDKWorker.js` UND `sw.js` → `CACHE_NAME`.
- **Neue Dateien im SW registrieren** — Wenn eine neue JS/CSS/Asset-Datei entsteht, in die `URLS_TO_CACHE`-Liste in BEIDEN SW-Dateien aufnehmen.
- **Testen im Preview** — Nach Code-Änderungen eigenständig den Preview-Server starten und per `preview_eval` verifizieren. Nicht fragen ob getestet werden soll.

## Troubleshooting: "funktioniert nicht"

Wenn Patrick sagt "funktioniert nicht" oder "geht nicht", erst diagnostizieren bevor neuer Code geschrieben wird:

1. **SW-Cache?** — Alte SW-Version im Browser cached? Cache-Version bumpen, pushen, User muss App einmal öffnen + schließen.
2. **Vercel deployed?** — `curl -s https://loewenherz-app.vercel.app/[datei]` → kommt der richtige Content?
3. **Browser-Cache?** — Für neue HTML-Dateien (z.B. install.html): SW fängt Navigation ab und serviert index.html als Fallback. Neue HTML-Dateien vom SW-Fetch ausschließen (`if (url.includes('install.html')) return;`).
4. **IndexedDB Version-Konflikt?** — Anderer Tab hat alte DB-Version offen → `onblocked` Handler.
5. **OneSignal Free Plan** — Max 3 Tags pro Player. Mehr → `"App is limited to a maximum of 3 tags"`.

## Deployment-Checkliste (vor iPhone-Test)

1. `git status` — Keine uncommitteten Änderungen?
2. `git push origin main` — Gepusht?
3. ~30s warten (Vercel-Build)
4. Erst DANN auf iPhone testen

## Projekt-Steckbrief

| Was | Wert |
|-----|------|
| Typ | PWA (Progressive Web App) |
| Stack | Vanilla JS, ES Modules, kein Framework, kein Build-Schritt |
| Hosting | Vercel, Deploy via `git push origin main` |
| Sprache | Deutsch (alle Texte in `content/de.js` im Objekt `TEXTS`) |
| Zielgerät | iPhone (iOS Safari / Standalone PWA), sekundär Android |
| DB | IndexedDB v2 mit In-Memory-Fallback (`js/db.js`) |
| Offline | Service Worker, Cache-First-Strategie |
| Design | Journal Design (warm/hell), Reflexion dunkel, mobile-first |
| Push | OneSignal Web SDK v16, Server-Scheduling via Vercel Functions |

## Architektur

```
index.html                    ← Single Entry Point (App)
install.html                  ← Eigenständige Install-Landing-Page (vom SW ausgeschlossen)
├── css/styles.css             ← Design System (Custom Properties + Animationen)
├── content/de.js              ← Alle Texte (TEXTS-Objekt)
├── js/app.js                  ← Router, Init, Tab-Switching, Coach-Mark
├── js/db.js                   ← IndexedDB v2 (Profile, Points, Reflections, Milestones)
├── js/push.js                 ← OneSignal Init, Tag-Sync (Client + Server-Fallback)
├── js/milestones.js           ← Meilenstein-Engine (21 Achievements, retroaktiver Scan)
├── js/weekly-cards.js         ← Wochen-Card-Engine (Quatschi-Texte, Pause-Collapse, Feed)
├── js/quatschi.js             ← Dynamische Texte, Toast, Dashboard-Kommentare
├── js/screens/
│   ├── dashboard.js           ← Heute-Tab (SMALL-Tracking, Erfolgs-Animation)
│   ├── reflection.js          ← Reflexion-Tab (Morgen + Abend, Zeitfenster-Logik)
│   ├── history.js             ← Verlauf-Tab (Hero "Dein Weg", Wochen-Cards, Quatschi-Level)
│   ├── settings.js            ← Einstellungen (Push-Settings, Zeiten)
│   ├── onboarding.js          ← Ersteinrichtung
│   └── landing.js             ← Installationshinweis (in-app)
├── js/components/
│   ├── bottom-sheet.js        ← Modal-Sheet
│   ├── week-dots.js           ← Wochendots (☀️/🌙/✓ 3-Stufen-System)
│   ├── balance-bar.js         ← SMALL-Balance-Balken
│   └── crisis-modal.js        ← Krisenhilfe-Overlay
├── api/
│   ├── send-notifications.js  ← Vercel Serverless: Cron-Push (alle 15 Min)
│   ├── set-tags.js            ← Vercel Serverless: OneSignal Tags via REST API
│   └── test-push.js           ← Vercel Serverless: Diagnose + Force-Tags
├── OneSignalSDKWorker.js      ← Combined SW: OneSignal + Cache-First (PRIMÄRER SW)
├── sw.js                      ← Backup SW (gleiche Cache-Version halten!)
└── manifest.json              ← PWA-Manifest
```

## Push-Notification Subsystem

| Komponente | Details |
|---|---|
| SDK | OneSignal Web SDK v16, App ID `1aeeca68-13c9-400a-a243-dd749527c49f` |
| Tags | Max 3 (Free Plan!): `morning_utc`, `evening_utc`, `small_enabled` |
| Tag-Sync | Dual: Client (`addTags`) + Server-Fallback (`api/set-tags.js` nach 3s) |
| Scheduling | `api/send-notifications.js`, alle 15 Min per cron-job.org |
| Auth | `CRON_SECRET` (Bearer) für Cron, `ONESIGNAL_API_KEY` (Basic) für OneSignal |
| UTC-Slots | Zeiten auf 15 Min gerundet, in UTC konvertiert für serverseitige Filter |

**Wichtig:** `push_enabled` gibt es NICHT als Tag. Wenn Push deaktiviert → alle Tags löschen (leerer String). Kein Tag = kein Push.

## Meilenstein-Engine

21 Milestones in 3 Kategorien:
- **Premieren (P1-P5):** Erster Punkt, erste Reflexion, beide an einem Tag, alle 5 Buchstaben, erste aktive Woche
- **Kumulativ (K1-K10):** 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000 Punkte
- **Entdeckungen (E1-E6):** Erster 🦁-Mood, 5/10/20/30/52 aktive Wochen

Trigger: Nach jedem SMALL-Tap + jeder Reflexion (async, non-blocking). Retroaktiver Scan beim ersten Load.

## Wochen-Card-Engine

- On-demand aus bestehenden Daten, kein eigener DB-Store
- 5 Quatschi-Level: zero (0), low (1-5), medium (6-15), high (16-30), extreme (30+)
- Deterministische Textauswahl per KW-Hash (kein Math.random, kein Flackern)
- Pause-Collapse: 2+ konsekutive Null-Wochen → eine Pause-Card
- Gundula-Strategie: Erste 4 Wochen extra, danach nur bei zero/pause/firstWeek
- `buildFeed()`: Merged Milestones + Wochen-Cards chronologisch
- Debug: `window.debugWeeklyCards`, `window.debugFeed`

## Charakter-Guide (für Textarbeit)

### Quatschi (der innere Kritiker)
- **Ton:** Sarkastisch, selbstbewusst, beleidigt wenn ignoriert. Nie gemein — eher wie ein Kollege der sich beschwert aber eigentlich harmlos ist.
- **Spricht in der 1. Person** ("Ich hab's genossen") oder über sich in der 3. Person ("Quatschi hat eine Beschwerde eingereicht")
- **Humor-Level:** Trocken, nie Slapstick. Pointen durch Understatement ("Fast ein Kompliment.")
- **Tabu:** Nie bedrohlich, nie abwertend gegenüber dem User. Quatschi ist lästig, nicht toxisch.

### Gundula (die innere Ruhe)
- **Ton:** Still, beobachtend, geduldig. Spricht selten, aber wenn dann zählt es.
- **Spricht in der 3. Person** ("Gundula nickt.", "Gundula wartet geduldig.")
- **Nie belehrend.** Kein "Du solltest..." — eher "Gundula hat das registriert."
- **Funktion:** Gegengewicht zu Quatschi. Wo Quatschi laut ist, ist Gundula leise. Wo Quatschi wertet, beobachtet Gundula.

### Zusammenspiel
- Quatschi redet, Gundula handelt. ("Quatschi findet, das zählt nicht. Gundula sieht das anders.")
- In der App: Quatschi = kursiv/Serif, Gundula = regular/Sans
- Bei Textarbeit: Varianten vorstellen, Patrick entscheidet. Texte nie direkt einbauen ohne Freigabe.

## Code-Konventionen

### JavaScript
- **ES Modules** mit `import`/`export` (kein CommonJS, kein `export default`)
- **Kein Framework**, kein jQuery — reines DOM-API (`createElement`, `querySelector`, `innerHTML`)
- **Async/Await** für DB-Operationen, niemals raw Promises
- **Template-Strings** für HTML-Generierung in `container.innerHTML`
- **Keine neuen Dependencies** — alles vanilla
- **Funktions-Architektur**: Jede Screen-Datei exportiert eine `render*`-Funktion die `(container, profile)` bekommt
- **Try/Catch in async Callbacks** — Unbehandelte Promise-Rejections sind auf iOS Safari lautlos. Alle async Callbacks die nicht awaited werden (z.B. in Event-Listenern) MÜSSEN in try/catch gewrappt werden.
- **Fire-and-forget Pattern**: Milestone-Checks, Tag-Syncs etc. mit `.catch(() => {})` am Ende — nie den Hauptflow blockieren.

### CSS
- **Custom Properties** im `:root` für alle Farben, Radien, Transitions
- **Animations-Properties**: `--anim-fast: 150ms`, `--anim-normal: 250ms`, `--anim-slow: 350ms`, `--anim-stagger: 60ms`, `--ease-out`
- **`prefers-reduced-motion`**: Alle Animationen respektieren diese Media Query
- **Nur `transform` + `opacity` animieren** — GPU-beschleunigt, kein Layout-Reflow
- **Kein CSS-in-JS** — aber inline `style.cssText` ist OK für dynamische Elemente
- **Mobile-first**: `max-width: 480px` auf `#app`, Safe Areas via `env()`
- **Kein `position: fixed` auf dynamisch erstellten Elementen** — iOS Safari bricht das in Flex-Containern

### Texte
- Alle UI-Texte leben in `content/de.js` → `TEXTS`
- Dynamische Texte (Quatschi-Kommentare, Wochen-Texte) in den jeweiligen Modulen
- Platzhalter: `{name}` für Nutzernamen, `[X]` für Zahlen (in Wochen-Texten)
- `{name}`-Ersetzung IMMER als **letzter** Schritt vor der Anzeige

### Service Worker
- **ZWEI SW-Dateien**: `OneSignalSDKWorker.js` (primär, mit OneSignal Import) + `sw.js` (Backup)
- Cache-Version in BEIDEN `CACHE_NAME` hochzählen bei JEDER Änderung
- Neue Dateien in `URLS_TO_CACHE` in BEIDEN Dateien registrieren
- `skipWaiting()` + `clients.claim()` = sofortige Aktivierung
- **install.html vom Fetch ausschließen**: `if (url.includes('install.html')) return;`

## Design System

### Farben (Journal Design — warm, editorial)
- Dashboard: `--bg-page: #f5efe3`, `--bg-paper: #faf6ed`, `--bg-card: #eee7d8`
- Text: `--text-primary: #2c2418`, `--text-body: #4a3f30`, `--text-secondary: #8a7d6a`
- SMALL-Farben: S `#c4793a`, M `#4a9e8e`, A `#9e6d94`, L1 `#b8922e`, L2 `#be5a5a`
- Akzent: `--gold: #b8922e`, `--gold-warm: #d4a843`
- Landing Page: Amber/Gold `#C8A84E` (nicht Teal), Background `#FAF8F4`
- Reflexion (dunkel): `--ref-bg: #1a1714`, `--ref-text: #f5ead6`
- Fonts: Instrument Serif (display/quatschi), DM Sans (UI)

### Typografie-Hierarchie (5 Stufen, nicht mehr)
| Stufe | Größe | Font | Verwendung |
|-------|-------|------|------------|
| Hero | 24px | Serif italic | Quatschi-Text |
| Display | 38px | Serif | Punktezahl |
| Body | 14px | Sans | Gundula-Text, Stats-Labels, alles was gelesen werden soll |
| Small | 11px | Sans | QUATSCHI-Tag, DIESE WOCHE, Wochentage, Button-Labels |
| Nav | 13px | Sans | Bottom-Navigation (Heute / Reflexion / Verlauf) |

Prinzip: Keine Zwischenstufen. Serif für emotionale Texte, Sans für Funktionales.

### Wochendots (3-Stufen-System)
- **Leer:** Grauer Kreis (keine Aktivität)
- **☀️ oder 🌙:** Nur Morgen- oder nur Abendreflexion (leicht amber-getönt)
- **✓ amber:** Beides erledigt (voller Amber-Kreis)
- **Heute:** Gestrichelter Rand
- **Zukunft:** opacity 0.4 (nur auf Verlauf-Tab)
- Konsistent auf Dashboard, Reflexion-Tab und Verlauf-Tab

### SMALL-Buttons
- Farbkreise zeigen **einzelne Buchstaben**: S, M, A, L, L (nicht L₁/L₂)
- Unterscheidung L1/L2 nur über Farbe (Gold vs. Warmrot) und Label darunter
- **Erfolgs-Animation beim Tap:** Gold-Glow (box-shadow pulse) + ✓ Overlay + Stats-Bump

### UI-Prinzipien
- **Journal, nicht Dashboard** — warme Ästhetik, editorial, literarisch-humorvoll
- **Kein Modal für Feedback**: Toasts/Inline-Elemente statt Modals
- **Haptic Feedback**: `navigator.vibrate(15)` bei Taps
- **Dezent**: Halbtransparente Hintergründe, subtile Schatten, keine grellen Farben
- **Reflexion = Dunkel**: `.reflexion-mode` auf `#app` schaltet das gesamte Farbschema um
- **Gundula-Bar**: 4 Zustände basierend auf 7-Tage-Konsistenz (tense/wachsam/ruhig/entspannt)
- **Animationen**: Beruhigend, nie hektisch. Kerzenlicht, nicht Disco. Für Menschen mit Angst.
- **Null-Regel**: Keine Nullen im UI anzeigen. "Alles über null ist Gewinn."

## iOS-Safari Fallstricke (gelernt durch Schmerz)

1. **`position: fixed` bricht in Flex-Containern** — Dynamische Elemente stattdessen im DOM-Flow platzieren (`insertAdjacentElement`)
2. **CSS Transitions auf dynamisch erstellten Elementen** — Klassen-Toggle für `opacity` funktioniert nicht zuverlässig. Inline `style.opacity` verwenden.
3. **Service Worker Cache** — Alte Version wird aggressiv gecacht. IMMER Version hochzählen.
4. **App-Icon** — Wird nur bei Neuinstallation aktualisiert (Homescreen löschen + neu hinzufügen)
5. **`getBoundingClientRect()`** — Kann nach Sheet-Close falsche Werte liefern. Rect VOR DOM-Änderungen capturen.
6. **Neue HTML-Dateien** — SW serviert index.html als Offline-Fallback für Navigation. Neue Seiten (install.html) müssen vom SW-Fetch ausgeschlossen werden.
7. **iOS Safari Compact Mode (ab iOS 26)** — Share-Button nicht mehr sichtbar, steckt hinter ⋯-Menü. Install-Anleitung muss universell sein.

## Git-Konventionen

- **Commit-Messages**: Deutsch, 1-2 Sätze, beschreibend
- **Author**: `loewenherzapp <pe@angstdoc.de>`
- **Branch**: `main` (einziger Branch)
- **Co-Author**: `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
- **Push**: Direkt nach Commit auf `main` pushen

## Test-Workflow

1. Preview-Server starten (`.claude/launch.json` → Port 3456)
2. Per `preview_eval` die App durchklicken (Onboarding überspringen, Dashboard testen)
3. Console-Errors prüfen (`preview_console_logs`)
4. Kritisch: iOS-Safari-Kompatibilität bedenken (kein `position: fixed` auf dynamischen Elementen)

### Testszenarien-Checkliste (nach Feature-Änderungen)

- [ ] Erster App-Start (Onboarding-Flow)
- [ ] Tap auf jeden SMALL-Button (S, M, A, L, L) → Punkt wird gespeichert?
- [ ] Toast erscheint nach Tap?
- [ ] Schneller Doppel-Tap → kein Glitch?
- [ ] Tab-Wechsel (Heute → Reflexion → Verlauf → zurück)
- [ ] Offline-Modus (kein Netzwerk → App funktioniert?)
- [ ] Name mit Sonderzeichen (Umlaute, Emoji)
- [ ] PWA Standalone vs. Safari-Tab
- [ ] Milestone-Check nach Tap (Console: `[Milestone]`)

## IndexedDB-Schema (v2)

| Store | Key | Indexes | Inhalt |
|-------|-----|---------|--------|
| `userProfile` | `id` | — | Name, Einstellungen, Erinnerungen |
| `smallPoints` | `id` (auto) | `date` | Datum, Zeit, Buchstabe (S/M/A/L1/L2), Kategorie |
| `reflections` | `id` (auto) | `date` (unique) | Datum, Mood, Helped, Gratitude |
| `milestones` | `id` (z.B. "P1") | — | type, date, retroactive, seen |

**localStorage-Keys:**
- `morningReflection_YYYY-MM-DD` — Morgenreflexion-Daten (completed, intention, customText)
- `smallPointsTotal` — Kumulative Punktezahl (Cache, bei Start aus DB initialisiert)
- `hasSeenInfo` — Coach-Mark Tooltip dismissed
- `loewenherz_push_enabled/morning_time/evening_time/small_reminders` — Push-Settings

## SMALL-Framework

| Buchstabe | Bedeutung | Beispiel-Kategorien |
|-----------|-----------|---------------------|
| S | Selbstfürsorge | Wasser, Schlaf, Bewegung, Essen |
| M | Meta-Intervention | Quatschi bemerkt, Autopilot unterbrochen |
| A | Affekt-Wahrnehmung | Gefühl benannt, Emotion erkannt |
| L₁ | Löwenherz (Mut) | Vermeidung durchbrochen, Schritt gewagt |
| L₂ | Liebevoller Umgang | Selbstmitgefühl, Grenze gesetzt |
