// Draws the PWA icons from scratch so the repo needs no binary design assets and
// no image library. Run with `pnpm icons` after changing the brand color.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

const GREEN = [22, 163, 74];
const WHITE = [255, 255, 255];

const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}

function crc32(buffer) {
  let c = -1;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // 8 bits per channel
  header[9] = 6; // truecolor with alpha

  const stride = size * 4 + 1;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y += 1) {
    pixels.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Rounded square, or the full canvas when the radius is zero (maskable icons). */
function inBackground(x, y, radius) {
  if (radius === 0) return true;
  const dx = Math.max(radius - x, x - (1 - radius), 0);
  const dy = Math.max(radius - y, y - (1 - radius), 0);
  return dx * dx + dy * dy <= radius * radius;
}

/** A shopping basket: half-ring handle over a slitted trapezoid body. */
function inBasket(x, y, scale) {
  const gx = (x - 0.5) / scale;
  const gy = (y - 0.5) / scale;

  const handle = Math.hypot(gx, gy + 0.1);
  if (gy + 0.1 <= 0 && handle >= 0.17 && handle <= 0.22) return true;

  if (gy < -0.1 || gy > 0.26) return false;

  const halfWidth = 0.34 - 0.11 * ((gy + 0.1) / 0.36);
  if (Math.abs(gx) > halfWidth) return false;
  if (gy <= -0.03) return true; // solid rim

  const relative = Math.abs(gx) / halfWidth;
  return relative > 0.1 && Math.abs(relative - 0.42) > 0.1;
}

const SAMPLES = 3;

function draw(size, { radius, glyphScale }) {
  const pixels = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let background = 0;
      let glyph = 0;

      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const x = (px + (sx + 0.5) / SAMPLES) / size;
          const y = (py + (sy + 0.5) / SAMPLES) / size;
          if (!inBackground(x, y, radius)) continue;
          background += 1;
          if (inBasket(x, y, glyphScale)) glyph += 1;
        }
      }

      const total = SAMPLES * SAMPLES;
      const alpha = background / total;
      const glyphRatio = background === 0 ? 0 : glyph / background;
      const offset = (py * size + px) * 4;

      for (let channel = 0; channel < 3; channel += 1) {
        pixels[offset + channel] = Math.round(
          GREEN[channel] * (1 - glyphRatio) + WHITE[channel] * glyphRatio,
        );
      }
      pixels[offset + 3] = Math.round(alpha * 255);
    }
  }

  return encodePng(size, pixels);
}

mkdirSync(OUT_DIR, { recursive: true });

const icons = [
  ["icon-192.png", 192, { radius: 0.22, glyphScale: 0.8 }],
  ["icon-512.png", 512, { radius: 0.22, glyphScale: 0.8 }],
  ["icon-maskable-512.png", 512, { radius: 0, glyphScale: 0.6 }],
];

for (const [name, size, options] of icons) {
  writeFileSync(join(OUT_DIR, name), draw(size, options));
  console.log(`wrote public/icons/${name}`);
}
