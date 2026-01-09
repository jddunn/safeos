#!/usr/bin/env node
/**
 * Generate PWA icons from logo.svg
 *
 * Usage: node scripts/generate-icons.js
 */

import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const UI_PUBLIC = join(__dirname, '../apps/guardian-ui/public');
const ICONS_DIR = join(UI_PUBLIC, 'icons');
const LOGO_SVG = join(UI_PUBLIC, 'logo.svg');

// Icon sizes for PWA manifest
const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

// Favicon sizes
const FAVICON_SIZES = [16, 32];

// Apple touch icon
const APPLE_TOUCH_SIZE = 180;

async function generateIcons() {
  console.log('Generating PWA icons from logo.svg...\n');

  // Ensure icons directory exists
  if (!existsSync(ICONS_DIR)) {
    mkdirSync(ICONS_DIR, { recursive: true });
  }

  const svgBuffer = readFileSync(LOGO_SVG);

  // Generate PWA icons
  for (const size of ICON_SIZES) {
    const outputPath = join(ICONS_DIR, `icon-${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`  Created: icons/icon-${size}.png`);
  }

  // Generate favicons
  for (const size of FAVICON_SIZES) {
    const outputPath = join(UI_PUBLIC, `favicon-${size}x${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`  Created: favicon-${size}x${size}.png`);
  }

  // Generate Apple touch icon
  const appleIconPath = join(UI_PUBLIC, 'apple-touch-icon.png');
  await sharp(svgBuffer)
    .resize(APPLE_TOUCH_SIZE, APPLE_TOUCH_SIZE)
    .png()
    .toFile(appleIconPath);
  console.log(`  Created: apple-touch-icon.png (${APPLE_TOUCH_SIZE}x${APPLE_TOUCH_SIZE})`);

  // Generate shortcut icons (using same logo, could customize later)
  const shortcutSizes = [
    { name: 'shortcut-monitor.png', size: 96 },
    { name: 'shortcut-alerts.png', size: 96 },
  ];

  for (const { name, size } of shortcutSizes) {
    const outputPath = join(ICONS_DIR, name);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`  Created: icons/${name}`);
  }

  console.log('\nAll icons generated successfully!');
}

generateIcons().catch(console.error);
