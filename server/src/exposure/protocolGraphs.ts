import { getEthenaDeploymentNodeIds } from "../adapters/ethena/deployments.js";
import { getGauntletDeploymentNodeIds } from "../adapters/gauntlet/deployments.js";
import { getMidasDeploymentNodeIds } from "../adapters/midas/deployments.js";
import { getResolvDeploymentNodeIds } from "../adapters/resolv/deployments.js";
import { getSkyDeploymentNodeIds } from "../adapters/sky/deployments.js";
import type { Edge, Node } from "../types.js";
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

const cloneSnapshotWithRootId = (
  snapshot: GraphSnapshot,
  nextRootId: string,
): GraphSnapshot => {
  const root = snapshot.nodes[0];

  if (!root) return snapshot;

  const baseRootId = root.id;

  if (nextRootId === baseRootId) return snapshot;

  const nextChain = nextRootId.split(":")[0]?.trim().toLowerCase() || undefined;
  const nextRoot: Node = {
    ...root,
    id: nextRootId,
    ...(nextChain ? { chain: nextChain } : {}),
  };

  const nextNodes: Node[] = [
    nextRoot,
    ...snapshot.nodes.slice(1).filter((node) => node.id !== nextRootId),
  ];
  const nextEdges: Edge[] = snapshot.edges.map((edge) => ({
    ...edge,
    from: edge.from === baseRootId ? nextRootId : edge.from,
    to: edge.to === baseRootId ? nextRootId : edge.to,
  }));

  return { ...snapshot, nodes: nextNodes, edges: nextEdges };
};

const getDeploymentNodeIdsForAsset = (
  asset: string,
  rootNodeId: string,
  protocol: string,
): string[] => {
  switch (protocol) {
    case "ethena":
      return getEthenaDeploymentNodeIds(rootNodeId);
    case "sky":
      return getSkyDeploymentNodeIds(rootNodeId);
    case "midas":
      return getMidasDeploymentNodeIds(asset);
    case "resolv":
      return getResolvDeploymentNodeIds(rootNodeId);
    case "gauntlet":
      return getGauntletDeploymentNodeIds();
    default:
      return [];
  }
};

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

    for (const nextRootId of getDeploymentNodeIdsForAsset(
      asset,
      normalizedRootNodeId,
      protocol,
    )) {
      const normalizedDeploymentRootId = canonicalizeNodeId(nextRootId);
      currentGroup[normalizedDeploymentRootId] = cloneSnapshotWithRootId(
        snapshot,
        nextRootId,
      );
    }

    groupedSnapshots.set(protocol, currentGroup);
  }

  return {
    assetCount: draftGraphs.size,
    groupedSnapshots,
    adapterFailures,
  };
};
