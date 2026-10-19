// Android edge-to-edge: MainActivity exposes the status/navigation bar (and keyboard) sizes; mirror them as CSS variables.
const root = typeof document !== 'undefined' ? document.documentElement : null;
export function applyInsets() {
  const n = typeof window !== 'undefined' ? window.NovaInsets : null;
  if (!root || !n) return;
  try { root.style.setProperty('--sat', `${n.top()}px`); root.style.setProperty('--sab', `${n.bottom()}px`); } catch { /* ignore */ }
}
if (typeof window !== 'undefined') {
  applyInsets();
  window.addEventListener('nova-insets', applyInsets); window.addEventListener('resize', applyInsets);
  [300, 1200, 3000].forEach((d) => setTimeout(applyInsets, d));
}
