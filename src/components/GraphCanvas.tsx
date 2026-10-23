import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  TerrainNode,
  NodeConnection,
  NodeType,
  TerrainDataMap,
  NodePort,
} from '../types/terrain';
import { NODE_REGISTRY } from '../engine/graphEvaluator';
import {
  Plus,
  Eye,
  EyeOff,
  Trash2,
  Maximize2,
  Sparkles,
  Sliders,
  Filter,
  Layers,
  GitBranch,
  X,
  Search,
  Pin,
  Grid,
  Map as MapIcon,
} from 'lucide-react';

interface GraphCanvasProps {
  nodes: TerrainNode[];
  connections: NodeConnection[];
  activeNodeId: string;
  pinnedNodeId: string;
  nodeOutputs: Map<
    string,
    {
      dataMap?: TerrainDataMap;
      mask?: Float32Array;
      namedOutputs?: Record<string, TerrainDataMap | Float32Array>;
    }
  >;
  onSelectNode: (nodeId: string) => void;
  onPinNode: (nodeId: string) => void;
  onUpdateNodes: (nodes: TerrainNode[]) => void;
  onUpdateConnections: (connections: NodeConnection[]) => void;
  onAddNode: (type: NodeType, x: number, y: number) => void;
  onDeleteNode: (nodeId: string) => void;
  onToggleBypass: (nodeId: string) => void;
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  nodes,
  connections,
  activeNodeId,
  pinnedNodeId,
  nodeOutputs,
  onSelectNode,
  onPinNode,
  onUpdateNodes,
  onUpdateConnections,
  onAddNode,
  onDeleteNode,
  onToggleBypass,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [zoom, setZoom] = useState(1.0);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Grid Snapping: 0 (off), 10, 25, 50
  const [gridSnap, setGridSnap] = useState<number>(25);

  // Dragging a node
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [nodeDragOffset, setNodeDragOffset] = useState({ x: 0, y: 0 });

  // Dragging a connection cable
  const [connectingFrom, setConnectingFrom] = useState<{
    nodeId: string;
    portId: string;
    portType: 'terrain' | 'mask';
    isOutput: boolean;
    startX: number;
    startY: number;
  } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Quick-Add / Lazy Menu popover
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [addMenuPos, setAddMenuPos] = useState({ x: 200, y: 150 });

  // Show Mini-Map
  const [showMinimap, setShowMinimap] = useState(true);

  // Global Keyboard Shortcuts (Gaea workflow: Tab = Lazy Menu, F = Pin to Viewport, B = Bypass, Delete = Remove)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') {
        return;
      }

      if (e.key === 'Tab' || e.code === 'Space') {
        e.preventDefault();
        setAddMenuPos({ x: mousePos.x, y: mousePos.y });
        setShowAddMenu(true);
      } else if (e.key === 'f' || e.key === 'F') {
        if (activeNodeId) {
          onPinNode(activeNodeId);
        }
      } else if (e.key === 'b' || e.key === 'B') {
        if (activeNodeId) {
          onToggleBypass(activeNodeId);
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (activeNodeId) {
          onDeleteNode(activeNodeId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeNodeId, mousePos, onPinNode, onToggleBypass, onDeleteNode]);

  // Snap coordinate helper
  const snap = (val: number) => {
    if (gridSnap <= 0) return Math.round(val);
    return Math.round(val / gridSnap) * gridSnap;
  };

  // Canvas pan & zoom via non-passive wheel listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      setZoom((prevZoom) => {
        const newZoom = Math.max(0.4, Math.min(2.0, prevZoom * zoomFactor));
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        setPan((prevPan) => ({
          x: mouseX - (mouseX - prevPan.x) * (newZoom / prevZoom),
          y: mouseY - (mouseY - prevPan.y) * (newZoom / prevZoom),
        }));
        return newZoom;
      });
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setIsPanning(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const curX = (e.clientX - rect.left - pan.x) / zoom;
      const curY = (e.clientY - rect.top - pan.y) / zoom;
      setAddMenuPos({ x: curX, y: curY });
      setShowAddMenu(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const canvasX = (e.clientX - rect.left - pan.x) / zoom;
      const canvasY = (e.clientY - rect.top - pan.y) / zoom;
      setMousePos({ x: canvasX, y: canvasY });

      if (isPanning) {
        setPan({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      } else if (draggingNodeId) {
        const newX = snap(canvasX - nodeDragOffset.x);
        const newY = snap(canvasY - nodeDragOffset.y);
        onUpdateNodes(
          nodes.map((n) => (n.id === draggingNodeId ? { ...n, x: newX, y: newY } : n))
        );
      }
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
    setConnectingFrom(null);
  };

  const handleNodeMouseDown = (e: React.MouseEvent, node: TerrainNode) => {
    e.stopPropagation();
    onSelectNode(node.id);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const currentMouseX = (e.clientX - rect.left - pan.x) / zoom;
      const currentMouseY = (e.clientY - rect.top - pan.y) / zoom;
      setNodeDragOffset({
        x: currentMouseX - node.x,
        y: currentMouseY - node.y,
      });
      setDraggingNodeId(node.id);
    }
  };

  const handlePortMouseDown = (
    e: React.MouseEvent,
    nodeId: string,
    port: NodePort,
    isOutput: boolean,
    portX: number,
    portY: number
  ) => {
    e.stopPropagation();
    setConnectingFrom({
      nodeId,
      portId: port.id,
      portType: port.type,
      isOutput,
      startX: portX,
      startY: portY,
    });
  };

  const handlePortMouseUp = (
    e: React.MouseEvent,
    targetNodeId: string,
    targetPort: NodePort,
    isOutput: boolean
  ) => {
    e.stopPropagation();
    if (!connectingFrom) return;

    if (connectingFrom.isOutput && !isOutput) {
      if (connectingFrom.nodeId === targetNodeId) return;

      const newConn: NodeConnection = {
        id: `conn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        fromNodeId: connectingFrom.nodeId,
        fromPortId: connectingFrom.portId,
        toNodeId: targetNodeId,
        toPortId: targetPort.id,
      };

      const filtered = connections.filter(
        (c) => !(c.toNodeId === targetNodeId && c.toPortId === targetPort.id)
      );
      onUpdateConnections([...filtered, newConn]);
    } else if (!connectingFrom.isOutput && isOutput) {
      if (connectingFrom.nodeId === targetNodeId) return;

      const newConn: NodeConnection = {
        id: `conn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        fromNodeId: targetNodeId,
        fromPortId: targetPort.id,
        toNodeId: connectingFrom.nodeId,
        toPortId: connectingFrom.portId,
      };

      const filtered = connections.filter(
        (c) => !(c.toNodeId === connectingFrom.nodeId && c.toPortId === connectingFrom.portId)
      );
      onUpdateConnections([...filtered, newConn]);
    }

    setConnectingFrom(null);
  };

  const handleDisconnectCable = (connId: string) => {
    onUpdateConnections(connections.filter((c) => c.id !== connId));
  };

  const handleCenterGraph = () => {
    if (nodes.length === 0) return;
    let minX = 9999, minY = 9999, maxX = -9999, maxY = -9999;
    nodes.forEach((n) => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + 220);
      maxY = Math.max(maxY, n.y + 160);
    });

    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      setPan({
        x: rect.width / 2 - centerX * zoom,
        y: rect.height / 2 - centerY * zoom,
      });
    }
  };

  const NODE_WIDTH = 224;
  const NODE_HEADER_HEIGHT = 38;
  const PORT_ROW_HEIGHT = 22;

  const getNodeHeight = (node: TerrainNode) => {
    const meta = NODE_REGISTRY[node.type];
    const maxPorts = Math.max(meta.inputs.length, meta.outputs.length);
    return NODE_HEADER_HEIGHT + Math.max(1, maxPorts) * PORT_ROW_HEIGHT + 74;
  };

  const getPortCoordinates = (
    node: TerrainNode,
    portId: string,
    isOutput: boolean
  ): { x: number; y: number } => {
    const meta = NODE_REGISTRY[node.type];
    const ports = isOutput ? meta.outputs : meta.inputs;
    const index = ports.findIndex((p) => p.id === portId);
    const portIndex = index >= 0 ? index : 0;

    const y = node.y + NODE_HEADER_HEIGHT + portIndex * PORT_ROW_HEIGHT + PORT_ROW_HEIGHT / 2;
    const x = isOutput ? node.x + NODE_WIDTH : node.x;

    return { x, y };
  };

  const renderThumbnail = (nodeId: string, canvasElement: HTMLCanvasElement | null) => {
    if (!canvasElement) return;
    const output = nodeOutputs.get(nodeId);
    if (!output) return;

    const ctx = canvasElement.getContext('2d');
    if (!ctx) return;

    const size = 48;
    canvasElement.width = size;
    canvasElement.height = size;
    const imgData = ctx.createImageData(size, size);
    const buf = imgData.data;

    if (output.dataMap) {
      const { heightmap, width, height, colorMap } = output.dataMap;
      const scaleX = width / size;
      const scaleY = height / size;

      for (let y = 0; y < size; y++) {
        const srcY = Math.floor(y * scaleY);
        for (let x = 0; x < size; x++) {
          const srcX = Math.floor(x * scaleX);
          const srcIdx = srcY * width + srcX;
          const idx = (y * size + x) * 4;

          if (colorMap) {
            buf[idx] = colorMap[srcIdx * 4];
            buf[idx + 1] = colorMap[srcIdx * 4 + 1];
            buf[idx + 2] = colorMap[srcIdx * 4 + 2];
            buf[idx + 3] = 255;
          } else {
            const val = heightmap[srcIdx];
            const c = Math.floor(Math.min(1, Math.max(0, val)) * 255);
            buf[idx] = Math.floor(c * 0.85);
            buf[idx + 1] = Math.floor(c * 0.95);
            buf[idx + 2] = c;
            buf[idx + 3] = 255;
          }
        }
      }
    } else if (output.mask) {
      const mask = output.mask;
      const dim = Math.floor(Math.sqrt(mask.length));
      const scale = dim / size;

      for (let y = 0; y < size; y++) {
        const srcY = Math.floor(y * scale);
        for (let x = 0; x < size; x++) {
          const srcX = Math.floor(x * scale);
          const val = mask[srcY * dim + srcX];
          const idx = (y * size + x) * 4;
          const c = Math.floor(Math.min(1, Math.max(0, val)) * 255);
          buf[idx] = c;
          buf[idx + 1] = Math.floor(c * 0.4);
          buf[idx + 2] = Math.floor(c * 0.8);
          buf[idx + 3] = 255;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'generator': return { header: 'bg-emerald-950/80 border-b border-emerald-500/40 text-emerald-300', badge: 'bg-emerald-500/20 text-emerald-400' };
      case 'filter': return { header: 'bg-amber-950/80 border-b border-amber-500/40 text-amber-300', badge: 'bg-amber-500/20 text-amber-400' };
      case 'selector': return { header: 'bg-purple-950/80 border-b border-purple-500/40 text-purple-300', badge: 'bg-purple-500/20 text-purple-400' };
      case 'combiner': return { header: 'bg-sky-950/80 border-b border-[#00A8FF]/40 text-[#00A8FF]', badge: 'bg-[#00A8FF]/20 text-[#00A8FF]' };
      case 'color': return { header: 'bg-pink-950/80 border-b border-pink-500/40 text-pink-300', badge: 'bg-pink-500/20 text-pink-400' };
      default: return { header: 'bg-neutral-900 border-b border-neutral-700 text-neutral-300', badge: 'bg-neutral-800 text-neutral-400' };
    }
  };

  const allNodeTypes = Object.values(NODE_REGISTRY);
  const filteredCatalog = allNodeTypes.filter((n) => {
    const matchesSearch =
      n.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      n.category.toLowerCase().includes(searchFilter.toLowerCase()) ||
      n.description.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesCat = categoryFilter === 'all' || n.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={handleContextMenu}
      className="relative w-full h-full bg-[#121315] overflow-hidden select-none"
      style={{
        backgroundImage: `
          radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.08) 1px, transparent 0)
        `,
        backgroundSize: `${gridSnap > 0 ? gridSnap * zoom : 25 * zoom}px ${gridSnap > 0 ? gridSnap * zoom : 25 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      }}
    >
      {/* Top Floating Graph Toolbar */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-20">
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Quick Add / Lazy Menu button */}
          <button
            onClick={() => {
              setAddMenuPos({ x: 200, y: 150 });
              setShowAddMenu(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00A8FF] hover:bg-[#0090dd] text-white text-xs font-semibold rounded-lg shadow-[0_0_15px_rgba(0,168,255,0.4)] transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Node</span>
            <span className="text-[10px] bg-black/25 px-1 py-0.2 rounded font-mono">Tab</span>
          </button>

          <button
            onClick={handleCenterGraph}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#1A1C1F] hover:bg-[#25282E] border border-[#2D3139] text-neutral-300 hover:text-white text-xs rounded-lg shadow-md transition-all font-mono"
            title="Recenter and Frame Graph"
          >
            <Maximize2 className="w-3.5 h-3.5 text-[#00A8FF]" />
            <span>Frame</span>
          </button>

          {/* Grid Snap selector */}
          <div className="flex items-center gap-1 bg-[#1A1C1F] border border-[#2D3139] px-2 py-1 rounded-lg text-xs font-mono text-neutral-400">
            <Grid className="w-3 h-3 text-neutral-500" />
            <select
              value={gridSnap}
              onChange={(e) => setGridSnap(Number(e.target.value))}
              className="bg-transparent text-neutral-300 cursor-pointer focus:outline-none"
            >
              <option value="0">Snap: Off</option>
              <option value="10">Snap: 10px</option>
              <option value="25">Snap: 25px</option>
              <option value="50">Snap: 50px</option>
            </select>
          </div>
        </div>

        {/* Zoom & Node Stats */}
        <div className="flex items-center gap-3 bg-[#1A1C1F]/90 border border-[#2D3139] px-3 py-1.5 rounded-lg text-xs font-mono text-neutral-400 pointer-events-auto backdrop-blur-md">
          <span>{nodes.length} Nodos</span>
          <span className="text-neutral-600">|</span>
          <span>{connections.length} Cables</span>
          <span className="text-neutral-600">|</span>
          <span className="text-[#00A8FF] font-semibold">{Math.round(zoom * 100)}%</span>
        </div>
      </div>

      {/* SVG Layer for Bézier Connection Cables */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <defs>
          <linearGradient id="cableGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00A8FF" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {connections.map((conn) => {
          const fromNode = nodes.find((n) => n.id === conn.fromNodeId);
          const toNode = nodes.find((n) => n.id === conn.toNodeId);
          if (!fromNode || !toNode) return null;

          const start = getPortCoordinates(fromNode, conn.fromPortId, true);
          const end = getPortCoordinates(toNode, conn.toPortId, false);

          const dx = Math.abs(end.x - start.x) * 0.5;
          const cp1x = start.x + Math.max(40, dx);
          const cp1y = start.y;
          const cp2x = end.x - Math.max(40, dx);
          const cp2y = end.y;

          const pathD = `M ${start.x} ${start.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${end.x} ${end.y}`;

          return (
            <g key={conn.id} className="pointer-events-auto group">
              <path
                d={pathD}
                fill="none"
                stroke="#00A8FF"
                strokeWidth={5}
                strokeOpacity={0.25}
                filter="url(#glow)"
              />
              <path
                d={pathD}
                fill="none"
                stroke="#00A8FF"
                strokeWidth={2.5}
                className="transition-colors group-hover:stroke-rose-400 cursor-pointer"
                onClick={() => handleDisconnectCable(conn.id)}
              />
              <circle
                cx={(start.x + end.x) / 2}
                cy={(start.y + end.y) / 2}
                r={7}
                fill="#1A1C1F"
                stroke="#00A8FF"
                strokeWidth={1.5}
                className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:stroke-rose-500"
                onClick={() => handleDisconnectCable(conn.id)}
              />
            </g>
          );
        })}

        {connectingFrom && (
          <path
            d={`M ${connectingFrom.startX} ${connectingFrom.startY} C ${
              connectingFrom.isOutput
                ? `${connectingFrom.startX + 60} ${connectingFrom.startY}, ${mousePos.x - 60} ${mousePos.y}`
                : `${connectingFrom.startX - 60} ${connectingFrom.startY}, ${mousePos.x + 60} ${mousePos.y}`
            }, ${mousePos.x} ${mousePos.y}`}
            fill="none"
            stroke="#00A8FF"
            strokeWidth={2.5}
            strokeDasharray="5,4"
            className="animate-pulse"
          />
        )}
      </svg>

      {/* Nodes DOM Layer */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {nodes.map((node) => {
          const meta = NODE_REGISTRY[node.type];
          const isSelected = node.id === activeNodeId;
          const isPinned = node.id === pinnedNodeId;
          const colors = getCategoryColor(node.category);
          const height = getNodeHeight(node);

          return (
            <div
              key={node.id}
              style={{
                transform: `translate(${node.x}px, ${node.y}px)`,
                width: `${NODE_WIDTH}px`,
                height: `${height}px`,
              }}
              onMouseDown={(e) => handleNodeMouseDown(e, node)}
              className={`absolute top-0 left-0 bg-[#1A1C1F] rounded-xl shadow-2xl border transition-shadow pointer-events-auto flex flex-col overflow-hidden ${
                isSelected
                  ? 'border-[#00A8FF] ring-2 ring-[#00A8FF]/40 shadow-[0_0_24px_rgba(0,168,255,0.35)]'
                  : isPinned
                  ? 'border-cyan-400 ring-1 ring-cyan-400/50'
                  : 'border-[#2D3139] hover:border-neutral-500'
              } ${node.bypass ? 'opacity-50' : 'opacity-100'}`}
            >
              {/* Node Header */}
              <div className={`px-3 py-2 flex items-center justify-between ${colors.header}`}>
                <div className="flex items-center gap-1.5 overflow-hidden">
                  {isPinned && <Pin className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400 shrink-0" />}
                  <span className="font-semibold text-xs truncate">{node.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  {/* Pin to Viewport button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPinNode(node.id);
                    }}
                    title={isPinned ? 'Currently Pinned to Viewport' : 'Pin to Viewport (F)'}
                    className={`p-1 rounded transition-colors ${
                      isPinned
                        ? 'bg-cyan-500/30 text-cyan-300'
                        : 'hover:bg-black/30 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-current' : ''}`} />
                  </button>

                  {/* Bypass toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleBypass(node.id);
                    }}
                    title={node.bypass ? 'Enable Node (B)' : 'Bypass / Mute Node (B)'}
                    className="p-1 hover:bg-black/30 rounded text-neutral-400 hover:text-white"
                  >
                    {node.bypass ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>

                  {/* Delete node */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteNode(node.id);
                    }}
                    title="Delete Node (Del)"
                    className="p-1 hover:bg-rose-500/20 rounded text-neutral-400 hover:text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Node Ports & Body */}
              <div className="flex-1 p-2.5 flex flex-col justify-between">
                <div className="flex justify-between items-start text-xs font-mono">
                  {/* Inputs Column */}
                  <div className="flex flex-col gap-1.5">
                    {meta.inputs.map((inPort) => {
                      const isConnected = connections.some(
                        (c) => c.toNodeId === node.id && c.toPortId === inPort.id
                      );
                      const portCoords = getPortCoordinates(node, inPort.id, false);

                      return (
                        <div key={inPort.id} className="flex items-center gap-2 relative group">
                          <div
                            onMouseDown={(e) =>
                              handlePortMouseDown(e, node.id, inPort, false, portCoords.x, portCoords.y)
                            }
                            onMouseUp={(e) => handlePortMouseUp(e, node.id, inPort, false)}
                            className={`w-3.5 h-3.5 -ml-4 rounded-full border-2 cursor-crosshair transition-transform hover:scale-125 ${
                              isConnected
                                ? 'bg-[#00A8FF] border-[#00A8FF]'
                                : inPort.type === 'mask'
                                ? 'bg-[#121315] border-purple-400 hover:bg-purple-400'
                                : 'bg-[#121315] border-[#00A8FF] hover:bg-[#00A8FF]'
                            }`}
                            title={`In: ${inPort.name} (${inPort.type})`}
                          />
                          <span className="text-[11px] text-neutral-400 group-hover:text-white">
                            {inPort.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Outputs Column */}
                  <div className="flex flex-col gap-1.5 items-end">
                    {meta.outputs.map((outPort) => {
                      const isConnected = connections.some(
                        (c) => c.fromNodeId === node.id && c.fromPortId === outPort.id
                      );
                      const portCoords = getPortCoordinates(node, outPort.id, true);

                      return (
                        <div key={outPort.id} className="flex items-center gap-2 relative group">
                          <span className="text-[11px] text-neutral-400 group-hover:text-white">
                            {outPort.name}
                          </span>
                          <div
                            onMouseDown={(e) =>
                              handlePortMouseDown(e, node.id, outPort, true, portCoords.x, portCoords.y)
                            }
                            onMouseUp={(e) => handlePortMouseUp(e, node.id, outPort, true)}
                            className={`w-3.5 h-3.5 -mr-4 rounded-full border-2 cursor-crosshair transition-transform hover:scale-125 ${
                              isConnected
                                ? 'bg-[#00A8FF] border-[#00A8FF]'
                                : outPort.type === 'mask'
                                ? 'bg-[#121315] border-purple-400 hover:bg-purple-400'
                                : 'bg-[#121315] border-[#00A8FF] hover:bg-[#00A8FF]'
                            }`}
                            title={`Out: ${outPort.name} (${outPort.type})`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Node Mini Thumbnail Preview and Category Tag */}
                <div className="mt-2 pt-2 border-t border-[#262930] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <canvas
                      ref={(canvas) => renderThumbnail(node.id, canvas)}
                      className="w-12 h-12 bg-black/60 rounded border border-[#2D3139] shadow-inner"
                    />
                    <div className="flex flex-col">
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded w-fit ${colors.badge}`}>
                        {node.category.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-neutral-500 font-mono mt-0.5 truncate max-w-[120px]">
                        {node.type}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mini-Map Navigator (Bottom Right) */}
      {showMinimap && nodes.length > 0 && (
        <div className="absolute bottom-4 right-4 bg-[#1A1C1F]/90 border border-[#2D3139] p-2 rounded-xl shadow-2xl backdrop-blur-md pointer-events-auto z-10 w-44 h-32 flex flex-col">
          <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400 border-b border-[#2D3139] pb-1 mb-1">
            <span className="flex items-center gap-1">
              <MapIcon className="w-3 h-3 text-[#00A8FF]" />
              <span>Minimap</span>
            </span>
            <button onClick={() => setShowMinimap(false)} className="text-neutral-500 hover:text-white">
              ✕
            </button>
          </div>
          <div className="flex-1 relative bg-black/40 rounded overflow-hidden">
            {nodes.map((n) => {
              // Normalize positions to mini-map box
              const miniX = (n.x / 1400) * 140 + 10;
              const miniY = (n.y / 800) * 80 + 10;
              const isSel = n.id === activeNodeId;
              const isPin = n.id === pinnedNodeId;
              return (
                <div
                  key={n.id}
                  style={{ left: `${miniX}px`, top: `${miniY}px` }}
                  className={`absolute w-3.5 h-2.5 rounded-sm border ${
                    isPin
                      ? 'bg-cyan-400 border-white'
                      : isSel
                      ? 'bg-[#00A8FF] border-white'
                      : 'bg-neutral-600 border-neutral-700'
                  }`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Add / Lazy Menu Modal (Tab / Space / Right-click) */}
      {showAddMenu && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto"
          onClick={() => setShowAddMenu(false)}
        >
          <div
            className="bg-[#1A1C1F] border border-[#2D3139] w-[560px] max-h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-[#2D3139] flex items-center justify-between bg-[#151619]">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#00A8FF]" />
                <h3 className="font-semibold text-white text-base">Quick Add Node</h3>
              </div>
              <button
                onClick={() => setShowAddMenu(false)}
                className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-[#25282E]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input & Category Filters */}
            <div className="p-4 border-b border-[#2D3139] space-y-2.5">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Type to filter nodes (Mountain, Erosion, SatMap, Terraces...)"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-[#121315] border border-[#2D3139] rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#00A8FF]"
                  autoFocus
                />
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-mono">
                {['all', 'generator', 'filter', 'selector', 'combiner', 'color'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded capitalize transition-all ${
                      categoryFilter === cat
                        ? 'bg-[#00A8FF] text-white font-semibold'
                        : 'bg-[#212429] text-neutral-400 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Catalog List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[50vh]">
              {filteredCatalog.map((item) => {
                const colors = getCategoryColor(item.category);
                return (
                  <div
                    key={item.type}
                    onClick={() => {
                      onAddNode(item.type, snap(addMenuPos.x), snap(addMenuPos.y));
                      setShowAddMenu(false);
                      setSearchFilter('');
                    }}
                    className="p-3 bg-[#212429] hover:bg-[#282C33] border border-[#2D3139] hover:border-[#00A8FF] rounded-xl cursor-pointer transition-all flex items-start justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-neutral-200 group-hover:text-white">
                          {item.name}
                        </span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${colors.badge}`}>
                          {item.category.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-1">{item.description}</p>
                    </div>
                    <Plus className="w-4 h-4 text-neutral-500 group-hover:text-[#00A8FF] mt-1 shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
