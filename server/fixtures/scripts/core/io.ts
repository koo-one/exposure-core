import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { Edge, GraphSnapshot, Node } from "../../../src/types";

export const writeJsonFile = async (
  path: string,
  payload: unknown,
): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });

  await writeFile(path, JSON.stringify(payload, null, 2), "utf8");
};

export const readJson = async <T>(path: string): Promise<T> => {
  const raw = await readFile(path, "utf8");

  return JSON.parse(raw) as T;
};

const normalizeChain = (chain: string): string => chain.trim().toLowerCase();

const extractChainFromNodeId = (nodeId: string): string | null => {
  const first = nodeId.split(":")[0];
  return first ? normalizeChain(first) : null;
};

export const cloneSnapshotWithRootId = (
  snapshot: GraphSnapshot,
  nextRootId: string,
): GraphSnapshot => {
  const root = snapshot.nodes[0];
  if (!root) return snapshot;

  const baseRootId = root.id;
  if (nextRootId === baseRootId) return snapshot;

  const nextChain = extractChainFromNodeId(nextRootId);
  const nextRoot: Node = {
    ...root,
    id: nextRootId,
    ...(nextChain ? { chain: nextChain } : {}),
  };

  const nextNodes: Node[] = [nextRoot, ...snapshot.nodes.slice(1)];
  const nextEdges: Edge[] = snapshot.edges.map((e) => ({
    ...e,
    from: e.from === baseRootId ? nextRootId : e.from,
    to: e.to === baseRootId ? nextRootId : e.to,
  }));

  return { ...snapshot, nodes: nextNodes, edges: nextEdges };
};
