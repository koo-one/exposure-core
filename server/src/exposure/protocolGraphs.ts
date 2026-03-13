import { buildDraftGraphsByAsset } from "../orchestrator";
import type { AdapterFactory } from "../adapters/registry";
import type { GraphSnapshot } from "../types";

const canonicalizeProtocolToken = (raw: string): string => {
  const p = raw
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");

  if (p.startsWith("morpho")) {
    if (p.includes("v2")) return "morpho-v2";
    if (p.includes("v1")) return "morpho-v1";
    return "morpho";
  }

  if (p.startsWith("euler")) {
    if (p.includes("v2")) return "euler-v2";
    if (p.includes("v1")) return "euler-v1";
    return "euler";
  }

  return p;
};

const canonicalizeNodeId = (raw: string): string => {
  const normalized = raw.trim();
  if (!normalized) return "";

  const parts = normalized.split(":");
  const [chainPart, protocolPart, ...restParts] = parts;

  if (!chainPart || !protocolPart) return normalized.toLowerCase();

  const chain = chainPart.trim().toLowerCase();
  const protocol = canonicalizeProtocolToken(protocolPart);
  const rest = restParts.join(":").trim().toLowerCase();

  return rest ? `${chain}:${protocol}:${rest}` : `${chain}:${protocol}`;
};

const protocolToFolder = (
  protocol: string | null | undefined,
): string | null => {
  const p = protocol ? canonicalizeProtocolToken(protocol) : null;
  if (!p) return null;

  if (p.startsWith("morpho")) return "morpho";
  if (p.startsWith("euler")) return "euler";
  return p;
};

const inferProtocolFolderFromNodeId = (normalizedId: string): string | null => {
  const [, protocol] = normalizedId.split(":");
  return protocolToFolder(protocol);
};

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
