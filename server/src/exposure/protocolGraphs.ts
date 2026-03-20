import {
  buildDraftGraphsByAssetReport,
  type AdapterRunFailure,
} from "../orchestrator.js";
import type { AdapterFactory } from "../adapters/registry.js";
import type { GraphSnapshot } from "../types.js";
import {
  canonicalizeNodeId,
  inferProtocolFolderFromNodeId,
} from "../utils/graphPaths.js";

export type GraphSnapshotGroup = Record<string, GraphSnapshot>;

export interface ProtocolGraphBuildResult {
  assetCount: number;
  groupedSnapshots: Map<string, GraphSnapshotGroup>;
  adapterFailures: AdapterRunFailure[];
}

export const buildProtocolGraphGroups = async (
  factories?: readonly AdapterFactory[],
): Promise<ProtocolGraphBuildResult> => {
  const { storesByAsset: draftGraphs, adapterFailures } =
    await buildDraftGraphsByAssetReport(factories);
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
    adapterFailures,
  };
};
