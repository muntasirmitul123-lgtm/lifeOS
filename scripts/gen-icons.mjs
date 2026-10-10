import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const combined = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createIconPNG(size, maskable = false) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const center = size / 2;
  const outerRingR = size * (maskable ? 0.28 : 0.32);
  const outerRingThickness = size * 0.05;
  const innerDotR = size * (maskable ? 0.085 : 0.1);

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filter type 0
    for (let x = 0; x < size; x++) {
      const idx = rowStart + 1 + x * 4;
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Default background: #0B0F0D (11, 15, 13)
      let r = 11, g = 15, b = 13, a = 255;

      // Subtle inner card #111713
      const pad = maskable ? size * 0.08 : size * 0.06;
      if (x >= pad && x < size - pad && y >= pad && y < size - pad) {
        r = 17; g = 23; b = 19;
      }

      // Ring track #1D2620
      if (Math.abs(dist - outerRingR) <= outerRingThickness / 2) {
        r = 29; g = 38; b = 32;
        // Progress arc in #79D99A (121, 217, 154)
        const angle = Math.atan2(dy, dx);
        if (angle > -Math.PI * 0.75 && angle < Math.PI * 0.65) {
          r = 121; g = 217; b = 154;
        }
      }

      // Center core #79D99A
      if (dist <= innerDotR) {
        r = 121; g = 217; b = 154;
      }

      raw[idx] = r;
      raw[idx + 1] = g;
      raw[idx + 2] = b;
      raw[idx + 3] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(raw);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

const pubDir = path.resolve('public');
if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true });

fs.writeFileSync(path.join(pubDir, 'apple-touch-icon.png'), createIconPNG(180, false));
fs.writeFileSync(path.join(pubDir, 'pwa-192x192.png'), createIconPNG(192, false));
fs.writeFileSync(path.join(pubDir, 'pwa-512x512.png'), createIconPNG(512, false));
fs.writeFileSync(path.join(pubDir, 'pwa-maskable-512x512.png'), createIconPNG(512, true));
console.log('Generated PWA PNG icons successfully.');
