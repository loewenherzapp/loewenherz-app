// ============================================================
// Sound Picker — Auswahl des Benachrichtigungstons (nur iOS-App)
// ============================================================
//
// Gleiches Chassis wie der Time-Picker (Overlay + Sheet von unten),
// aber ohne Übernehmen-Schritt: Ein Tap wählt den Ton sofort UND
// spielt ihn vor — wer durchhört, hat am Ende automatisch das gewählt,
// was zuletzt geklungen hat. „Fertig" schließt nur noch.
//
// Das Sheet darf beim Tap deshalb NICHT zuklappen (anders als das
// SMALL-Bottom-Sheet): Töne vergleicht man, indem man mehrere
// nacheinander anspielt.
// ============================================================

import { SOUND_OPTIONS, getSound, setSound } from '../notification-sound.js';

// Nur ein Sheet gleichzeitig — gleicher Riegel wie im Time-Picker.
let activeOverlay = null;

// Ein gemeinsames Audio-Element, src wird pro Vorhören getauscht.
// Lazy erzeugt: Das Modul lädt auch im Web (statischer Import in
// settings.js), gebraucht wird es nur nativ.
let previewAudio = null;

function playPreview(src) {
  if (!src) return; // iOS-Systemton: keine Vorschau möglich
  try {
    if (!previewAudio) previewAudio = new Audio();
    previewAudio.pause();
    previewAudio.src = src;
    previewAudio.currentTime = 0;
    const p = previewAudio.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {
    // Silent — ein stummes Vorhören darf die Auswahl nicht blockieren
  }
}

/**
 * Öffnet den Ton-Picker.
 * @param {function} onChange  Bekommt die gewählte id nach jedem Tap —
 *                             die Auswahl gilt sofort, nicht erst beim
 *                             Schließen. Aufrufer aktualisiert Anzeige
 *                             und stößt den Tag-Sync an.
 */
export function openSoundPicker(onChange) {
  if (activeOverlay) return;

  const overlay = document.createElement('div');
  overlay.className = 'sound-picker-overlay';
  overlay.innerHTML = `
    <div class="sound-picker-sheet" role="dialog" aria-modal="true" aria-label="Benachrichtigungston">
      <div class="sheet-grip"></div>
      <div class="sheet-title">Benachrichtigungston</div>
      <div class="sound-picker-hint">Tippen spielt den Ton ab</div>
      <div class="sound-picker-opts">
        ${SOUND_OPTIONS.map(o =>
          `<button type="button" class="sound-picker-opt${o.id === getSound() ? ' is-selected' : ''}" data-id="${o.id}"><span class="sound-picker-opt-label">${o.label}${o.preview ? '' : '<span class="sound-picker-note">kein Vorhören möglich</span>'}</span><span class="sound-picker-check" aria-hidden="true">✓</span></button>`
        ).join('')}
      </div>
      <button type="button" class="btn-primary sound-picker-done">Fertig</button>
    </div>
  `;

  document.body.appendChild(overlay);
  activeOverlay = overlay;

  // Nachlebendes Overlay während der Ausblend-Animation — gleiche Falle,
  // gleicher Riegel wie im Time-Picker.
  let closed = false;

  function close() {
    if (closed) return;
    closed = true;
    if (activeOverlay === overlay) activeOverlay = null;
    if (previewAudio) previewAudio.pause();
    overlay.classList.remove('open');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => overlay.remove(), 200);
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  overlay.addEventListener('click', (e) => {
    if (closed) return;

    if (e.target === overlay) { close(); return; }

    const opt = e.target.closest('.sound-picker-opt');
    if (opt) {
      if (navigator.vibrate) navigator.vibrate(50);
      overlay.querySelectorAll('.is-selected').forEach(el => el.classList.remove('is-selected'));
      opt.classList.add('is-selected');
      const id = opt.dataset.id;
      setSound(id);
      playPreview((SOUND_OPTIONS.find(o => o.id === id) || {}).preview);
      onChange(id);
      return;
    }

    if (e.target.closest('.sound-picker-done')) close();
  });

  document.addEventListener('keydown', onKey);

  // Synchron statt rAF — rAF feuert bei verstecktem Dokument nicht,
  // das Sheet bliebe unsichtbar im DOM und schluckte jeden Tap.
  void overlay.offsetHeight;
  overlay.classList.add('open');
}
