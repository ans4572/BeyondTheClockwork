import fs from 'node:fs';

/** Width and height of a PNG or a WebP (lossless VP8L, lossy VP8 or extended VP8X) from its header. */
export function imageSize(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 1, 4) === 'PNG') return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') throw new Error(`not a PNG or WebP: ${file}`);
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8L') { const [b0, b1, b2, b3] = [b[21], b[22], b[23], b[24]]; return [1 + (((b1 & 0x3f) << 8) | b0), 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6))]; }
  if (chunk === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (chunk === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  throw new Error(`unknown WebP chunk ${chunk}: ${file}`);
}
