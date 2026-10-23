import { clamp } from './noise';

export interface HydraulicParams {
  iterations: number;       // Droplet passes (e.g. 15 to 60)
  rainAmount: number;       // Rain intensity factor (0.1 to 1.0)
  solubility: number;       // Bedrock dissolution rate (0.01 to 0.1)
  evaporation: number;      // Water evaporation rate (0.01 to 0.05)
  sedimentCapacity: number; // Max sediment per velocity (2.0 to 8.0)
  gravity: number;          // Gravity acceleration
}

export interface ThermalParams {
  iterations: number;       // Iterations (5 to 30)
  talusAngle: number;       // Angle of repose threshold (0.01 to 0.08)
  talusRate: number;        // Slump deposition rate (0.1 to 0.5)
}

// Compute spatial slope (0.0 = completely flat, 1.0 = vertical cliff)
export function computeSlopeMap(
  heightmap: Float32Array,
  width: number,
  height: number
): Float32Array {
  const slopeMap = new Float32Array(width * height);
  const invWidth = 1.0 / width;
  const invHeight = 1.0 / height;

  for (let y = 0; y < height; y++) {
    const yUp = y > 0 ? y - 1 : 0;
    const yDn = y < height - 1 ? y + 1 : height - 1;
    const row = y * width;
    const rowUp = yUp * width;
    const rowDn = yDn * width;

    for (let x = 0; x < width; x++) {
      const xL = x > 0 ? x - 1 : 0;
      const xR = x < width - 1 ? x + 1 : width - 1;

      const hL = heightmap[row + xL];
      const hR = heightmap[row + xR];
      const hD = heightmap[rowDn + x];
      const hU = heightmap[rowUp + x];

      const dx = (hR - hL) * 0.5;
      const dy = (hD - hU) * 0.5;

      const grad = Math.sqrt(dx * dx + dy * dy) * 8.0;
      slopeMap[row + x] = clamp(grad, 0.0, 1.0);
    }
  }

  return slopeMap;
}

// Simulate Hydraulic Erosion and accumulate Flow & Deposition maps
export function simulateHydraulicErosion(
  srcHeight: Float32Array,
  width: number,
  height: number,
  params: Partial<HydraulicParams> = {}
): {
  heightmap: Float32Array;
  flowmap: Float32Array;
  deposition: Float32Array;
  wear: Float32Array;
} {
  const p: HydraulicParams = {
    iterations: params.iterations ?? 25,
    rainAmount: params.rainAmount ?? 0.4,
    solubility: params.solubility ?? 0.04,
    evaporation: params.evaporation ?? 0.02,
    sedimentCapacity: params.sedimentCapacity ?? 4.0,
    gravity: params.gravity ?? 9.8,
  };

  const len = width * height;
  const heightmap = new Float32Array(srcHeight);
  const flowmap = new Float32Array(len);
  const deposition = new Float32Array(len);
  const wear = new Float32Array(len);

  // Droplet lifetime simulation
  const maxLifetime = 30;
  const inertia = 0.05;
  const minSlope = 0.001;

  // Run droplet streams in batches across grid
  const stepStride = Math.max(1, Math.floor(width / 64));
  const passes = Math.max(1, Math.floor(p.iterations / 5));

  for (let pass = 0; pass < passes; pass++) {
    for (let sy = 1; sy < height - 1; sy += stepStride) {
      for (let sx = 1; sx < width - 1; sx += stepStride) {
        let posX = sx + (Math.random() - 0.5) * stepStride;
        let posY = sy + (Math.random() - 0.5) * stepStride;
        let dirX = 0;
        let dirY = 0;
        let speed = 1.0;
        let water = p.rainAmount;
        let sediment = 0;

        for (let step = 0; step < maxLifetime; step++) {
          const ix = Math.floor(posX);
          const iy = Math.floor(posY);
          if (ix <= 0 || ix >= width - 1 || iy <= 0 || iy >= height - 1) break;

          const u = posX - ix;
          const v = posY - iy;
          const idx = iy * width + ix;

          // Height and gradient using bilinear interpolation
          const h00 = heightmap[idx];
          const h10 = heightmap[idx + 1];
          const h01 = heightmap[idx + width];
          const h11 = heightmap[idx + width + 1];

          // Surface gradient
          const gx = (h10 - h00) * (1 - v) + (h11 - h01) * v;
          const gy = (h01 - h00) * (1 - u) + (h11 - h10) * u;

          // Update flow direction with inertia
          dirX = dirX * inertia - gx * (1 - inertia);
          dirY = dirY * inertia - gy * (1 - inertia);

          const lenDir = Math.sqrt(dirX * dirX + dirY * dirY);
          if (lenDir < 0.0001) break;

          dirX /= lenDir;
          dirY /= lenDir;

          const nextX = posX + dirX;
          const nextY = posY + dirY;
          const nextIx = Math.floor(nextX);
          const nextIy = Math.floor(nextY);

          if (nextIx <= 0 || nextIx >= width - 1 || nextIy <= 0 || nextIy >= height - 1) break;

          const nextIdx = nextIy * width + nextIx;
          const currentH = (h00 * (1 - u) + h10 * u) * (1 - v) + (h01 * (1 - u) + h11 * u) * v;
          const nextH = heightmap[nextIdx];
          const deltaH = nextH - currentH;

          // Accumulate flow concentration
          flowmap[idx] += water * 0.15;

          // Sediment transport and erosion
          if (deltaH > 0) {
            // Flowing uphill into a depression: deposit sediment
            const depositAmount = Math.min(sediment, deltaH);
            sediment -= depositAmount;
            heightmap[idx] += depositAmount * 0.5;
            deposition[idx] += depositAmount * 0.8;
          } else {
            // Flowing downhill: compute sediment capacity
            const slope = Math.max(minSlope, -deltaH);
            const cSediment = Math.max(slope * speed * water * p.sedimentCapacity, 0);

            if (sediment > cSediment) {
              // Deposit excess
              const depositAmount = (sediment - cSediment) * 0.25;
              sediment -= depositAmount;
              heightmap[idx] += depositAmount * 0.3;
              deposition[idx] += depositAmount * 0.5;
            } else {
              // Erode bedrock
              const erodeAmount = Math.min((cSediment - sediment) * p.solubility, -deltaH);
              sediment += erodeAmount;
              heightmap[idx] -= erodeAmount * 0.35;
              wear[idx] += erodeAmount * 1.5;
            }
          }

          // Accelerate and evaporate
          speed = Math.sqrt(Math.max(0.01, speed * speed - deltaH * p.gravity));
          water *= (1.0 - p.evaporation);
          posX = nextX;
          posY = nextY;
        }
      }
    }
  }

  // Normalize flowmap, deposition, and wear into [0, 1] range for PBR rendering
  let maxFlow = 0.001;
  let maxDep = 0.001;
  let maxWear = 0.001;

  for (let i = 0; i < len; i++) {
    if (flowmap[i] > maxFlow) maxFlow = flowmap[i];
    if (deposition[i] > maxDep) maxDep = deposition[i];
    if (wear[i] > maxWear) maxWear = wear[i];
  }

  const slope = computeSlopeMap(heightmap, width, height);

  for (let i = 0; i < len; i++) {
    flowmap[i] = Math.min(1.0, Math.pow(flowmap[i] / maxFlow, 0.45));
    deposition[i] = Math.min(1.0, Math.pow(deposition[i] / maxDep, 0.6));
    // Wear combines mechanical abrasion and intrinsic steep slope
    wear[i] = Math.min(1.0, Math.pow(wear[i] / maxWear, 0.6) * 0.5 + slope[i] * 0.5);
    heightmap[i] = clamp(heightmap[i], 0.0, 1.0);
  }

  return { heightmap, flowmap, deposition, wear };
}

// Thermal erosion (scree / talus slopes)
export function simulateThermalErosion(
  srcHeight: Float32Array,
  width: number,
  height: number,
  params: Partial<ThermalParams> = {}
): Float32Array {
  const p: ThermalParams = {
    iterations: params.iterations ?? 12,
    talusAngle: params.talusAngle ?? 0.025,
    talusRate: params.talusRate ?? 0.3,
  };

  const result = new Float32Array(srcHeight);

  for (let iter = 0; iter < p.iterations; iter++) {
    for (let y = 1; y < height - 1; y++) {
      const row = y * width;
      const rowUp = (y - 1) * width;
      const rowDn = (y + 1) * width;

      for (let x = 1; x < width - 1; x++) {
        const center = result[row + x];

        // 4 neighbors
        const nL = result[row + x - 1];
        const nR = result[row + x + 1];
        const nU = result[rowUp + x];
        const nD = result[rowDn + x];

        const diffL = center - nL;
        const diffR = center - nR;
        const diffU = center - nU;
        const diffD = center - nD;

        let maxDiff = 0;
        let targetIdx = -1;

        if (diffL > p.talusAngle && diffL > maxDiff) { maxDiff = diffL; targetIdx = row + x - 1; }
        if (diffR > p.talusAngle && diffR > maxDiff) { maxDiff = diffR; targetIdx = row + x + 1; }
        if (diffU > p.talusAngle && diffU > maxDiff) { maxDiff = diffU; targetIdx = rowUp + x; }
        if (diffD > p.talusAngle && diffD > maxDiff) { maxDiff = diffD; targetIdx = rowDn + x; }

        if (targetIdx !== -1) {
          const move = (maxDiff - p.talusAngle) * p.talusRate * 0.5;
          result[row + x] -= move;
          result[targetIdx] += move;
        }
      }
    }
  }

  return result;
}

// World Machine Snow Device: Snow Accumulation, Avalanching & Cirque Settling
export interface SnowDeviceParams {
  snowfall: number;      // Precipitation intensity (0.1 to 1.0)
  snowLine: number;      // Freezing altitude boundary (0.2 to 0.85)
  meltRate: number;      // Transition / melting softness (0.05 to 0.4)
  slumpAngle: number;    // Angle of repose where snow slides off steep cliffs (0.25 to 0.65)
  iterations: number;    // Avalanche settlement passes (4 to 20)
}

export function simulateSnowAccumulation(
  srcHeight: Float32Array,
  width: number,
  height: number,
  params: Partial<SnowDeviceParams> = {}
): {
  heightmap: Float32Array;
  snowMap: Float32Array;
} {
  const p: SnowDeviceParams = {
    snowfall: params.snowfall ?? 0.6,
    snowLine: params.snowLine ?? 0.52,
    meltRate: params.meltRate ?? 0.15,
    slumpAngle: params.slumpAngle ?? 0.38,
    iterations: params.iterations ?? 12,
  };

  const len = width * height;
  const heightmap = new Float32Array(srcHeight);
  const snowMap = new Float32Array(len);
  const slope = computeSlopeMap(srcHeight, width, height);

  // 1. Initial Snowfall deposition
  for (let i = 0; i < len; i++) {
    const h = srcHeight[i];
    const s = slope[i];

    // Snow line altitude gate with melt gradient
    const altFactor = clamp((h - (p.snowLine - p.meltRate)) / (p.meltRate * 1.5 + 0.02), 0.0, 1.0);
    
    // Slump inhibition: steep cliffs cannot hold fresh snow
    const adhereFactor = s < p.slumpAngle ? 1.0 : Math.max(0.0, 1.0 - (s - p.slumpAngle) * 3.2);

    snowMap[i] = p.snowfall * altFactor * adhereFactor * 0.25;
  }

  // 2. Avalanching / Slump down gravity gradient into cirques and couloirs
  for (let iter = 0; iter < p.iterations; iter++) {
    for (let y = 1; y < height - 1; y++) {
      const row = y * width;
      const rowUp = (y - 1) * width;
      const rowDn = (y + 1) * width;

      for (let x = 1; x < width - 1; x++) {
        const idx = row + x;
        const currentSnow = snowMap[idx];
        if (currentSnow < 0.001) continue;

        // Current total height (bedrock + snow)
        const totalH = heightmap[idx] + currentSnow;

        // 4 neighbors
        const nL = heightmap[row + x - 1] + snowMap[row + x - 1];
        const nR = heightmap[row + x + 1] + snowMap[row + x + 1];
        const nU = heightmap[rowUp + x] + snowMap[rowUp + x];
        const nD = heightmap[rowDn + x] + snowMap[rowDn + x];

        const diffL = totalH - nL;
        const diffR = totalH - nR;
        const diffU = totalH - nU;
        const diffD = totalH - nD;

        let maxDrop = 0;
        let targetIdx = -1;

        if (diffL > 0.015 && diffL > maxDrop) { maxDrop = diffL; targetIdx = row + x - 1; }
        if (diffR > 0.015 && diffR > maxDrop) { maxDrop = diffR; targetIdx = row + x + 1; }
        if (diffU > 0.015 && diffU > maxDrop) { maxDrop = diffU; targetIdx = rowUp + x; }
        if (diffD > 0.015 && diffD > maxDrop) { maxDrop = diffD; targetIdx = rowDn + x; }

        if (targetIdx !== -1 && maxDrop > 0.02) {
          // Slide snow down slope
          const slide = Math.min(currentSnow * 0.45, maxDrop * 0.25);
          snowMap[idx] -= slide;
          snowMap[targetIdx] += slide;
        }
      }
    }
  }

  // 3. Add accumulated snow pack volume to terrain
  for (let i = 0; i < len; i++) {
    heightmap[i] = clamp(heightmap[i] + snowMap[i] * 0.35, 0.0, 1.0);
    // Normalize snow depth for shader
    snowMap[i] = clamp(snowMap[i] * 4.0, 0.0, 1.0);
  }

  return { heightmap, snowMap };
}

