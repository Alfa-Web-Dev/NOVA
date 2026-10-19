/** "Husne Ara" -> "HA"; "Aarif" -> "A"; empty -> "N". */
export function initials(name) {
  const w = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!w.length) return 'N';
  const first = Array.from(w[0])[0] || 'N';
  return (w.length > 1 ? first + (Array.from(w[w.length - 1])[0] || '') : first).toUpperCase();
}
