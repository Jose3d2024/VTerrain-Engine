import React, { useState } from 'react';
import {
  TerrainNode,
  NodeType,
  ViewportSettings,
  PBRMaterialSettings,
  LightingSettings,
  OceanSettings,
  SculptBrushSettings,
  InspectorTab,
} from '../types/terrain';
import { NODE_REGISTRY } from '../engine/graphEvaluator';
import {
  Sliders,
  Palette,
  Snowflake,
  Sun,
  Waves,
  Brush,
  Pin,
  Eye,
  EyeOff,
  RotateCcw,
  Dices,
  Sparkles,
  Layers,
  Check,
  ChevronRight,
  Droplet,
  Compass,
  Cpu,
  Trash2,
  Maximize2,
} from 'lucide-react';

interface StudioInspectorProps {
  activeNode: TerrainNode | null;
  pinnedNodeId: string;
  viewportSettings: ViewportSettings;
  onPinNode: (nodeId: string) => void;
  onToggleBypass: (nodeId: string) => void;
  onUpdateParams: (nodeId: string, params: Record<string, any>) => void;
  onAppendModifier: (sourceNodeId: string, modifierType: NodeType) => void;
  onUpdateSettings: (newSettings: Partial<ViewportSettings>) => void;
  onBakeResolution: (resolution: number) => void;
  onClearSculpt?: () => void;
  isBaking: boolean;
}

// 1-Click PBR Biome Material Presets (Substance Painter / World Creator grade)
const PBR_PRESETS: { id: string; name: string; desc: string; pbr: Partial<PBRMaterialSettings> }[] = [
  {
    id: 'alps',
    name: 'Alps Alpine Granite',
    desc: 'High mountain rock with limestone scree, subalpine meadows & glacial snowcaps',
    pbr: {
      rockColor: '#534d45',
      rockRoughness: 0.85,
      screeColor: '#8c7d6e',
      screeRoughness: 0.9,
      grassColor: '#45582e',
      grassRoughness: 0.75,
      snowEnabled: true,
      snowColor: '#f4f7fc',
      snowRoughness: 0.28,
      snowHeight: 0.55,
      snowMeltRate: 0.14,
      snowSlumpAngle: 0.40,
      beachColor: '#7e735e',
      waterColor: '#1d3e4c',
      normalStrength: 1.4,
      triplanarScale: 1.0,
      ambientOcclusion: 1.15,
    },
  },
  {
    id: 'zion',
    name: 'Zion Red Sandstone',
    desc: 'Eroded red canyon cliffs, oxidized orange scree and dry wash riverbeds',
    pbr: {
      rockColor: '#9e462a',
      rockRoughness: 0.82,
      screeColor: '#ba6f45',
      screeRoughness: 0.88,
      grassColor: '#7a7343',
      grassRoughness: 0.85,
      snowEnabled: false,
      snowColor: '#faeae3',
      snowRoughness: 0.5,
      snowHeight: 0.95,
      snowMeltRate: 0.2,
      snowSlumpAngle: 0.45,
      beachColor: '#8a6548',
      waterColor: '#423425',
      normalStrength: 1.6,
      triplanarScale: 1.2,
      ambientOcclusion: 1.25,
    },
  },
  {
    id: 'iceland',
    name: 'Icelandic Volcanic',
    desc: 'Dark basalt crags, volcanic black gravel scree, and neon emerald moss',
    pbr: {
      rockColor: '#282b30',
      rockRoughness: 0.78,
      screeColor: '#3d4147',
      screeRoughness: 0.85,
      grassColor: '#3a6627',
      grassRoughness: 0.65,
      snowEnabled: false,
      snowColor: '#e9f1f7',
      snowRoughness: 0.25,
      snowHeight: 0.72,
      snowMeltRate: 0.15,
      snowSlumpAngle: 0.42,
      beachColor: '#2a2c30',
      waterColor: '#183b48',
      normalStrength: 1.8,
      triplanarScale: 1.1,
      ambientOcclusion: 1.35,
    },
  },
  {
    id: 'patagonia',
    name: 'Patagonia Fjords',
    desc: 'Cold granite spires, blue-tinted shale, and heavy perennial snowfields',
    pbr: {
      rockColor: '#474b54',
      rockRoughness: 0.82,
      screeColor: '#6f7480',
      screeRoughness: 0.88,
      grassColor: '#3d4d38',
      grassRoughness: 0.78,
      snowEnabled: true,
      snowColor: '#f7fafc',
      snowRoughness: 0.22,
      snowHeight: 0.52,
      snowMeltRate: 0.12,
      snowSlumpAngle: 0.42,
      beachColor: '#6a6d75',
      waterColor: '#123145',
      normalStrength: 1.5,
      triplanarScale: 1.0,
      ambientOcclusion: 1.2,
    },
  },
];

// 1-Click Studio Lighting Presets
const LIGHTING_PRESETS: { id: string; name: string; desc: string; lighting: Partial<LightingSettings> }[] = [
  {
    id: 'noon',
    name: 'High Noon Studio',
    desc: 'Bright neutral daylight with deep terrain ridge shadows and sky bounce',
    lighting: {
      sunElevation: 54,
      sunAzimuth: 135,
      sunIntensity: 2.8,
      ambientLight: 0.95,
      sunColor: '#fff8ee',
      skyColor: '#9ec4ec',
      fogDensity: 0.012,
      exposure: 1.35,
      contrast: 1.02,
    },
  },
  {
    id: 'golden',
    name: 'Cinematic Golden Hour',
    desc: 'Low raking sunlight emphasizing micro-normals, rock strata, and cliff faces',
    lighting: {
      sunElevation: 22,
      sunAzimuth: 215,
      sunIntensity: 3.2,
      ambientLight: 0.85,
      sunColor: '#ffba6b',
      skyColor: '#5a78aa',
      fogDensity: 0.016,
      exposure: 1.4,
      contrast: 1.05,
    },
  },
  {
    id: 'dawn',
    name: 'Crisp Alpine Morning',
    desc: 'Cool blue ambient fill with high-contrast sunlight on snow crests',
    lighting: {
      sunElevation: 35,
      sunAzimuth: 85,
      sunIntensity: 2.9,
      ambientLight: 1.1,
      sunColor: '#fff0d8',
      skyColor: '#7eb3e6',
      fogDensity: 0.015,
      exposure: 1.35,
      contrast: 1.02,
    },
  },
  {
    id: 'overcast',
    name: 'Soft Overcast Diffuse',
    desc: 'Even hemispheric lighting highlighting subtle erosion channels and scree',
    lighting: {
      sunElevation: 68,
      sunAzimuth: 180,
      sunIntensity: 2.1,
      ambientLight: 1.4,
      sunColor: '#f2f2f2',
      skyColor: '#b0bfcf',
      fogDensity: 0.018,
      exposure: 1.38,
      contrast: 1.0,
    },
  },
];

// 1-Click Ocean & Water Presets
const OCEAN_PRESETS: { id: string; name: string; ocean: Partial<OceanSettings> }[] = [
  {
    id: 'glacial',
    name: 'Glacial Fjord',
    ocean: {
      shallowColor: '#2898a4',
      deepColor: '#0b263d',
      foamColor: '#eef8ff',
      foamThreshold: 0.12,
      waveHeight: 0.05,
      waveSpeed: 1.2,
      opacity: 0.9,
    },
  },
  {
    id: 'ocean',
    name: 'Deep Blue Sea',
    ocean: {
      shallowColor: '#1d8aa6',
      deepColor: '#07182d',
      foamColor: '#ffffff',
      foamThreshold: 0.15,
      waveHeight: 0.08,
      waveSpeed: 1.6,
      opacity: 0.92,
    },
  },
  {
    id: 'tropical',
    name: 'Tropical Atoll',
    ocean: {
      shallowColor: '#20d5d2',
      deepColor: '#0e4d75',
      foamColor: '#f0ffff',
      foamThreshold: 0.18,
      waveHeight: 0.04,
      waveSpeed: 1.0,
      opacity: 0.85,
    },
  },
];

export const StudioInspector: React.FC<StudioInspectorProps> = ({
  activeNode,
  pinnedNodeId,
  viewportSettings,
  onPinNode,
  onToggleBypass,
  onUpdateParams,
  onAppendModifier,
  onUpdateSettings,
  onBakeResolution,
  onClearSculpt,
  isBaking,
}) => {
  const [activeTab, setActiveTab] = useState<InspectorTab>('node');

  const isPinned = activeNode ? activeNode.id === pinnedNodeId : false;
  const meta = activeNode ? NODE_REGISTRY[activeNode.type] : null;
  const params = activeNode ? activeNode.params : {};

  const handleParamChange = (key: string, value: any) => {
    if (!activeNode) return;
    onUpdateParams(activeNode.id, {
      ...params,
      [key]: value,
    });
  };

  const handleRandomSeed = () => {
    if (!activeNode) return;
    handleParamChange('seed', Math.floor(Math.random() * 9999) + 1);
  };

  const handleResetDefaults = () => {
    if (!activeNode || !meta) return;
    onUpdateParams(activeNode.id, { ...meta.defaultParams });
  };

  const updatePbr = (patch: Partial<PBRMaterialSettings>) => {
    onUpdateSettings({
      pbr: {
        ...viewportSettings.pbr,
        ...patch,
      },
    });
  };

  const updateLighting = (patch: Partial<LightingSettings>) => {
    onUpdateSettings({
      lighting: {
        ...viewportSettings.lighting,
        ...patch,
      },
    });
  };

  const updateOcean = (patch: Partial<OceanSettings>) => {
    onUpdateSettings({
      ocean: {
        ...viewportSettings.ocean,
        ...patch,
      },
    });
  };

  const updateBrush = (patch: Partial<SculptBrushSettings>) => {
    onUpdateSettings({
      brush: {
        ...viewportSettings.brush,
        ...patch,
      },
    });
  };

  return (
    <div className="w-[340px] h-full bg-[#17181B] border-l border-[#2D3139] flex flex-col select-none text-xs font-mono overflow-hidden z-20">
      {/* Top Inspector Tab Bar */}
      <div className="flex items-center justify-between bg-[#121315] border-b border-[#2D3139] p-1 gap-1">
        <button
          onClick={() => setActiveTab('node')}
          className={`flex-1 flex flex-col items-center py-2 px-1 rounded-md transition-all ${
            activeTab === 'node'
              ? 'bg-[#212429] text-[#00A8FF] font-semibold shadow'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-[#1A1C1F]'
          }`}
          title="Active Geological Node Parameters"
        >
          <Sliders className="w-4 h-4 mb-0.5" />
          <span className="text-[10px]">Node</span>
        </button>

        <button
          onClick={() => setActiveTab('pbr')}
          className={`flex-1 flex flex-col items-center py-2 px-1 rounded-md transition-all ${
            activeTab === 'pbr'
              ? 'bg-[#212429] text-[#00A8FF] font-semibold shadow'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-[#1A1C1F]'
          }`}
          title="PBR Material Layers & Texturing"
        >
          <Palette className="w-4 h-4 mb-0.5" />
          <span className="text-[10px]">Materials</span>
        </button>

        <button
          onClick={() => setActiveTab('lighting')}
          className={`flex-1 flex flex-col items-center py-2 px-1 rounded-md transition-all ${
            activeTab === 'lighting'
              ? 'bg-[#212429] text-[#00A8FF] font-semibold shadow'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-[#1A1C1F]'
          }`}
          title="Sun, Sky Ambient & Atmospheric Lighting"
        >
          <Sun className="w-4 h-4 mb-0.5" />
          <span className="text-[10px]">Lighting</span>
        </button>

        <button
          onClick={() => setActiveTab('ocean')}
          className={`flex-1 flex flex-col items-center py-2 px-1 rounded-md transition-all ${
            activeTab === 'ocean'
              ? 'bg-[#212429] text-[#00A8FF] font-semibold shadow'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-[#1A1C1F]'
          }`}
          title="Dynamic Gerstner Ocean & Shoreline Foam"
        >
          <Waves className="w-4 h-4 mb-0.5" />
          <span className="text-[10px]">Ocean</span>
        </button>

        <button
          onClick={() => setActiveTab('sculpt')}
          className={`flex-1 flex flex-col items-center py-2 px-1 rounded-md transition-all ${
            activeTab === 'sculpt'
              ? 'bg-[#212429] text-[#00A8FF] font-semibold shadow'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-[#1A1C1F]'
          }`}
          title="Interactive 3D Terrain Sculpting Brush"
        >
          <Brush className="w-4 h-4 mb-0.5" />
          <span className="text-[10px]">Sculpt</span>
        </button>
      </div>

      {/* TAB CONTENT 1: NODE INSPECTOR */}
      {activeTab === 'node' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {!activeNode ? (
            <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
              <Sliders className="w-10 h-10 text-neutral-600 mb-3" />
              <h4 className="text-sm font-semibold text-neutral-400">No Node Selected</h4>
              <p className="text-xs text-neutral-500 mt-1 max-w-[200px]">
                Click on any node in the graph editor to calibrate its geological parameters.
              </p>
            </div>
          ) : (
            <>
              {/* Node Header */}
              <div className="p-3.5 border-b border-[#2D3139] bg-[#1A1C1F] flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-neutral-100 text-sm truncate max-w-[150px]">
                      {activeNode.name}
                    </span>
                    {isPinned && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-semibold">
                        PINNED
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-[#00A8FF] font-semibold uppercase tracking-wider">
                      {activeNode.category}
                    </span>
                    <span className="text-neutral-500">•</span>
                    <span className="text-[10px] text-neutral-400">{activeNode.type}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onPinNode(activeNode.id)}
                    title={isPinned ? 'Unpin from Viewport (F)' : 'Pin to Viewport (F)'}
                    className={`p-1.5 rounded transition-colors ${
                      isPinned
                        ? 'bg-cyan-500/30 text-cyan-300'
                        : 'hover:bg-[#25282E] text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-current' : ''}`} />
                  </button>

                  <button
                    onClick={() => onToggleBypass(activeNode.id)}
                    title={activeNode.bypass ? 'Enable Node (B)' : 'Bypass Node (B)'}
                    className="p-1.5 hover:bg-[#25282E] rounded text-neutral-400 hover:text-white transition-colors"
                  >
                    {activeNode.bypass ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={handleResetDefaults}
                    title="Reset to Node Defaults"
                    className="p-1.5 hover:bg-[#25282E] rounded text-neutral-400 hover:text-white transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Node Form Fields */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Random Seed */}
                {params.seed !== undefined && (
                  <div className="space-y-1.5 bg-[#212429] p-2.5 rounded-lg border border-[#2D3139]">
                    <div className="flex items-center justify-between text-neutral-300">
                      <span className="text-neutral-400">Random Seed:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#00A8FF] font-semibold">{params.seed}</span>
                        <button
                          onClick={handleRandomSeed}
                          title="Generate Random Seed"
                          className="p-1 bg-[#1A1C1F] hover:bg-[#2A2E35] border border-[#2D3139] rounded text-neutral-300 hover:text-white"
                        >
                          <Dices className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Dynamic Parameter Sliders */}
                {Object.entries(params).map(([key, val]) => {
                  if (key === 'seed') return null;

                  if (typeof val === 'number') {
                    let min = 0;
                    let max = 1;
                    let step = 0.01;

                    if (key === 'scale' || key === 'frequency') {
                      min = 0.1;
                      max = 8.0;
                      step = 0.1;
                    } else if (key === 'octaves' || key === 'steps' || key === 'iterations') {
                      min = 1;
                      max = 16;
                      step = 1;
                    } else if (key === 'angle') {
                      min = 0;
                      max = 360;
                      step = 1;
                    } else if (key === 'power' || key === 'falloff' || key === 'slope' || key === 'steepness') {
                      min = 0.1;
                      max = 5.0;
                      step = 0.05;
                    }

                    return (
                      <div key={key} className="space-y-1.5">
                        <div className="flex justify-between items-center text-neutral-300">
                          <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                          <span className="text-[#00A8FF] font-semibold">
                            {Number(val).toFixed(step < 1 ? 2 : 0)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={min}
                          max={max}
                          step={step}
                          value={val}
                          onChange={(e) => handleParamChange(key, parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-[#25282E] rounded-lg appearance-none cursor-pointer accent-[#00A8FF]"
                        />
                      </div>
                    );
                  }

                  if (typeof val === 'string') {
                    if (key === 'operation') {
                      const ops = ['add', 'subtract', 'multiply', 'max', 'min', 'screen'];
                      return (
                        <div key={key} className="space-y-1.5">
                          <label className="text-neutral-400 capitalize">{key}:</label>
                          <select
                            value={val}
                            onChange={(e) => handleParamChange(key, e.target.value)}
                            className="w-full bg-[#212429] border border-[#2D3139] text-neutral-200 rounded p-1.5 focus:border-[#00A8FF] focus:outline-none"
                          >
                            {ops.map((op) => (
                              <option key={op} value={op}>
                                {op.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    }
                  }

                  return null;
                })}

                {/* Gaea Workflow Quick Modifiers */}
                <div className="pt-2 border-t border-[#2D3139] space-y-2">
                  <span className="text-[11px] text-neutral-400 uppercase tracking-wider font-semibold">
                    Append Geological Filter
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => onAppendModifier(activeNode.id, 'hydraulic')}
                      className="px-2 py-1.5 bg-[#212429] hover:bg-[#282C33] border border-[#2D3139] hover:border-[#00A8FF] text-neutral-300 hover:text-white rounded text-left transition-colors flex items-center justify-between"
                    >
                      <span>Erosion</span>
                      <ChevronRight className="w-3 h-3 text-[#00A8FF]" />
                    </button>
                    <button
                      onClick={() => onAppendModifier(activeNode.id, 'thermal')}
                      className="px-2 py-1.5 bg-[#212429] hover:bg-[#282C33] border border-[#2D3139] hover:border-[#00A8FF] text-neutral-300 hover:text-white rounded text-left transition-colors flex items-center justify-between"
                    >
                      <span>Talus Scree</span>
                      <ChevronRight className="w-3 h-3 text-[#00A8FF]" />
                    </button>
                    <button
                      onClick={() => onAppendModifier(activeNode.id, 'terraces')}
                      className="px-2 py-1.5 bg-[#212429] hover:bg-[#282C33] border border-[#2D3139] hover:border-[#00A8FF] text-neutral-300 hover:text-white rounded text-left transition-colors flex items-center justify-between"
                    >
                      <span>Terraces</span>
                      <ChevronRight className="w-3 h-3 text-[#00A8FF]" />
                    </button>
                    <button
                      onClick={() => onAppendModifier(activeNode.id, 'satmap')}
                      className="px-2 py-1.5 bg-[#212429] hover:bg-[#282C33] border border-[#2D3139] hover:border-[#00A8FF] text-neutral-300 hover:text-white rounded text-left transition-colors flex items-center justify-between"
                    >
                      <span>SatMap</span>
                      <ChevronRight className="w-3 h-3 text-[#00A8FF]" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB CONTENT 2: PBR MATERIALS */}
      {activeTab === 'pbr' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Biome Presets */}
          <div className="space-y-2">
            <span className="text-[11px] text-[#00A8FF] uppercase tracking-wider font-semibold">
              Substance Painter Biomes
            </span>
            <div className="grid grid-cols-2 gap-2">
              {PBR_PRESETS.map((bp) => (
                <button
                  key={bp.id}
                  onClick={() => updatePbr(bp.pbr)}
                  className="p-2 bg-[#212429] hover:bg-[#2A2E35] border border-[#2D3139] hover:border-[#00A8FF] rounded-lg text-left transition-all group"
                >
                  <div className="font-semibold text-neutral-200 group-hover:text-white text-xs truncate">
                    {bp.name}
                  </div>
                  <div className="text-[10px] text-neutral-400 line-clamp-1 mt-0.5">{bp.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Layer 1: Cliff Rock */}
          <div className="space-y-3 bg-[#1A1C1F] p-3 rounded-xl border border-[#2D3139]">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-200">1. Cliff Bedrock</span>
              <input
                type="color"
                value={viewportSettings.pbr.rockColor}
                onChange={(e) => updatePbr({ rockColor: e.target.value })}
                className="w-6 h-6 rounded border border-[#2D3139] cursor-pointer bg-transparent"
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-neutral-400 text-[11px]">
                <span>Roughness</span>
                <span className="text-[#00A8FF]">{viewportSettings.pbr.rockRoughness.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.02"
                value={viewportSettings.pbr.rockRoughness}
                onChange={(e) => updatePbr({ rockRoughness: parseFloat(e.target.value) })}
                className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-[#00A8FF]"
              />
            </div>
          </div>

          {/* Layer 2: Alluvial Scree & Gravel */}
          <div className="space-y-3 bg-[#1A1C1F] p-3 rounded-xl border border-[#2D3139]">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-200">2. Scree & Sediment</span>
              <input
                type="color"
                value={viewportSettings.pbr.screeColor}
                onChange={(e) => updatePbr({ screeColor: e.target.value })}
                className="w-6 h-6 rounded border border-[#2D3139] cursor-pointer bg-transparent"
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-neutral-400 text-[11px]">
                <span>Roughness</span>
                <span className="text-[#00A8FF]">{viewportSettings.pbr.screeRoughness.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.02"
                value={viewportSettings.pbr.screeRoughness}
                onChange={(e) => updatePbr({ screeRoughness: parseFloat(e.target.value) })}
                className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-[#00A8FF]"
              />
            </div>
          </div>

          {/* Layer 3: Grass & Alpine Flora */}
          <div className="space-y-3 bg-[#1A1C1F] p-3 rounded-xl border border-[#2D3139]">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-200">3. Alpine Meadow</span>
              <input
                type="color"
                value={viewportSettings.pbr.grassColor}
                onChange={(e) => updatePbr({ grassColor: e.target.value })}
                className="w-6 h-6 rounded border border-[#2D3139] cursor-pointer bg-transparent"
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-neutral-400 text-[11px]">
                <span>Roughness</span>
                <span className="text-[#00A8FF]">{viewportSettings.pbr.grassRoughness.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.02"
                value={viewportSettings.pbr.grassRoughness}
                onChange={(e) => updatePbr({ grassRoughness: parseFloat(e.target.value) })}
                className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-[#00A8FF]"
              />
            </div>
          </div>

          {/* Layer 4: Snow & Glacial Frost */}
          <div className="space-y-3 bg-[#1A1C1F] p-3 rounded-xl border border-[#2D3139]">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-200">4. Alpine Snowcap</span>
              <input
                type="color"
                value={viewportSettings.pbr.snowColor}
                onChange={(e) => updatePbr({ snowColor: e.target.value })}
                className="w-6 h-6 rounded border border-[#2D3139] cursor-pointer bg-transparent"
              />
            </div>
            <div className="space-y-2">
              <div className="space-y-1">
                <div className="flex justify-between text-neutral-400 text-[11px]">
                  <span>Snow Line Altitude</span>
                  <span className="text-[#00A8FF]">{(viewportSettings.pbr.snowHeight * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.02"
                  value={viewportSettings.pbr.snowHeight}
                  onChange={(e) => updatePbr({ snowHeight: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-[#00A8FF]"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-neutral-400 text-[11px]">
                  <span>Roughness</span>
                  <span className="text-[#00A8FF]">{viewportSettings.pbr.snowRoughness.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.02"
                  value={viewportSettings.pbr.snowRoughness}
                  onChange={(e) => updatePbr({ snowRoughness: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-[#00A8FF]"
                />
              </div>
            </div>
          </div>

          {/* Micro-Normals & Triplanar Crags */}
          <div className="space-y-3 bg-[#1A1C1F] p-3 rounded-xl border border-[#2D3139]">
            <span className="font-semibold text-neutral-200">Surface Micro-Normals</span>
            <div className="space-y-2">
              <div className="space-y-1">
                <div className="flex justify-between text-neutral-400 text-[11px]">
                  <span>Normal Detail Strength</span>
                  <span className="text-[#00A8FF]">{viewportSettings.pbr.normalStrength.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="3.0"
                  step="0.1"
                  value={viewportSettings.pbr.normalStrength}
                  onChange={(e) => updatePbr({ normalStrength: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-[#00A8FF]"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-neutral-400 text-[11px]">
                  <span>Triplanar Scaling</span>
                  <span className="text-[#00A8FF]">{viewportSettings.pbr.triplanarScale.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.1"
                  value={viewportSettings.pbr.triplanarScale}
                  onChange={(e) => updatePbr({ triplanarScale: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-[#00A8FF]"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-neutral-400 text-[11px]">
                  <span>Crevasse Ambient Occlusion</span>
                  <span className="text-[#00A8FF]">{viewportSettings.pbr.ambientOcclusion.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="2.0"
                  step="0.05"
                  value={viewportSettings.pbr.ambientOcclusion}
                  onChange={(e) => updatePbr({ ambientOcclusion: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-[#00A8FF]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: LIGHTING & SKY */}
      {activeTab === 'lighting' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Lighting Presets */}
          <div className="space-y-2">
            <span className="text-[11px] text-[#00A8FF] uppercase tracking-wider font-semibold">
              Sun & Sky Presets
            </span>
            <div className="grid grid-cols-2 gap-2">
              {LIGHTING_PRESETS.map((lp) => (
                <button
                  key={lp.id}
                  onClick={() => updateLighting(lp.lighting)}
                  className="p-2 bg-[#212429] hover:bg-[#2A2E35] border border-[#2D3139] hover:border-[#00A8FF] rounded-lg text-left transition-all group"
                >
                  <div className="font-semibold text-neutral-200 group-hover:text-white text-xs truncate">
                    {lp.name}
                  </div>
                  <div className="text-[10px] text-neutral-400 line-clamp-1 mt-0.5">{lp.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Sun Coordinates */}
          <div className="space-y-3 bg-[#1A1C1F] p-3 rounded-xl border border-[#2D3139]">
            <span className="font-semibold text-neutral-200">Sun Position & Angles</span>
            <div className="space-y-2">
              <div className="space-y-1">
                <div className="flex justify-between text-neutral-400 text-[11px]">
                  <span>Elevation (Altitude)</span>
                  <span className="text-[#00A8FF]">{viewportSettings.lighting.sunElevation}°</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="85"
                  step="1"
                  value={viewportSettings.lighting.sunElevation}
                  onChange={(e) => updateLighting({ sunElevation: parseInt(e.target.value) })}
                  className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-[#00A8FF]"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-neutral-400 text-[11px]">
                  <span>Azimuth (Direction)</span>
                  <span className="text-[#00A8FF]">{viewportSettings.lighting.sunAzimuth}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="1"
                  value={viewportSettings.lighting.sunAzimuth}
                  onChange={(e) => updateLighting({ sunAzimuth: parseInt(e.target.value) })}
                  className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-[#00A8FF]"
                />
              </div>
            </div>
          </div>

          {/* Light Energy & Sky Fill */}
          <div className="space-y-3 bg-[#1A1C1F] p-3 rounded-xl border border-[#2D3139]">
            <span className="font-semibold text-neutral-200">Light Energy & Sky Bounce</span>
            <div className="space-y-2">
              <div className="space-y-1">
                <div className="flex justify-between text-neutral-400 text-[11px]">
                  <span>Direct Sun Intensity</span>
                  <span className="text-[#00A8FF]">{viewportSettings.lighting.sunIntensity.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="4.0"
                  step="0.1"
                  value={viewportSettings.lighting.sunIntensity}
                  onChange={(e) => updateLighting({ sunIntensity: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-[#00A8FF]"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-neutral-400 text-[11px]">Sun Light Tint</span>
                <input
                  type="color"
                  value={viewportSettings.lighting.sunColor}
                  onChange={(e) => updateLighting({ sunColor: e.target.value })}
                  className="w-6 h-6 rounded border border-[#2D3139] cursor-pointer bg-transparent"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-neutral-400 text-[11px]">Sky Ambient Fill</span>
                <input
                  type="color"
                  value={viewportSettings.lighting.skyColor}
                  onChange={(e) => updateLighting({ skyColor: e.target.value })}
                  className="w-6 h-6 rounded border border-[#2D3139] cursor-pointer bg-transparent"
                />
              </div>
            </div>
          </div>

          {/* Exposure & Tone Mapping */}
          <div className="space-y-3 bg-[#1A1C1F] p-3 rounded-xl border border-[#2D3139]">
            <span className="font-semibold text-neutral-200">ACES Filmic Post-Processing</span>
            <div className="space-y-2">
              <div className="space-y-1">
                <div className="flex justify-between text-neutral-400 text-[11px]">
                  <span>Exposure</span>
                  <span className="text-[#00A8FF]">{viewportSettings.lighting.exposure.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="2.2"
                  step="0.05"
                  value={viewportSettings.lighting.exposure}
                  onChange={(e) => updateLighting({ exposure: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-[#00A8FF]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-neutral-400 text-[11px]">
                  <span>Contrast Curve</span>
                  <span className="text-[#00A8FF]">{viewportSettings.lighting.contrast.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.9"
                  max="1.3"
                  step="0.02"
                  value={viewportSettings.lighting.contrast}
                  onChange={(e) => updateLighting({ contrast: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-[#00A8FF]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-neutral-400 text-[11px]">
                  <span>Aerial Fog Density</span>
                  <span className="text-[#00A8FF]">{(viewportSettings.lighting.fogDensity * 100).toFixed(1)}%</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="0.04"
                  step="0.002"
                  value={viewportSettings.lighting.fogDensity}
                  onChange={(e) => updateLighting({ fogDensity: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-[#00A8FF]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: OCEAN & WATER */}
      {activeTab === 'ocean' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Ocean Switch */}
          <div className="flex items-center justify-between bg-[#1A1C1F] p-3 rounded-xl border border-[#2D3139]">
            <div>
              <span className="font-semibold text-neutral-200">Ocean Plane</span>
              <p className="text-[10px] text-neutral-500">Gerstner animated waves & foam</p>
            </div>
            <button
              onClick={() => updateOcean({ enabled: !viewportSettings.ocean.enabled })}
              className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all ${
                viewportSettings.ocean.enabled
                  ? 'bg-[#00A8FF] text-white shadow-[0_0_12px_rgba(0,168,255,0.4)]'
                  : 'bg-[#212429] text-neutral-400 hover:text-white border border-[#2D3139]'
              }`}
            >
              {viewportSettings.ocean.enabled ? 'ACTIVE' : 'OFF'}
            </button>
          </div>

          {/* Ocean Presets */}
          <div className="space-y-2">
            <span className="text-[11px] text-[#00A8FF] uppercase tracking-wider font-semibold">
              Water Depth Presets
            </span>
            <div className="grid grid-cols-3 gap-2">
              {OCEAN_PRESETS.map((op) => (
                <button
                  key={op.id}
                  onClick={() => updateOcean(op.ocean)}
                  className="p-2 bg-[#212429] hover:bg-[#2A2E35] border border-[#2D3139] hover:border-[#00A8FF] rounded-lg text-center transition-all"
                >
                  <div className="font-semibold text-neutral-200 text-xs truncate">{op.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Water Level / Sea Altitude */}
          <div className="space-y-3 bg-[#1A1C1F] p-3 rounded-xl border border-[#2D3139]">
            <span className="font-semibold text-neutral-200">Sea Level Elevation</span>
            <div className="space-y-1">
              <div className="flex justify-between text-neutral-400 text-[11px]">
                <span>Water Level</span>
                <span className="text-[#00A8FF]">{(viewportSettings.ocean.waterLevel * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.02"
                max="0.80"
                step="0.01"
                value={viewportSettings.ocean.waterLevel}
                onChange={(e) => updateOcean({ waterLevel: parseFloat(e.target.value) })}
                className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-[#00A8FF]"
              />
            </div>
          </div>

          {/* Wave Dynamics */}
          <div className="space-y-3 bg-[#1A1C1F] p-3 rounded-xl border border-[#2D3139]">
            <span className="font-semibold text-neutral-200">Wave Dynamics</span>
            <div className="space-y-2">
              <div className="space-y-1">
                <div className="flex justify-between text-neutral-400 text-[11px]">
                  <span>Wave Height</span>
                  <span className="text-[#00A8FF]">{viewportSettings.ocean.waveHeight.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="0.25"
                  step="0.01"
                  value={viewportSettings.ocean.waveHeight}
                  onChange={(e) => updateOcean({ waveHeight: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-[#00A8FF]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-neutral-400 text-[11px]">
                  <span>Wave Speed</span>
                  <span className="text-[#00A8FF]">{viewportSettings.ocean.waveSpeed.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="3.0"
                  step="0.1"
                  value={viewportSettings.ocean.waveSpeed}
                  onChange={(e) => updateOcean({ waveSpeed: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-[#00A8FF]"
                />
              </div>
            </div>
          </div>

          {/* Water Colors & Shoreline Foam */}
          <div className="space-y-3 bg-[#1A1C1F] p-3 rounded-xl border border-[#2D3139]">
            <span className="font-semibold text-neutral-200">Depth & Foam Colors</span>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400 text-[11px]">Shallow Turquoise</span>
                <input
                  type="color"
                  value={viewportSettings.ocean.shallowColor}
                  onChange={(e) => updateOcean({ shallowColor: e.target.value })}
                  className="w-6 h-6 rounded border border-[#2D3139] cursor-pointer bg-transparent"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-neutral-400 text-[11px]">Abyss Deep Navy</span>
                <input
                  type="color"
                  value={viewportSettings.ocean.deepColor}
                  onChange={(e) => updateOcean({ deepColor: e.target.value })}
                  className="w-6 h-6 rounded border border-[#2D3139] cursor-pointer bg-transparent"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-neutral-400 text-[11px]">Shoreline Foam Tint</span>
                <input
                  type="color"
                  value={viewportSettings.ocean.foamColor}
                  onChange={(e) => updateOcean({ foamColor: e.target.value })}
                  className="w-6 h-6 rounded border border-[#2D3139] cursor-pointer bg-transparent"
                />
              </div>

              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-neutral-400 text-[11px]">
                  <span>Foam Band Width</span>
                  <span className="text-[#00A8FF]">{(viewportSettings.ocean.foamThreshold * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.02"
                  max="0.40"
                  step="0.01"
                  value={viewportSettings.ocean.foamThreshold}
                  onChange={(e) => updateOcean({ foamThreshold: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-[#00A8FF]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 5: SCULPT TOOLS */}
      {activeTab === 'sculpt' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Sculpt Brush Toggle */}
          <div className="flex items-center justify-between bg-[#1A1C1F] p-3 rounded-xl border border-[#2D3139]">
            <div>
              <span className="font-semibold text-neutral-200">Interactive Brush</span>
              <p className="text-[10px] text-neutral-500">Sculpt directly onto 3D terrain</p>
            </div>
            <button
              onClick={() => updateBrush({ enabled: !viewportSettings.brush.enabled })}
              className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all ${
                viewportSettings.brush.enabled
                  ? 'bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                  : 'bg-[#212429] text-neutral-400 hover:text-white border border-[#2D3139]'
              }`}
            >
              {viewportSettings.brush.enabled ? 'ACTIVE' : 'OFF'}
            </button>
          </div>

          {/* Brush Tools */}
          <div className="space-y-2">
            <span className="text-[11px] text-[#00A8FF] uppercase tracking-wider font-semibold">
              Sculpt Mode
            </span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'raise', label: 'Raise Peak', desc: 'Adds elevation' },
                { id: 'lower', label: 'Carve Canyon', desc: 'Depresses valley' },
                { id: 'smooth', label: 'Smooth Relax', desc: 'Thermal smoothing' },
                { id: 'flatten', label: 'Flatten Mesa', desc: 'Creates plateau' },
              ].map((tool) => {
                const isSelected = viewportSettings.brush.tool === tool.id;
                return (
                  <button
                    key={tool.id}
                    onClick={() => updateBrush({ tool: tool.id as any, enabled: true })}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-500/60 text-amber-200'
                        : 'bg-[#212429] border-[#2D3139] text-neutral-300 hover:bg-[#282C33]'
                    }`}
                  >
                    <div className="font-semibold text-xs">{tool.label}</div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">{tool.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Brush Radius & Strength */}
          <div className="space-y-3 bg-[#1A1C1F] p-3 rounded-xl border border-[#2D3139]">
            <span className="font-semibold text-neutral-200">Brush Settings</span>
            <div className="space-y-2">
              <div className="space-y-1">
                <div className="flex justify-between text-neutral-400 text-[11px]">
                  <span>Brush Radius</span>
                  <span className="text-[#00A8FF]">{(viewportSettings.brush.radius * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.04"
                  max="0.45"
                  step="0.01"
                  value={viewportSettings.brush.radius}
                  onChange={(e) => updateBrush({ radius: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-[#00A8FF]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-neutral-400 text-[11px]">
                  <span>Brush Strength</span>
                  <span className="text-[#00A8FF]">{(viewportSettings.brush.strength * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.05"
                  value={viewportSettings.brush.strength}
                  onChange={(e) => updateBrush({ strength: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-[#00A8FF]"
                />
              </div>

              {/* Falloff selection */}
              <div className="pt-1">
                <span className="text-neutral-400 text-[11px] block mb-1">Falloff Curve</span>
                <div className="grid grid-cols-3 gap-1">
                  {(['smooth', 'linear', 'spherical'] as const).map((falloff) => (
                    <button
                      key={falloff}
                      onClick={() => updateBrush({ falloff })}
                      className={`py-1 text-[10px] capitalize rounded border transition-colors ${
                        viewportSettings.brush.falloff === falloff
                          ? 'bg-[#00A8FF] text-white border-[#00A8FF]'
                          : 'bg-[#212429] text-neutral-400 border-[#2D3139] hover:text-white'
                      }`}
                    >
                      {falloff}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Reset Sculpting */}
          {onClearSculpt && (
            <button
              onClick={onClearSculpt}
              className="w-full py-2 bg-rose-950/30 hover:bg-rose-900/40 border border-rose-800/40 text-rose-300 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Sculpt Overrides</span>
            </button>
          )}
        </div>
      )}

      {/* Bottom Global Baking Bar */}
      <div className="p-3 bg-[#121315] border-t border-[#2D3139] flex items-center justify-between">
        <span className="text-[10px] text-neutral-400 font-mono">Bake Grid:</span>
        <div className="flex items-center gap-1">
          {[256, 512, 1024].map((res) => (
            <button
              key={res}
              onClick={() => onBakeResolution(res)}
              disabled={isBaking}
              className={`px-2 py-1 rounded text-xs font-mono transition-all ${
                viewportSettings.resolution === res
                  ? 'bg-[#00A8FF] text-white font-semibold'
                  : 'bg-[#212429] text-neutral-400 hover:text-white border border-[#2D3139]'
              }`}
            >
              {res}²
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
