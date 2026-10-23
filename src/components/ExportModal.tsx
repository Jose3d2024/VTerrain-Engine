import React, { useState } from 'react';
import { TerrainDataMap } from '../types/terrain';
import {
  create16BitPNG,
  exportOBJMesh,
  createPBRTextureMap,
  downloadFile,
} from '../engine/exporters';
import {
  Download,
  X,
  FileCode,
  Box,
  Image,
  Layers,
  Sparkles,
  CheckCircle,
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataMap: TerrainDataMap;
  heightScale: number;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  dataMap,
  heightScale,
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const triggerFeedback = (name: string) => {
    setDownloadSuccess(name);
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  const handleExport16BitPNG = () => {
    const blob = create16BitPNG(dataMap.heightmap, dataMap.width, dataMap.height);
    downloadFile(blob, `vterrain_heightmap_16bit_${dataMap.width}x${dataMap.height}.png`);
    triggerFeedback('16-bit Heightmap PNG');
  };

  const handleExportOBJ = () => {
    const objText = exportOBJMesh(dataMap, heightScale, 1);
    downloadFile(objText, `vterrain_mesh_${dataMap.width}x${dataMap.height}.obj`);
    triggerFeedback('3D OBJ Mesh');
  };

  const handleExportTexture = (type: 'albedo' | 'normal' | 'packed_data' | 'flow' | 'deposition' | 'wear', label: string) => {
    const dataUrl = createPBRTextureMap(dataMap, type);
    // Convert base64 data url to blob
    fetch(dataUrl)
      .then((res) => res.blob())
      .then((blob) => {
        downloadFile(blob, `vterrain_${type}_${dataMap.width}x${dataMap.height}.png`);
        triggerFeedback(`${label} PNG`);
      });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm select-none">
      <div className="bg-[#1A1C1F] border border-[#2D3139] w-[640px] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-neutral-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#2D3139] flex items-center justify-between bg-[#151619]">
          <div className="flex items-center gap-2.5">
            <Download className="w-5 h-5 text-[#00A8FF]" />
            <h3 className="font-semibold text-white text-base">Industrial Pipeline Export</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-[#25282E]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success toast */}
        {downloadSuccess && (
          <div className="bg-emerald-500/10 border-b border-emerald-500/30 px-6 py-2.5 flex items-center gap-2 text-emerald-400 text-xs font-mono">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>Successfully generated and downloaded {downloadSuccess}!</span>
          </div>
        )}

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Section 1: 16-bit Displacement Heightmap */}
          <div className="bg-[#212429] p-4 rounded-xl border border-[#2D3139] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <Image className="w-4 h-4 text-[#00A8FF]" />
                <span>16-Bit Displacement Heightmap (Raw PNG)</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00A8FF]/20 text-[#00A8FF]">
                Zero-Banding
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              High bit-depth (65,536 discrete elevation levels) grayscale heightmap formatted specifically for Unreal Engine 5 landscape displacement, Blender displacement modifier, and Houdini heightfields.
            </p>
            <button
              onClick={handleExport16BitPNG}
              className="px-4 py-2 bg-[#00A8FF] hover:bg-[#0094e0] text-white text-xs font-semibold rounded-lg shadow-md flex items-center gap-2 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download 16-bit PNG ({dataMap.width}x{dataMap.height})</span>
            </button>
          </div>

          {/* Section 2: 3D Mesh Geometry */}
          <div className="bg-[#212429] p-4 rounded-xl border border-[#2D3139] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <Box className="w-4 h-4 text-amber-400" />
                <span>Wavefront 3D OBJ Mesh</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
                {(dataMap.width * dataMap.height * 2).toLocaleString()} Polys
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Optimized 3D surface geometry containing XYZ vertices, UV coordinates, and normal vectors, compatible with any 3D DCC, Maya, 3ds Max, or game engine.
            </p>
            <button
              onClick={handleExportOBJ}
              className="px-4 py-2 bg-[#2D3139] hover:bg-[#363B45] text-white text-xs font-semibold rounded-lg border border-neutral-600 flex items-center gap-2 transition-all"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Download 3D Geometry (.obj)</span>
            </button>
          </div>

          {/* Section 3: Packed PBR Geological Data Maps */}
          <div className="bg-[#212429] p-4 rounded-xl border border-[#2D3139] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Geological Data Maps & PBR Textures</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                PBR Pack
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Discrete multi-channel geological maps transporting raw physics parameters for custom shaders:
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => handleExportTexture('albedo', 'Albedo / Diffuse')}
                className="px-3 py-2 bg-[#1A1C1F] hover:bg-[#282C33] border border-[#2D3139] hover:border-[#00A8FF] rounded-lg text-left text-xs font-mono text-neutral-300 transition-all flex items-center justify-between"
              >
                <span>Albedo / Diffuse</span>
                <Download className="w-3.5 h-3.5 text-[#00A8FF]" />
              </button>

              <button
                onClick={() => handleExportTexture('normal', 'Tangent Normal')}
                className="px-3 py-2 bg-[#1A1C1F] hover:bg-[#282C33] border border-[#2D3139] hover:border-purple-400 rounded-lg text-left text-xs font-mono text-neutral-300 transition-all flex items-center justify-between"
              >
                <span>Tangent Normal Map</span>
                <Download className="w-3.5 h-3.5 text-purple-400" />
              </button>

              <button
                onClick={() => handleExportTexture('packed_data', 'RGBA32 Packed Data')}
                className="px-3 py-2 bg-[#1A1C1F] hover:bg-[#282C33] border border-[#2D3139] hover:border-sky-400 rounded-lg text-left text-xs font-mono text-neutral-300 transition-all flex items-center justify-between"
              >
                <span>RGBA Packed (R:H, G:Fl, B:Dep, A:Wear)</span>
                <Download className="w-3.5 h-3.5 text-sky-400" />
              </button>

              <button
                onClick={() => handleExportTexture('flow', 'Flowmap Runoff')}
                className="px-3 py-2 bg-[#1A1C1F] hover:bg-[#282C33] border border-[#2D3139] hover:border-cyan-400 rounded-lg text-left text-xs font-mono text-neutral-300 transition-all flex items-center justify-between"
              >
                <span>Water Flowmap (Veins)</span>
                <Download className="w-3.5 h-3.5 text-cyan-400" />
              </button>

              <button
                onClick={() => handleExportTexture('deposition', 'Deposition Sediment')}
                className="px-3 py-2 bg-[#1A1C1F] hover:bg-[#282C33] border border-[#2D3139] hover:border-amber-400 rounded-lg text-left text-xs font-mono text-neutral-300 transition-all flex items-center justify-between"
              >
                <span>Sediment Deposition Mask</span>
                <Download className="w-3.5 h-3.5 text-amber-400" />
              </button>

              <button
                onClick={() => handleExportTexture('wear', 'Rock Wear & Slope')}
                className="px-3 py-2 bg-[#1A1C1F] hover:bg-[#282C33] border border-[#2D3139] hover:border-rose-400 rounded-lg text-left text-xs font-mono text-neutral-300 transition-all flex items-center justify-between"
              >
                <span>Rock Wear / Abrasion Mask</span>
                <Download className="w-3.5 h-3.5 text-rose-400" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
