# Benachrichtigungstöne — Herkunft und Lizenznachweis

Die drei Töne der iOS-App (`ios/App/App/sounds/*.caf`, Vorschau-Kopien in
`assets/sounds/*.mp3`) stammen aus lizenzfreien Bibliotheken. Beide Lizenzen
erlauben die kostenlose Nutzung in kommerziellen Apps ohne Namensnennung.
Ausgewählt von Patrick am 05./06.08.2026 über drei Anhör-Runden.

| Datei | In-App-Name (Stand 08/2026) | Original | Autor | Quelle | Lizenz |
|---|---|---|---|---|---|
| lh-ton-1 (Standard) | Gedämpfter Tupfer | Short Soft Muted Notification Sound | Chrysalyn | https://pixabay.com/sound-effects/technology-short-soft-muted-notification-sound-547377/ | [Pixabay Content License](https://pixabay.com/service/license-summary/) |
| lh-ton-2 | Sanfter Impuls | Soft Notification (2022) | Universfield | https://pixabay.com/sound-effects/film-special-effects-soft-notification-131438/ | Pixabay Content License |
| lh-ton-3 | Sanfter Impuls II | Soft Notification (2023) | Universfield | https://pixabay.com/sound-effects/film-special-effects-soft-notification-146623/ | Pixabay Content License |

Hinweis zur Pixabay-Lizenz: Einbau in Apps ist ausdrücklich erlaubt; nicht
erlaubt wäre nur der Weiterverkauf/die Weiterverbreitung als eigenständige
Audio-Datei — trifft auf die App nicht zu.

Technik: `.caf` erzeugt mit `afconvert -f caff -d LEI16@44100 -c 1` aus den
Original-MP3s (256 kbps). APNs erwartet die Dateien im Bundle-**Root** —
die Xcode-Gruppe `sounds` kopiert sie flach dorthin (kein Unterordner im
Bundle, sonst findet iOS sie nicht und spielt still den Systemton).

Die vollständige Kandidaten-Historie (alle 3 Runden, auch die aussortierten)
liegt außerhalb des Repos in
`/Users/Katana/Claude/projekte/loewenherz-sounds-kandidaten/LIZENZEN.md`.
