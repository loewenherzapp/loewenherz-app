# Löwenherz — Projektanweisungen für Claude

## Memory-System

Claude hat ein persistentes Memory unter `~/.claude/projects/C--ClaudeCode/memory/`. Bei Session-Start relevante Memories lesen. Nach jedem Durchgang reflektieren: Gibt es neue Learnings die in Memory oder CLAUDE.md gehören? Wenn ja: eigenständig eintragen.

## Chat-Abkürzungen

| Kürzel | Bedeutung |
|--------|-----------|
| **i** | Interview-Modus: Interviewe mich — frag alles was du brauchst, bevor du planst. |
| **r** | Reflexion aus 4 Perspektiven auf das zuletzt Besprochene. Bei Texten: Varianten vorstellen, nicht direkt einbauen. |
| **r** auf [Datei/Thema] | Reflexion aus 4 passenden Perspektiven auf das genannte Objekt |
| **m** oder **ja** oder **los** | Sofort umsetzen, nicht nochmal nachfragen |

## Arbeitsweise

- **Planen vor Umsetzen** — Bei nicht-trivialen Tasks erst Plan erstellen und Freigabe holen. Proaktiv mitdenken, Rückfragen stellen, Patricks Vorgaben auch hinterfragen wenn es das Ergebnis verbessert.
- **Prompts erst reflektieren, dann umsetzen** — Architektur-Fit, potentielle Probleme, Optimierungen prüfen. Nicht blind abarbeiten.
- **Textarbeit: Varianten vorstellen** — Bei Quatschi/Gundula-Texten oder UI-Copy: Optionen zeigen, Patrick entscheidet. Nie direkt einbauen ohne Freigabe.

## Autonomie

- **Committen & Pushen: JA** — Eigenständig `git add` + `git commit` + `git push origin main` ohne nachzufragen. Commit-Messages auf Deutsch, kurz, prägnant.
- **SW-Cache-Version: IMMER hochzählen** nach jeder Änderung. In BEIDEN Dateien: `OneSignalSDKWorker.js` UND `sw.js` → `CACHE_NAME`.
- **Neue Dateien im SW registrieren** — `URLS_TO_CACHE`-Liste in BEIDEN SW-Dateien.
- **Testen im Preview** — Nach Code-Änderungen eigenständig Preview starten und verifizieren.

## Troubleshooting: "funktioniert nicht"

Erst diagnostizieren, nicht blind neuen Code schreiben:

1. **SW-Cache?** — Cache-Version bumpen, pushen, App öffnen + schließen.
2. **Vercel deployed?** — `curl -s https://loewenherz-app.vercel.app/[datei]` prüfen.
3. **Browser-Cache?** — SW serviert index.html als Fallback. Neue HTML-Dateien vom SW-Fetch ausschließen.
4. **IndexedDB Version-Konflikt?** — Anderer Tab hat alte DB-Version offen.
5. **OneSignal-Tags: es ist GENAU EINER** — `sched` trägt den kompletten Zeitplan: `v1;m=0500;e=1830;s=0530,0930,1000;t=ton-2` (Version; Morgen; Abend; SMALL-Zeiten; Ton nur bei Abweichung vom Standard). Zeiten immer UTC im Format `HHMM` auf dem 15-Minuten-Raster. Push aus = Tag gelöscht (leerer String). Gebaut in `buildTags()` (`js/push.js`) — dieselbe Funktion für Web und nativ; gewürfelt wird NUR in `rollIfNeeded()` (`js/small-schedule.js`).

   **NIE einen zweiten Tag hinzufügen.** Der Plan dieser App erlaubt **3 Data-Tags pro Gerät, kumulativ**, und weist einen Schreibvorgang mit mehr Keys KOMPLETT ab (`App is limited to a maximum of 3 tags on a given player`) — auch das Löschen. Genau daran ist das alte Modell mit 13 Tags gescheitert: Ab dem sechsten SMALL-Impuls kam monatelang kein Wert mehr an, ohne jede Fehlermeldung. Diagnose-Historie: siehe Memory `loewenherz-onesignal-tag-limit`.

   Weil OneSignal auf einen zusammengesetzten Wert nicht filtern kann, bildet **`api/send-notifications.js` die Zielgruppe selbst**: Subscriptions per API holen, `sched` parsen, auf den aktuellen Slot filtern, gezielt via `include_subscription_ids` senden. Ton-Kennungen müssen zu `SOUND_FILES` dort UND `SOUND_OPTIONS` in `js/notification-sound.js` passen. Geräte mit den alten Einzel-Tags werden weiter bedient und beim Versandlauf automatisch migriert. Regression-Netz: `npm run test:send`.

## Deployment-Checkliste

1. `git status` → keine uncommitteten Änderungen
2. `git push origin main` → gepusht
3. ~30s warten (Vercel-Build)
4. Erst dann auf iPhone testen

## KRITISCH: Vercel-Projekte nicht überschreiben

**NIE `vercel deploy` in diesem Ordner für ein anderes Projekt ausführen.**
Dieser Ordner ist mit dem Vercel-Projekt `loewenherz-app` verknüpft (`.vercel/project.json`).
Ein `vercel deploy` hier überschreibt die Production der echten App.

Neue Vercel-Projekte (z.B. Platzhalterseiten, andere Domains) IMMER in einem separaten Ordner erstellen.
Beispiel: `app-angstdoc-placeholder/` → dort `vercel deploy` → eigenes Vercel-Projekt.

## Charakter-Guide (für Textarbeit)

### Quatschi (der innere Kritiker)
- **Ton:** Sarkastisch, selbstbewusst, beleidigt wenn ignoriert. Nie gemein — eher wie ein Kollege der sich beschwert aber eigentlich harmlos ist.
- **Spricht in der 1. Person** ("Ich hab's genossen") oder 3. Person ("Quatschi hat eine Beschwerde eingereicht")
- **Humor:** Trocken, nie Slapstick. Pointen durch Understatement.
- **Tabu:** Nie bedrohlich, nie abwertend. Lästig, nicht toxisch.

### Gundula (die innere Ruhe)
- **Ton:** Still, beobachtend, geduldig. Spricht selten, aber wenn dann zählt es.
- **Spricht in der 3. Person** ("Gundula nickt.", "Gundula wartet geduldig.")
- **Nie belehrend.** Kein "Du solltest..." — eher "Gundula hat das registriert."

### Zusammenspiel
- Quatschi redet, Gundula handelt. In der App: Quatschi = kursiv/Serif, Gundula = regular/Sans.
- Varianten vorstellen, Patrick entscheidet. Texte nie direkt einbauen.

## Code-Konventionen

### JavaScript
- **ES Modules**, kein Framework, kein jQuery, keine Dependencies
- **Try/Catch in async Callbacks** — iOS Safari verschluckt unbehandelte Promise-Rejections lautlos
- **Fire-and-forget:** Milestone-Checks, Tag-Syncs mit `.catch(() => {})` — nie Hauptflow blockieren
- **Render-Pattern:** Screen-Dateien exportieren `render*(container, profile)`

### CSS
- **Nur `transform` + `opacity` animieren** — GPU-beschleunigt, kein Layout-Reflow
- **`prefers-reduced-motion`** respektieren
- **Kein `position: fixed` auf dynamischen Elementen** — iOS Safari bricht das in Flex-Containern

### Service Worker
- **ZWEI SW-Dateien** synchron halten: `OneSignalSDKWorker.js` + `sw.js`
- Cache-Version in BEIDEN `CACHE_NAME` hochzählen bei JEDER Änderung
- Neue Dateien in `URLS_TO_CACHE` in BEIDEN registrieren

## UI-Prinzipien

- **Journal, nicht Dashboard** — warm, editorial, literarisch-humorvoll. Für Menschen mit Angst.
- **Animationen:** Beruhigend, nie hektisch. Kerzenlicht, nicht Disco.
- **Null-Regel:** Keine Nullen im UI anzeigen. "Alles über null ist Gewinn."
- **Wochendots:** Leer (grau) → ☀️/🌙 (teil-amber) → ✓ (voll amber). Heute = gestrichelt.
- **SMALL-Buttons:** Einzelne Buchstaben S, M, A, L, L. L₁/L₂ nur über Farbe + Label unterschieden.

## iOS-Safari Fallstricke

1. **`position: fixed` bricht in Flex-Containern** → `insertAdjacentElement` statt fixed
2. **CSS Transitions auf dynamischen Elementen** → Inline `style.opacity` statt Klassen-Toggle
3. **SW Cache aggressiv** → IMMER Version hochzählen
4. **App-Icon** → Nur bei Neuinstallation aktualisiert
5. **`getBoundingClientRect()`** → Rect VOR DOM-Änderungen capturen
6. **Neue HTML-Dateien** → Vom SW-Fetch ausschließen
7. **iOS 26 Compact Mode** → Share-Button hinter ⋯-Menü, Install-Anleitung universell halten

## Git-Konventionen

- **Author:** `loewenherzapp <pe@angstdoc.de>`
- **Co-Author:** `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
- Deutsch, 1-2 Sätze, direkt nach Commit auf `main` pushen

## Testszenarien (nach Feature-Änderungen)

- [ ] Erster App-Start (Onboarding)
- [ ] SMALL-Buttons: Tap → Punkt gespeichert? Toast?
- [ ] Schneller Doppel-Tap → kein Glitch?
- [ ] Tab-Wechsel (Heute → Reflexion → Verlauf → zurück)
- [ ] Offline-Modus funktioniert?
- [ ] Name mit Sonderzeichen (Umlaute, Emoji)
- [ ] Milestone-Check nach Tap (Console: `[Milestone]`)

## Häufige Fehler

_Diese Sektion wird von Claude selbst ergänzt wenn Fehler auftreten._

- **SW-Drift (aufgetreten v93–v99, geheilt mit v100):** Sieben Bumps landeten nur in `sw.js`, `OneSignalSDKWorker.js` blieb auf v92 — Push-aktive Web-Nutzer (deren aktiver SW der OneSignal-Worker ist!) bekamen tagelang alten Code, obwohl „die Cache-Version erhöht" war. Prüf-Kommando nach jedem Bump: `grep -h CACHE_NAME sw.js OneSignalSDKWorker.js` → beide Zeilen müssen identisch sein. Gleiches gilt für `URLS_TO_CACHE` (dort fehlten `small-schedule.js` und `time-picker.js`).
- **SW-Drift, zweiter Fall (v109, 01.09.2026):** Derselbe Fehler nochmal — der Ton-Commit hob nur `sw.js`, `OneSignalSDKWorker.js` blieb auf v105 und hätte push-aktiven Web-Nutzern alles seit v106 vorenthalten. Geheilt mit v110. Der Bump ist offenbar die Stelle, an der man am Ende einer Session unter Zeitdruck hinsieht: Das Prüf-Kommando gehört VOR den Commit, nicht danach.
