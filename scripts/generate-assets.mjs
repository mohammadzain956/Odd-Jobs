// Regenerates the app icons and splash art from vector definitions.
// Run: node scripts/generate-assets.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const GREEN = '#1E7A46';
const CREAM = '#F6F5F0';
const AMBER = '#C25E00';

// The "OJ" monogram, drawn as pure geometry (font-independent) in a 108 box.
const monogram = `
  <circle cx="40" cy="48" r="15" fill="none" stroke="${CREAM}" stroke-width="8.5"/>
  <path d="M74 30 V50 q0 12 -12 12" fill="none" stroke="${CREAM}" stroke-width="8.5" stroke-linecap="round"/>
  <rect x="28" y="74" width="52" height="7.5" rx="3.75" fill="${AMBER}"/>
`;

// Full-bleed icon: green field + monogram.
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">
  <rect width="108" height="108" fill="${GREEN}"/>
  ${monogram}
</svg>`;

// Android adaptive foreground: monogram scaled into the safe zone, transparent.
const adaptiveSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">
  <g transform="translate(54 54) scale(0.82) translate(-50.5 -53.5)">${monogram}</g>
</svg>`;

// Splash mark: monogram only, transparent (the plugin paints the green behind it).
const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">
  <g transform="translate(54 54) scale(0.92) translate(-53.5 -53.5)">${monogram}</g>
</svg>`;

mkdirSync('assets', { recursive: true });

async function render(svg, size, out) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(out);
  console.log('wrote', out, size + 'px');
}

await render(iconSvg, 1024, 'assets/icon.png');
await render(adaptiveSvg, 1024, 'assets/android-icon-foreground.png');
await render(iconSvg, 196, 'assets/favicon.png');
await render(splashSvg, 1024, 'assets/splash-icon.png');
console.log('done');
