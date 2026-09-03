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

**Globale Absenkung am 01.09.2026:** Nach dem Hörtest am Gerät wurden ALLE
sechs Töne um exakt 3 dB abgesenkt — die Abstände zwischen ihnen bleiben
dadurch unverändert, nur das Niveau der ganzen Familie liegt tiefer.
Gerechnet auf der fertigen PCM-Datei (`volume=-3dB`), Format und Länge
unangetastet. Stand danach (integriert / Momentan-Max):
Räuspern −20,6/−16,1 · Aufatmen −23,6/−23,3 · Nachhall −27,0/−24,9 ·
König der Welt −22,2/−19,0 · Radau −22,0/−20,6 · Sofalöwe −25,8/−20,9 LUFS.
**Zweite Absenkung am 01.09.2026, nur die beiden Brüller:** `lh-ton-4` und
`lh-ton-5` noch einmal −3 dB, nachdem sie am Gerät weiter zu präsent
wirkten. Ein Brüllen ist breitbandig und wirkt bei gleichem Messwert
lauter als ein schmaler Tupfer — die Familie ist hier also bewusst NICHT
gleichmäßig. Stand jetzt (Momentan-Max, der für kurze Alerts zählt):
Räuspern −16,1 · Sofalöwe −20,9 · König der Welt −22,0 · Aufatmen −23,3 ·
Radau −23,6 · Nachhall −24,9 LUFS. Der Standardton ist damit rund 6 dB
leiser als Räuspern.

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
