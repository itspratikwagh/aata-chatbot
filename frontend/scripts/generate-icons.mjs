#!/usr/bin/env node
/**
 * Generates the PWA / apple-touch PNG icons from a single vector design.
 * Pure Node (zlib only) — no native deps. Run: `node scripts/generate-icons.mjs`.
 * Renders at 2x and box-downsamples for anti-aliasing.
 */
import zlib from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(OUT_DIR, { recursive: true });

const CYAN = [0, 174, 239];
const INDIGO = [99, 102, 241];
const WHITE = [255, 255, 255];

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];

function inRoundedRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x;
  const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

// Render the design into an RGBA buffer of side*side at the given resolution.
function render(side) {
  const buf = new Uint8ClampedArray(side * side * 4);
  const put = (x, y, [r, g, b], a = 255) => {
    const i = (y * side + x) * 4;
    const ia = a / 255;
    buf[i] = buf[i] * (1 - ia) + r * ia;
    buf[i + 1] = buf[i + 1] * (1 - ia) + g * ia;
    buf[i + 2] = buf[i + 2] * (1 - ia) + b * ia;
    buf[i + 3] = Math.max(buf[i + 3], a);
  };

  const S = side;
  const outerR = S * 0.22;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // Gradient background within a rounded square.
      if (inRoundedRect(x, y, 0, 0, S - 1, S - 1, outerR)) {
        const t = (x + y) / (2 * S);
        put(x, y, mix(CYAN, INDIGO, t));
      }
    }
  }

  // White speech bubble.
  const bx0 = S * 0.235,
    by0 = S * 0.235,
    bx1 = S * 0.765,
    by1 = S * 0.64,
    br = S * 0.08;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (inRoundedRect(x, y, bx0, by0, bx1, by1, br)) put(x, y, WHITE);
    }
  }
  // Bubble tail (triangle pointing down-left).
  const tax = S * 0.33,
    tay = by1 - 2,
    tbx = S * 0.46,
    tby = by1 - 2,
    tcx = S * 0.33,
    tcy = S * 0.73;
  const sign = (ax, ay, bx, by, cx, cy) => (ax - cx) * (by - cy) - (bx - cx) * (ay - cy);
  for (let y = Math.floor(by0); y < S * 0.75; y++) {
    for (let x = Math.floor(bx0); x < bx1; x++) {
      const d1 = sign(x, y, tax, tay, tbx, tby);
      const d2 = sign(x, y, tbx, tby, tcx, tcy);
      const d3 = sign(x, y, tcx, tcy, tax, tay);
      const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
      const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
      if (!(hasNeg && hasPos)) put(x, y, WHITE);
    }
  }

  // Three gradient bars (analytics motif) inside the bubble.
  const barW = S * 0.075;
  const bars = [
    { x: S * 0.33, top: S * 0.45 },
    { x: S * 0.465, top: S * 0.38 },
    { x: S * 0.6, top: S * 0.32 },
  ];
  const barBottom = S * 0.56;
  const barR = S * 0.025;
  for (const bar of bars) {
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        if (inRoundedRect(x, y, bar.x, bar.top, bar.x + barW, barBottom, barR)) {
          const t = (x + y) / (2 * S);
          put(x, y, mix(CYAN, INDIGO, t));
        }
      }
    }
  }

  return buf;
}

// Box-downsample 2x for anti-aliasing.
function downsample2x(src, side) {
  const out = side / 2;
  const dst = new Uint8ClampedArray(out * out * 4);
  for (let y = 0; y < out; y++) {
    for (let x = 0; x < out; x++) {
      for (let c = 0; c < 4; c++) {
        const s = (yy, xx) => src[((yy * side + xx) * 4) + c];
        dst[(y * out + x) * 4 + c] =
          (s(2 * y, 2 * x) + s(2 * y, 2 * x + 1) + s(2 * y + 1, 2 * x) + s(2 * y + 1, 2 * x + 1)) / 4;
      }
    }
  }
  return { buf: dst, side: out };
}

// Minimal PNG (RGBA, 8-bit) encoder.
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(rgba, side) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(side, 0);
  ihdr.writeUInt32BE(side, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // raw with per-row filter byte 0
  const stride = side * 4;
  const raw = Buffer.alloc((stride + 1) * side);
  for (let y = 0; y < side; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function makeIcon(size, name) {
  const hi = render(size * 2);
  const { buf, side } = downsample2x(hi, size * 2);
  const png = encodePng(buf, side);
  const path = join(OUT_DIR, name);
  writeFileSync(path, png);
  console.log(`wrote ${path} (${png.length} bytes)`);
}

makeIcon(512, "icon-512.png");
makeIcon(192, "icon-192.png");
makeIcon(180, "apple-touch-icon.png");
