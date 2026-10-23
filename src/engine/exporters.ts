import { TerrainDataMap } from '../types/terrain';

// Simple CRC32 implementation for PNG chunks
function makeCRCTable(): Uint32Array {
  let c: number;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
}

const crcTable = makeCRCTable();

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Generate genuine 16-bit Grayscale PNG for displacement (avoiding banding in Blender/Unreal/Houdini)
export function create16BitPNG(data: Float32Array, width: number, height: number): Blob {
  // Uncompressed PNG using Deflate uncompressed blocks (type 00)
  // Each scanline has 1 filter byte (0) + width * 2 bytes (16-bit big-endian)
  const scanlineLength = 1 + width * 2;
  const rawData = new Uint8Array(height * scanlineLength);

  let rawIdx = 0;
  for (let y = 0; y < height; y++) {
    rawData[rawIdx++] = 0; // Filter: None
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const v = Math.max(0, Math.min(1, data[row + x]));
      const val16 = Math.floor(v * 65535.0);
      rawData[rawIdx++] = (val16 >>> 8) & 0xff; // High byte
      rawData[rawIdx++] = val16 & 0xff;        // Low byte
    }
  }

  // Deflate wrapper with stored (uncompressed) blocks (max 65535 bytes per block)
  const BLOCK_SIZE = 65535;
  const numBlocks = Math.ceil(rawData.length / BLOCK_SIZE);
  // zlib header (2) + blocks (5 per block + data) + adler32 (4)
  const zlibLen = 2 + numBlocks * 5 + rawData.length + 4;
  const idatData = new Uint8Array(zlibLen);

  let zIdx = 0;
  idatData[zIdx++] = 0x78; // CMF: Deflate, 32K window
  idatData[zIdx++] = 0x01; // FLG: No compression

  // Compute Adler32
  let s1 = 1;
  let s2 = 0;
  for (let i = 0; i < rawData.length; i++) {
    s1 = (s1 + rawData[i]) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  const adler = ((s2 << 16) | s1) >>> 0;

  let offset = 0;
  for (let b = 0; b < numBlocks; b++) {
    const isLast = b === numBlocks - 1;
    const len = Math.min(BLOCK_SIZE, rawData.length - offset);
    idatData[zIdx++] = isLast ? 0x01 : 0x00; // BFINAL, BTYPE=00 (stored)
    idatData[zIdx++] = len & 0xff;
    idatData[zIdx++] = (len >>> 8) & 0xff;
    const nlen = len ^ 0xffff;
    idatData[zIdx++] = nlen & 0xff;
    idatData[zIdx++] = (nlen >>> 8) & 0xff;
    idatData.set(rawData.subarray(offset, offset + len), zIdx);
    zIdx += len;
    offset += len;
  }

  // Append Adler-32 (big-endian)
  idatData[zIdx++] = (adler >>> 24) & 0xff;
  idatData[zIdx++] = (adler >>> 16) & 0xff;
  idatData[zIdx++] = (adler >>> 8) & 0xff;
  idatData[zIdx++] = adler & 0xff;

  // Build PNG chunks: Signature + IHDR + IDAT + IEND
  const chunks: Uint8Array[] = [];

  // Signature
  chunks.push(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));

  // IHDR chunk: 13 bytes
  const ihdrBuf = new Uint8Array(17);
  ihdrBuf.set(new TextEncoder().encode('IHDR'), 0);
  const view = new DataView(ihdrBuf.buffer);
  view.setUint32(4, width, false);
  view.setUint32(8, height, false);
  ihdrBuf[12] = 16; // 16 bits per sample
  ihdrBuf[13] = 0;  // ColorType: Grayscale
  ihdrBuf[14] = 0;  // Compression method
  ihdrBuf[15] = 0;  // Filter method
  ihdrBuf[16] = 0;  // Interlace: None

  const ihdrLen = new Uint8Array(4);
  new DataView(ihdrLen.buffer).setUint32(0, 13, false);
  const ihdrCrc = new Uint8Array(4);
  new DataView(ihdrCrc.buffer).setUint32(0, crc32(ihdrBuf), false);
  chunks.push(ihdrLen, ihdrBuf, ihdrCrc);

  // IDAT chunk
  const idatChunk = new Uint8Array(4 + idatData.length);
  idatChunk.set(new TextEncoder().encode('IDAT'), 0);
  idatChunk.set(idatData, 4);

  const idatLen = new Uint8Array(4);
  new DataView(idatLen.buffer).setUint32(0, idatData.length, false);
  const idatCrc = new Uint8Array(4);
  new DataView(idatCrc.buffer).setUint32(0, crc32(idatChunk), false);
  chunks.push(idatLen, idatChunk, idatCrc);

  // IEND chunk
  const iendBuf = new TextEncoder().encode('IEND');
  const iendChunk = new Uint8Array(4);
  iendChunk.set(iendBuf, 0);
  const iendLen = new Uint8Array(4); // 0
  const iendCrc = new Uint8Array(4);
  new DataView(iendCrc.buffer).setUint32(0, crc32(iendChunk), false);
  chunks.push(iendLen, iendChunk, iendCrc);

  return new Blob(chunks as any[], { type: 'image/png' });
}

// Generate Wavefront OBJ mesh
export function exportOBJMesh(
  dataMap: TerrainDataMap,
  heightScale: number = 4.0,
  stepStride: number = 1
): string {
  const { width, height, heightmap } = dataMap;
  const lines: string[] = [
    '# VTerrain Engine OBJ Export',
    '# Generated procedurally',
    `# Resolution: ${width}x${height}, Stride: ${stepStride}`,
    'o VTerrain_Surface',
  ];

  const cols = Math.floor((width - 1) / stepStride) + 1;
  const rows = Math.floor((height - 1) / stepStride) + 1;

  const halfW = 10.0;
  const halfH = 10.0;

  // Vertices and UVs
  for (let r = 0; r < rows; r++) {
    const y = Math.min(height - 1, r * stepStride);
    const posZ = (y / (height - 1) - 0.5) * halfH * 2.0;
    const v = y / (height - 1);

    for (let c = 0; c < cols; c++) {
      const x = Math.min(width - 1, c * stepStride);
      const posX = (x / (width - 1) - 0.5) * halfW * 2.0;
      const posY = heightmap[y * width + x] * heightScale;
      const u = x / (width - 1);

      lines.push(`v ${posX.toFixed(4)} ${posY.toFixed(4)} ${posZ.toFixed(4)}`);
      lines.push(`vt ${u.toFixed(4)} ${(1.0 - v).toFixed(4)}`);
    }
  }

  // Normals (simple up default or calculated)
  lines.push('vn 0.0000 1.0000 0.0000');

  // Faces (1-indexed quad meshes triangulated)
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const i0 = r * cols + c + 1;
      const i1 = r * cols + (c + 1) + 1;
      const i2 = (r + 1) * cols + (c + 1) + 1;
      const i3 = (r + 1) * cols + c + 1;

      // Triangle 1: i0, i1, i2
      lines.push(`f ${i0}/${i0}/1 ${i1}/${i1}/1 ${i2}/${i2}/1`);
      // Triangle 2: i0, i2, i3
      lines.push(`f ${i0}/${i0}/1 ${i2}/${i2}/1 ${i3}/${i3}/1`);
    }
  }

  return lines.join('\n');
}

// Generate PBR Texture map via HTML Canvas
export function createPBRTextureMap(
  dataMap: TerrainDataMap,
  mapType: 'albedo' | 'normal' | 'packed_data' | 'flow' | 'deposition' | 'wear'
): string {
  const { width, height, heightmap, flowmap, deposition, wear } = dataMap;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(width, height);
  const buf = imgData.data;

  for (let y = 0; y < height; y++) {
    const row = y * width;
    const yUp = y > 0 ? y - 1 : 0;
    const yDn = y < height - 1 ? y + 1 : height - 1;

    for (let x = 0; x < width; x++) {
      const idx = row + x;
      const pixelIdx = idx * 4;

      const h = heightmap[idx];
      const fl = flowmap[idx];
      const dep = deposition[idx];
      const w = wear[idx];

      if (mapType === 'packed_data') {
        // RGBA: R=Height, G=Flow, B=Deposition, A=Wear
        buf[pixelIdx] = Math.floor(h * 255);
        buf[pixelIdx + 1] = Math.floor(fl * 255);
        buf[pixelIdx + 2] = Math.floor(dep * 255);
        buf[pixelIdx + 3] = Math.floor(w * 255);
      } else if (mapType === 'normal') {
        const xL = x > 0 ? x - 1 : 0;
        const xR = x < width - 1 ? x + 1 : width - 1;
        const hL = heightmap[row + xL];
        const hR = heightmap[row + xR];
        const hD = heightmap[yDn * width + x];
        const hU = heightmap[yUp * width + x];

        const dx = (hL - hR) * 12.0;
        const dy = (hD - hU) * 12.0;
        const dz = 1.0;
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const nx = (dx / len) * 0.5 + 0.5;
        const ny = (dy / len) * 0.5 + 0.5;
        const nz = (dz / len) * 0.5 + 0.5;

        buf[pixelIdx] = Math.floor(nx * 255);
        buf[pixelIdx + 1] = Math.floor(ny * 255);
        buf[pixelIdx + 2] = Math.floor(nz * 255);
        buf[pixelIdx + 3] = 255;
      } else if (mapType === 'albedo') {
        // Realistic multi-biome geological albedo
        // Grass / moss for flat valleys with sediment
        let r = 0.22, g = 0.26, b = 0.16;

        // Sand / silt in deposition
        if (dep > 0.2) {
          const t = Math.min(1.0, dep * 1.5);
          r = r * (1 - t) + 0.52 * t;
          g = g * (1 - t) + 0.44 * t;
          b = b * (1 - t) + 0.32 * t;
        }

        // Exposed steep bedrock
        if (w > 0.35) {
          const t = Math.min(1.0, (w - 0.35) * 1.8);
          r = r * (1 - t) + 0.28 * t;
          g = g * (1 - t) + 0.26 * t;
          b = b * (1 - t) + 0.25 * t;
        }

        // River veins (flow)
        if (fl > 0.3) {
          const t = Math.min(1.0, (fl - 0.3) * 1.8);
          r = r * (1 - t) + 0.12 * t;
          g = g * (1 - t) + 0.35 * t;
          b = b * (1 - t) + 0.45 * t;
        }

        // Snow on high peaks
        if (h > 0.65) {
          const t = Math.min(1.0, (h - 0.65) * 4.0) * (1.0 - w * 0.6);
          r = r * (1 - t) + 0.94 * t;
          g = g * (1 - t) + 0.96 * t;
          b = b * (1 - t) + 0.99 * t;
        }

        buf[pixelIdx] = Math.floor(r * 255);
        buf[pixelIdx + 1] = Math.floor(g * 255);
        buf[pixelIdx + 2] = Math.floor(b * 255);
        buf[pixelIdx + 3] = 255;
      } else if (mapType === 'flow') {
        const val = Math.floor(fl * 255);
        buf[pixelIdx] = Math.floor(val * 0.1);
        buf[pixelIdx + 1] = Math.floor(val * 0.7);
        buf[pixelIdx + 2] = val;
        buf[pixelIdx + 3] = 255;
      } else if (mapType === 'deposition') {
        const val = Math.floor(dep * 255);
        buf[pixelIdx] = val;
        buf[pixelIdx + 1] = Math.floor(val * 0.8);
        buf[pixelIdx + 2] = Math.floor(val * 0.4);
        buf[pixelIdx + 3] = 255;
      } else if (mapType === 'wear') {
        const val = Math.floor(w * 255);
        buf[pixelIdx] = val;
        buf[pixelIdx + 1] = Math.floor(val * 0.4);
        buf[pixelIdx + 2] = Math.floor(val * 0.2);
        buf[pixelIdx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

// Download helper utility
export function downloadFile(content: Blob | string, filename: string) {
  const blob = typeof content === 'string' ? new Blob([content], { type: 'text/plain' }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
