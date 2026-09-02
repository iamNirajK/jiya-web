import fs from 'fs';
import zlib from 'zlib';

function createPNG(width, height, r, g, b, alpha = 255) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth 8
  ihdrData.writeUInt8(6, 9); // color type RGBA
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Raw image data: filter byte 0 + RGBA pixels
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // None filter

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      
      // Draw rounded rect & gradient icon effect
      const dx = x - width / 2;
      const dy = y - height / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxR = width * 0.45;

      if (dist < maxR) {
        // Indigo / purple gradient
        const t = (x + y) / (width + height);
        const curR = Math.round(99 * (1 - t) + 236 * t);
        const curG = Math.round(102 * (1 - t) + 72 * t);
        const curB = Math.round(241 * (1 - t) + 153 * t);

        rawData[pxOffset] = curR;
        rawData[pxOffset + 1] = curG;
        rawData[pxOffset + 2] = curB;
        rawData[pxOffset + 3] = 255;
      } else {
        // Dark background (#0f172a)
        rawData[pxOffset] = 15;
        rawData[pxOffset + 1] = 23;
        rawData[pxOffset + 2] = 42;
        rawData[pxOffset + 3] = 255;
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(8 + length + 4);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crc = crc32(chunk.subarray(4, 8 + length));
  chunk.writeUInt32BE(crc, 8 + length);
  return chunk;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const table = new Int32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  table[i] = c;
}

fs.writeFileSync('public/pwa-192x192.png', createPNG(192, 192, 99, 102, 241));
fs.writeFileSync('public/pwa-512x512.png', createPNG(512, 512, 99, 102, 241));
fs.writeFileSync('public/pwa-maskable-512x512.png', createPNG(512, 512, 99, 102, 241));
fs.writeFileSync('public/apple-touch-icon.png', createPNG(180, 180, 99, 102, 241));
console.log('PNG Icons generated successfully!');
