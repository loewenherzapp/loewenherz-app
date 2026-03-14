// ============================================================
// Balance Bar Component
// ============================================================

const LETTERS = ['S', 'M', 'A', 'L1', 'L2'];
const DISPLAY = ['S', 'M', 'A', 'L₁', 'L₂'];

export function renderBalanceBars(container, points) {
  container.innerHTML = '';
  const counts = {};
  LETTERS.forEach(l => counts[l] = 0);
  points.forEach(p => { if (counts[p.letter] !== undefined) counts[p.letter]++; });
  const max = Math.max(...Object.values(counts), 1);
  LETTERS.forEach((letter, i) => {
    const row = document.createElement('div');
    row.className = 'balance-row';
    const lbl = document.createElement('div');
    lbl.className = 'balance-letter';
    lbl.textContent = DISPLAY[i];
    const track = document.createElement('div');
    track.className = 'balance-track';
    const fill = document.createElement('div');
    fill.className = 'balance-fill';
    const count = counts[letter];
    if (count === 0) { fill.style.width = '6px'; fill.style.opacity = '0.3'; }
    else { const pct = (count / max) * 100; fill.style.width = `${Math.max(pct, 5)}%`; }
    track.appendChild(fill);
    row.appendChild(lbl);
    row.appendChild(track);
    container.appendChild(row);
  });
}
