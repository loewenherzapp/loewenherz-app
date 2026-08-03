// ============================================================
// Time Picker — eigenes Bottom-Sheet statt <input type="time">
// ============================================================
//
// Warum nicht das native Feld: Der Zeitdialog gehört dem Browser, nicht
// uns — er ist von der Seite aus weder stylbar noch reparierbar. Auf
// Android schneidet er bei vergrößerter Systemschrift den „Festlegen"-
// Button rechts ab, und sein „Löschen"-Button hinterlässt ein leeres
// Feld, aus dem der "00:NaN"-Bug entstand. Auf iOS sieht er wieder ganz
// anders aus. Ein eigenes Sheet löst alle drei Probleme auf einmal.
//
// Das 15-Minuten-Raster ist hier Struktur statt Nachbearbeitung: Es gibt
// nur 00/15/30/45 zur Auswahl, also kann kein krummer Wert entstehen.
// roundTo15Min() bleibt trotzdem nötig — für Altbestand aus der Zeit der
// nativen Felder.
// ============================================================

import { roundTo15Min } from '../push.js';

const MINUTES = ['00', '15', '30', '45'];
const FALLBACK = '12:00';

// Nur ein Sheet gleichzeitig. Ohne den Riegel legt ein Doppeltap zwei
// Overlays übereinander und das untere bleibt für immer im DOM.
let activeOverlay = null;

/**
 * Markup für den Auslöser. Trägt bewusst weiter die Klasse .reminder-time:
 * Alle Layout-Regeln der Screens (.push-setting-time, .push-small-slot,
 * .reminder-slot) greifen damit unverändert weiter.
 * @param {string} attrs  Zusätzliche Attribute, z.B. 'id="push-morning-time"'
 */
export function renderTimeButton(attrs, time) {
  return `<button type="button" class="reminder-time" ${attrs} data-time="${time}"><span class="reminder-time-value">${time}</span><span class="reminder-time-caret" aria-hidden="true">▾</span></button>`;
}

/** Zeit im Auslöser setzen. data-time ist die Wahrheit, nicht der Text. */
export function setTimeButtonValue(btn, time) {
  btn.dataset.time = time;
  btn.querySelector('.reminder-time-value').textContent = time;
}

/**
 * Öffnet den Zeit-Picker.
 * @param {string} title    Überschrift im Sheet, z.B. "Morgenkompass"
 * @param {string} value    Aktuelle Zeit "HH:MM" (ungültig → 12:00)
 * @param {function} onSelect  Bekommt die gewählte Zeit als "HH:MM".
 *                             Wird bei Abbruch NICHT gerufen.
 */
export function openTimePicker(title, value, onSelect) {
  if (activeOverlay) return;

  const start = roundTo15Min(value) || FALLBACK;
  let selH = start.slice(0, 2);
  let selM = start.slice(3, 5);

  const overlay = document.createElement('div');
  overlay.className = 'time-picker-overlay';
  overlay.innerHTML = `
    <div class="time-picker-sheet" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="sheet-grip"></div>
      <div class="sheet-title">${title}</div>
      <div class="time-picker-cols">
        <div class="time-picker-col" data-unit="h">
          ${Array.from({ length: 24 }, (_, i) => {
            const h = String(i).padStart(2, '0');
            return `<button type="button" class="time-picker-opt${h === selH ? ' is-selected' : ''}" data-v="${h}">${h}</button>`;
          }).join('')}
        </div>
        <div class="time-picker-sep">:</div>
        <div class="time-picker-col" data-unit="m">
          ${MINUTES.map(m =>
            `<button type="button" class="time-picker-opt${m === selM ? ' is-selected' : ''}" data-v="${m}">${m}</button>`
          ).join('')}
        </div>
      </div>
      <button type="button" class="btn-primary time-picker-apply">Übernehmen</button>
    </div>
  `;

  document.body.appendChild(overlay);
  activeOverlay = overlay;

  // Gewählte Stunde mittig in ihre Spalte scrollen. Bewusst nicht
  // scrollIntoView(): das scrollt im WKWebView auch die Seite dahinter.
  for (const col of overlay.querySelectorAll('.time-picker-col')) {
    const sel = col.querySelector('.is-selected');
    if (sel) col.scrollTop = sel.offsetTop - col.clientHeight / 2 + sel.clientHeight / 2;
  }

  function close() {
    if (activeOverlay !== overlay) return;
    activeOverlay = null;
    overlay.classList.remove('open');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => overlay.remove(), 200);
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  overlay.addEventListener('click', (e) => {
    // Tap neben das Sheet = abbrechen, onSelect bleibt ungerufen.
    if (e.target === overlay) { close(); return; }

    const opt = e.target.closest('.time-picker-opt');
    if (opt) {
      const col = opt.closest('.time-picker-col');
      col.querySelectorAll('.is-selected').forEach(el => el.classList.remove('is-selected'));
      opt.classList.add('is-selected');
      if (col.dataset.unit === 'h') selH = opt.dataset.v;
      else selM = opt.dataset.v;
      return;
    }

    if (e.target.closest('.time-picker-apply')) {
      if (navigator.vibrate) navigator.vibrate(50);
      const picked = `${selH}:${selM}`;
      close();
      onSelect(picked);
    }
  });

  document.addEventListener('keydown', onKey);

  // Layout-Durchlauf erzwingen, damit die Transition vom Startzustand aus
  // läuft. Bewusst synchron statt über requestAnimationFrame: rAF feuert
  // nicht, solange das Dokument versteckt ist. Wandert die App genau
  // zwischen Tap und Animationsstart in den Hintergrund, bliebe das Sheet
  // sonst dauerhaft unsichtbar im DOM — und würde als Overlay jeden
  // weiteren Tap schlucken. Die App wäre bedienungsunfähig.
  void overlay.offsetHeight;
  overlay.classList.add('open');
}
