export type NodeCategory = 'generator' | 'filter' | 'selector' | 'combiner' | 'color';

export type NodeType =
  // Generators / Primitives
  | 'mountain'
  | 'crater'
  | 'canyon'
  | 'simplex'
  | 'fbm'
  | 'billow'
  | 'ridged'
  | 'voronoi'
  // Filters & Natural
  | 'hydraulic'
  | 'thermal'
  | 'terraces'
  | 'autolevel'
  | 'clamp'
  | 'invert'
  // Selectors
  | 'select_slope'
  | 'select_altitude'
  | 'select_curvature'
  // Combiners
  | 'combiner'
  // Color & SatMap
  | 'satmap';

export type PortDataType = 'terrain' | 'mask';

export interface NodePort {
  id: string;
  name: string;
  type: PortDataType;
  direction: 'in' | 'out';
  description?: string;
}

export interface NodeMetadata {
  type: NodeType;
  name: string;
  category: NodeCategory;
  description: string;
  inputs: NodePort[];
  outputs: NodePort[];
  defaultParams: Record<string, any>;
}

export interface TerrainNode {
  id: string;
  type: NodeType;
  name: string;
  category: NodeCategory;
  x: number;
  y: number;
  params: Record<string, any>;
  bypass?: boolean;
}

export interface NodeConnection {
  id: string;
  fromNodeId: string;
  fromPortId: string;
  toNodeId: string;
  toPortId: string;
}

export interface TerrainDataMap {
  width: number;
  height: number;
  heightmap: Float32Array;   // Channel R: 0.0 - 1.0 (elevation)
  flowmap: Float32Array;     // Channel G: 0.0 - 1.0 (water runoff)
  deposition: Float32Array;  // Channel B: 0.0 - 1.0 (sediment)
  wear: Float32Array;        // Channel A: 0.0 - 1.0 (wear & slope)
  colorMap?: Uint8Array;     // RGBA SatMap satellite color buffer
}

export type RenderStyle =
  | 'pbr'
  | 'clay'
  | 'satmap'
  | 'height'
  | 'flow'
  | 'deposition'
  | 'wear'
  | 'normals'
  | 'wireframe';

export type SatMapBiome =
  | 'zion'
  | 'iceland'
  | 'alps'
  | 'sahara'
  | 'patagonia'
  | 'volcanic';

// Substance Painter / World Creator PBR Layers
export interface PBRMaterialSettings {
  // Layer 1: Cliff Rock
  rockColor: string;
  rockRoughness: number;
  rockDetail: number;
  // Layer 2: Scree & Talus
  screeColor: string;
  screeRoughness: number;
  // Layer 3: Grass & Vegetation
  grassColor: string;
  grassRoughness: number;
  // Layer 4: Glacial Snow
  snowColor: string;
  snowRoughness: number;
  snowHeight: number;
  // Layer 5: Wet Riverbed
  waterColor: string;
  wetness: number;
  // Micro-texture normal scaling
  normalStrength: number;
  triplanarScale: number;
  ambientOcclusion: number;
}

// Advanced Gerstner Ocean & Shoreline Settings
export interface OceanSettings {
  enabled: boolean;
  waterLevel: number;
  waveSpeed: number;
  waveHeight: number;
  shallowColor: string;
  deepColor: string;
  foamColor: string;
  foamThreshold: number;
  opacity: number;
  preset: 'glacial' | 'ocean' | 'tropical' | 'stream';
}

export interface SculptBrushSettings {
  enabled: boolean;
  tool: 'raise' | 'lower' | 'smooth' | 'flatten';
  radius: number;
  strength: number;
  falloff: 'smooth' | 'linear' | 'spherical';
}

export interface LightingSettings {
  sunElevation: number; // 0 to 90
  sunAzimuth: number;   // 0 to 360
  sunIntensity: number; // 1.0 to 4.0
  ambientLight: number; // 0.2 to 1.5
  skyColor: string;
  sunColor: string;
  fogDensity: number;
  exposure: number;
  contrast: number;
}

export interface ViewportSettings {
  renderStyle: RenderStyle;
  satmapBiome: SatMapBiome;
  wireframe: boolean;
  solidSlab: boolean;       // 3D Geological Strata Cutout Block
  slabDepth: number;
  heightScale: number;
  meshDensity: 256 | 512;   // Plane geometry polygon density
  resolution: number;       // Texture computation resolution (256, 512, 1024, 2048)
  lighting: LightingSettings;
  ocean: OceanSettings;
  pbr: PBRMaterialSettings;
  brush: SculptBrushSettings;
}

export interface TerrainPreset {
  id: string;
  name: string;
  description: string;
  badge: string;
  nodes: TerrainNode[];
  connections: NodeConnection[];
  activeNodeId?: string;
  pinnedNodeId?: string;
}

export type InspectorTab = 'node' | 'pbr' | 'lighting' | 'ocean' | 'sculpt';
