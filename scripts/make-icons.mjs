/**
 * Generate PWA icons (192/512 + maskable 512) as real PNGs with zero
 * dependencies — a tiny pure-JS PNG encoder over node's zlib.
 * Design: deep-green rounded square, three grass blades, soil shadow.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(root, { recursive: true });

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// Colors: bg deep green, blades light/mid green, shadow dark.
const BG = [29, 77, 43, 255];
const BLADE_A = [127, 176, 105, 255];
const BLADE_B = [168, 213, 162, 255];
const SHADOW = [14, 26, 18, 90];

function blade(buf, w, h, cx, baseY, height, width, lean, color) {
  for (let y = 0; y < height; y++) {
    const t = y / height; // 0 at base → 1 at tip
    const halfW = (width / 2) * (1 - t * 0.92);
    const x = Math.round(cx + lean * t * height * 0.35);
    const py = Math.round(baseY - y);
    for (let dx = -Math.ceil(halfW); dx <= Math.ceil(halfW); dx++) {
      if (Math.abs(dx) > halfW) continue;
      const px = x + dx;
      if (px < 0 || px >= w || py < 0 || py >= h) continue;
      const i = (py * w + px) * 4;
      // simple alpha blend over existing pixel
      const a = color[3] / 255;
      buf[i] = Math.round(color[0] * a + buf[i] * (1 - a));
      buf[i + 1] = Math.round(color[1] * a + buf[i + 1] * (1 - a));
      buf[i + 2] = Math.round(color[2] * a + buf[i + 2] * (1 - a));
      buf[i + 3] = 255;
    }
  }
}

function roundedRect(buf, w, h, r, color) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cx = Math.min(Math.max(x, r), w - 1 - r);
      const cy = Math.min(Math.max(y, r), h - 1 - r);
      const dx = x - cx, dy = y - cy;
      const inside = dx * dx + dy * dy <= r * r || (x >= r && x < w - r) || (y >= r && y < h - r);
      const i = (y * w + x) * 4;
      if (inside) { buf[i] = color[0]; buf[i + 1] = color[1]; buf[i + 2] = color[2]; buf[i + 3] = 255; }
      else { buf[i + 3] = 0; }
    }
  }
}

function makeIcon(size, maskable) {
  const buf = Buffer.alloc(size * size * 4);
  const pad = maskable ? Math.round(size * 0.12) : 0;
  const w = size - pad * 2;
  roundedRect(buf, size, size, maskable ? 0 : Math.round(size * 0.22), BG);
  // soil shadow ellipse
  const cy = pad + w * 0.84;
  for (let x = 0; x < size; x++) {
    const t = Math.abs(x - size / 2) / (size * 0.32);
    if (t > 1) continue;
    const halfH = Math.round(size * 0.035 * (1 - t * t));
    for (let dy = -halfH; dy <= halfH; dy++) {
      const py = Math.round(cy + dy);
      if (py < 0 || py >= size) continue;
      const i = (py * size + x) * 4;
      const a = SHADOW[3] / 255;
      buf[i] = Math.round(SHADOW[0] * a + buf[i] * (1 - a));
      buf[i + 1] = Math.round(SHADOW[1] * a + buf[i + 1] * (1 - a));
      buf[i + 2] = Math.round(SHADOW[2] * a + buf[i + 2] * (1 - a));
    }
  }
  const baseY = pad + w * 0.8;
  blade(buf, size, size, size * 0.36, baseY, w * 0.52, w * 0.10, -1, BLADE_A);
  blade(buf, size, size, size * 0.5, baseY, w * 0.66, w * 0.11, 0.1, BLADE_B);
  blade(buf, size, size, size * 0.64, baseY, w * 0.46, w * 0.09, 1, BLADE_A);
  return encodePng(size, size, buf);
}

writeFileSync(join(root, 'icon-192.png'), makeIcon(192, false));
writeFileSync(join(root, 'icon-512.png'), makeIcon(512, false));
writeFileSync(join(root, 'icon-maskable-512.png'), makeIcon(512, true));
console.log('icons written to', root);
