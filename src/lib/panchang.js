// Panchang (Hindu calendar) computed on the device — no network, works offline.
// Low-precision astronomy (Meeus): Moon ±0.3°, so tithi/nakshatra timings are accurate to about an hour. Good for daily use;
// for ritual timings people should confirm with a local almanac. Uses Lahiri ayanamsa and the calendar day of the user's device.
const rad = (d) => (d * Math.PI) / 180, norm = (d) => ((d % 360) + 360) % 360;
const jd = (ms) => ms / 86400000 + 2440587.5;

export function sunLon(ms) {
  const T = (jd(ms) - 2451545) / 36525;
  const L0 = 280.46646 + 36000.76983 * T, M = rad(357.52911 + 35999.05029 * T);
  return norm(L0 + 1.914602 * Math.sin(M) + 0.019993 * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M));
}
export function moonLon(ms) {
  const T = (jd(ms) - 2451545) / 36525;
  const L = 218.3164477 + 481267.88123421 * T, D = rad(297.8501921 + 445267.1114034 * T), M = rad(357.5291092 + 35999.0502909 * T);
  const Mp = rad(134.9633964 + 477198.8675055 * T), F = rad(93.272095 + 483202.0175233 * T);
  return norm(L + 6.289 * Math.sin(Mp) + 1.274 * Math.sin(2 * D - Mp) + 0.658 * Math.sin(2 * D) + 0.214 * Math.sin(2 * Mp) - 0.186 * Math.sin(M) - 0.114 * Math.sin(2 * F)
    + 0.059 * Math.sin(2 * D - 2 * Mp) + 0.057 * Math.sin(2 * D - M - Mp) + 0.053 * Math.sin(2 * D + Mp) + 0.046 * Math.sin(2 * D - M) + 0.041 * Math.sin(M - Mp) - 0.035 * Math.sin(D) - 0.031 * Math.sin(M + Mp));
}
const ayanamsa = (ms) => 23.853 + 0.013969 * ((jd(ms) - 2451545) / 365.25); // Lahiri, degrees

export const TITHIS = ['Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi'];
export const NAKSHATRAS = ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'];
export const YOGAS = ['Vishkambha', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana', 'Atiganda', 'Sukarma', 'Dhriti', 'Shula', 'Ganda', 'Vriddhi', 'Dhruva', 'Vyaghata', 'Harshana', 'Vajra', 'Siddhi', 'Vyatipata', 'Variyana', 'Parigha', 'Shiva', 'Siddha', 'Sadhya', 'Shubha', 'Shukla', 'Brahma', 'Indra', 'Vaidhriti'];
export const VARA = [['Sunday', 'Ravivara'], ['Monday', 'Somavara'], ['Tuesday', 'Mangalavara'], ['Wednesday', 'Budhavara'], ['Thursday', 'Guruvara'], ['Friday', 'Shukravara'], ['Saturday', 'Shanivara']];

/** Tithi number 1..30 (1–15 Shukla, 16–30 Krishna) at the moment `ms`. */
export const tithiAt = (ms) => Math.floor(norm(moonLon(ms) - sunLon(ms)) / 12) + 1;
export const tithiName = (n) => (n === 15 ? 'Purnima' : n === 30 ? 'Amavasya' : TITHIS[(n - 1) % 15]);

/** First moment after `ms` when `fn` changes value (10-minute steps, then refined to the minute). */
function nextChange(ms, fn, maxHours = 40) {
  const start = fn(ms); let t = ms;
  for (let i = 0; i < maxHours * 6; i++) { const n = t + 600000; if (fn(n) !== start) { let lo = t, hi = n; while (hi - lo > 60000) { const mid = (lo + hi) / 2; if (fn(mid) === start) lo = mid; else hi = mid; } return hi; } t = n; }
  return null;
}

export function panchang(ms = Date.now()) {
  const sun = sunLon(ms), moon = moonLon(ms), ay = ayanamsa(ms);
  const t = tithiAt(ms), nk = Math.floor(norm(moon - ay) / (360 / 27)), yg = Math.floor(norm(sun + moon - 2 * ay) / (360 / 27));
  const d = new Date(ms);
  return {
    vara: VARA[d.getDay()], tithi: t, tithiName: tithiName(t), paksha: t <= 15 ? 'Shukla (waxing)' : 'Krishna (waning)',
    nakshatra: NAKSHATRAS[nk % 27], yoga: YOGAS[yg % 27],
    tithiEnds: nextChange(ms, tithiAt), nakshatraEnds: nextChange(ms, (x) => Math.floor(norm(moonLon(x) - ayanamsa(x)) / (360 / 27))),
    moonPhase: Math.round((1 - Math.cos(rad(norm(moon - sun)))) / 2 * 100),
  };
}
