# Antwort auf Guideline 2.1 — Information Needed (01.09.2026)

Apple hat bei der Erstprüfung Zusatzinformationen angefordert (Standard bei
Entwicklerkonten ohne Prüfhistorie), Submission-ID
`634e1634-e9a5-4a36-9bd9-d18aa2539faf`.

Punkt 1 (Bildschirmaufnahme auf einem **physischen** Gerät) muss Patrick liefern —
der Simulator zählt nicht. Punkte 2–6 unten sind fertig zum Absenden.

---

## Text für die Antwort in App Store Connect (englisch)

```
Thank you for reviewing Löwenherz. Answers to your questions below.

2. PURPOSE AND TARGET AUDIENCE

Löwenherz is a German-language self-help app for people who experience anxiety.
It is the companion app to the published German book "Löwenherz" by Dr. med.
Patrick Eberle, but it is fully usable on its own and requires no purchase.

The problem it solves: people read about anxiety, understand the concepts, and
still freeze in the real moment — in a supermarket, at a door, at 3 a.m. The
knowledge is there but does not translate into action. The app closes that gap
by turning the concepts into a small daily practice instead of theory.

The value it provides is three short routines that fit into an ordinary day:
- A morning intention ("How do you want to be today?")
- SMALL point tracking: one-tap logging of five categories of self-care actions
  (Self-care, Meta-awareness, Affect, Courage, Self-compassion)
- An evening reflection with mood tracking

Progress is visible in a weekly overview and a milestone system computed on the
device. Two friendly characters from the book appear as gentle commentary:
"Quatschi" (the inner catastrophizing voice) and "Gundula" (the body's alarm
system). Their purpose is to make self-observation less grim.

Target audience: German-speaking adults (Germany, Austria, Switzerland) who deal
with anxiety and want a light daily practice. Age rating 13+.

The app is psychoeducation and self-help. It does not diagnose, treat, or
replace professional care, and it says so in the app.

3. SETUP AND ACCESS

No account, no login, no credentials of any kind are required. Nothing is gated.

First launch:
a) Enter a first name. It is stored only on the device and is used to address
   the user by name.
b) Choose a daily time window for reminders (defaults are fine).
c) An optional newsletter screen appears. This is NOT a registration wall — tap
   the button labelled "Erstmal ohne →" ("continue without for now") below the
   form to skip it and use the full app.
d) The main app opens on the "Heute" (Today) tab.

Main features and where to find them:
- "Heute" tab: tap any of the five letters S, M, A, L, L to log a self-care
  action. A sheet with concrete options opens; tapping one records a point.
- "Reflexion" tab: morning intention (available in the morning) and evening
  reflection (available from 6 p.m.).
- "Verlauf" tab: weekly overview and earned milestones.
- Gear icon (top right): reminder times, notification sound, data export,
  legal texts.
- Heart icon (top right, on every screen): crisis hotlines.

Push notifications are requested only after an in-app explanation, and only
once. If the user declines, the app remains fully usable — reminders are the
only feature that needs the permission.

The app works completely offline, including on first launch. You can verify
this in airplane mode.

4. EXTERNAL SERVICES USED

- OneSignal (onesignal.com): delivery of push notification reminders via APNs.
  Receives a subscription identifier and one scheduling tag. No user content.
- Brevo (brevo.com): newsletter double opt-in, and ONLY if the user actively
  enters an email address on the optional screen. Receives the email address
  and nothing else.
- Vercel (vercel.com): hosting for the app's two serverless endpoints
  (/api/subscribe, /api/set-tags) and for the companion website.

There are no payment processors, no authentication services, no AI services, no
advertising networks, and no analytics SDKs in the app. All journal entries,
tracked points, moods, and the user's name are stored locally on the device
(IndexedDB/localStorage) and are never uploaded.

5. REGIONAL DIFFERENCES

There are none. The app behaves identically in every region and is available in
German only. The crisis hotline screen shows a fixed list (Telefonseelsorge
Germany, Telefonseelsorge Austria, Die Dargebotene Hand Switzerland, and the
European emergency number 112). This list is static and is not switched by
region.

6. REGULATED INDUSTRY AND THIRD-PARTY MATERIAL

Regulatory status: Löwenherz is not a medical device and is not declared as one.
It performs no diagnosis, no treatment, no prevention, and no monitoring of any
condition — the four purposes that define a medical device under EU MDR. It
offers psychoeducation and self-observation only. A health disclaimer is shown
in the app settings, and a crisis help button is reachable from every screen.

The developer, Dr. med. Patrick Eberle, is a licensed physician in Germany.
However, the app provides no medical service, no consultation, and creates no
doctor-patient relationship. It is an educational companion to his book.

Third-party material: the six notification sounds are licensed stock audio under
the Pixabay Content License, which permits commercial use without attribution.
The sources are documented. Images are own productions, licensed stock, or
AI-generated, as stated in the app's legal notice. The book "Löwenherz" is the
developer's own work.
```

---

## Offen: Punkt 1, die Bildschirmaufnahme

Apple verlangt ausdrücklich ein **physisches Gerät** mit aktuellem Betriebssystem.
Der Simulator genügt nicht.

Zu zeigen (Aufnahme muss mit dem App-Start beginnen):
1. App vom Homescreen starten
2. Onboarding: Name eingeben, Zeitfenster, „Erstmal ohne →" antippen
3. „Heute": zwei bis drei SMALL-Punkte über verschiedene Buchstaben setzen
4. „Reflexion" öffnen, Abendreflexion beginnen, Stimmung wählen
5. „Verlauf" öffnen — Wochenübersicht und Meilensteine
6. Zahnrad öffnen — Erinnerungszeiten und Tonauswahl kurz zeigen
7. Herz-Symbol öffnen — Krisennummern zeigen

Nicht nötig: Registrierung, Login, Kontolöschung, nutzergenerierte Inhalte,
Melde- und Blockierfunktionen. Es gibt davon nichts in der App — das steht auch
so in der Antwort.

Aufnahme am iPhone: Kontrollzentrum → Bildschirmaufnahme. Oder am Mac per
QuickTime Player → Ablage → Neue Videoaufnahme → iPhone als Quelle wählen.
