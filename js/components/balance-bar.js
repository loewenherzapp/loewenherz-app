// ============================================================
// Balance Bar Component — Color-coded per SMALL letter
// ============================================================

const LETTERS = ['S', 'M', 'A', 'L1', 'L2'];

const LETTER_FILL_COLORS = {
  S:  'var(--color-S)',
  M:  'var(--color-M)',
  A:  'var(--color-A)',
  L1: 'var(--color-L1)',
  L2: 'var(--color-L2)'
};

export function renderBalanceBar(container, points) {
  container.innerHTML = '';

  const counts = {};
  LETTERS.forEach(l => counts[l] = 0);
  points.forEach(p => { if (counts[p.letter] !== undefined) counts[p.letter]++; });

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const bar = document.createElement('div');
  bar.className = 'balance-bar';

  LETTERS.forEach(letter => {
    const segment = document.createElement('div');
    segment.className = 'balance-segment';

    const fill = document.createElement('div');
    fill.className = 'balance-fill';
    fill.style.background = LETTER_FILL_COLORS[letter];

    const count = counts[letter];
    if (count === 0) {
      fill.style.width = '0%';
      fill.style.minWidth = '0';
    } else if (total === 0) {
      fill.style.width = '0%';
      fill.style.minWidth = '0';
    } else {
      const pct = (count / total) * 100;
      fill.style.width = `${Math.max(pct, 4)}%`;
    }

    segment.appendChild(fill);
    bar.appendChild(segment);
  });

  container.appendChild(bar);
}

// Legacy export name for history.js compatibility
export { renderBalanceBar as renderBalanceBars };
