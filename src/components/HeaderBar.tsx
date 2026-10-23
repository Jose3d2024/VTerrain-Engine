import React, { useRef, useState } from 'react';
import { TerrainPreset } from '../types/terrain';
import { TERRAIN_PRESETS } from '../engine/presets';
import {
  Mountain,
  Download,
  Upload,
  Sparkles,
  Columns2,
  Box,
  Network,
  ChevronDown,
  Cpu,
  Layers,
  FolderOpen,
  Save,
  HelpCircle,
  Pin,
  Keyboard,
  X,
} from 'lucide-react';

interface HeaderBarProps {
  currentPresetId: string;
  onSelectPreset: (preset: TerrainPreset) => void;
  layoutMode: 'split' | 'viewport' | 'graph';
  onChangeLayout: (mode: 'split' | 'viewport' | 'graph') => void;
  onOpenExport: () => void;
  onBake: () => void;
  isBaking: boolean;
  resolution: number;
  pinnedNodeName?: string;
  onSaveProject: () => void;
  onLoadProject: (file: File) => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  currentPresetId,
  onSelectPreset,
  layoutMode,
  onChangeLayout,
  onOpenExport,
  onBake,
  isBaking,
  resolution,
  pinnedNodeName,
  onSaveProject,
  onLoadProject,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onLoadProject(e.target.files[0]);
    }
  };

  return (
    <>
      <header className="h-12 bg-[#17181B] border-b border-[#2D3139] px-4 flex items-center justify-between select-none z-30">
        {/* Brand & Preset Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#00A8FF] to-sky-300 flex items-center justify-center shadow-[0_0_12px_rgba(0,168,255,0.4)]">
              <Mountain className="w-4 h-4 text-[#121315]" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-bold text-white text-sm tracking-tight">VTerrain</span>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-[#00A8FF]/20 text-[#00A8FF]">
                  GAEA STUDIO
                </span>
              </div>
              <span className="text-[10px] text-neutral-400 font-mono leading-none mt-0.5">
                GPU Directed Acyclic Graph
              </span>
            </div>
          </div>

          <div className="h-5 w-[1px] bg-[#2D3139] mx-2" />

          {/* Presets Selector */}
          <div className="relative group">
            <select
              value={currentPresetId}
              onChange={(e) => {
                const selected = TERRAIN_PRESETS.find((p) => p.id === e.target.value);
                if (selected) onSelectPreset(selected);
              }}
              className="bg-[#212429] hover:bg-[#282C33] border border-[#2D3139] text-neutral-200 text-xs font-mono rounded-lg pl-3 pr-8 py-1.5 cursor-pointer appearance-none focus:outline-none focus:border-[#00A8FF] transition-all"
            >
              {TERRAIN_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.badge}: {preset.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          {/* Pinned Viewport Indicator */}
          {pinnedNodeName && (
            <div className="hidden lg:flex items-center gap-1.5 bg-cyan-950/40 border border-cyan-500/30 px-2 py-1 rounded text-xs font-mono text-cyan-300">
              <Pin className="w-3 h-3 text-cyan-400 fill-cyan-400" />
              <span>Viewing: {pinnedNodeName}</span>
            </div>
          )}
        </div>

        {/* Middle: Layout mode switcher */}
        <div className="flex items-center gap-1 bg-[#121315] p-1 rounded-lg border border-[#2D3139]">
          <button
            onClick={() => onChangeLayout('split')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono transition-all ${
              layoutMode === 'split'
                ? 'bg-[#212429] text-[#00A8FF] font-semibold shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
            title="Split View (Graph + 3D Viewport)"
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span>Split Studio</span>
          </button>

          <button
            onClick={() => onChangeLayout('viewport')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono transition-all ${
              layoutMode === 'viewport'
                ? 'bg-[#212429] text-[#00A8FF] font-semibold shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
            title="Full 3D Viewport"
          >
            <Box className="w-3.5 h-3.5" />
            <span>3D Viewport</span>
          </button>

          <button
            onClick={() => onChangeLayout('graph')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono transition-all ${
              layoutMode === 'graph'
                ? 'bg-[#212429] text-[#00A8FF] font-semibold shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
            title="Full Node Graph"
          >
            <Network className="w-3.5 h-3.5" />
            <span>Infinity Graph</span>
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Shortcuts cheatsheet */}
          <button
            onClick={() => setShowShortcutsModal(true)}
            title="Gaea Keyboard Shortcuts Cheatsheet"
            className="p-1.5 bg-[#212429] hover:bg-[#2A2E35] border border-[#2D3139] text-neutral-300 hover:text-white rounded-lg transition-colors flex items-center gap-1 text-xs font-mono"
          >
            <Keyboard className="w-4 h-4 text-[#00A8FF]" />
            <span className="hidden sm:inline">Shortcuts</span>
          </button>

          {/* Project Save / Load */}
          <button
            onClick={onSaveProject}
            title="Save Project JSON (.vterrain)"
            className="p-1.5 bg-[#212429] hover:bg-[#2A2E35] border border-[#2D3139] text-neutral-300 hover:text-white rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            title="Load Project File"
            className="p-1.5 bg-[#212429] hover:bg-[#2A2E35] border border-[#2D3139] text-neutral-300 hover:text-white rounded-lg transition-colors"
          >
            <FolderOpen className="w-4 h-4" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json,.vterrain"
            className="hidden"
          />

          <div className="h-4 w-[1px] bg-[#2D3139] mx-1" />

          {/* Quick Bake Button */}
          <button
            onClick={onBake}
            disabled={isBaking}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#212429] hover:bg-[#2A2E35] border border-[#2D3139] hover:border-[#00A8FF] text-neutral-200 text-xs font-mono rounded-lg transition-all"
          >
            <Cpu className={`w-3.5 h-3.5 text-[#00A8FF] ${isBaking ? 'animate-spin' : ''}`} />
            <span>Bake {resolution}²</span>
          </button>

          {/* Export Pipeline Button */}
          <button
            onClick={onOpenExport}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#00A8FF] hover:bg-[#0090dd] text-white text-xs font-semibold rounded-lg shadow-[0_0_12px_rgba(0,168,255,0.35)] transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Assets</span>
          </button>
        </div>
      </header>

      {/* Keyboard Shortcuts Cheatsheet Modal */}
      {showShortcutsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm select-none"
          onClick={() => setShowShortcutsModal(false)}
        >
          <div
            className="bg-[#1A1C1F] border border-[#2D3139] w-[500px] rounded-2xl shadow-2xl p-6 text-neutral-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#2D3139] pb-3">
              <div className="flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-[#00A8FF]" />
                <h3 className="font-semibold text-white text-base">Gaea Workflow Shortcuts</h3>
              </div>
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex items-center justify-between py-1.5 border-b border-[#262930]">
                <span className="text-neutral-400">Quick Add / Lazy Menu</span>
                <span className="px-2 py-0.5 rounded bg-[#212429] border border-[#2D3139] text-[#00A8FF]">Tab / Space / Right-Click</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#262930]">
                <span className="text-neutral-400">Pin Node to 3D Viewport</span>
                <span className="px-2 py-0.5 rounded bg-[#212429] border border-[#2D3139] text-cyan-400">F</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#262930]">
                <span className="text-neutral-400">Bypass / Mute Node</span>
                <span className="px-2 py-0.5 rounded bg-[#212429] border border-[#2D3139] text-amber-400">B</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#262930]">
                <span className="text-neutral-400">Delete Selected Node</span>
                <span className="px-2 py-0.5 rounded bg-[#212429] border border-[#2D3139] text-rose-400">Delete / Backspace</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#262930]">
                <span className="text-neutral-400">Pan Graph / 3D Orbit</span>
                <span className="px-2 py-0.5 rounded bg-[#212429] border border-[#2D3139] text-neutral-300">Middle Mouse / Drag</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-neutral-400">Zoom Graph / Viewport</span>
                <span className="px-2 py-0.5 rounded bg-[#212429] border border-[#2D3139] text-neutral-300">Mouse Wheel</span>
              </div>
            </div>

            <div className="pt-2 text-center text-[11px] text-neutral-500 font-mono">
              Inspired by QuadSpinner Gaea 2 & World Machine documentation standards.
            </div>
          </div>
        </div>
      )}
    </>
  );
};
