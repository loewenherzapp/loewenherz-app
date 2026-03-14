// ============================================================
// Bottom Sheet Component
// ============================================================

let sheetOverlay = null;
let sheetContainer = null;
let onCloseCallback = null;

export function initBottomSheet() {
  sheetOverlay = document.getElementById('sheet-overlay');
  sheetContainer = document.getElementById('sheet-container');
  sheetOverlay.addEventListener('click', closeSheet);
}

export function openSheet(title, options, onSelect) {
  const titleEl = sheetContainer.querySelector('.sheet-title');
  const optionsEl = sheetContainer.querySelector('.sheet-options');
  titleEl.textContent = title;
  optionsEl.innerHTML = '';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'sheet-option';
    btn.innerHTML = `<span class="sheet-option-emoji">${opt.emoji}</span><span>${opt.label}</span>`;
    btn.addEventListener('click', () => { if (navigator.vibrate) navigator.vibrate(50); onSelect(opt); closeSheet(); });
    optionsEl.appendChild(btn);
  });
  sheetOverlay.classList.add('open');
  sheetContainer.classList.add('open');
  onCloseCallback = null;
}

export function closeSheet() {
  sheetOverlay.classList.remove('open');
  sheetContainer.classList.remove('open');
  if (onCloseCallback) onCloseCallback();
}
