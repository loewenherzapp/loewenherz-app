# Benachrichtigungstöne — Herkunft und Lizenznachweis

Die sechs Töne der iOS-App (`ios/App/App/sounds/*.caf`, Vorschau-Kopien in
`assets/sounds/*.mp3`) stammen aus lizenzfreien Bibliotheken. Beide Lizenzen
erlauben die kostenlose Nutzung in kommerziellen Apps ohne Namensnennung.
Die drei leisen Töne wählte Patrick am 05./06.08.2026 über drei Anhör-Runden,
die drei Löwentöne am 30.08.2026.

| Datei | In-App-Name (Stand 08/2026) | Original | Autor | Quelle | Lizenz |
|---|---|---|---|---|---|
| lh-ton-1 | Räuspern | Short Soft Muted Notification Sound | Chrysalyn | https://pixabay.com/sound-effects/technology-short-soft-muted-notification-sound-547377/ | [Pixabay Content License](https://pixabay.com/service/license-summary/) |
| lh-ton-2 | Aufatmen | Soft Notification (2022) | Universfield | https://pixabay.com/sound-effects/film-special-effects-soft-notification-131438/ | Pixabay Content License |
| lh-ton-3 | Nachhall | Soft Notification (2023) | Universfield | https://pixabay.com/sound-effects/film-special-effects-soft-notification-146623/ | Pixabay Content License |
| lh-ton-4 (Standard) | König der Welt | Wild lion animal roar (ID 6) | Mixkit | https://mixkit.co/free-sound-effects/lion/ | [Mixkit Sound Effects Free License](https://mixkit.co/license/#sfxFree) |
| lh-ton-5 | Radau | Roar 1 | Stu9 | https://pixabay.com/sound-effects/nature-roar-1-352871/ | Pixabay Content License |
| lh-ton-6 | Sofalöwe | Big wild cat long purr (ID 96) | Mixkit | https://mixkit.co/free-sound-effects/lion/ | Mixkit Sound Effects Free License |

Hinweis zur Pixabay-Lizenz: Einbau in Apps ist ausdrücklich erlaubt; nicht
erlaubt wäre nur der Weiterverkauf/die Weiterverbreitung als eigenständige
Audio-Datei — trifft auf die App nicht zu.

Technik: `.caf` erzeugt mit `afconvert -f caff -d LEI16@44100 -c 1`. Die
Löwentöne kommen aus den WAV-Originalen (Mixkit) bzw. der Original-MP3
(Pixabay bietet für „Roar 1" kein WAV an); vor der Wandlung wurden Stille
getrimmt, eine Ausblende gesetzt und der Pegel auf die Lautheit der
bestehenden Töne gebracht (Ziel −19 LUFS, True Peak −1,5 dBFS; das Schnurren
landet peak-begrenzt bei −22,8 LUFS).

Die Vorschau-MP3s werden aus den fertigen `.caf` erzeugt (192 kbps, mono,
44,1 kHz) — nicht aus den Originalen. Sonst hört man in den Einstellungen
etwas anderes, als das Gerät später spielt: Die ersten drei Vorschauen waren
bis 08/2026 die Stereo-Originale und damit 1,5–3,3 dB lauter als ihre `.caf`
(der Mono-Downmix senkt den Pegel).
APNs erwartet die Dateien im Bundle-**Root** —
die Xcode-Gruppe `sounds` kopiert sie flach dorthin (kein Unterordner im
Bundle, sonst findet iOS sie nicht und spielt still den Systemton).

Die vollständige Kandidaten-Historie (alle 3 Runden, auch die aussortierten)
liegt außerhalb des Repos in
`/Users/Katana/Claude/projekte/loewenherz-sounds-kandidaten/LIZENZEN.md`,
die 20 Löwen-Kandidaten in `loewenherz-sounds-kandidaten/loewe/LIZENZEN.md`.
