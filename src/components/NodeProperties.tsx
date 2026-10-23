import React from 'react';
import { TerrainNode, NodeType, SatMapBiome } from '../types/terrain';
import { NODE_REGISTRY } from '../engine/graphEvaluator';
import {
  Sliders,
  Dices,
  Cpu,
  RotateCcw,
  Sparkles,
  Layers,
  Activity,
  Check,
  Pin,
  Eye,
  EyeOff,
  Palette,
  Layers3,
} from 'lucide-react';

interface NodePropertiesProps {
  node: TerrainNode | null;
  isPinned: boolean;
  onPinNode: (nodeId: string) => void;
  onToggleBypass: (nodeId: string) => void;
  onUpdateParams: (nodeId: string, params: Record<string, any>) => void;
  onAppendModifier: (sourceNodeId: string, modifierType: NodeType) => void;
  onBakeResolution: (resolution: number) => void;
  isBaking: boolean;
  currentResolution: number;
}

export const NodeProperties: React.FC<NodePropertiesProps> = ({
  node,
  isPinned,
  onPinNode,
  onToggleBypass,
  onUpdateParams,
  onAppendModifier,
  onBakeResolution,
  isBaking,
  currentResolution,
}) => {
  if (!node) {
    return (
      <div className="w-80 h-full bg-[#1A1C1F] border-l border-[#2D3139] p-6 flex flex-col items-center justify-center text-center select-none">
        <Sliders className="w-10 h-10 text-neutral-600 mb-3" />
        <h4 className="text-sm font-semibold text-neutral-400">No Node Selected</h4>
        <p className="text-xs text-neutral-500 mt-1 max-w-[200px]">
          Click on any node in the graph canvas to inspect and calibrate its geological parameters.
        </p>
      </div>
    );
  }

  const meta = NODE_REGISTRY[node.type];
  const params = node.params;

  const handleChange = (key: string, value: any) => {
    onUpdateParams(node.id, {
      ...params,
      [key]: value,
    });
  };

  const handleRandomSeed = () => {
    handleChange('seed', Math.floor(Math.random() * 9999) + 1);
  };

  const handleResetDefaults = () => {
    onUpdateParams(node.id, { ...meta.defaultParams });
  };

  return (
    <div className="w-80 h-full bg-[#1A1C1F] border-l border-[#2D3139] flex flex-col select-none text-xs font-mono overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#2D3139] bg-[#17181B] flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-200 text-sm truncate max-w-[140px]">
              {node.name}
            </span>
            {isPinned && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                PINNED
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-[#00A8FF] font-semibold uppercase tracking-wider">
              {node.category}
            </span>
            <span className="text-neutral-500">•</span>
            <span className="text-[10px] text-neutral-400">{node.type}</span>
          </div>
        </div>

        {/* Quick Node Actions: Pin, Bypass, Reset */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPinNode(node.id)}
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
            onClick={() => onToggleBypass(node.id)}
            title={node.bypass ? 'Enable Node (B)' : 'Bypass Node (B)'}
            className="p-1.5 hover:bg-[#25282E] rounded text-neutral-400 hover:text-white transition-colors"
          >
            {node.bypass ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
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

      {/* Scrollable Parameters Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Seed parameter with random dice */}
        {params.seed !== undefined && (
          <div className="space-y-1.5 bg-[#212429] p-2.5 rounded-lg border border-[#2D3139]">
            <div className="flex items-center justify-between text-neutral-300">
              <span className="text-neutral-400">Random Seed:</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[#00A8FF] font-semibold">{params.seed}</span>
                <button
                  onClick={handleRandomSeed}
                  title="Generate Random Seed"
                  className="p-1 hover:bg-[#2D3139] rounded text-neutral-300 hover:text-white transition-colors"
                >
                  <Dices className="w-3.5 h-3.5 text-amber-400" />
                </button>
              </div>
            </div>
            <input
              type="range"
              min="1"
              max="9999"
              value={params.seed}
              onChange={(e) => handleChange('seed', Number(e.target.value))}
              className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-[#00A8FF]"
            />
          </div>
        )}

        {/* Mountain Primitive Controls */}
        {node.type === 'mountain' && (
          <>
            <div className="space-y-1">
              <div className="flex justify-between text-neutral-400">
                <span>Ridge Folding Power:</span>
                <span className="text-emerald-400 font-semibold">{Number(params.ridgePower).toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="4.0"
                step="0.1"
                value={params.ridgePower}
                onChange={(e) => handleChange('ridgePower', Number(e.target.value))}
                className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-emerald-400"
              />
            </div>
          </>
        )}

        {/* Crater / Volcano Controls */}
        {node.type === 'crater' && (
          <>
            <div className="space-y-1">
              <div className="flex justify-between text-neutral-400">
                <span>Rim Radius:</span>
                <span className="text-emerald-400 font-semibold">{Number(params.rimRadius).toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="0.8"
                step="0.02"
                value={params.rimRadius}
                onChange={(e) => handleChange('rimRadius', Number(e.target.value))}
                className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-emerald-400"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-neutral-400">
                <span>Caldera Depth:</span>
                <span className="text-emerald-400 font-semibold">{Number(params.calderaDepth).toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.02"
                value={params.calderaDepth}
                onChange={(e) => handleChange('calderaDepth', Number(e.target.value))}
                className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-emerald-400"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-neutral-400">
                <span>Central Peak Cone:</span>
                <span className="text-neutral-300">{Number(params.centralPeak).toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.8"
                step="0.02"
                value={params.centralPeak}
                onChange={(e) => handleChange('centralPeak', Number(e.target.value))}
                className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-emerald-400"
              />
            </div>
          </>
        )}

        {/* Canyon Controls */}
        {node.type === 'canyon' && (
          <>
            <div className="space-y-1">
              <div className="flex justify-between text-neutral-400">
                <span>Gorge Carve Depth:</span>
                <span className="text-emerald-400 font-semibold">{Number(params.canyonDepth).toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="0.9"
                step="0.02"
                value={params.canyonDepth}
                onChange={(e) => handleChange('canyonDepth', Number(e.target.value))}
                className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-emerald-400"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-neutral-400">
                <span>Strata Steps:</span>
                <span className="text-neutral-300">{params.strataSteps}</span>
              </div>
              <input
                type="range"
                min="4"
                max="24"
                step="1"
                value={params.strataSteps}
                onChange={(e) => handleChange('strataSteps', Number(e.target.value))}
                className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-emerald-400"
              />
            </div>
          </>
        )}

        {/* Generator Frequency & Noise Parameters */}
        {params.scale !== undefined && (
          <div className="space-y-1">
            <div className="flex justify-between text-neutral-400">
              <span>Frequency / Scale:</span>
              <span className="text-[#00A8FF] font-semibold">{Number(params.scale).toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="8.0"
              step="0.1"
              value={params.scale}
              onChange={(e) => handleChange('scale', Number(e.target.value))}
              className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-[#00A8FF]"
            />
          </div>
        )}

        {params.octaves !== undefined && (
          <div className="space-y-1">
            <div className="flex justify-between text-neutral-400">
              <span>Fractal Octaves:</span>
              <span className="text-[#00A8FF] font-semibold">{params.octaves} oct</span>
            </div>
            <input
              type="range"
              min="1"
              max="8"
              step="1"
              value={params.octaves}
              onChange={(e) => handleChange('octaves', Number(e.target.value))}
              className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-[#00A8FF]"
            />
          </div>
        )}

        {params.lacunarity !== undefined && (
          <div className="space-y-1">
            <div className="flex justify-between text-neutral-400">
              <span>Lacunarity (Spread):</span>
              <span className="text-neutral-300">{Number(params.lacunarity).toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="1.2"
              max="3.5"
              step="0.05"
              value={params.lacunarity}
              onChange={(e) => handleChange('lacunarity', Number(e.target.value))}
              className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-[#00A8FF]"
            />
          </div>
        )}

        {params.persistence !== undefined && (
          <div className="space-y-1">
            <div className="flex justify-between text-neutral-400">
              <span>Persistence (Roughness):</span>
              <span className="text-neutral-300">{Number(params.persistence).toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.02"
              value={params.persistence}
              onChange={(e) => handleChange('persistence', Number(e.target.value))}
              className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-[#00A8FF]"
            />
          </div>
        )}

        {/* SatMap Biome Selector */}
        {node.type === 'satmap' && (
          <div className="space-y-2 bg-[#212429] p-3 rounded-lg border border-pink-500/30">
            <div className="flex items-center gap-1.5 text-pink-400 font-semibold">
              <Palette className="w-3.5 h-3.5" />
              <span>SatMap Biome Library:</span>
            </div>
            <select
              value={params.biome}
              onChange={(e) => handleChange('biome', e.target.value as SatMapBiome)}
              className="w-full bg-[#1A1C1F] border border-[#2D3139] rounded px-2.5 py-1.5 text-neutral-200 focus:outline-none focus:border-pink-500"
            >
              <option value="zion">Zion Navajo Sandstone (Canyon)</option>
              <option value="iceland">Icelandic Basalt & Moss (Volcanic)</option>
              <option value="alps">Alps Glacial Horn (Glacier)</option>
              <option value="sahara">Sahara Erg & Dunes (Desert)</option>
              <option value="patagonia">Patagonia Granite Towers (Alpine)</option>
              <option value="volcanic">Volcanic Caldera & Ash (Caldera)</option>
            </select>
          </div>
        )}

        {/* Terraces Specific Controls */}
        {node.type === 'terraces' && (
          <>
            <div className="space-y-1">
              <div className="flex justify-between text-neutral-400">
                <span>Strata Step Count:</span>
                <span className="text-amber-400 font-semibold">{params.stepCount} steps</span>
              </div>
              <input
                type="range"
                min="2"
                max="24"
                step="1"
                value={params.stepCount}
                onChange={(e) => handleChange('stepCount', Number(e.target.value))}
                className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-amber-400"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-neutral-400">
                <span>Step Smoothness:</span>
                <span className="text-neutral-300">{Number(params.smoothness).toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.02"
                max="0.8"
                step="0.02"
                value={params.smoothness}
                onChange={(e) => handleChange('smoothness', Number(e.target.value))}
                className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-amber-400"
              />
            </div>
          </>
        )}

        {/* Hydraulic Erosion Controls */}
        {node.type === 'hydraulic' && (
          <>
            <div className="space-y-1">
              <div className="flex justify-between text-neutral-400">
                <span>Simulation Iterations:</span>
                <span className="text-sky-400 font-semibold">{params.iterations} passes</span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                step="1"
                value={params.iterations}
                onChange={(e) => handleChange('iterations', Number(e.target.value))}
                className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-sky-400"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-neutral-400">
                <span>Rainfall Intensity:</span>
                <span className="text-neutral-300">{Number(params.rainAmount).toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={params.rainAmount}
                onChange={(e) => handleChange('rainAmount', Number(e.target.value))}
                className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-sky-400"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-neutral-400">
                <span>Sediment Transport Cap:</span>
                <span className="text-neutral-300">{Number(params.sedimentCapacity).toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="8.0"
                step="0.2"
                value={params.sedimentCapacity}
                onChange={(e) => handleChange('sedimentCapacity', Number(e.target.value))}
                className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-sky-400"
              />
            </div>
          </>
        )}

        {/* AutoLevel Controls */}
        {node.type === 'autolevel' && (
          <div className="space-y-1">
            <div className="flex justify-between text-neutral-400">
              <span>Normalize Strength:</span>
              <span className="text-blue-400 font-semibold">{(params.strength * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={params.strength}
              onChange={(e) => handleChange('strength', Number(e.target.value))}
              className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-blue-400"
            />
          </div>
        )}

        {/* Select Curvature Controls */}
        {node.type === 'select_curvature' && (
          <>
            <div className="space-y-1.5">
              <label className="text-neutral-400">Curvature Mode:</label>
              <select
                value={params.mode}
                onChange={(e) => handleChange('mode', e.target.value)}
                className="w-full bg-[#212429] border border-[#2D3139] rounded px-2.5 py-1.5 text-neutral-200 focus:outline-none focus:border-purple-400"
              >
                <option value="ridges">Ridges (Convex Peaks)</option>
                <option value="valleys">Valleys (Concave Crevices)</option>
              </select>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-neutral-400">
                <span>Contrast:</span>
                <span className="text-purple-400 font-semibold">{Number(params.contrast).toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={params.contrast}
                onChange={(e) => handleChange('contrast', Number(e.target.value))}
                className="w-full h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-purple-400"
              />
            </div>
          </>
        )}

        {/* Gaea Modifier Stack: Quick-Append Modifier */}
        <div className="pt-2 border-t border-[#2D3139] space-y-2">
          <div className="flex items-center gap-1.5 text-neutral-400 font-semibold text-[11px]">
            <Layers3 className="w-3.5 h-3.5 text-[#00A8FF]" />
            <span>Modifier Stack (Quick Append):</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => onAppendModifier(node.id, 'autolevel')}
              className="px-2 py-1.5 bg-[#212429] hover:bg-[#2A2E35] border border-[#2D3139] hover:border-blue-400 rounded text-left text-[11px] text-neutral-300 transition-all flex items-center justify-between"
            >
              <span>+ AutoLevel</span>
            </button>
            <button
              onClick={() => onAppendModifier(node.id, 'terraces')}
              className="px-2 py-1.5 bg-[#212429] hover:bg-[#2A2E35] border border-[#2D3139] hover:border-amber-400 rounded text-left text-[11px] text-neutral-300 transition-all flex items-center justify-between"
            >
              <span>+ Terraces</span>
            </button>
            <button
              onClick={() => onAppendModifier(node.id, 'hydraulic')}
              className="px-2 py-1.5 bg-[#212429] hover:bg-[#2A2E35] border border-[#2D3139] hover:border-sky-400 rounded text-left text-[11px] text-neutral-300 transition-all flex items-center justify-between"
            >
              <span>+ Erosion</span>
            </button>
            <button
              onClick={() => onAppendModifier(node.id, 'satmap')}
              className="px-2 py-1.5 bg-[#212429] hover:bg-[#2A2E35] border border-[#2D3139] hover:border-pink-400 rounded text-left text-[11px] text-neutral-300 transition-all flex items-center justify-between"
            >
              <span>+ SatMap</span>
            </button>
          </div>
        </div>
      </div>

      {/* Industrial Bake Panel at Bottom */}
      <div className="p-4 border-t border-[#2D3139] bg-[#16171A] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-neutral-300 font-semibold">
            <Cpu className="w-4 h-4 text-[#00A8FF]" />
            <span>High-Res Bake</span>
          </div>
          <span className="text-[10px] text-neutral-500 font-mono">
            Active: {currentResolution}²
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {[256, 512, 1024].map((res) => (
            <button
              key={res}
              onClick={() => onBakeResolution(res)}
              disabled={isBaking}
              className={`py-1.5 rounded text-[11px] font-mono border transition-all ${
                currentResolution === res
                  ? 'bg-[#00A8FF]/20 border-[#00A8FF] text-[#00A8FF] font-semibold'
                  : 'bg-[#212429] border-[#2D3139] text-neutral-400 hover:text-white hover:bg-[#2A2E35]'
              }`}
            >
              {res}x{res}
            </button>
          ))}
        </div>

        <button
          onClick={() => onBakeResolution(currentResolution)}
          disabled={isBaking}
          className="w-full py-2.5 bg-[#00A8FF] hover:bg-[#0092dd] active:scale-[0.99] disabled:opacity-50 text-white font-semibold rounded-lg shadow-[0_0_15px_rgba(0,168,255,0.35)] flex items-center justify-center gap-2 transition-all"
        >
          <Sparkles className={`w-4 h-4 ${isBaking ? 'animate-spin' : ''}`} />
          <span>{isBaking ? 'Baking Pipeline...' : 'Bake Full Resolution'}</span>
        </button>
      </div>
    </div>
  );
};
