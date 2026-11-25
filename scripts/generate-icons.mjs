import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const SIZES = [16, 32, 48, 128];
const OUTPUT_DIR = path.resolve(process.cwd(), 'public/icons');

// CRC32 table for valid PNG chunk generation
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter None
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function sdRoundedBox(px, py, bx, by, r) {
  const qx = Math.abs(px) - bx + r;
  const qy = Math.abs(py) - by + r;
  return (
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
    Math.min(Math.max(qx, qy), 0) -
    r
  );
}

function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const supersample = 4;
  const step = 1 / supersample;

  // Brand colors: #6255E7 -> deep indigo #4A3DD4 gradient
  const topR = 114, topG = 102, topB = 242;
  const botR = 82, botG = 69, botB = 216;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let accR = 0;
      let accG = 0;
      let accB = 0;
      let accA = 0;

      for (let sy = 0; sy < supersample; sy++) {
        for (let sx = 0; sx < supersample; sx++) {
          const u = (x + (sx + 0.5) * step) / size;
          const v = (y + (sy + 0.5) * step) / size;
          const cx = u - 0.5;
          const cy = v - 0.5;

          const bgDist = sdRoundedBox(cx, cy, 0.46, 0.46, 0.22);
          if (bgDist > 0) continue;

          // Subtle vertical gradient
          const t = clamp((v - 0.05) / 0.9, 0, 1);
          let r = topR + (botR - topR) * t;
          let g = topG + (botG - topG) * t;
          let b = topB + (botB - topB) * t;

          // Geometric Tavriqelo mark: clean T crossbar + stem + expansion chevron dot
          const topBar = sdRoundedBox(cx, cy + 0.17, 0.27, 0.068, 0.032);
          const stem = sdRoundedBox(cx + 0.04, cy - 0.05, 0.068, 0.22, 0.032);
          // Forward expansion slash / spark bar on lower right
          const expandBar = sdRoundedBox(cx - 0.17, cy - 0.17, 0.09, 0.055, 0.025);

          const isGlyph = topBar <= 0 || stem <= 0 || expandBar <= 0;
          if (isGlyph) {
            r = 255;
            g = 255;
            b = 255;
          }

          accR += r;
          accG += g;
          accB += b;
          accA += 255;
        }
      }

      const samples = supersample * supersample;
      const idx = (y * size + x) * 4;
      const alpha = Math.round(accA / samples);
      if (alpha > 0) {
        rgba[idx] = Math.round(accR / (accA / 255));
        rgba[idx + 1] = Math.round(accG / (accA / 255));
        rgba[idx + 2] = Math.round(accB / (accA / 255));
        rgba[idx + 3] = alpha;
      }
    }
  }

  return encodePNG(size, size, rgba);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
for (const size of SIZES) {
  const png = renderIcon(size);
  const target = path.join(OUTPUT_DIR, `icon${size}.png`);
  fs.writeFileSync(target, png);
  console.log(`Generated ${target} (${png.length} bytes)`);
}
