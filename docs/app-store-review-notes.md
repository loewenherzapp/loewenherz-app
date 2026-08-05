# App Store Review Notes — Löwenherz

Fertig kopierbarer Text für das Feld **App Store Connect → App-Version → „Notes"**.
Englische Fassung zuerst (Review-Team arbeitet englisch), deutsche Fassung darunter
als Referenz. Jede genannte Funktion existiert im Code — Stand `1738615` + C3
(05.08.2026); bei Funktionsänderungen diesen Text mitziehen.

---

## English (für das Notes-Feld)

```
Löwenherz is a standalone, fully offline self-help journaling app (German
language), companion to the published German book "Löwenherz" about anxiety
self-help. It is not a repackaged website.

NO ACCOUNT, NO LOGIN, NO DEMO CREDENTIALS NEEDED
The app has no account system. On first launch you are asked for a first
name (stored only on the device) and then see an optional newsletter
sign-up screen. This is NOT a registration wall: tap the button labelled
"Erstmal ohne →" ("continue without for now") below the form to skip it
and use the full app. Nothing is locked behind the e-mail sign-up.

FULLY OFFLINE / SELF-CONTAINED
All assets ship inside the app bundle; all user data (reflections, tracked
points, settings) is stored locally on the device (IndexedDB/localStorage)
and is never uploaded. You can verify this by using the app in airplane
mode — everything works, including first launch.

OWN APPLICATION LOGIC (not fetched web content)
- SMALL point tracking: one-tap logging of five daily self-care actions
  with category quick-select, week overview and balance view
- Guided morning intention and evening reflection flows with mood
  tracking and a milestone engine (21 milestones computed on device)
- Reminder scheduling algorithm runs on the device: the user sets a time
  window and a daily count; the app draws the actual reminder times anew
  every day via stratified randomization on a 15-minute grid with minimum
  30-minute gaps, avoiding the two fixed ritual times. (Randomized timing
  is intentional, to prevent habituation to fixed reminder times.)

NATIVE FUNCTIONALITY (not possible in a browser)
- Data export through the iOS share sheet (Save to Files, AirDrop, Mail)
- Direct jump to the app's iOS Settings page when notifications are
  blocked ("Einstellungen öffnen" button)
- Haptic feedback on completed actions (with an in-app toggle)
- Native push notifications via APNs for the self-scheduled reminders

PUSH IS OPTIONAL
Notifications are requested only after an in-app explanation, and only
once. If declined, the app remains fully usable — reminders are the only
feature that needs the permission.

LANGUAGE / MARKET
The app is intentionally German-only and targets Germany, Austria and
Switzerland, matching the German-language book it accompanies.

HEALTH DISCLAIMER
Löwenherz is self-help/psychoeducation. It does not diagnose, treat or
replace professional care. A health disclaimer plus crisis hotlines
(Telefonseelsorge DE/AT/CH, emergency number 112) is shown in the app
settings, and a crisis help button (♡) is reachable from every screen.
```

---

## Deutsch (Referenz)

```
Löwenherz ist eine eigenständige, vollständig offline funktionierende
Selbsthilfe-Journal-App (deutschsprachig), Begleiter zum erschienenen
Buch „Löwenherz" über Angst-Selbsthilfe. Sie ist keine verpackte Website.

KEIN KONTO, KEIN LOGIN, KEINE DEMO-ZUGANGSDATEN NÖTIG
Es gibt kein Konto-System. Beim Erststart wird nur ein Vorname erfragt
(bleibt auf dem Gerät), danach erscheint eine optionale Newsletter-
Anmeldung. Das ist KEINE Registrierungsschranke: Der Button „Erstmal
ohne →" unter dem Formular überspringt sie — die App ist vollständig
nutzbar, nichts ist hinter der E-Mail-Anmeldung verschlossen.

VOLLSTÄNDIG OFFLINE
Alle Assets liegen im App-Bundle; alle Nutzerdaten (Reflexionen, Punkte,
Einstellungen) werden ausschließlich lokal gespeichert (IndexedDB/
localStorage) und nie hochgeladen. Prüfbar im Flugmodus — alles
funktioniert, auch der Erststart.

EIGENE ANWENDUNGSLOGIK (kein abgerufener Webinhalt)
- SMALL-Punkte-Tracking: Ein-Tipp-Erfassung von fünf täglichen
  Selbstfürsorge-Handlungen mit Kategorie-Auswahl, Wochenübersicht und
  Balance-Ansicht
- Geführte Morgen-Intention und Abendreflexion mit Stimmungserfassung
  und einer Meilenstein-Engine (21 Meilensteine, auf dem Gerät berechnet)
- Der Erinnerungs-Algorithmus läuft auf dem Gerät: Der Nutzer legt
  Zeitfenster und Anzahl fest; die App zieht die konkreten Uhrzeiten
  täglich neu — geschichtete Zufallsziehung im 15-Minuten-Raster mit
  mindestens 30 Minuten Abstand, unter Aussparung der beiden festen
  Ritualzeiten. (Die Zufälligkeit ist gewollt: keine Gewöhnung an feste
  Erinnerungszeiten.)

NATIVE FUNKTIONEN (im Browser nicht möglich)
- Datenexport über das iOS-Share-Sheet („In Dateien sichern", AirDrop, Mail)
- Direkter Sprung in die iOS-Einstellungen der App bei blockierten
  Mitteilungen (Button „Einstellungen öffnen")
- Haptisches Feedback bei abgeschlossenen Handlungen (mit Schalter)
- Native Push-Benachrichtigungen über APNs für die selbst berechneten
  Erinnerungen

PUSH IST OPTIONAL
Die Berechtigung wird erst nach einer In-App-Erklärung angefragt, und
nur einmal. Bei Ablehnung bleibt die App vollständig nutzbar.

SPRACHE / MARKT
Bewusst ausschließlich deutschsprachig, gerichtet auf Deutschland,
Österreich und die Schweiz — passend zum deutschsprachigen Buch.

GESUNDHEITSHINWEIS
Löwenherz ist Selbsthilfe/Psychoedukation, stellt keine Diagnosen und
ersetzt keine Behandlung. Ein Gesundheitshinweis inkl. Krisen-Hotlines
(Telefonseelsorge DE/AT/CH, Notruf 112) steht in den Einstellungen; die
Krisenhilfe (♡) ist von jedem Screen aus erreichbar.
```
