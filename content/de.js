export const TEXTS = {
  quatschi: {
    general: [
      "Na, {name}, was erzählt Quatschi gerade?",
      "Kurz innehalten. Wie steht's um deinen Cocktail, {name}?",
      "Schultern runter, {name}. Und dann mal schauen.",
      "Quatschi-Check: Sendepause oder Dauerloop?",
      "Hey {name}. Kurz raus aus dem Film.",
      "Was würdest du einer guten Freundin gerade raten, {name}?",
      "Drei Sekunden. Reinhören. Was ist da?",
      "Autopilot oder Pilotin? Kurzer Check, {name}.",
      "Wie wär's mit einem SMALL-Moment?",
      "{name}, was sagt Gundula gerade? Kurz reinspüren."
    ],
    firstPoint: [
      "Erster Punkt des Tages wartet, {name}. Alles über null ist Gewinn.",
      "Guten Morgen, {name}. Bereit für den ersten SMALL-Moment?",
      "Noch kein Punkt heute. Kein Drama — nur eine Einladung."
    ],
    inactiveShort: [
      "Siehst du? Funktioniert doch nicht. — Netter Versuch, Quatschi.",
      "Drei Tage Pause? Passiert. Alles über null ist Gewinn, {name}.",
      "{name}, Quatschi sagt du hast aufgegeben. Stimmt das?"
    ],
    inactiveLong: [
      "Hey {name}. Alles okay? Schön, dass du wieder da bist.",
      "Lange nicht gesehen, {name}. Kein Vorwurf. Willkommen zurück.",
      "Quatschi hat schon dein Grab geschaufelt. Ignorier ihn. Willkommen zurück, {name}."
    ]
  },
  reflectionEnd: {
    drowned: "Überlebt ist ein SMALL-Punkt. Gute Nacht, Löwenherz.",
    tough: "Zähe Tage zählen doppelt. Du bist drangeblieben.",
    okay: "Okay ist okay. Morgen ist ein neuer Tag.",
    good: "Gut gelaufen heute. Dein Löwenherz wächst.",
    lion: "Quatschi ist sprachlos. Kurz. Gute Nacht, Champ."
  },
  ui: {
    tabs: { today: "Heute", reflection: "Reflexion", history: "Verlauf" },
    onboarding: {
      welcome: "Willkommen, Löwenherz.",
      askName: "Wie heißt du?",
      namePlaceholder: "Dein Vorname",
      next: "Weiter →",
      reminderTitle: "Hey {name}, wann soll ich dich an SMALL erinnern?",
      reminderHint: "(Kannst du jederzeit in den Einstellungen ändern.)",
      morning: "Morgens",
      midday: "Mittags",
      evening: "Abends",
      go: "Los geht's 🦁"
    },
    dashboard: {
      todayPoints: "Heute: {n} Punkte",
      todayPointsSingular: "Heute: 1 Punkt",
      todayPointsZero: "Heute: noch kein Punkt",
      motto: "Alles über null ist Gewinn."
    },
    smallLabels: {
      S: "Selbstfürsorge",
      M: "Metaintervention",
      A: "Affekt & Emotion",
      L1: "Löwenherz",
      L2: "Liebe"
    },
    quickSelect: {
      S: {
        title: "S — Selbstfürsorge",
        options: [
          { key: "water", emoji: "💧", label: "Wasser getrunken" },
          { key: "movement", emoji: "🚶", label: "Bewegt / frische Luft" },
          { key: "food", emoji: "🍎", label: "Etwas gegessen" },
          { key: "pause", emoji: "😮‍💨", label: "Pause gemacht" },
          { key: "other", emoji: "✨", label: "Anderes" }
        ]
      },
      M: {
        title: "M — Metaintervention & Mindset",
        options: [
          { key: "quatschi", emoji: "🔇", label: "Quatschi erkannt" },
          { key: "mindset", emoji: "🔄", label: "Haltungswechsel" },
          { key: "radio", emoji: "📻", label: "Radio Bullshit aus" },
          { key: "other", emoji: "✨", label: "Anderes" }
        ]
      },
      A: {
        title: "A — Affekt & Emotion",
        options: [
          { key: "named", emoji: "🏷️", label: "Gefühl benannt" },
          { key: "felt", emoji: "💛", label: "Gefühl gespürt" },
          { key: "understood", emoji: "🔍", label: "Botschaft verstanden" },
          { key: "other", emoji: "✨", label: "Anderes" }
        ]
      },
      L1: {
        title: "L — Löwenherz",
        options: [
          { key: "step", emoji: "👟", label: "Schritt gewagt" },
          { key: "conversation", emoji: "📞", label: "Schwieriges Gespräch" },
          { key: "avoidance", emoji: "🚪", label: "Vermeidung durchbrochen" },
          { key: "other", emoji: "✨", label: "Anderes" }
        ]
      },
      L2: {
        title: "L — Liebe & Selbstliebe",
        options: [
          { key: "kind", emoji: "🤝", label: "Freundlich mit mir" },
          { key: "boundary", emoji: "🛑", label: "Grenze gesetzt" },
          { key: "gratitude", emoji: "🙏", label: "Dankbarkeit gespürt" },
          { key: "other", emoji: "✨", label: "Anderes" }
        ]
      }
    },
    reflection: {
      title: "Wie war dein Tag, {name}?",
      moods: [
        { key: "drowned", emoji: "🌊", label: "Untergegangen" },
        { key: "tough", emoji: "🌧️", label: "Zäh" },
        { key: "okay", emoji: "🌤️", label: "Okay" },
        { key: "good", emoji: "☀️", label: "Gut" },
        { key: "lion", emoji: "🦁", label: "Löwentag" }
      ],
      helpedTitle: "Was hat heute geholfen?",
      helpedDontKnow: "Weiß nicht",
      helpedSurvived: "Hab überlebt",
      gratitudeTitle: "Wofür bist du gerade dankbar?",
      gratitudePlaceholder: "Ein Satz reicht...",
      gratitudeSkip: "Nicht heute",
      gratitudeDone: "Fertig ✓",
      goodNight: "Gute Nacht, Löwenherz.",
      close: "Schließen",
      tabTitle: "Reflexion",
      pastTitle: "Letzte Reflexion",
      noReflection: "Noch keine Reflexion. Starte heute Abend deine erste.",
      startNow: "Jetzt reflektieren",
      lastDays: "Letzte 7 Tage"
    },
    history: {
      title: "Dein Weg, {name}",
      thisWeek: "Diese Woche",
      weekLabel: "KW {n}",
      balance: "Balance"
    },
    settings: {
      title: "Einstellungen",
      back: "← Zurück",
      nameLabel: "Name",
      remindersLabel: "Erinnerungen",
      morning: "Morgens",
      midday: "Mittags",
      evening: "Abends",
      reflectionTimeLabel: "Abendreflexion",
      pushHint: "Push-Benachrichtigungen werden in einem Update aktiviert.",
      dataHint: "Deine Daten werden nur auf diesem Gerät gespeichert. Es gibt kein Cloud-Backup. Wenn du die App deinstallierst, gehen deine Daten verloren.",
      crisisLink: "Soforthilfe & Krisennummern",
      aboutTitle: "Über Löwenherz",
      version: "Version 1.0",
      madeBy: "Ein Werkzeug von Der AngstDoc",
      bookLink: "Zum Buch",
      bookUrl: "https://löwenherz-buch.de",
      disclaimer: "Diese App ersetzt keine Therapie. Sie ist ein Begleitwerkzeug zum Buch 'Löwenherz' und unterstützt dich bei der Umsetzung des SMALL-Systems im Alltag. Bei akuten psychischen Krisen wende dich bitte an die Telefonseelsorge oder einen Krisendienst.",
      impressum: "Impressum",
      impressumText: "[Impressum wird vor Launch ergänzt]",
      datenschutz: "Datenschutz",
      datenschutzText: "[Datenschutzerklärung wird vor Launch ergänzt. Kernpunkte: Alle Daten lokal gespeichert, keine Übertragung an Server, keine Cookies, kein Tracking.]",
      deleteData: "Alle Daten löschen",
      deleteConfirm: "Wirklich alle Daten löschen? Das kann nicht rückgängig gemacht werden.",
      deleteYes: "Ja, löschen",
      deleteNo: "Abbrechen"
    },
    crisis: {
      title: "Du bist nicht allein.",
      telefonseelsorge: "Telefonseelsorge (24/7, kostenlos, anonym)",
      phone1: "0800 111 0 111",
      phone2: "0800 111 0 222",
      krisentelefon: "Krisentelefon",
      phone3: "0800 116 016",
      online: "Online-Beratung",
      onlineUrl: "online.telefonseelsorge.de",
      onlineHref: "https://online.telefonseelsorge.de",
      footer: "Wenn du professionelle Hilfe brauchst, ist das ein Zeichen von Stärke.",
      close: "Schließen"
    },
    landing: {
      title: "Löwenherz installieren",
      subtitle: "Damit alles funktioniert, füge Löwenherz zu deinem Homescreen hinzu:",
      step1: "Tippe auf das Teilen-Symbol",
      step2: "Scrolle zu \"Zum Home-Bildschirm\"",
      step3: "Tippe \"Hinzufügen\"",
      step4: "Öffne Löwenherz von deinem Homescreen",
      androidToggle: "Ich nutze Android →",
      androidStep1: "Tippe auf das Menü (⋮) oben rechts",
      androidStep2: "Wähle \"Zum Startbildschirm hinzufügen\"",
      androidStep3: "Tippe \"Hinzufügen\""
    }
  }
};
