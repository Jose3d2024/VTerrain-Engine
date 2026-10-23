import {
  TerrainNode,
  NodeConnection,
  TerrainDataMap,
  NodeMetadata,
  NodeType,
} from '../types/terrain';
import {
  SimplexNoise,
  fbm2D,
  billow2D,
  ridged2D,
  voronoi2D,
  mountain2D,
  crater2D,
  canyon2D,
  applyTerrace,
  applyAutoLevel,
  computeCurvatureMap,
  evaluateFuzzySlope,
  evaluateAltitude,
  generateSatMapColors,
  clamp,
  lerp,
} from './noise';
import {
  simulateHydraulicErosion,
  simulateThermalErosion,
  simulateSnowAccumulation,
  computeSlopeMap,
} from './erosion';

// Comprehensive Gaea-inspired Node Registry
export const NODE_REGISTRY: Record<NodeType, NodeMetadata> = {
  // Primitives / Generators
  mountain: {
    type: 'mountain',
    name: 'Mountain Primitive',
    category: 'generator',
    description: 'Signature Gaea mountain with ridge folding, warped crests, and layered mass',
    inputs: [],
    outputs: [{ id: 'out', name: 'Terrain', type: 'terrain', direction: 'out' }],
    defaultParams: {
      seed: 582,
      scale: 2.6,
      octaves: 7,
      lacunarity: 2.1,
      persistence: 0.52,
      ridgePower: 2.4,
    },
  },
  crater: {
    type: 'crater',
    name: 'Crater / Volcano',
    category: 'generator',
    description: 'Volcanic caldera or impact crater with raised rim, central peak, and apron',
    inputs: [],
    outputs: [{ id: 'out', name: 'Terrain', type: 'terrain', direction: 'out' }],
    defaultParams: {
      seed: 391,
      rimRadius: 0.45,
      rimHeight: 0.8,
      calderaDepth: 0.45,
      centralPeak: 0.3,
    },
  },
  canyon: {
    type: 'canyon',
    name: 'Canyon Gorge',
    category: 'generator',
    description: 'Meandering carved canyon gorge with stratified plateau walls and tablelands',
    inputs: [],
    outputs: [{ id: 'out', name: 'Terrain', type: 'terrain', direction: 'out' }],
    defaultParams: {
      seed: 814,
      canyonDepth: 0.65,
      strataSteps: 10,
    },
  },
  simplex: {
    type: 'simplex',
    name: 'Simplex Noise',
    category: 'generator',
    description: 'Continuous gradient simplex noise for smooth rolling highlands',
    inputs: [],
    outputs: [{ id: 'out', name: 'Terrain', type: 'terrain', direction: 'out' }],
    defaultParams: {
      seed: 42,
      scale: 2.5,
      octaves: 4,
      lacunarity: 2.0,
      persistence: 0.5,
    },
  },
  fbm: {
    type: 'fbm',
    name: 'Fractal FBM',
    category: 'generator',
    description: 'Fractional Brownian Motion fractal generator with up to 8 octaves',
    inputs: [],
    outputs: [{ id: 'out', name: 'Terrain', type: 'terrain', direction: 'out' }],
    defaultParams: {
      seed: 101,
      scale: 3.2,
      octaves: 6,
      lacunarity: 2.0,
      persistence: 0.5,
      gain: 1.0,
    },
  },
  billow: {
    type: 'billow',
    name: 'Billow Noise',
    category: 'generator',
    description: 'Rounded pillowy domes and volcanic formations using absolute noise',
    inputs: [],
    outputs: [{ id: 'out', name: 'Terrain', type: 'terrain', direction: 'out' }],
    defaultParams: {
      seed: 202,
      scale: 2.2,
      octaves: 5,
      lacunarity: 2.0,
      persistence: 0.5,
    },
  },
  ridged: {
    type: 'ridged',
    name: 'Ridged Multi-Fractal',
    category: 'generator',
    description: 'Inverted multi-fractal creating razor-sharp alpine horns and glacial arêtes',
    inputs: [],
    outputs: [{ id: 'out', name: 'Terrain', type: 'terrain', direction: 'out' }],
    defaultParams: {
      seed: 303,
      scale: 2.6,
      octaves: 6,
      lacunarity: 2.1,
      persistence: 0.52,
      sharpness: 2.0,
    },
  },
  voronoi: {
    type: 'voronoi',
    name: 'Voronoi Cells',
    category: 'generator',
    description: 'Cellular distance noise for tectonic cracks, hexagonal plates, and basalt columns',
    inputs: [],
    outputs: [{ id: 'out', name: 'Terrain', type: 'terrain', direction: 'out' }],
    defaultParams: {
      seed: 404,
      scale: 4.0,
      jitter: 0.85,
      distanceType: 'f1',
    },
  },

  // Filters & Natural
  hydraulic: {
    type: 'hydraulic',
    name: 'Erosion (Hydraulic)',
    category: 'filter',
    description: 'Flagship Gaea erosion simulation carving rivers, carrying sediment, and eroding bedrock',
    inputs: [{ id: 'in', name: 'Terrain', type: 'terrain', direction: 'in' }],
    outputs: [
      { id: 'out', name: 'Terrain', type: 'terrain', direction: 'out', description: 'Carved terrain' },
      { id: 'flow', name: 'Flow Mask', type: 'mask', direction: 'out', description: 'Water veins mask' },
      { id: 'sediment', name: 'Sediment Mask', type: 'mask', direction: 'out', description: 'Alluvial deposition' },
      { id: 'wear', name: 'Wear Mask', type: 'mask', direction: 'out', description: 'Exposed bedrock wear' },
    ],
    defaultParams: {
      iterations: 30,
      rainAmount: 0.45,
      solubility: 0.045,
      sedimentCapacity: 4.2,
    },
  },
  thermal: {
    type: 'thermal',
    name: 'Thermal Erosion',
    category: 'filter',
    description: 'Talus angle-of-repose relaxation creating rock scree and softening cliffs',
    inputs: [{ id: 'in', name: 'Terrain', type: 'terrain', direction: 'in' }],
    outputs: [{ id: 'out', name: 'Terrain', type: 'terrain', direction: 'out' }],
    defaultParams: {
      iterations: 15,
      talusAngle: 0.022,
      talusRate: 0.32,
    },
  },
  terraces: {
    type: 'terraces',
    name: 'Terraces (Strata)',
    category: 'filter',
    description: 'Quantizes elevations into layered geological sedimentary strata and plateaus',
    inputs: [{ id: 'in', name: 'Terrain', type: 'terrain', direction: 'in' }],
    outputs: [{ id: 'out', name: 'Terrain', type: 'terrain', direction: 'out' }],
    defaultParams: {
      stepCount: 8,
      smoothness: 0.3,
      sharpness: 1.2,
      strataBlend: 0.85,
    },
  },
  snow: {
    type: 'snow',
    name: 'Snow (Accumulation & Slump)',
    category: 'filter',
    description: 'World Machine style snow fall, gravity avalanching down cliffs, and accumulation in glacial cirques',
    inputs: [{ id: 'in', name: 'Terrain', type: 'terrain', direction: 'in' }],
    outputs: [
      { id: 'out', name: 'Terrain', type: 'terrain', direction: 'out', description: 'Snow-covered terrain' },
      { id: 'snow', name: 'Snow Depth', type: 'mask', direction: 'out', description: 'Snow pack depth mask' },
    ],
    defaultParams: {
      snowfall: 0.65,
      snowLine: 0.52,
      meltRate: 0.15,
      slumpAngle: 0.38,
      iterations: 12,
    },
  },
  autolevel: {
    type: 'autolevel',
    name: 'AutoLevel (Normalize)',
    category: 'filter',
    description: 'Stretches terrain elevations to utilize the full [0, 1] vertical dynamic range',
    inputs: [{ id: 'in', name: 'Terrain', type: 'terrain', direction: 'in' }],
    outputs: [{ id: 'out', name: 'Terrain', type: 'terrain', direction: 'out' }],
    defaultParams: {
      strength: 1.0,
    },
  },
  clamp: {
    type: 'clamp',
    name: 'Clamp & Remap',
    category: 'filter',
    description: 'Constrains or scales elevation values into specific min/max bounds',
    inputs: [{ id: 'in', name: 'Terrain', type: 'terrain', direction: 'in' }],
    outputs: [{ id: 'out', name: 'Terrain', type: 'terrain', direction: 'out' }],
    defaultParams: {
      min: 0.0,
      max: 1.0,
      normalize: false,
    },
  },
  invert: {
    type: 'invert',
    name: 'Invert Terrain',
    category: 'filter',
    description: 'Inverts peaks into valleys and ridges into canyons',
    inputs: [{ id: 'in', name: 'Terrain', type: 'terrain', direction: 'in' }],
    outputs: [{ id: 'out', name: 'Terrain', type: 'terrain', direction: 'out' }],
    defaultParams: {
      blend: 1.0,
    },
  },

  // Selectors
  select_slope: {
    type: 'select_slope',
    name: 'Select Slope',
    category: 'selector',
    description: 'Generates a distribution mask based on surface inclination with fuzzy filtering',
    inputs: [{ id: 'in', name: 'Terrain', type: 'terrain', direction: 'in' }],
    outputs: [{ id: 'mask', name: 'Mask', type: 'mask', direction: 'out' }],
    defaultParams: {
      minSlope: 0.25,
      maxSlope: 0.85,
      fuzzy: 0.12,
    },
  },
  select_altitude: {
    type: 'select_altitude',
    name: 'Select Altitude',
    category: 'selector',
    description: 'Masks specific elevation strata (snow line, valley floor) via smoothstep',
    inputs: [{ id: 'in', name: 'Terrain', type: 'terrain', direction: 'in' }],
    outputs: [{ id: 'mask', name: 'Mask', type: 'mask', direction: 'out' }],
    defaultParams: {
      minAlt: 0.5,
      maxAlt: 1.0,
      falloff: 0.1,
    },
  },
  select_curvature: {
    type: 'select_curvature',
    name: 'Select Curvature',
    category: 'selector',
    description: 'Identifies convex ridge tops vs concave valley crevices using Laplacian curvature',
    inputs: [{ id: 'in', name: 'Terrain', type: 'terrain', direction: 'in' }],
    outputs: [{ id: 'mask', name: 'Mask', type: 'mask', direction: 'out' }],
    defaultParams: {
      mode: 'ridges', // 'ridges' or 'valleys'
      contrast: 1.5,
    },
  },

  // Combiners
  combiner: {
    type: 'combiner',
    name: 'Combiner / Mixer',
    category: 'combiner',
    description: 'Arithmetically or logically mixes two terrain layers with optional mask input',
    inputs: [
      { id: 'inA', name: 'Primary (A)', type: 'terrain', direction: 'in' },
      { id: 'inB', name: 'Secondary (B)', type: 'terrain', direction: 'in' },
      { id: 'mask', name: 'Mask (Optional)', type: 'mask', direction: 'in' },
    ],
    outputs: [{ id: 'out', name: 'Terrain', type: 'terrain', direction: 'out' }],
    defaultParams: {
      mode: 'add',
      ratio: 0.5,
      clampOutput: true,
    },
  },

  // Color & SatMap
  satmap: {
    type: 'satmap',
    name: 'SatMap (Color)',
    category: 'color',
    description: 'Gaea signature Satellite Color Map library producing hyper-realistic geological textures',
    inputs: [{ id: 'in', name: 'Terrain', type: 'terrain', direction: 'in' }],
    outputs: [{ id: 'out', name: 'Terrain', type: 'terrain', direction: 'out' }],
    defaultParams: {
      biome: 'alps', // 'zion', 'iceland', 'alps', 'sahara', 'patagonia', 'volcanic'
      saturation: 1.1,
      contrast: 1.05,
    },
  },
};

// Create empty TerrainDataMap
export function createEmptyDataMap(width: number, height: number): TerrainDataMap {
  const len = width * height;
  return {
    width,
    height,
    heightmap: new Float32Array(len),
    flowmap: new Float32Array(len),
    deposition: new Float32Array(len),
    wear: new Float32Array(len),
  };
}

// Clone TerrainDataMap
export function cloneDataMap(src: TerrainDataMap): TerrainDataMap {
  const cloned: TerrainDataMap = {
    width: src.width,
    height: src.height,
    heightmap: new Float32Array(src.heightmap),
    flowmap: new Float32Array(src.flowmap),
    deposition: new Float32Array(src.deposition),
    wear: new Float32Array(src.wear),
  };
  if (src.colorMap) {
    cloned.colorMap = new Uint8Array(src.colorMap);
  }
  return cloned;
}

// Single node generator runner
export function evaluateNode(
  node: TerrainNode,
  inputs: Record<string, TerrainDataMap | Float32Array>,
  width: number,
  height: number
): {
  dataMap?: TerrainDataMap;
  mask?: Float32Array;
  namedOutputs?: Record<string, TerrainDataMap | Float32Array>;
} {
  const len = width * height;
  const p = node.params;

  switch (node.type) {
    case 'mountain': {
      const simplex = new SimplexNoise(p.seed ?? 582);
      const data = createEmptyDataMap(width, height);
      const scale = (p.scale ?? 2.6) / width;
      const octaves = p.octaves ?? 7;
      const lac = p.lacunarity ?? 2.1;
      const pers = p.persistence ?? 0.52;
      const ridgePower = p.ridgePower ?? 2.4;
      const halfW = width / 2;
      const halfH = height / 2;

      for (let y = 0; y < height; y++) {
        const row = y * width;
        const ny = (y - halfH) / halfH;
        for (let x = 0; x < width; x++) {
          const nx = (x - halfW) / halfW;
          const dist = Math.sqrt(nx * nx + ny * ny);
          const islandMask = Math.max(0.0, 1.0 - Math.pow(dist / 0.94, 2.8));

          const rawH = mountain2D(simplex, x * scale, y * scale, octaves, lac, pers, ridgePower);
          data.heightmap[row + x] = Math.pow(rawH, 1.1) * islandMask;
        }
      }
      data.wear = computeSlopeMap(data.heightmap, width, height);
      return { dataMap: data };
    }

    case 'crater': {
      const simplex = new SimplexNoise(p.seed ?? 391);
      const data = createEmptyDataMap(width, height);
      const halfW = width / 2;
      const halfH = height / 2;

      for (let y = 0; y < height; y++) {
        const row = y * width;
        const normY = (y - halfH) / halfH;
        for (let x = 0; x < width; x++) {
          const normX = (x - halfW) / halfW;
          data.heightmap[row + x] = crater2D(
            simplex,
            normX,
            normY,
            p.rimRadius ?? 0.45,
            p.rimHeight ?? 0.8,
            p.calderaDepth ?? 0.45,
            p.centralPeak ?? 0.3
          );
        }
      }
      data.wear = computeSlopeMap(data.heightmap, width, height);
      return { dataMap: data };
    }

    case 'canyon': {
      const simplex = new SimplexNoise(p.seed ?? 814);
      const data = createEmptyDataMap(width, height);
      const halfW = width / 2;
      const halfH = height / 2;

      for (let y = 0; y < height; y++) {
        const row = y * width;
        const normY = (y - halfH) / halfH;
        for (let x = 0; x < width; x++) {
          const normX = (x - halfW) / halfW;
          data.heightmap[row + x] = canyon2D(
            simplex,
            normX,
            normY,
            p.canyonDepth ?? 0.65,
            p.strataSteps ?? 10
          );
        }
      }
      data.wear = computeSlopeMap(data.heightmap, width, height);
      return { dataMap: data };
    }

    case 'simplex': {
      const simplex = new SimplexNoise(p.seed ?? 42);
      const data = createEmptyDataMap(width, height);
      const scale = (p.scale ?? 2.5) / width;
      const octaves = p.octaves ?? 4;
      const lac = p.lacunarity ?? 2.0;
      const pers = p.persistence ?? 0.5;

      for (let y = 0; y < height; y++) {
        const row = y * width;
        for (let x = 0; x < width; x++) {
          data.heightmap[row + x] = fbm2D(simplex, x * scale, y * scale, octaves, lac, pers);
        }
      }
      data.wear = computeSlopeMap(data.heightmap, width, height);
      return { dataMap: data };
    }

    case 'fbm': {
      const simplex = new SimplexNoise(p.seed ?? 101);
      const data = createEmptyDataMap(width, height);
      const scale = (p.scale ?? 3.2) / width;
      const octaves = Math.min(8, Math.max(1, p.octaves ?? 6));
      const lac = p.lacunarity ?? 2.0;
      const pers = p.persistence ?? 0.5;
      const gain = p.gain ?? 1.0;

      for (let y = 0; y < height; y++) {
        const row = y * width;
        for (let x = 0; x < width; x++) {
          const val = fbm2D(simplex, x * scale, y * scale, octaves, lac, pers);
          data.heightmap[row + x] = clamp(Math.pow(val, gain), 0.0, 1.0);
        }
      }
      data.wear = computeSlopeMap(data.heightmap, width, height);
      return { dataMap: data };
    }

    case 'billow': {
      const simplex = new SimplexNoise(p.seed ?? 202);
      const data = createEmptyDataMap(width, height);
      const scale = (p.scale ?? 2.2) / width;
      const octaves = p.octaves ?? 5;
      const lac = p.lacunarity ?? 2.0;
      const pers = p.persistence ?? 0.5;

      for (let y = 0; y < height; y++) {
        const row = y * width;
        for (let x = 0; x < width; x++) {
          data.heightmap[row + x] = billow2D(simplex, x * scale, y * scale, octaves, lac, pers);
        }
      }
      data.wear = computeSlopeMap(data.heightmap, width, height);
      return { dataMap: data };
    }

    case 'ridged': {
      const simplex = new SimplexNoise(p.seed ?? 303);
      const data = createEmptyDataMap(width, height);
      const scale = (p.scale ?? 2.6) / width;
      const octaves = p.octaves ?? 6;
      const lac = p.lacunarity ?? 2.1;
      const pers = p.persistence ?? 0.52;
      const sharpness = p.sharpness ?? 2.0;
      const halfW = width / 2;
      const halfH = height / 2;

      for (let y = 0; y < height; y++) {
        const row = y * width;
        const ny = (y - halfH) / halfH;
        for (let x = 0; x < width; x++) {
          const nx = (x - halfW) / halfW;
          const dist = Math.sqrt(nx * nx + ny * ny);
          const islandMask = Math.max(0.0, 1.0 - Math.pow(dist / 0.94, 2.6));
          const val = ridged2D(simplex, x * scale, y * scale, octaves, lac, pers, sharpness);
          data.heightmap[row + x] = Math.pow(val, 1.2) * islandMask;
        }
      }
      data.wear = computeSlopeMap(data.heightmap, width, height);
      return { dataMap: data };
    }

    case 'voronoi': {
      const data = createEmptyDataMap(width, height);
      const scale = (p.scale ?? 4.0) / width;
      const jitter = p.jitter ?? 0.85;
      const type = p.distanceType ?? 'f1';
      const seed = p.seed ?? 404;

      for (let y = 0; y < height; y++) {
        const row = y * width;
        for (let x = 0; x < width; x++) {
          data.heightmap[row + x] = voronoi2D(x * scale, y * scale, seed, jitter, type);
        }
      }
      data.wear = computeSlopeMap(data.heightmap, width, height);
      return { dataMap: data };
    }

    case 'terraces': {
      const inData = (inputs['in'] as TerrainDataMap) || createEmptyDataMap(width, height);
      const data = cloneDataMap(inData);
      const steps = p.stepCount ?? 8;
      const smoothness = p.smoothness ?? 0.3;
      const sharpness = p.sharpness ?? 1.2;
      const blend = p.strataBlend ?? 0.85;

      for (let i = 0; i < len; i++) {
        const t = applyTerrace(data.heightmap[i], steps, smoothness, sharpness);
        data.heightmap[i] = lerp(data.heightmap[i], t, blend);
      }
      data.wear = computeSlopeMap(data.heightmap, width, height);
      return { dataMap: data };
    }

    case 'hydraulic': {
      const inData = (inputs['in'] as TerrainDataMap) || createEmptyDataMap(width, height);
      const simulated = simulateHydraulicErosion(inData.heightmap, width, height, {
        iterations: p.iterations ?? 30,
        rainAmount: p.rainAmount ?? 0.45,
        solubility: p.solubility ?? 0.045,
        sedimentCapacity: p.sedimentCapacity ?? 4.2,
      });

      const carvedData: TerrainDataMap = {
        width,
        height,
        heightmap: simulated.heightmap,
        flowmap: simulated.flowmap,
        deposition: simulated.deposition,
        wear: simulated.wear,
      };

      return {
        dataMap: carvedData,
        namedOutputs: {
          out: carvedData,
          flow: simulated.flowmap,
          sediment: simulated.deposition,
          wear: simulated.wear,
        },
      };
    }

    case 'thermal': {
      const inData = (inputs['in'] as TerrainDataMap) || createEmptyDataMap(width, height);
      const data = cloneDataMap(inData);
      data.heightmap = simulateThermalErosion(data.heightmap, width, height, {
        iterations: p.iterations ?? 15,
        talusAngle: p.talusAngle ?? 0.022,
        talusRate: p.talusRate ?? 0.32,
      });
      data.wear = computeSlopeMap(data.heightmap, width, height);
      return { dataMap: data };
    }

    case 'snow': {
      const inData = (inputs['in'] as TerrainDataMap) || createEmptyDataMap(width, height);
      const simulated = simulateSnowAccumulation(inData.heightmap, width, height, {
        snowfall: p.snowfall ?? 0.65,
        snowLine: p.snowLine ?? 0.52,
        meltRate: p.meltRate ?? 0.15,
        slumpAngle: p.slumpAngle ?? 0.38,
        iterations: p.iterations ?? 12,
      });
      const snowData: TerrainDataMap = {
        ...cloneDataMap(inData),
        heightmap: simulated.heightmap,
        snowmap: simulated.snowMap,
        wear: computeSlopeMap(simulated.heightmap, width, height),
      };
      return {
        dataMap: snowData,
        namedOutputs: {
          out: snowData,
          snow: simulated.snowMap,
        },
      };
    }

    case 'autolevel': {
      const inData = (inputs['in'] as TerrainDataMap) || createEmptyDataMap(width, height);
      const data = cloneDataMap(inData);
      const normalized = applyAutoLevel(data.heightmap);
      const strength = p.strength ?? 1.0;
      for (let i = 0; i < len; i++) {
        data.heightmap[i] = lerp(data.heightmap[i], normalized[i], strength);
      }
      data.wear = computeSlopeMap(data.heightmap, width, height);
      return { dataMap: data };
    }

    case 'clamp': {
      const inData = (inputs['in'] as TerrainDataMap) || createEmptyDataMap(width, height);
      const data = cloneDataMap(inData);
      const minVal = p.min ?? 0.0;
      const maxVal = p.max ?? 1.0;
      const doNorm = p.normalize ?? false;

      let low = 999.0;
      let high = -999.0;
      if (doNorm) {
        for (let i = 0; i < len; i++) {
          const v = data.heightmap[i];
          if (v < low) low = v;
          if (v > high) high = v;
        }
      }

      for (let i = 0; i < len; i++) {
        if (doNorm && high > low) {
          const norm = (data.heightmap[i] - low) / (high - low);
          data.heightmap[i] = lerp(minVal, maxVal, norm);
        } else {
          data.heightmap[i] = clamp(data.heightmap[i], minVal, maxVal);
        }
      }
      data.wear = computeSlopeMap(data.heightmap, width, height);
      return { dataMap: data };
    }

    case 'invert': {
      const inData = (inputs['in'] as TerrainDataMap) || createEmptyDataMap(width, height);
      const data = cloneDataMap(inData);
      const blend = p.blend ?? 1.0;
      for (let i = 0; i < len; i++) {
        const inv = 1.0 - data.heightmap[i];
        data.heightmap[i] = lerp(data.heightmap[i], inv, blend);
      }
      data.wear = computeSlopeMap(data.heightmap, width, height);
      return { dataMap: data };
    }

    case 'select_slope': {
      const inData = (inputs['in'] as TerrainDataMap) || createEmptyDataMap(width, height);
      const slopeMap = computeSlopeMap(inData.heightmap, width, height);
      const mask = new Float32Array(len);
      const minSlope = p.minSlope ?? 0.25;
      const maxSlope = p.maxSlope ?? 0.85;
      const fuzzy = p.fuzzy ?? 0.12;

      for (let i = 0; i < len; i++) {
        mask[i] = evaluateFuzzySlope(slopeMap[i], minSlope, maxSlope, fuzzy);
      }
      return { mask };
    }

    case 'select_altitude': {
      const inData = (inputs['in'] as TerrainDataMap) || createEmptyDataMap(width, height);
      const mask = new Float32Array(len);
      const minAlt = p.minAlt ?? 0.5;
      const maxAlt = p.maxAlt ?? 1.0;
      const falloff = p.falloff ?? 0.1;

      for (let i = 0; i < len; i++) {
        mask[i] = evaluateAltitude(inData.heightmap[i], minAlt, maxAlt, falloff);
      }
      return { mask };
    }

    case 'select_curvature': {
      const inData = (inputs['in'] as TerrainDataMap) || createEmptyDataMap(width, height);
      const curv = computeCurvatureMap(inData.heightmap, width, height);
      const mask = new Float32Array(len);
      const isValleys = p.mode === 'valleys';
      const contrast = p.contrast ?? 1.5;

      for (let i = 0; i < len; i++) {
        const val = isValleys ? Math.max(0, curv[i] - 0.5) * 2.0 : Math.max(0, 0.5 - curv[i]) * 2.0;
        mask[i] = clamp(Math.pow(val, contrast), 0.0, 1.0);
      }
      return { mask };
    }

    case 'combiner': {
      const dataA = (inputs['inA'] as TerrainDataMap) || createEmptyDataMap(width, height);
      const dataB = (inputs['inB'] as TerrainDataMap) || createEmptyDataMap(width, height);
      const customMask = inputs['mask'] as Float32Array | undefined;

      const out = cloneDataMap(dataA);
      const mode = p.mode ?? 'add';
      const ratio = p.ratio ?? 0.5;
      const doClamp = p.clampOutput ?? true;

      for (let i = 0; i < len; i++) {
        const a = dataA.heightmap[i];
        const b = dataB.heightmap[i];
        const weight = customMask ? customMask[i] * ratio : ratio;

        let combined = a;
        switch (mode) {
          case 'add':
            combined = a + b * weight;
            break;
          case 'subtract':
            combined = a - b * weight;
            break;
          case 'multiply':
            combined = a * (1.0 - weight + b * weight);
            break;
          case 'max':
            combined = Math.max(a, b * weight);
            break;
          case 'min':
            combined = Math.min(a, b * weight + a * (1.0 - weight));
            break;
          case 'overlay':
            combined = a < 0.5 ? 2 * a * b : 1 - 2 * (1 - a) * (1 - b);
            combined = lerp(a, combined, weight);
            break;
          case 'blend':
          default:
            combined = lerp(a, b, weight);
            break;
        }

        out.heightmap[i] = doClamp ? clamp(combined, 0.0, 1.0) : combined;
        out.flowmap[i] = Math.max(dataA.flowmap[i], dataB.flowmap[i]);
        out.deposition[i] = Math.max(dataA.deposition[i], dataB.deposition[i]);
      }

      out.wear = computeSlopeMap(out.heightmap, width, height);
      return { dataMap: out };
    }

    case 'satmap': {
      const inData = (inputs['in'] as TerrainDataMap) || createEmptyDataMap(width, height);
      const data = cloneDataMap(inData);
      const biome = p.biome ?? 'alps';

      // Generate RGBA satellite color buffer
      const colorBuf = new Uint8Array(len * 4);
      const slopeMap = computeSlopeMap(data.heightmap, width, height);

      for (let i = 0; i < len; i++) {
        const [r, g, b] = generateSatMapColors(
          data.heightmap[i],
          slopeMap[i],
          data.flowmap[i],
          data.deposition[i],
          data.wear[i],
          biome
        );
        const idx = i * 4;
        colorBuf[idx] = Math.floor(clamp(r, 0, 1) * 255);
        colorBuf[idx + 1] = Math.floor(clamp(g, 0, 1) * 255);
        colorBuf[idx + 2] = Math.floor(clamp(b, 0, 1) * 255);
        colorBuf[idx + 3] = 255;
      }
      data.colorMap = colorBuf;
      return { dataMap: data };
    }

    default:
      return { dataMap: createEmptyDataMap(width, height) };
  }
}

// Full DAG evaluation with topological ordering & multi-output support
export function evaluateGraph(
  nodes: TerrainNode[],
  connections: NodeConnection[],
  width: number = 256,
  height: number = 256,
  targetNodeId?: string
): {
  finalDataMap: TerrainDataMap;
  nodeOutputs: Map<
    string,
    {
      dataMap?: TerrainDataMap;
      mask?: Float32Array;
      namedOutputs?: Record<string, TerrainDataMap | Float32Array>;
    }
  >;
  activeNodeId: string;
} {
  const nodeMap = new Map<string, TerrainNode>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  const inEdges = new Map<string, { portId: string; fromNodeId: string; fromPortId: string }[]>();
  nodes.forEach((n) => inEdges.set(n.id, []));

  connections.forEach((c) => {
    if (inEdges.has(c.toNodeId) && nodeMap.has(c.fromNodeId)) {
      inEdges.get(c.toNodeId)!.push({
        portId: c.toPortId,
        fromNodeId: c.fromNodeId,
        fromPortId: c.fromPortId,
      });
    }
  });

  const inDegree = new Map<string, number>();
  nodes.forEach((n) => inDegree.set(n.id, 0));

  connections.forEach((c) => {
    if (nodeMap.has(c.toNodeId) && nodeMap.has(c.fromNodeId)) {
      inDegree.set(c.toNodeId, (inDegree.get(c.toNodeId) || 0) + 1);
    }
  });

  const queue: string[] = [];
  inDegree.forEach((deg, id) => {
    if (deg === 0) queue.push(id);
  });

  const sortedNodeIds: string[] = [];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    sortedNodeIds.push(curr);

    connections.forEach((c) => {
      if (c.fromNodeId === curr && inDegree.has(c.toNodeId)) {
        const nextDeg = inDegree.get(c.toNodeId)! - 1;
        inDegree.set(c.toNodeId, nextDeg);
        if (nextDeg === 0) queue.push(c.toNodeId);
      }
    });
  }

  nodes.forEach((n) => {
    if (!sortedNodeIds.includes(n.id)) {
      sortedNodeIds.push(n.id);
    }
  });

  const nodeOutputs = new Map<
    string,
    {
      dataMap?: TerrainDataMap;
      mask?: Float32Array;
      namedOutputs?: Record<string, TerrainDataMap | Float32Array>;
    }
  >();

  for (const nodeId of sortedNodeIds) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;

    const inputPayloads: Record<string, TerrainDataMap | Float32Array> = {};
    const edges = inEdges.get(nodeId) || [];

    for (const edge of edges) {
      const srcOut = nodeOutputs.get(edge.fromNodeId);
      if (srcOut) {
        // Check if there is a specific named output from the source node
        if (srcOut.namedOutputs && srcOut.namedOutputs[edge.fromPortId]) {
          inputPayloads[edge.portId] = srcOut.namedOutputs[edge.fromPortId];
        } else if (srcOut.dataMap) {
          inputPayloads[edge.portId] = srcOut.dataMap;
        } else if (srcOut.mask) {
          inputPayloads[edge.portId] = srcOut.mask;
        }
      }
    }

    if (node.bypass) {
      const firstIn = Object.values(inputPayloads)[0];
      if (firstIn && 'heightmap' in firstIn) {
        nodeOutputs.set(nodeId, { dataMap: firstIn });
      } else {
        nodeOutputs.set(nodeId, { dataMap: createEmptyDataMap(width, height) });
      }
      continue;
    }

    const res = evaluateNode(node, inputPayloads, width, height);
    nodeOutputs.set(nodeId, res);
  }

  let activeId = targetNodeId && nodeMap.has(targetNodeId) ? targetNodeId : '';

  if (!activeId) {
    for (let i = sortedNodeIds.length - 1; i >= 0; i--) {
      const id = sortedNodeIds[i];
      const out = nodeOutputs.get(id);
      if (out && out.dataMap) {
        activeId = id;
        break;
      }
    }
  }

  if (!activeId && nodes.length > 0) {
    activeId = nodes[0].id;
  }

  const activeRes = nodeOutputs.get(activeId);
  const finalDataMap = activeRes?.dataMap ?? createEmptyDataMap(width, height);

  return {
    finalDataMap,
    nodeOutputs,
    activeNodeId: activeId,
  };
}
