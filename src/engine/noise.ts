import { SatMapBiome } from '../types/terrain';

// Deterministic Pseudo-Random Number Generator (Mulberry32)
export function createPRNG(seed: number) {
  let s = Math.floor(seed) >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 2D Simplex Noise implementation with seeded permutations
export class SimplexNoise {
  private perm = new Uint8Array(512);
  private permMod12 = new Uint8Array(512);

  private grad3 = new Float32Array([
    1, 1, 0,
    -1, 1, 0,
    1, -1, 0,
    -1, -1, 0,
    1, 0, 1,
    -1, 0, 1,
    1, 0, -1,
    -1, 0, -1,
    0, 1, 1,
    0, -1, 1,
    0, 1, -1,
    0, -1, -1,
  ]);

  constructor(seed: number = 42) {
    this.reseed(seed);
  }

  public reseed(seed: number) {
    const prng = createPRNG(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }
    // Fisher-Yates shuffle
    for (let i = 255; i > 0; i--) {
      const r = Math.floor(prng() * (i + 1));
      const tmp = p[i];
      p[i] = p[r];
      p[r] = tmp;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.permMod12[i] = (p[i & 255] % 12);
    }
  }

  public noise2D(xin: number, yin: number): number {
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);

    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;

    let i1: number;
    let j1: number;
    if (x0 > y0) {
      i1 = 1;
      j1 = 0;
    } else {
      i1 = 0;
      j1 = 1;
    }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    const ii = i & 255;
    const jj = j & 255;

    let n0 = 0.0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      const gi0 = this.permMod12[ii + this.perm[jj]] * 3;
      t0 *= t0;
      n0 = t0 * t0 * (this.grad3[gi0] * x0 + this.grad3[gi0 + 1] * y0);
    }

    let n1 = 0.0;
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]] * 3;
      t1 *= t1;
      n1 = t1 * t1 * (this.grad3[gi1] * x1 + this.grad3[gi1 + 1] * y1);
    }

    let n2 = 0.0;
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]] * 3;
      t2 *= t2;
      n2 = t2 * t2 * (this.grad3[gi2] * x2 + this.grad3[gi2 + 1] * y2);
    }

    return 70.0 * (n0 + n1 + n2);
  }
}

// Math helpers
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

// Voronoi / Worley Noise
export function voronoi2D(
  x: number,
  y: number,
  seed: number,
  jitter: number = 1.0,
  distanceType: 'f1' | 'f2' | 'f2_minus_f1' = 'f1'
): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let minD1 = 999.0;
  let minD2 = 999.0;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cellX = xi + dx;
      const cellY = yi + dy;

      const h = ((cellX * 374761393 + cellY * 668265263 + seed * 961748941) ^ 0x5bf03635) >>> 0;
      const rx = (h & 0xffff) / 65535.0;
      const ry = ((h >>> 16) & 0xffff) / 65535.0;

      const px = cellX + rx * jitter;
      const py = cellY + ry * jitter;

      const dist = Math.sqrt((x - px) * (x - px) + (y - py) * (y - py));

      if (dist < minD1) {
        minD2 = minD1;
        minD1 = dist;
      } else if (dist < minD2) {
        minD2 = dist;
      }
    }
  }

  if (distanceType === 'f2') return Math.min(1.0, minD2);
  if (distanceType === 'f2_minus_f1') return Math.min(1.0, (minD2 - minD1) * 1.5);
  return Math.min(1.0, minD1);
}

// Fractal Brownian Motion (FBM)
export function fbm2D(
  simplex: SimplexNoise,
  x: number,
  y: number,
  octaves: number = 6,
  lacunarity: number = 2.0,
  persistence: number = 0.5
): number {
  let value = 0;
  let amplitude = 1.0;
  let frequency = 1.0;
  let maxAmp = 0;

  for (let o = 0; o < octaves; o++) {
    value += simplex.noise2D(x * frequency, y * frequency) * amplitude;
    maxAmp += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return (value / maxAmp) * 0.5 + 0.5;
}

// Billow noise
export function billow2D(
  simplex: SimplexNoise,
  x: number,
  y: number,
  octaves: number = 5,
  lacunarity: number = 2.0,
  persistence: number = 0.5
): number {
  let value = 0;
  let amplitude = 1.0;
  let frequency = 1.0;
  let maxAmp = 0;

  for (let o = 0; o < octaves; o++) {
    const n = simplex.noise2D(x * frequency, y * frequency);
    value += Math.abs(n) * amplitude;
    maxAmp += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return Math.min(1.0, Math.max(0.0, value / maxAmp));
}

// Ridged Multi-fractal
export function ridged2D(
  simplex: SimplexNoise,
  x: number,
  y: number,
  octaves: number = 6,
  lacunarity: number = 2.1,
  persistence: number = 0.5,
  sharpness: number = 2.0
): number {
  let value = 0;
  let amplitude = 1.0;
  let frequency = 1.0;
  let weight = 1.0;
  let maxAmp = 0;

  for (let o = 0; o < octaves; o++) {
    let n = simplex.noise2D(x * frequency, y * frequency);
    n = 1.0 - Math.abs(n);
    n = Math.pow(n, sharpness);
    n *= weight;
    weight = Math.min(1.0, Math.max(0.0, n * 2.0));

    value += n * amplitude;
    maxAmp += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return Math.min(1.0, Math.max(0.0, value / maxAmp));
}

// Gaea Signature: Mountain Primitive (Mountain peaks with ridge folding)
export function mountain2D(
  simplex: SimplexNoise,
  x: number,
  y: number,
  octaves: number = 7,
  lacunarity: number = 2.1,
  persistence: number = 0.52,
  ridgePower: number = 2.4
): number {
  // Domain warp for geological folding
  const warpX = simplex.noise2D(x * 0.8, y * 0.8) * 0.35;
  const warpY = simplex.noise2D((x + 10.5) * 0.8, (y + 10.5) * 0.8) * 0.35;

  const wx = x + warpX;
  const wy = y + warpY;

  // Primary mountain ridge core
  const r = ridged2D(simplex, wx, wy, octaves, lacunarity, persistence, ridgePower);
  // Secondary billow mass
  const b = billow2D(simplex, wx * 0.7, wy * 0.7, 4, 2.0, 0.5);

  const combined = Math.pow(r, 1.4) * 0.75 + b * 0.25;
  return clamp(combined, 0.0, 1.0);
}

// Gaea Signature: Crater / Volcano Primitive
export function crater2D(
  simplex: SimplexNoise,
  x: number,
  y: number,
  rimRadius: number = 0.45,
  rimHeight: number = 0.8,
  calderaDepth: number = 0.45,
  centralPeak: number = 0.3
): number {
  // Dist from center [0, 1] mapped to [-1, 1]
  const dist = Math.sqrt(x * x + y * y);
  const angle = Math.atan2(y, x);

  // Irregular rim noise
  const rimNoise = simplex.noise2D(Math.cos(angle) * 2.5, Math.sin(angle) * 2.5) * 0.08;
  const actualRadius = rimRadius + rimNoise;

  let elevation = 0;
  if (dist < actualRadius) {
    // Inside caldera bowl
    const t = dist / actualRadius;
    const bowl = Math.pow(t, 2.2) * rimHeight - (1.0 - t) * calderaDepth;
    // Central volcanic cone
    const cone = Math.max(0, 1.0 - dist / (actualRadius * 0.35)) * centralPeak;
    elevation = bowl + cone;
  } else {
    // Outer volcanic apron falloff
    const t = (dist - actualRadius) * 2.2;
    elevation = rimHeight / (1.0 + t * t * 3.5);
  }

  // Micro rugged noise
  const detail = fbm2D(simplex, x * 4.0, y * 4.0, 4, 2.0, 0.45) * 0.12;
  return clamp(elevation + detail, 0.0, 1.0);
}

// Gaea Signature: Canyon Primitive (Stepped plateaus with meandering carved gorges)
export function canyon2D(
  simplex: SimplexNoise,
  x: number,
  y: number,
  canyonDepth: number = 0.65,
  strataSteps: number = 10
): number {
  // Meandering gorge curve
  const meander = simplex.noise2D(x * 1.2, 0.5) * 0.4;
  const distToRiver = Math.abs(y - meander);

  // Base plateau
  const baseNoise = fbm2D(simplex, x * 1.5, y * 1.5, 5, 2.0, 0.5);
  let height = baseNoise * 0.2 + 0.8;

  // Carve gorge
  const gorgeWidth = 0.35 + simplex.noise2D(x * 3.0, y * 3.0) * 0.1;
  if (distToRiver < gorgeWidth) {
    const t = distToRiver / gorgeWidth;
    const carve = Math.pow(t, 1.8);
    height -= (1.0 - carve) * canyonDepth;
  }

  // Quantize canyon walls into strata steps
  const scaled = height * strataSteps;
  const step = Math.floor(scaled);
  const frac = scaled - step;
  const stepped = (step + Math.pow(frac, 2.5)) / strataSteps;

  return clamp(stepped * 0.7 + height * 0.3, 0.0, 1.0);
}

// Geological Strata Terraces function
export function applyTerrace(
  elevation: number,
  stepCount: number = 8,
  smoothness: number = 0.25,
  sharpness: number = 1.0
): number {
  if (stepCount <= 1) return elevation;
  const scaled = elevation * stepCount;
  const step = Math.floor(scaled);
  const frac = scaled - step;

  const halfSmooth = Math.max(0.001, smoothness * 0.5);
  let blendedFrac: number;

  if (frac < halfSmooth) {
    const t = frac / halfSmooth;
    blendedFrac = 0.5 * (t * t * (3 - 2 * t));
  } else if (frac > 1.0 - halfSmooth) {
    const t = (frac - (1.0 - halfSmooth)) / halfSmooth;
    blendedFrac = 0.5 + 0.5 * (t * t * (3 - 2 * t));
  } else {
    blendedFrac = 0.5;
  }

  const terraced = (step + Math.pow(frac, sharpness) * (1 - (1 - smoothness)) + blendedFrac * (1 - smoothness)) / stepCount;
  return Math.min(1.0, Math.max(0.0, terraced * 0.75 + elevation * 0.25));
}

// Autolevel / Normalize function (Stretches elevation to full [0, 1] range)
export function applyAutoLevel(heightmap: Float32Array): Float32Array {
  let minVal = 9999.0;
  let maxVal = -9999.0;
  const len = heightmap.length;

  for (let i = 0; i < len; i++) {
    const v = heightmap[i];
    if (v < minVal) minVal = v;
    if (v > maxVal) maxVal = v;
  }

  const out = new Float32Array(len);
  const range = maxVal - minVal;
  if (range <= 0.0001) {
    out.set(heightmap);
    return out;
  }

  for (let i = 0; i < len; i++) {
    out[i] = (heightmap[i] - minVal) / range;
  }
  return out;
}

// Surface Curvature calculation (Convex ridges vs Concave valleys)
export function computeCurvatureMap(
  heightmap: Float32Array,
  width: number,
  height: number
): Float32Array {
  const curvature = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    const rowUp = (y - 1) * width;
    const rowDn = (y + 1) * width;
    for (let x = 1; x < width - 1; x++) {
      const c = heightmap[row + x];
      const l = heightmap[row + x - 1];
      const r = heightmap[row + x + 1];
      const u = heightmap[rowUp + x];
      const d = heightmap[rowDn + x];

      // Laplacian approximation of curvature
      const laplacian = (l + r + u + d) - 4.0 * c;
      // Map to [0, 1]: 0.5 = flat, >0.5 = valley/concave, <0.5 = ridge/convex
      curvature[row + x] = clamp(0.5 + laplacian * 8.0, 0.0, 1.0);
    }
  }
  return curvature;
}

// Select Slope with fuzzy filtering
export function evaluateFuzzySlope(
  slope: number,
  minSlope: number,
  maxSlope: number,
  fuzzy: number
): number {
  const f = Math.max(0.001, fuzzy);
  const inLower = smoothstep(minSlope - f, minSlope + f, slope);
  const inUpper = 1.0 - smoothstep(maxSlope - f, maxSlope + f, slope);
  return inLower * inUpper;
}

// Select Altitude with smoothstep
export function evaluateAltitude(
  height: number,
  minAlt: number,
  maxAlt: number,
  falloff: number
): number {
  const f = Math.max(0.001, falloff);
  const inLower = smoothstep(minAlt - f, minAlt + f, height);
  const inUpper = 1.0 - smoothstep(maxAlt - f, maxAlt + f, height);
  return inLower * inUpper;
}

// Gaea Signature: SatMap Multi-Biome Satellite Color Synthesis
export function generateSatMapColors(
  height: number,
  slope: number,
  flow: number,
  deposition: number,
  wear: number,
  biome: SatMapBiome
): [number, number, number] {
  switch (biome) {
    case 'zion': {
      // Red rock Navajo sandstone & iron canyons
      let r = 0.72, g = 0.38, b = 0.22;
      // Stratified banded red/cream layers
      const band = Math.sin(height * 28.0) * 0.5 + 0.5;
      r += band * 0.12;
      g += band * 0.08;
      // Canyon floor silt
      if (deposition > 0.25) {
        r = lerp(r, 0.82, deposition * 0.7);
        g = lerp(g, 0.65, deposition * 0.7);
        b = lerp(b, 0.45, deposition * 0.7);
      }
      // Desert scrub in low slope & flow
      if (slope < 0.25 && flow > 0.2) {
        r = lerp(r, 0.35, 0.6);
        g = lerp(g, 0.42, 0.6);
        b = lerp(b, 0.22, 0.6);
      }
      // Exposed cliff varnishes
      if (wear > 0.4) {
        r = lerp(r, 0.28, (wear - 0.4) * 1.4);
        g = lerp(g, 0.22, (wear - 0.4) * 1.4);
        b = lerp(b, 0.20, (wear - 0.4) * 1.4);
      }
      return [r, g, b];
    }

    case 'iceland': {
      // Dark volcanic basalt with fluorescent emerald moss
      let r = 0.14, g = 0.15, b = 0.16;
      // Lush electric moss in flat depressions
      if (slope < 0.35 && height < 0.65) {
        const mossT = Math.min(1.0, (0.35 - slope) * 3.5);
        r = lerp(r, 0.22, mossT);
        g = lerp(g, 0.52, mossT);
        b = lerp(b, 0.15, mossT);
      }
      // High altitude glacial ice & frost
      if (height > 0.7) {
        const iceT = Math.min(1.0, (height - 0.7) * 4.0);
        r = lerp(r, 0.88, iceT);
        g = lerp(g, 0.94, iceT);
        b = lerp(b, 0.99, iceT);
      }
      // Black volcanic sand in flow gullies
      if (flow > 0.3) {
        r = lerp(r, 0.06, flow * 0.8);
        g = lerp(g, 0.12, flow * 0.8);
        b = lerp(b, 0.16, flow * 0.8);
      }
      return [r, g, b];
    }

    case 'sahara': {
      // Warm golden ochre ergs & dunes
      let r = 0.85, g = 0.65, b = 0.38;
      // Darker desert pavement in hollows
      if (wear > 0.3) {
        r = lerp(r, 0.58, wear * 0.7);
        g = lerp(g, 0.42, wear * 0.7);
        b = lerp(b, 0.28, wear * 0.7);
      }
      // Sun-bleached dune crests
      if (slope > 0.4) {
        r = lerp(r, 0.96, slope * 0.5);
        g = lerp(g, 0.78, slope * 0.5);
        b = lerp(b, 0.52, slope * 0.5);
      }
      return [r, g, b];
    }

    case 'patagonia': {
      // Dark jagged granite spires with turquoise glacial milk runoffs
      let r = 0.28, g = 0.30, b = 0.32;
      // Lichen on mid-altitude slopes
      if (height > 0.3 && height < 0.65 && slope < 0.45) {
        r = lerp(r, 0.38, 0.5);
        g = lerp(g, 0.42, 0.5);
        b = lerp(b, 0.24, 0.5);
      }
      // Turquoise glacial lake / river sediment
      if (flow > 0.35) {
        r = lerp(r, 0.12, flow);
        g = lerp(g, 0.48, flow);
        b = lerp(b, 0.55, flow);
      }
      // Heavy snowfields
      if (height > 0.68) {
        const sn = Math.min(1.0, (height - 0.68) * 3.8);
        r = lerp(r, 0.94, sn);
        g = lerp(g, 0.96, sn);
        b = lerp(b, 0.99, sn);
      }
      return [r, g, b];
    }

    case 'volcanic': {
      // Charcoal ash, obsidian basalt, and sulfur deposits
      let r = 0.16, g = 0.15, b = 0.17;
      // Iron oxide rust streaks
      if (wear > 0.45) {
        r = lerp(r, 0.55, wear * 0.8);
        g = lerp(g, 0.22, wear * 0.8);
        b = lerp(b, 0.14, wear * 0.8);
      }
      // Sulfur yellow volcanic vents in flow depressions
      if (flow > 0.45 && height < 0.45) {
        r = lerp(r, 0.78, flow * 0.7);
        g = lerp(g, 0.72, flow * 0.7);
        b = lerp(b, 0.18, flow * 0.7);
      }
      return [r, g, b];
    }

    case 'alps':
    default: {
      // Classical high alpine peaks with valley grass and mountain snow
      let r = 0.22, g = 0.28, b = 0.16;
      // Sandy scree / talus
      if (deposition > 0.2) {
        r = lerp(r, 0.55, deposition * 0.8);
        g = lerp(g, 0.46, deposition * 0.8);
        b = lerp(b, 0.35, deposition * 0.8);
      }
      // Steep granite cliff
      if (slope > 0.35 || wear > 0.35) {
        const t = Math.min(1.0, Math.max(slope, wear) * 1.5);
        r = lerp(r, 0.32, t);
        g = lerp(g, 0.30, t);
        b = lerp(b, 0.28, t);
      }
      // High alpine glacier & snow
      if (height > 0.65) {
        const sn = Math.min(1.0, (height - 0.65) * 3.5) * (1.0 - slope * 0.5);
        r = lerp(r, 0.94, sn);
        g = lerp(g, 0.96, sn);
        b = lerp(b, 0.99, sn);
      }
      // Glacial flow runoff
      if (flow > 0.3) {
        r = lerp(r, 0.14, flow * 0.8);
        g = lerp(g, 0.36, flow * 0.8);
        b = lerp(b, 0.46, flow * 0.8);
      }
      return [r, g, b];
    }
  }
}
