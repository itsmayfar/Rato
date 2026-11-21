/**
 * Renders the PNG app icons (home screen, manifest, Apple touch icon) from the
 * MAYFAR mark. Run: node scripts/generate-icons.mjs  (needs Chromium for playwright-core;
 * set CHROMIUM_PATH if it isn't at /opt/pw-browsers/chromium).
 */
import { chromium } from "playwright-core";

const mark = (stroke) =>
  `<path d="M14 46V18l18 18 18-18v28" fill="none" stroke="#fff" stroke-width="${stroke}" stroke-linejoin="miter"/>` +
  `<circle cx="32" cy="36" r="3.5" fill="#e0242d"/>`;

// Full-bleed square: the platform applies its own rounding/mask.
const square = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#000"/>${mark(3)}</svg>`;
// Maskable: keep the mark inside the central safe zone (~70%).
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#000"/><g transform="translate(9.6 9.6) scale(0.7)">${mark(3.6)}</g></svg>`;

const targets = [
  ["public/icons/icon-192.png", square, 192],
  ["public/icons/icon-512.png", square, 512],
  ["public/icons/icon-maskable-512.png", maskable, 512],
  ["src/app/apple-icon.png", square, 180],
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
for (const [file, svg, size] of targets) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<html><body style="margin:0">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: file, omitBackground: false });
  await page.close();
  console.log("wrote", file);
}
await browser.close();
