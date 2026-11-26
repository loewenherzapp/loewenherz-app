# Landing-Seite app.angstdoc.de

Stand: 26.11.2026 (Buch erschienen am 25.11.2026).

Der QR-Code und die Adresse im Buch (Modul 7 und nach dem Nachwort) führen auf
`https://app.angstdoc.de`. Wer dort im Browser ankommt und noch kein Profil hat,
sieht die Landing-Seite. In den nativen Apps und in der installierten Web-App
erscheint sie nie (`isStandalone()` in `js/app.js`).

## Wo was liegt

| Was | Wo |
|---|---|
| Aufbau, Verknüpfungen | `js/screens/landing.js` |
| Texte | `content/de.js` → `ui.landing` |
| Gestaltung | `css/styles.css`, Block „Landing Page“ |
| Bilder | `landing/` (bewusst nicht in `assets/`: `build-www.mjs` kopiert `assets/` ins App-Bundle) |
| Titel, Vorschau beim Teilen, iPhone-Hinweis | `index.html` (`og:*`, `apple-itunes-app`) |

`/install.html` und `/install` leiten auf die Startseite weiter (`vercel.json`).
Die frühere eigene Installationsseite gibt es nicht mehr, damit nicht zwei
Seiten auseinanderlaufen.

## Regeln

- **Beide Stores stehen immer nebeneinander**, ohne Geräte-Erkennung und ohne
  Umschalter. App Store zuerst, beide Knöpfe gleich groß. Das verlangen die
  Marken-Richtlinien (Apple: App-Store-Badge zuerst; Google: Play-Badge nicht
  kleiner als andere). Gilt auch, falls später die offiziellen Badges kommen:
  dann Mindesthöhe 40 px, ein Viertel der Höhe als Freiraum, nichts verändern,
  Markenhinweise von Apple und Google in den Fußbereich, App-Store-Badge nur
  einmal pro Seite.
- **Texte stammen aus dem Buch und dem Store-Eintrag** (App-Seiten in Modul 7
  und nach dem Nachwort, Zusammenfassung Modul 8, Store-Beschreibung). Wer dort
  etwas ändert, zieht es in `ui.landing` nach. Neue Texte legt Patrick fest.
- **Store-Links öffnen im selben Tab.** Auf dem Handy übernimmt die Store-App,
  ein neuer Tab bliebe als leere Seite zurück.
- **Geräterahmen der Screenshots bleibt neutral** (kein Merkmal eines bestimmten
  Handys). Apple erlaubt eigene Gerätebilder nur ohne Apple-typische Details.
- Kleine Schrift nutzt `--landing-soft` und `--landing-teal` statt
  `--text-secondary` und `--ink-teal`: Die App-Farben haben auf Creme weniger
  als 4,5:1 Kontrast.

## Bilder neu erzeugen

Quellen: Play-Screenshots aus `~/Buch/Löwenherz - Store-Grafiken (Logo 11-2026)/`,
Buchbilder aus `~/Claude/projekte/loewenherz-buch/images/`.

```bash
cwebp -q 82 -resize 720 0 play-screenshot-04-reflexion.jpg      -o landing/screen-morgen.webp
cwebp -q 82 -resize 720 0 play-screenshot-01-heute.jpg          -o landing/screen-heute.webp
cwebp -q 82 -resize 720 0 play-screenshot-02-abendreflexion.jpg -o landing/screen-abend.webp
cwebp -q 82 -resize 720 0 play-screenshot-03-verlauf.jpg        -o landing/screen-verlauf.webp
cwebp -q 86 quatschi.png -o landing/quatschi.webp
cwebp -q 86 -alpha_q 90 -resize 480 0 loewenherz-mockup-trim.png -o landing/buch.webp
cwebp -q 84 -resize 240 0 dr-patrick-eberle-autor.jpg -o landing/patrick-eberle.webp
sips -s format jpeg -s formatOptions 86 play-feature-1024x500.png --out landing/og-loewenherz.jpg
```

`landing/qr-app.svg` ist der QR-Code aus dem Buch
(`~/Buch/QR-Codes/Zur App Löwenherz Weiterleitung/qr-code.png`, Ziel
`https://app.angstdoc.de`), Modul für Modul als Vektor nachgezeichnet. Nach
jeder Änderung mit einem QR-Leser prüfen.

## Prüfen

```bash
npm run test:landing
```

Der Test öffnet die Seite in Chrome ohne Fenster, in vier Größen (320 × 568,
375 × 667, 768 × 1024, 1280 × 800), und prüft: beide Stores oben und am Schluss
mit den Adressen aus `js/config.js`, App Store zuerst, beide Knöpfe gleich groß
und ohne Scrollen sichtbar, kein waagerechtes Scrollen, alle Bilder laden,
Fragen klappen auf, Impressum und Datenschutz öffnen, „Löwenherz im Browser
nutzen“ führt ins Onboarding.

Nicht im Test: Wer schon ein Profil hat, sieht direkt die App (von Hand
geprüft am 26.11.2026). Der QR-Code wird nicht ausgelesen.
