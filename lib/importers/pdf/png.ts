/**
 * Tiny, dependency-free PNG encoder for raw pixel buffers — Node only.
 *
 * `unpdf`'s `extractImages` hands back DECODED pixels (`data` + `width`/`height`
 * + `channels`), not the original encoded bytes, so to ship an image to the
 * browser we must re-encode it. The obvious tools (sharp, @napi-rs/canvas) are
 * heavy native deps that aren't declared here and complicate the cross-platform
 * Vercel build — so instead we hand-assemble a PNG using only Node built-ins:
 * `zlib` for the IDAT stream and a small CRC for the chunk checksums. Runs server-
 * side in the parse route (Node runtime), never in the browser bundle.
 */
import { deflateSync } from "node:zlib";

// Standard PNG/zlib CRC-32 table, built once.
const CRC_TABLE: number[] = (() => {
  const table: number[] = new Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Frame a PNG chunk: length, type, data, CRC(type+data). */
function chunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, "latin1");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/**
 * Encode 8-bit raw pixels to a PNG buffer. `channels` maps to PNG color type:
 * 1 → grayscale, 3 → RGB, 4 → RGBA. Each scanline is prefixed with filter byte 0
 * ("none") and the whole stream is zlib-deflated into a single IDAT.
 */
export function rawToPng(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  channels: 1 | 3 | 4,
): Buffer {
  const colorType = channels === 1 ? 0 : channels === 3 ? 2 : 6;
  const stride = width * channels;

  // Prepend a per-row filter byte (0 = none) to the raw scanlines.
  const filtered = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    filtered[y * (stride + 1)] = 0;
    const srcStart = data.byteOffset + y * stride;
    Buffer.from(data.buffer, srcStart, stride).copy(filtered, y * (stride + 1) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = colorType;
  ihdr[10] = 0; // compression: deflate
  ihdr[11] = 0; // filter method: adaptive
  ihdr[12] = 0; // interlace: none

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(filtered)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
