# Löwenherz — Projektanweisungen für Claude

## Chat-Abkürzungen

| Kürzel | Bedeutung |
|--------|-----------|
| **r** auf [Datei/Thema] | Reflexion aus 4 passenden Perspektiven auf das genannte Objekt |

## Autonomie

- **Committen & Pushen: JA** — Eigenständig committen und `git push origin main` ohne nachzufragen. Commit-Messages auf Deutsch, kurz, prägnant.
- **SW-Cache-Version: IMMER hochzählen** nach jeder Änderung an gecachten Dateien (`sw.js` → `CACHE_NAME`).
- **Neue Dateien im SW registrieren** — Wenn eine neue JS/CSS/Asset-Datei entsteht, in die `urlsToCache`-Liste in `sw.js` aufnehmen.
- **Testen im Preview** — Nach Code-Änderungen eigenständig den Preview-Server starten und per `preview_eval` verifizieren. Nicht fragen ob getestet werden soll.

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
| DB | IndexedDB mit In-Memory-Fallback (`js/db.js`) |
| Offline | Service Worker, Cache-First-Strategie |
| Design | Dark Theme, mobile-first, Daumen-optimiert |

## Architektur

```
index.html                    ← Single Entry Point
├── css/styles.css             ← Design System (Custom Properties)
├── content/de.js              ← Alle Texte (TEXTS-Objekt)
├── js/app.js                  ← Router, Init, Tab-Switching
├── js/db.js                   ← IndexedDB-Layer (Profile, Points, Reflections)
├── js/quatschi.js             ← Dynamische Texte, Toast, Notifications
├── js/screens/
│   ├── dashboard.js           ← Heute-Tab (SMALL-Tracking)
│   ├── reflection.js          ← Reflexion-Tab (Abendritual)
│   ├── history.js             ← Verlauf-Tab (Wochen/Monate)
│   ├── settings.js            ← Einstellungen
│   ├── onboarding.js          ← Ersteinrichtung
│   └── landing.js             ← Installationshinweis
├── js/components/
│   ├── bottom-sheet.js        ← Modal-Sheet
│   ├── week-dots.js           ← Wochenkalender-Punkte
│   ├── balance-bar.js         ← SMALL-Balance-Balken
│   └── crisis-modal.js        ← Krisenhilfe-Overlay
├── sw.js                      ← Service Worker
└── manifest.json              ← PWA-Manifest
```

## Code-Konventionen

### JavaScript
- **ES Modules** mit `import`/`export` (kein CommonJS, kein `export default`)
- **Kein Framework**, kein jQuery — reines DOM-API (`createElement`, `querySelector`, `innerHTML`)
- **Async/Await** für DB-Operationen, niemals raw Promises
- **Template-Strings** für HTML-Generierung in `container.innerHTML`
- **Keine neuen Dependencies** — alles vanilla
- **Funktions-Architektur**: Jede Screen-Datei exportiert eine `render*`-Funktion die `(container, profile)` bekommt
- **Try/Catch in async Callbacks** — Unbehandelte Promise-Rejections sind auf iOS Safari lautlos. Alle async Callbacks die nicht awaited werden (z.B. in Event-Listenern) MÜSSEN in try/catch gewrappt werden.

### CSS
- **Custom Properties** im `:root` für alle Farben, Radien, Transitions
- **Kein CSS-in-JS** — aber inline `style.cssText` ist OK für dynamische Elemente (iOS-kompatibler als Klassen-Toggle)
- **Mobile-first**: `max-width: 480px` auf `#app`, Safe Areas via `env()`
- **Kein `position: fixed` auf dynamisch erstellten Elementen** — iOS Safari bricht das in Flex-Containern. Stattdessen Elemente im DOM-Flow einfügen.

### Texte
- Alle UI-Texte leben in `content/de.js` → `TEXTS`
- Platzhalter: `{name}` für Nutzernamen, `{n}` für Zahlen
- `{name}`-Ersetzung IMMER als **letzter** Schritt vor der Anzeige
- Template-Strings (MIT Platzhalter) im localStorage speichern, nicht gerenderte Texte

### Service Worker
- Cache-Version in `CACHE_NAME` hochzählen bei JEDER Änderung
- Neue Dateien in `urlsToCache` registrieren
- `skipWaiting()` + `clients.claim()` = sofortige Aktivierung

## Design System

### Farben
- Hintergrund: `#1C1917` (primary), `#292524` (card)
- Text: `#E7E5E4` (primary), `#A8A29E` (secondary)
- Akzent: `#E2B714` (Gold/Löwe), `#F59E0B` (Amber)
- Moods: drowned `#3B6EB5`, tough `#7B8BA3`, okay `#C4A94D`, good `#D97706`, lion `#E2B714`

### UI-Prinzipien
- **Daumen-Zone**: Interaktive Elemente im unteren 60% des Screens
- **Kein Modal für Feedback**: Toasts/Inline-Elemente statt Modals
- **Haptic Feedback**: `navigator.vibrate(50)` bei Taps
- **Dezent**: Halbtransparente Hintergründe, subtile Schatten, keine grellen Farben
- **Keine subtilen Animationen** — iOS Safari rendert CSS-Transitions auf dynamischen Elementen unzuverlässig. Lieber sofort sichtbar + Fade-out beim Entfernen. Einfachheit > Eleganz.

## iOS-Safari Fallstricke (gelernt durch Schmerz)

1. **`position: fixed` bricht in Flex-Containern** — Dynamische Elemente stattdessen im DOM-Flow platzieren (`insertAdjacentElement`)
2. **CSS Transitions auf dynamisch erstellten Elementen** — Klassen-Toggle für `opacity` funktioniert nicht zuverlässig. Inline `style.opacity` verwenden.
3. **Service Worker Cache** — Alte Version wird aggressiv gecacht. IMMER Version hochzählen.
4. **App-Icon** — Wird nur bei Neuinstallation aktualisiert (Homescreen löschen + neu hinzufügen)
5. **`getBoundingClientRect()`** — Kann nach Sheet-Close falsche Werte liefern. Rect VOR DOM-Änderungen capturen.

## Git-Konventionen

- **Commit-Messages**: Deutsch, Präfix (`Feature:`, `Fix:`, `Refactor:`), 1-2 Sätze
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
- [ ] Tap auf jeden SMALL-Button (S, M, A, L₁, L₂) → Punkt wird gespeichert?
- [ ] Toast erscheint nach Tap? (Milestone bei Punkt 1, 5, 10)
- [ ] Schneller Doppel-Tap → kein Glitch?
- [ ] Tab-Wechsel (Heute → Reflexion → Verlauf → zurück)
- [ ] Offline-Modus (kein Netzwerk → App funktioniert?)
- [ ] Name mit Sonderzeichen (Umlaute, Emoji)
- [ ] PWA Standalone vs. Safari-Tab

## IndexedDB-Schema

| Store | Key | Indexes | Inhalt |
|-------|-----|---------|--------|
| `userProfile` | `id` | — | Name, Einstellungen, Erinnerungen |
| `smallPoints` | `id` (auto) | `date` | Datum, Zeit, Buchstabe (S/M/A/L1/L2), Kategorie |
| `reflections` | `id` (auto) | `date` (unique) | Datum, Mood, Helped, Gratitude |

## SMALL-Framework

| Buchstabe | Bedeutung | Beispiel-Kategorien |
|-----------|-----------|---------------------|
| S | Selbstfürsorge | Wasser, Schlaf, Bewegung, Essen |
| M | Meta-Intervention | Quatschi bemerkt, Autopilot unterbrochen |
| A | Affekt-Wahrnehmung | Gefühl benannt, Emotion erkannt |
| L₁ | Löwenherz (Mut) | Vermeidung durchbrochen, Schritt gewagt |
| L₂ | Liebevoller Umgang | Selbstmitgefühl, Grenze gesetzt |
