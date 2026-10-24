import { evaluateGraph } from './graphEvaluator';
import type { TerrainNode, NodeConnection } from '../types/terrain';

type WorkerRequest = {
  id: number;
  nodes: TerrainNode[];
  connections: NodeConnection[];
  width: number;
  height: number;
  targetNodeId?: string;
};

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, nodes, connections, width, height, targetNodeId } = event.data;
  try {
    const result = evaluateGraph(nodes, connections, width, height, targetNodeId);
    // Transfer large pixel buffers instead of copying them back to the UI thread.
    const transfer = new Set<ArrayBuffer>();
    const addBuffer = (value: unknown) => {
      if (value instanceof Float32Array && value.buffer instanceof ArrayBuffer) {
        transfer.add(value.buffer);
      } else if (value instanceof Uint8Array && value.buffer instanceof ArrayBuffer) {
        transfer.add(value.buffer);
      }
    };
    for (const output of result.nodeOutputs.values()) {
      if (output.dataMap) {
        addBuffer(output.dataMap.heightmap);
        addBuffer(output.dataMap.flowmap);
        addBuffer(output.dataMap.deposition);
        addBuffer(output.dataMap.wear);
        addBuffer(output.dataMap.snowmap);
        addBuffer(output.dataMap.colorMap);
      }
      if (output.mask) addBuffer(output.mask);
      if (output.namedOutputs) {
        for (const payload of Object.values(output.namedOutputs)) {
          if (payload instanceof Float32Array || payload instanceof Uint8Array) addBuffer(payload);
        }
      }
    }
    self.postMessage({ id, result }, [...transfer]);
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export {};
