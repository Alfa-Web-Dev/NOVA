// Accent colours: light, "premium" tones. Each has a deeper variant for light mode so text and buttons stay readable.
export const ACCENTS = [
  { id: 'black', name: 'Black', dark: '#ececec', light: '#111111' },
  { id: 'lavender', name: 'Lavender', dark: '#a99bf0', light: '#6d5bd0' },
  { id: 'sky', name: 'Sky', dark: '#7cc4ff', light: '#1f7fd1' },
  { id: 'aqua', name: 'Aqua', dark: '#62dbe8', light: '#0e8fa0' },
  { id: 'mint', name: 'Mint', dark: '#6fe3c1', light: '#14916f' },
  { id: 'lemon', name: 'Lemon', dark: '#f2d46b', light: '#a67c00' },
  { id: 'peach', name: 'Peach', dark: '#ffb38a', light: '#cf6228' },
  { id: 'coral', name: 'Coral', dark: '#ff9a9a', light: '#cf3d3d' },
  { id: 'rose', name: 'Rose', dark: '#ff9fc0', light: '#cf4379' },
  { id: 'orchid', name: 'Orchid', dark: '#d7a1ff', light: '#9a3fd1' },
  { id: 'silver', name: 'Silver', dark: '#c5cad6', light: '#566074' },
];
export const accentById = (id) => ACCENTS.find((a) => a.id === id) || ACCENTS[0];

/** Sets the accent on <html>; everything (buttons, logo, menus, highlights) reads these variables. */
export function applyAccent(id, dark, root = document.documentElement) {
  const a = accentById(id), c = dark ? a.dark : a.light;
  root.style.setProperty('--accent', c);
  root.style.setProperty('--accent-ink', dark ? '#0b0b10' : '#ffffff');
  root.style.setProperty('--accent-soft', `color-mix(in srgb, ${c} ${dark ? 16 : 12}%, var(--bg))`);
  root.style.setProperty('--logo-acc', c);
  root.dataset.accent = a.id;
  return c;
}
