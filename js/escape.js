// ============================================================
// HTML-Maskierung für Nutzertexte
// ============================================================
// Alles, was ein Nutzer eingibt (Name, Dankbarkeit, eigene Intention),
// läuft durch esc(), bevor es in ein Template kommt. Ohne das beendet ein
// Anführungszeichen im Namen das value-Attribut (der Auto-Save speichert
// dann den verstümmelten Rest), ein < schluckt den Text dahinter, und ein
// <img onerror> aus einem fremden Backup führt Code aus.

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
