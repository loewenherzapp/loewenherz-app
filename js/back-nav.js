// ============================================================
// Zurück-Taste des Handys
// ============================================================
// In der Android-App (früher TWA, jetzt Capacitor) und in installierten
// Web-Apps löst die Zurück-Taste des Handys ein history.back() aus. Löwenherz ist eine
// einzige Seite ohne Verlaufseinträge — die Taste beendete deshalb sofort
// die App, egal ob gerade die Einstellungen, eine Auswahlliste oder der
// Verlauf offen waren (Tester-Rückmeldung 06.10.2026: „kann ich nur übers
// Handy machen und fliege aus der App").
//
// Lösung ohne Eingriff in jede einzelne Ansicht: Solange irgendetwas über
// dem Startzustand liegt (Heute-Tab, nichts geöffnet), steht genau EIN
// Schutz-Eintrag im Verlauf. Die Zurück-Taste verbraucht ihn; dann wird die
// oberste Ebene über ihren eigenen Schließen-Knopf geschlossen. Ist danach
// noch etwas offen, kommt ein neuer Schutz-Eintrag. Im Startzustand gibt es
// keinen — dort beendet die Taste die App wie gewohnt.
//
// Welche Ebene „oben" liegt, liest obersteEbene() aus dem DOM — dieselbe
// Liste wie uiInputFlowOpen() in app.js. Neue Overlays hier eintragen.
//
// Native Android-App: Capacitor reicht die Taste über das App-Plugin
// durch. Ohne eigenen Listener ginge es zwar in der WebView-Historie
// zurück, aber im Startzustand passierte NICHTS — die App ließe sich mit
// der Taste nicht mehr verlassen. Deshalb unten: Verlaufseintrag da →
// history.back() (landet im popstate-Handler), sonst App in den
// Hintergrund (wie Android es seit Version 12 selbst macht).
// ============================================================

import { closeSoftAskUndecided } from './push.js';
import { isAndroid } from './platform.js';
import { nativePlugin } from './native-plugins.js';

let schutzAktiv = false;
let ignorieren = 0;
let planTimer = null;
let hooks = null;

function klick(sel, root = document) {
  const el = root.querySelector(sel);
  if (el) el.click();
  return !!el;
}

function escape() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

function sichtbar(id) {
  const el = document.getElementById(id);
  return !!el && !el.classList.contains('hidden');
}

/** Oberste offene Ebene als Schließ-Funktion, oder null im Startzustand. */
function obersteEbene() {
  // Die Neustart-Meldung bei Datenproblemen ist keine Ebene: Zurück
  // beendet dort die App, statt sie wegzuklicken.
  if (document.getElementById('datenverlust-overlay')) return null;

  const bestaetigung = [...document.querySelectorAll('.confirm-overlay')]
    .find((o) => o.id !== 'datenverlust-overlay');
  if (bestaetigung) {
    return () => klick('#confirm-no, #confirm-import-no', bestaetigung) || bestaetigung.remove();
  }
  if (document.querySelector('.time-picker-overlay, .sound-picker-overlay')) return escape;
  const detail = document.getElementById('detail-overlay');
  if (detail) return () => klick('#detail-close') || detail.remove();
  const infoSheet = document.querySelector('.info-sheet-overlay.active');
  if (infoSheet) return () => klick('.info-sheet-close', infoSheet);
  // Nicht #push-later klicken: In Runde 2 wäre das „Nein, danke" — endgültig.
  if (document.querySelector('.push-soft-ask-overlay.active')) return closeSoftAskUndecided;
  if (document.querySelector('.soft-prompt-overlay.active')) return escape;
  if (sichtbar('crisis-modal')) return () => klick('#crisis-close-btn');
  if (document.querySelector('.sheet-container.open')) return () => klick('#sheet-overlay');
  if (document.querySelector('.legal-page.active')) return () => klick('#legal-back');
  if (sichtbar('settings-container')) return () => klick('#settings-back');

  // Ab hier nur innerhalb der App-Oberfläche (nicht in Landing/Onboarding)
  if (!sichtbar('app-shell')) return null;
  const tab = hooks.aktuellerTab();
  const reflexion = document.querySelector('#main-content .reflection-screen');
  if (tab === 'reflection' && reflexion && !reflexion.querySelector('.ref-hub-cards')) {
    return hooks.reflexionsUebersicht;      // mitten im Ablauf → zurück zur Übersicht
  }
  if (tab && tab !== 'today') return hooks.zuHeute;
  return null;
}

function bewerten() {
  if (ignorieren > 0) return;               // ein Rückbau läuft noch
  const offen = obersteEbene() !== null;
  if (offen && !schutzAktiv) {
    history.pushState({ loewenherzZurueck: true }, '');
    schutzAktiv = true;
  } else if (!offen && schutzAktiv) {
    // Über die Oberfläche geschlossen: Schutz-Eintrag wieder entfernen,
    // damit die nächste Zurück-Taste im Startzustand die App beendet.
    schutzAktiv = false;
    ignorieren++;
    history.back();
  }
}

// Gedrosselt statt entprellt: Während Einblend-Animationen ändern sich
// laufend Klassen — ein Entprellen würde die Bewertung immer weiter
// hinausschieben. So läuft sie spätestens 250 ms nach der ersten Änderung.
function planen() {
  if (planTimer) return;
  planTimer = setTimeout(() => {
    planTimer = null;
    bewerten();
  }, 250);
}

export function initZurueckTaste(h) {
  if (hooks) return;
  hooks = h;

  if (isAndroid()) {
    nativePlugin('App').then((app) => {
      if (!app) return;
      app.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) history.back();
        else app.minimizeApp().catch(() => {});
      });
    }).catch((e) => console.warn('[Zurück] Android-Taste nicht angebunden:', e));
  }

  window.addEventListener('popstate', () => {
    if (ignorieren > 0) {
      ignorieren--;
      planen();
      return;
    }
    schutzAktiv = false;                    // der Eintrag ist verbraucht
    try {
      const schliessen = obersteEbene();
      if (schliessen) schliessen();
    } catch (e) {
      console.warn('[Zurück] Ebene ließ sich nicht schließen:', e);
    }
    planen();
  });

  // Jede Änderung an Overlays, Tabs und Ansichten neu bewerten — so muss
  // keine einzelne Ansicht von dieser Datei wissen.
  new MutationObserver(planen).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });
  planen();
}
