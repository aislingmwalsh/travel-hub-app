// scripts/generate-icons.js
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

// Simple pure-node PNG generator
function createPngBuffer(width, height, drawPixelFn) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8-bit depth
  ihdrData.writeUInt8(6, 9); // RGBA (color type 6)
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Raw image data with filter byte (0 = none) at start of each scanline
  const scanlineWidth = 1 + width * 4;
  const rawData = Buffer.alloc(height * scanlineWidth);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineWidth;
    rawData.writeUInt8(0, rowOffset); // filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawPixelFn(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData.writeUInt8(r, pxOffset);
      rawData.writeUInt8(g, pxOffset + 1);
      rawData.writeUInt8(b, pxOffset + 2);
      rawData.writeUInt8(a, pxOffset + 3);
    }
  }

  // IDAT chunk (compressed)
  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = data.length;
  const buffer = Buffer.alloc(8 + length + 4);
  buffer.writeUInt32BE(length, 0);
  buffer.write(type, 4, 4, 'ascii');
  data.copy(buffer, 8);
  const crc = crc32(buffer.subarray(4, 8 + length));
  buffer.writeInt32BE(crc, 8 + length);
  return buffer;
}

// CRC32 implementation for PNG chunks
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        if (c & 1) c = 0xedb88320 ^ (c >>> 1);
        else c = c >>> 1;
      }
      table[n] = c;
    }
    crc32.table = table;
  }

  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return crc ^ -1;
}

// Draw a modern gradient background with a clean airplane/travel emblem
function drawTravelIcon(x, y, width, height, isMaskable = false) {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 2;
  const cornerRadius = isMaskable ? 0 : width * 0.22; // rounded app icon

  // Normalized coordinates (-1 to 1)
  const nx = (x - cx) / (width / 2);
  const ny = (y - cy) / (height / 2);

  // Check rounded rect boundary (or square for maskable)
  if (!isMaskable) {
    const rx = Math.abs(x - cx);
    const ry = Math.abs(y - cy);
    const innerW = width / 2 - cornerRadius;
    const innerH = height / 2 - cornerRadius;
    if (rx > innerW && ry > innerH) {
      const dist = Math.hypot(rx - innerW, ry - innerH);
      if (dist > cornerRadius) {
        return [0, 0, 0, 0]; // transparent outside
      }
    }
  }

  // Deep Royal Blue to Indigo to Purple Gradient
  const gradT = (x / width + y / height) / 2;
  // Gradient from #2563EB (37, 99, 235) to #7C3AED (124, 58, 237)
  const bgR = Math.round(37 + (124 - 37) * gradT);
  const bgG = Math.round(99 + (58 - 99) * gradT);
  const bgB = Math.round(235 + (237 - 235) * gradT);

  // Airplane Geometry (Normalized inside circle radius ~ 0.55)
  // Rotate by ~-35 degrees for an ascending flight angle
  const angle = -35 * (Math.PI / 180);
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  // Shift center slightly for optical balance
  const px = nx * cosA - ny * sinA;
  const py = nx * sinA + ny * cosA;

  // Let's draw an elegant paper plane / jet silhouette in crisp white (#FFFFFF)
  // Nose at (0, -0.48), Left wing tip at (-0.38, 0.35), Right wing tip at (0.38, 0.35), Tail cleft at (0, 0.18)
  const scale = 1.0;
  const sx = px / scale;
  const sy = (py + 0.05) / scale;

  let isAirplane = false;
  let isShade = false;

  // Triangle checks:
  // Left wing: (0, -0.48), (-0.42, 0.40), (0, 0.22)
  // Right wing: (0, -0.48), (0.42, 0.40), (0, 0.22)
  if (sy >= -0.48 && sy <= 0.40) {
    if (sx <= 0 && sx >= -0.42) {
      // Line from (0, -0.48) to (-0.42, 0.40):
      const maxLeft = -0.42 * ((sy + 0.48) / 0.88);
      // Line from (0, 0.22) to (-0.42, 0.40):
      const bottomLimit = 0.22 + (0.40 - 0.22) * (-sx / 0.42);
      if (sx >= maxLeft && sy <= bottomLimit) {
        isAirplane = true;
        isShade = false; // Left wing bright white
      }
    } else if (sx > 0 && sx <= 0.42) {
      // Line from (0, -0.48) to (0.42, 0.40):
      const maxRight = 0.42 * ((sy + 0.48) / 0.88);
      // Line from (0, 0.22) to (0.42, 0.40):
      const bottomLimit = 0.22 + (0.40 - 0.22) * (sx / 0.42);
      if (sx <= maxRight && sy <= bottomLimit) {
        isAirplane = true;
        isShade = true; // Right wing slight shadow/depth
      }
    }
  }

  // Draw globe latitude/longitude faint rings in background
  const distFromCenter = Math.hypot(nx, ny);
  const isRing1 = Math.abs(distFromCenter - 0.68) < 0.015;
  const isRing2 = Math.abs(distFromCenter - 0.40) < 0.012;

  if (isAirplane) {
    if (isShade) {
      return [230, 240, 255, 255]; // Soft blue-tinted white
    }
    return [255, 255, 255, 255]; // Pure crisp white
  }

  if (isRing1 || isRing2) {
    return [
      Math.min(255, bgR + 45),
      Math.min(255, bgG + 45),
      Math.min(255, bgB + 45),
      255
    ];
  }

  return [bgR, bgG, bgB, 255];
}

console.log('Generating PWA Icons in /public...');

const iconConfigs = [
  { file: 'pwa-192x192.png', size: 192, maskable: false },
  { file: 'pwa-512x512.png', size: 512, maskable: false },
  { file: 'maskable-icon-512x512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: false }
];

for (const config of iconConfigs) {
  const buf = createPngBuffer(config.size, config.size, (x, y, w, h) =>
    drawTravelIcon(x, y, w, h, config.maskable)
  );
  const destPath = path.join(publicDir, config.file);
  fs.writeFileSync(destPath, buf);
  console.log(`✓ Created ${config.file} (${config.size}x${config.size})`);
}

console.log('All PWA icons generated successfully!');
