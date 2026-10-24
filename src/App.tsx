/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TerrainNode,
  NodeConnection,
  ViewportSettings,
  NodeType,
  TerrainPreset,
} from './types/terrain';
import { TERRAIN_PRESETS } from './engine/presets';
import { NODE_REGISTRY } from './engine/graphEvaluator';
import { evaluateGraphAsync } from './engine/evaluateGraphAsync';
import { Viewport3D } from './components/Viewport3D';
import { GraphCanvas } from './components/GraphCanvas';
import { StudioInspector } from './components/StudioInspector';
import { HeaderBar } from './components/HeaderBar';
import { ExportModal } from './components/ExportModal';
import { downloadFile } from './engine/exporters';

export default function App() {
  const initialPreset = TERRAIN_PRESETS[0];

  const [currentPresetId, setCurrentPresetId] = useState<string>(initialPreset.id);
  const [nodes, setNodes] = useState<TerrainNode[]>(initialPreset.nodes);
  const [connections, setConnections] = useState<NodeConnection[]>(initialPreset.connections);

  // Active node = currently selected in Properties Inspector
  const [activeNodeId, setActiveNodeId] = useState<string>(
    initialPreset.activeNodeId || initialPreset.nodes[0].id
  );

  // Pinned node = currently rendered in 3D Viewport (Gaea's signature feature)
  const [pinnedNodeId, setPinnedNodeId] = useState<string>(
    initialPreset.pinnedNodeId || initialPreset.nodes[initialPreset.nodes.length - 1]?.id || ''
  );

  const [layoutMode, setLayoutMode] = useState<'split' | 'viewport' | 'graph'>('split');
  const [splitRatio, setSplitRatio] = useState<number>(0.5);
  const [isDraggingSplitter, setIsDraggingSplitter] = useState<boolean>(false);

  const [isBaking, setIsBaking] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  const [viewportSettings, setViewportSettings] = useState<ViewportSettings>({
    renderStyle: 'pbr',
    satmapBiome: 'alps',
    wireframe: false,
    solidSlab: true,
    slabDepth: 3.0,
    heightScale: 4.2,
    meshDensity: 256,
    resolution: 256,
    lighting: {
      sunElevation: 52,
      sunAzimuth: 140,
      sunIntensity: 2.8,
      ambientLight: 1.0,
      sunColor: '#fff8ee',
      skyColor: '#9ec4ec',
      fogDensity: 0.012,
      exposure: 1.35,
      contrast: 1.02,
    },
    ocean: {
      enabled: true,
      waterLevel: 0.18,
      waveSpeed: 1.3,
      waveHeight: 0.06,
      shallowColor: '#2898a4',
      deepColor: '#0b263d',
      foamColor: '#eef8ff',
      foamThreshold: 0.12,
      opacity: 0.9,
      preset: 'glacial',
    },
    pbr: {
      rockColor: '#534d45',
      rockRoughness: 0.85,
      rockDetail: 1.2,
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
      wetness: 0.85,
      normalStrength: 1.5,
      triplanarScale: 1.0,
      ambientOcclusion: 1.15,
    },
    brush: {
      enabled: false,
      tool: 'raise',
      radius: 0.16,
      strength: 0.5,
      falloff: 'smooth',
    },
  });

  // Sculpt overrides state
  const [sculptMap, setSculptMap] = useState<Float32Array | null>(null);

  // Evaluate Graph for the pinned node (or active node if no pin)
  const evalTargetId = pinnedNodeId || activeNodeId;

  // Keep the first paint cheap; full terrain evaluation runs in a cancellable Web Worker.
  const [evalResult, setEvalResult] = useState(() =>
    NODE_REGISTRY && nodes.length
      ? {
          finalDataMap: {
            width: 64,
            height: 64,
            heightmap: new Float32Array(64 * 64),
            flowmap: new Float32Array(64 * 64),
            deposition: new Float32Array(64 * 64),
            wear: new Float32Array(64 * 64),
          },
          nodeOutputs: new Map(),
          activeNodeId: evalTargetId,
        }
      : {
          finalDataMap: {
            width: 64,
            height: 64,
            heightmap: new Float32Array(64 * 64),
            flowmap: new Float32Array(64 * 64),
            deposition: new Float32Array(64 * 64),
            wear: new Float32Array(64 * 64),
          },
          nodeOutputs: new Map(),
          activeNodeId: '',
        }
  );
  const [evaluationError, setEvaluationError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setEvaluationError(null);
    evaluateGraphAsync(
      nodes,
      connections,
      viewportSettings.resolution,
      viewportSettings.resolution,
      evalTargetId,
      controller.signal
    ).then((result) => {
      setEvalResult(result);
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setEvaluationError(error instanceof Error ? error.message : String(error));
      console.error('Terrain graph evaluation failed:', error);
    });
    return () => controller.abort();
  }, [nodes, connections, viewportSettings.resolution, evalTargetId]);

  const displayDataMap = useMemo(() => {
    if (!sculptMap || sculptMap.length !== evalResult.finalDataMap.heightmap.length) {
      return evalResult.finalDataMap;
    }
    return {
      ...evalResult.finalDataMap,
      heightmap: sculptMap,
    };
  }, [evalResult.finalDataMap, sculptMap]);

  const handleSculptHeightmap = useCallback((newH: Float32Array) => {
    setSculptMap(new Float32Array(newH));
  }, []);

  // Ensure activeNodeId exists
  useEffect(() => {
    if (!nodes.some((n) => n.id === activeNodeId) && nodes.length > 0) {
      setActiveNodeId(nodes[0].id);
    }
  }, [nodes, activeNodeId]);

  // Ensure pinnedNodeId exists
  useEffect(() => {
    if (pinnedNodeId && !nodes.some((n) => n.id === pinnedNodeId)) {
      setPinnedNodeId(nodes[nodes.length - 1]?.id || '');
    }
  }, [nodes, pinnedNodeId]);

  const activeNode = useMemo(() => {
    return nodes.find((n) => n.id === activeNodeId) || null;
  }, [nodes, activeNodeId]);

  const pinnedNode = useMemo(() => {
    return nodes.find((n) => n.id === pinnedNodeId) || null;
  }, [nodes, pinnedNodeId]);

  // Handle Preset Selection
  const handleSelectPreset = (preset: TerrainPreset) => {
    setSculptMap(null);
    setCurrentPresetId(preset.id);
    setNodes(preset.nodes);
    setConnections(preset.connections);
    if (preset.activeNodeId) setActiveNodeId(preset.activeNodeId);
    if (preset.pinnedNodeId) {
      setPinnedNodeId(preset.pinnedNodeId);
    } else if (preset.nodes.length > 0) {
      setPinnedNodeId(preset.nodes[preset.nodes.length - 1].id);
    }

    // Adapt PBR material and ocean parameters to the selected geological biome
    if (preset.id === 'zion_canyonlands') {
      setViewportSettings((prev) => ({
        ...prev,
        ocean: { ...prev.ocean, waterLevel: 0.08, enabled: false },
        pbr: {
          ...prev.pbr,
          snowEnabled: false,
          rockColor: '#9e462a',
          rockRoughness: 0.82,
          screeColor: '#ba6f45',
          screeRoughness: 0.88,
          grassColor: '#7a7343',
          grassRoughness: 0.85,
        },
      }));
    } else if (preset.id === 'iceland_volcano') {
      setViewportSettings((prev) => ({
        ...prev,
        ocean: { ...prev.ocean, waterLevel: 0.22, enabled: true },
        pbr: {
          ...prev.pbr,
          snowEnabled: false,
          rockColor: '#282b30',
          rockRoughness: 0.78,
          screeColor: '#3d4147',
          screeRoughness: 0.85,
          grassColor: '#3a6627',
          grassRoughness: 0.65,
        },
      }));
    } else if (preset.id === 'patagonia_spires') {
      setViewportSettings((prev) => ({
        ...prev,
        ocean: { ...prev.ocean, waterLevel: 0.18, enabled: true },
        pbr: {
          ...prev.pbr,
          snowEnabled: true,
          rockColor: '#474b54',
          rockRoughness: 0.82,
          screeColor: '#6f7480',
          screeRoughness: 0.88,
          grassColor: '#3d4d38',
          grassRoughness: 0.78,
          snowHeight: 0.52,
        },
      }));
    } else if (preset.id === 'alpine_peaks') {
      setViewportSettings((prev) => ({
        ...prev,
        ocean: { ...prev.ocean, waterLevel: 0.16, enabled: true },
        pbr: {
          ...prev.pbr,
          snowEnabled: true,
          rockColor: '#534d45',
          rockRoughness: 0.85,
          screeColor: '#8c7d6e',
          screeRoughness: 0.9,
          grassColor: '#45582e',
          grassRoughness: 0.75,
          snowHeight: 0.55,
        },
      }));
    }
  };

  // Node parameter change
  const handleUpdateNodeParams = (nodeId: string, params: Record<string, any>) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, params: { ...n.params, ...params } } : n))
    );
  };

  // Pin node to Viewport
  const handlePinNode = (nodeId: string) => {
    if (pinnedNodeId === nodeId) {
      setPinnedNodeId(''); // toggle unpin
    } else {
      setPinnedNodeId(nodeId);
    }
  };

  // Add a new node
  const handleAddNode = (type: NodeType, x: number, y: number) => {
    const meta = NODE_REGISTRY[type];
    const newNode: TerrainNode = {
      id: `node_${type}_${Date.now()}`,
      type,
      name: meta.name,
      category: meta.category,
      x,
      y,
      params: { ...meta.defaultParams },
    };
    setNodes((prev) => [...prev, newNode]);
    setActiveNodeId(newNode.id);
  };

  // Append modifier from inspector
  const handleAppendModifier = (sourceNodeId: string, modifierType: NodeType) => {
    const srcNode = nodes.find((n) => n.id === sourceNodeId);
    if (!srcNode) return;

    const meta = NODE_REGISTRY[modifierType];
    const newNode: TerrainNode = {
      id: `node_${modifierType}_${Date.now()}`,
      type: modifierType,
      name: meta.name,
      category: meta.category,
      x: srcNode.x + 280,
      y: srcNode.y,
      params: { ...meta.defaultParams },
    };

    const newConnection: NodeConnection = {
      id: `conn_${Date.now()}`,
      fromNodeId: srcNode.id,
      fromPortId: 'out',
      toNodeId: newNode.id,
      toPortId: 'in',
    };

    setNodes((prev) => [...prev, newNode]);
    setConnections((prev) => [...prev, newConnection]);
    setActiveNodeId(newNode.id);
    setPinnedNodeId(newNode.id);
  };

  // Delete node
  const handleDeleteNode = (nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setConnections((prev) => prev.filter((c) => c.fromNodeId !== nodeId && c.toNodeId !== nodeId));
    if (activeNodeId === nodeId) {
      const remaining = nodes.filter((n) => n.id !== nodeId);
      setActiveNodeId(remaining.length > 0 ? remaining[0].id : '');
    }
    if (pinnedNodeId === nodeId) {
      setPinnedNodeId('');
    }
  };

  // Toggle node bypass
  const handleToggleBypass = (nodeId: string) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, bypass: !n.bypass } : n))
    );
  };

  // Bake High Resolution Pipeline
  const handleBakeResolution = (res: number) => {
    setIsBaking(true);
    setViewportSettings((prev) => ({ ...prev, resolution: res }));
    setTimeout(() => {
      setIsBaking(false);
    }, 450);
  };

  // Save Project as JSON
  const handleSaveProject = () => {
    const project = {
      version: '2026.2-gaea',
      date: new Date().toISOString(),
      nodes,
      connections,
      activeNodeId,
      pinnedNodeId,
      viewportSettings,
    };
    const jsonStr = JSON.stringify(project, null, 2);
    downloadFile(jsonStr, `vterrain_gaea_project_${Date.now()}.vterrain`);
  };

  // Load Project JSON
  const handleLoadProject = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.nodes && Array.isArray(data.nodes)) {
          setNodes(data.nodes);
          setConnections(data.connections || []);
          if (data.activeNodeId) setActiveNodeId(data.activeNodeId);
          if (data.pinnedNodeId) setPinnedNodeId(data.pinnedNodeId);
          if (data.viewportSettings) setViewportSettings(data.viewportSettings);
        }
      } catch (err) {
        console.error('Failed to parse project file', err);
      }
    };
    reader.readAsText(file);
  };

  // Resizable Splitter mouse handlers
  const handleSplitterMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSplitter(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingSplitter) return;
      const totalWidth = window.innerWidth - 320;
      const ratio = Math.max(0.2, Math.min(0.8, e.clientX / totalWidth));
      setSplitRatio(ratio);
    };

    const handleMouseUp = () => {
      setIsDraggingSplitter(false);
    };

    if (isDraggingSplitter) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSplitter]);

  return (
    <div className="flex flex-col w-screen h-screen bg-[#121315] text-neutral-200 overflow-hidden font-sans select-none">
      {/* Top Studio Header */}
      <HeaderBar
        currentPresetId={currentPresetId}
        onSelectPreset={handleSelectPreset}
        layoutMode={layoutMode}
        onChangeLayout={setLayoutMode}
        onOpenExport={() => setIsExportOpen(true)}
        onBake={() => handleBakeResolution(viewportSettings.resolution)}
        isBaking={isBaking}
        resolution={viewportSettings.resolution}
        pinnedNodeName={pinnedNode ? pinnedNode.name : activeNode ? activeNode.name : undefined}
        onSaveProject={handleSaveProject}
        onLoadProject={handleLoadProject}
      />

      {/* Main Studio Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left & Center Panels (Graph Canvas & 3D Viewport) */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Panel 1: Node Tree / Graph Editor */}
          {(layoutMode === 'split' || layoutMode === 'graph') && (
            <div
              style={{
                width: layoutMode === 'split' ? `${splitRatio * 100}%` : '100%',
              }}
              className="h-full relative overflow-hidden"
            >
              <GraphCanvas
                nodes={nodes}
                connections={connections}
                activeNodeId={activeNodeId}
                pinnedNodeId={pinnedNodeId}
                nodeOutputs={evalResult.nodeOutputs}
                onSelectNode={setActiveNodeId}
                onPinNode={handlePinNode}
                onUpdateNodes={setNodes}
                onUpdateConnections={setConnections}
                onAddNode={handleAddNode}
                onDeleteNode={handleDeleteNode}
                onToggleBypass={handleToggleBypass}
              />
            </div>
          )}

          {/* Interactive Draggable Splitter Bar */}
          {layoutMode === 'split' && (
            <div
              onMouseDown={handleSplitterMouseDown}
              className={`w-1.5 bg-[#1E2024] hover:bg-[#00A8FF] transition-colors cursor-col-resize z-20 flex items-center justify-center relative ${
                isDraggingSplitter ? 'bg-[#00A8FF]' : ''
              }`}
            >
              <div className="w-0.5 h-6 bg-neutral-600 rounded-full" />
            </div>
          )}

          {/* Panel 2: 3D Viewport */}
          {(layoutMode === 'split' || layoutMode === 'viewport') && (
            <div
              style={{
                width: layoutMode === 'split' ? `${(1 - splitRatio) * 100}%` : '100%',
              }}
              className="h-full relative overflow-hidden"
            >
              <Viewport3D
                dataMap={displayDataMap}
                settings={viewportSettings}
                onUpdateSettings={(s) => setViewportSettings((prev) => ({ ...prev, ...s }))}
                onSculptHeightmap={handleSculptHeightmap}
                isBaking={isBaking}
              />
            </div>
          )}
        </div>

        {/* Panel 3: Unified Studio Inspector Dock (Node, PBR Materials, Lighting, Ocean, Sculpt) */}
        <StudioInspector
          activeNode={activeNode}
          pinnedNodeId={pinnedNodeId}
          viewportSettings={viewportSettings}
          onPinNode={handlePinNode}
          onToggleBypass={handleToggleBypass}
          onUpdateParams={handleUpdateNodeParams}
          onAppendModifier={handleAppendModifier}
          onUpdateSettings={(s) => setViewportSettings((prev) => ({ ...prev, ...s }))}
          onBakeResolution={handleBakeResolution}
          onClearSculpt={() => setSculptMap(null)}
          isBaking={isBaking}
        />
      </div>

      {/* Export Dialog */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        dataMap={displayDataMap}
        heightScale={viewportSettings.heightScale}
      />
    </div>
  );
}
