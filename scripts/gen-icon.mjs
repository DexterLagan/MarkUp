import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const W = 1024;
const H = 1024;
const R = 208;

function inRect(x, y) {
  if (x >= R && x <= W - 1 - R) return true;
  if (y >= R && y <= H - 1 - R) return true;
  const dx = x < R ? x - R : x - (W - 1 - R);
  const dy = y < R ? y - R : y - (H - 1 - R);
  return dx * dx + dy * dy <= R * R;
}

function inArrow(x, y) {
  const dx = x - W / 2;
  if (Math.abs(dx) <= 70 && y >= 292 && y <= 652) return true;
  if (y >= 540 && y <= 800) {
    const hw = 232 * (1 - (y - 540) / 260);
    if (Math.abs(dx) <= hw) return true;
  }
  return false;
}

function coverage(f, x, y) {
  let c = 0;
  for (const sy of [0.25, 0.75])
    for (const sx of [0.25, 0.75]) if (f(x + sx, y + sy)) c += 1;
  return c / 4;
}

let table;
function crc32(buf) {
  if (!table) {
    table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

const stride = 1 + W * 4;
const raw = Buffer.alloc(H * stride);
for (let y = 0; y < H; y += 1) {
  raw[y * stride] = 0;
  const t = y / (H - 1);
  for (let x = 0; x < W; x += 1) {
    const o = y * stride + 1 + x * 4;
    const aRect = coverage(inRect, x, y);
    if (aRect === 0) continue;
    let r = 10 + (94 - 10) * t;
    let g = 132 + (92 - 132) * t;
    let b = 255 + (230 - 255) * t;
    const aArrow = coverage(inArrow, x, y) * 0.97;
    if (aArrow > 0) {
      r += (255 - r) * aArrow;
      g += (255 - g) * aArrow;
      b += (255 - b) * aArrow;
    }
    raw[o] = Math.round(r);
    raw[o + 1] = Math.round(g);
    raw[o + 2] = Math.round(b);
    raw[o + 3] = Math.round(aRect * 255);
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 6;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);
writeFileSync(new URL("../icon-source.png", import.meta.url), png);
console.log("wrote icon-source.png (1024x1024)");
