import type { TerrainNode, NodeConnection } from '../types/terrain';
import type { evaluateGraph } from './graphEvaluator';

type EvaluationResult = ReturnType<typeof evaluateGraph>;
let nextRequestId = 1;

export function evaluateGraphAsync(
  nodes: TerrainNode[],
  connections: NodeConnection[],
  width: number,
  height: number,
  targetNodeId: string | undefined,
  signal?: AbortSignal
): Promise<EvaluationResult> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Evaluation cancelled', 'AbortError'));
      return;
    }

    const worker = new Worker(new URL('./terrainWorker.ts', import.meta.url), {
      type: 'module',
    });
    const id = nextRequestId++;
    const cleanup = () => {
      worker.terminate();
      signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException('Evaluation cancelled', 'AbortError'));
    };

    signal?.addEventListener('abort', onAbort, { once: true });
    worker.onmessage = (event: MessageEvent<{ id: number; result?: EvaluationResult; error?: string }>) => {
      if (event.data.id !== id) return;
      cleanup();
      if (event.data.error) reject(new Error(event.data.error));
      else if (event.data.result) resolve(event.data.result);
      else reject(new Error('The terrain worker returned an empty result.'));
    };
    worker.onerror = (event) => {
      cleanup();
      reject(new Error(event.message || 'Terrain worker failed.'));
    };

    // Structured cloning isolates worker inputs from React state.
    worker.postMessage({ id, nodes, connections, width, height, targetNodeId });
  });
}
