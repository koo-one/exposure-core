import { buildDraftGraphsByAsset } from "../orchestrator";
import type { AdapterFactory } from "../adapters/registry";
import type { GraphSnapshot } from "../types";
import {
  canonicalizeNodeId,
  inferProtocolFolderFromNodeId,
} from "../utils/graphPaths";

export type GraphSnapshotGroup = Record<string, GraphSnapshot>;

export interface ProtocolGraphBuildResult {
  assetCount: number;
  groupedSnapshots: Map<string, GraphSnapshotGroup>;
}

export const buildProtocolGraphGroups = async (
  factories?: readonly AdapterFactory[],
): Promise<ProtocolGraphBuildResult> => {
  const draftGraphs = await buildDraftGraphsByAsset(factories);
  const groupedSnapshots = new Map<string, GraphSnapshotGroup>();

  for (const [asset, store] of draftGraphs) {
    const snapshot = store.toSnapshot({ sources: [] });
    const rootNodeId = snapshot.nodes[0]?.id;

    if (!rootNodeId) {
      throw new Error(`Missing root node id for asset: ${asset}`);
    }

    const normalizedRootNodeId = canonicalizeNodeId(rootNodeId);
    const protocol = inferProtocolFolderFromNodeId(normalizedRootNodeId);

    if (!protocol) {
      throw new Error(`Missing protocol folder for asset: ${asset}`);
    }

    const currentGroup = groupedSnapshots.get(protocol) ?? {};
    currentGroup[normalizedRootNodeId] = snapshot;
    groupedSnapshots.set(protocol, currentGroup);
  }

  return {
    assetCount: draftGraphs.size,
    groupedSnapshots,
  };
};
