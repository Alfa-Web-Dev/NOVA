// Generates every PNG icon from the brand masks in /branding. Run: npm run icons
//   branding/nova-spiral.png  – the Nova spiral (single-colour alpha mask)
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const BG = '#0b0b10', INK_ON_DARK = '#b99cff', ACCENT = '#b99cff';

/** a solid colour shaped by a mask's alpha channel */
async function tinted(maskFile, size, color) {
  const { data } = await sharp(maskFile).resize(size, size).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const [r, g, b] = color.match(/[0-9a-f]{2}/gi).map((h) => parseInt(h, 16));
  const out = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) { out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = data[i * 4 + 3]; }
  return sharp(out, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
}

/** the full logo, transparent background, drawn at `fraction` of the canvas */
async function mark(canvas, fraction, ink = INK_ON_DARK, accent = ACCENT) {
  const s = Math.round(canvas * fraction), off = Math.round((canvas - s) / 2);
  const layers = [[await tinted('branding/nova-spiral.png', s, accent)]];
  return sharp({ create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers.map(([input]) => ({ input, left: off, top: off }))).png().toBuffer();
}

async function tile(size, { fraction, radius = 0, bg = BG, ink, accent }) {
  const art = await mark(size, fraction, ink, accent);
  const base = radius
    ? sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${Math.round(size * radius)}" fill="${bg}"/></svg>`))
    : sharp({ create: { width: size, height: size, channels: 4, background: bg } });
  return base.composite([{ input: art }]).png();
}

await mkdir('public/icons', { recursive: true });
await mkdir('resources', { recursive: true });
const jobs = [
  ['public/icons/icon-192.png', 192, { fraction: 0.62, radius: 0.22 }],
  ['public/icons/icon-512.png', 512, { fraction: 0.62, radius: 0.22 }],
  ['public/icons/apple-touch-icon.png', 180, { fraction: 0.64 }],          // iOS rounds the corners itself
  ['public/icons/maskable-512.png', 512, { fraction: 0.56 }],              // full-bleed, artwork inside the 80 % safe zone
  ['public/icons/favicon-64.png', 64, { fraction: 0.8, radius: 0.22 }],
  ['public/icons/favicon-32.png', 32, { fraction: 0.82, radius: 0.22 }],
  ['resources/icon.png', 1024, { fraction: 0.56 }],                         // Android launcher source (adaptive-icon safe zone)
];
for (const [file, size, o] of jobs) { await (await tile(size, o)).toFile(file); console.log('wrote', file); }

// splash: dark canvas, small centred mark
await (await tile(2732, { fraction: 0.22 })).toFile('resources/splash.png');
await (await tile(2732, { fraction: 0.22 })).toFile('resources/splash-dark.png');
console.log('wrote resources/splash*.png');

// light-background lockup used in the README and social previews
await sharp(await mark(1024, 0.9, '#7c5cf0', '#7c5cf0')).toFile('branding/nova-logo-light.png');
await sharp(await mark(1024, 0.9, INK_ON_DARK, ACCENT)).toFile('branding/nova-logo-dark.png');
console.log('wrote branding/nova-logo-*.png');
