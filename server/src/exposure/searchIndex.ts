import type { Edge, GraphSnapshot } from "../types.js";

import {
  inferAssetLogoKey,
  normalizeLogoKey,
} from "../resolvers/debank/utils.js";
import { inferProtocolFolderFromNodeId } from "../utils/graphPaths.js";

export type GraphSnapshotGroup = Record<string, GraphSnapshot>;

interface SnapshotNode {
  id: string;
  name: string;
  displayName?: string;
  logoKeys?: string[];
  protocol?: string;
  apy?: number | null;
  tvlUsd?: number | null;
  details?: {
    kind?: string;
    curator?: string | null;
    underlyingSymbol?: string;
    subtype?: string;
  } | null;
}

interface Snapshot {
  nodes: SnapshotNode[];
  edges?: Edge[];
}

export interface SearchIndexEntry {
  id: string;
  chain: string;
  protocol: string;
  name: string;
  displayName?: string;
  nodeId: string;
  apy: number | null;
  curator: string | null;
  tvlUsd: number | null;
  logoKeys?: string[];
  typeLabel?: string;
}

const isTokenLike = (value: string): boolean => {
  const v = normalizeLogoKey(value);
  return /^[a-z0-9.+-]+$/.test(v) && v.length >= 2 && v.length <= 10;
};

const ASSET_NAME_STOPWORDS = new Set<string>([
  "account",
  "alpha",
  "balanced",
  "cash",
  "core",
  "degen",
  "ecosystem",
  "financial",
  "frontier",
  "global",
  "high",
  "highyield",
  "instant",
  "liquid",
  "main",
  "og",
  "perps",
  "position",
  "prime",
  "reactor",
  "spot",
  "value",
  "vault",
  "v1",
  "v2",
  "withdrawable",
  "x",
  "yield",
]);

const TERM_ASSET_PATTERN = /^l([A-Za-z0-9.+]+)-\d+[dwmy]$/i;
const EXACT_ROOT_LOGO_KEYS: Record<string, string> = {
  "yieldnest rwa": "usdc",
};
const EXACT_ROOT_LOGO_KEYS_BY_ID: Record<string, string> = {
  "base:morpho-v2:0xbeeff7ae5e00aae3db302e4b0d8c883810a58100": "usdc",
};
const VERSION_LIKE_LOGO_KEY = /^v\d+(?:\.\d+)*$/i;

const extractAssetCandidateKey = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const termAsset = trimmed.match(TERM_ASSET_PATTERN)?.[1];
  const normalized = normalizeLogoKey(termAsset ?? trimmed);
  if (!isTokenLike(normalized)) return null;
  if (ASSET_NAME_STOPWORDS.has(normalized)) return null;

  const looksAssetLike =
    /₮/.test(trimmed) ||
    /\d/.test(trimmed) ||
    /[A-Z]{2,}/.test(trimmed) ||
    /[a-z][A-Z]/.test(trimmed);
  return looksAssetLike ? normalized : null;
};

const inferAssetKeyFromName = (name: string): string | null => {
  const compact = name.trim().replace(/\s+/g, " ");
  if (!compact) return null;

  const colonParts = compact.split(":");
  const colonCandidate = colonParts[colonParts.length - 1]?.trim() ?? "";
  const fromColon = extractAssetCandidateKey(colonCandidate);
  if (fromColon) return fromColon;

  const words = compact
    .split(/[\s/()]+/)
    .map((part) => part.replace(/^[^A-Za-z0-9₮.+-]+|[^A-Za-z0-9₮.+-]+$/g, ""))
    .filter((part) => part.length > 0);

  const candidates = words
    .map((part) => extractAssetCandidateKey(part))
    .filter((part): part is string => Boolean(part));

  const candidate =
    [...candidates]
      .reverse()
      .find((part) => !VERSION_LIKE_LOGO_KEY.test(part)) ??
    candidates[candidates.length - 1] ??
    null;
  const inferred = candidate ? inferAssetLogoKey(candidate) : null;
  if (inferred === "eth" && /\s/.test(compact)) return "weth";
  return inferred;
};

const inferNodeLogoKey = (node: SnapshotNode): string | null => {
  const direct =
    typeof node.details?.underlyingSymbol === "string"
      ? node.details.underlyingSymbol.trim()
      : "";
  if (direct && isTokenLike(direct)) {
    const key = inferAssetLogoKey(direct);
    if (key) return key;
  }

  const named = inferAssetKeyFromName(node.name);
  if (named) return named;

  const displayName =
    typeof node.displayName === "string" ? node.displayName.trim() : "";
  if (displayName && isTokenLike(displayName)) {
    const key = inferAssetLogoKey(displayName);
    if (key) return key;
  }

  const rootName = node.name.trim();
  if (isTokenLike(rootName) && rootName.length <= 10) {
    const key = inferAssetLogoKey(rootName);
    if (key) return key;
  }

  return null;
};

const inferDescendantLogoKey = (
  snapshot: Snapshot,
  root: SnapshotNode,
): string | null => {
  const edges = snapshot.edges ?? [];
  if (edges.length === 0) return null;

  const nodesById = new Map<string, SnapshotNode>();
  const edgesByFrom = new Map<string, Edge[]>();
  for (const node of snapshot.nodes) nodesById.set(node.id, node);
  for (const edge of edges) {
    const outgoing = edgesByFrom.get(edge.from);
    if (outgoing) outgoing.push(edge);
    else edgesByFrom.set(edge.from, [edge]);
  }

  const weights = new Map<string, number>();

  const addWeight = (key: string | null, weight: number) => {
    if (!key || !Number.isFinite(weight) || weight <= 0) return;
    weights.set(key, (weights.get(key) ?? 0) + weight);
  };

  const visit = (
    nodeId: string,
    branchWeight: number,
    seen: Set<string>,
  ): boolean => {
    if (seen.has(nodeId)) return false;

    const node = nodesById.get(nodeId);
    if (!node) return false;

    const nextSeen = new Set(seen);
    nextSeen.add(nodeId);

    const outgoing = (edgesByFrom.get(nodeId) ?? []).filter((edge) => {
      const allocationUsd = Math.abs(
        typeof edge.allocationUsd === "number" ? edge.allocationUsd : 0,
      );
      return Number.isFinite(allocationUsd) && allocationUsd > 0;
    });

    let foundInDescendants = false;
    for (const edge of outgoing) {
      const allocationUsd = Math.abs(edge.allocationUsd);
      const nextWeight = Math.min(branchWeight, allocationUsd);
      foundInDescendants =
        visit(edge.to, nextWeight, nextSeen) || foundInDescendants;
    }

    if (foundInDescendants) return true;

    const key = inferNodeLogoKey(node);
    if (!key) return false;
    addWeight(key, branchWeight);
    return true;
  };

  for (const edge of edgesByFrom.get(root.id) ?? []) {
    const allocationUsd = Math.abs(
      typeof edge.allocationUsd === "number" ? edge.allocationUsd : 0,
    );
    if (!Number.isFinite(allocationUsd) || allocationUsd <= 0) continue;
    visit(edge.to, allocationUsd, new Set([root.id]));
  }

  let best: { key: string; weight: number } | null = null;
  for (const [key, weight] of weights.entries()) {
    if (!best || weight > best.weight) best = { key, weight };
  }

  return best?.key ?? null;
};

const inferLogoKeys = (snapshot: Snapshot, root: SnapshotNode): string[] => {
  const explicit = Array.isArray(root.logoKeys) ? root.logoKeys : [];
  if (explicit.length > 0) return explicit;

  const direct =
    typeof root.details?.underlyingSymbol === "string"
      ? root.details.underlyingSymbol.trim()
      : "";
  if (direct && isTokenLike(direct)) {
    const key = inferAssetLogoKey(direct);
    if (key) return [key];
  }

  const exactRootKeyById = EXACT_ROOT_LOGO_KEYS_BY_ID[root.id];
  if (exactRootKeyById) return [exactRootKeyById];

  const exactRootKey = EXACT_ROOT_LOGO_KEYS[root.name.trim().toLowerCase()];
  if (exactRootKey) return [exactRootKey];

  const brandedRootKey = inferAssetKeyFromName(root.name);
  if (brandedRootKey) return [brandedRootKey];

  const rootName = root.name.trim();
  if (isTokenLike(rootName) && rootName.length <= 10) {
    const key = inferAssetLogoKey(rootName);
    if (key) return [key];
  }

  const descendantKey = inferDescendantLogoKey(snapshot, root);
  if (descendantKey) return [descendantKey];

  return [];
};

const getTypeLabel = (root: SnapshotNode): string => {
  const subtype =
    typeof root.details?.subtype === "string"
      ? root.details.subtype.trim()
      : "";
  if (subtype) return subtype;

  const kind =
    typeof root.details?.kind === "string" ? root.details.kind.trim() : "";
  return kind;
};

const collectSearchIndexEntriesFromSnapshots = (
  snapshots: Iterable<Snapshot>,
): SearchIndexEntry[] => {
  const entries: SearchIndexEntry[] = [];

  for (const snapshot of snapshots) {
    if (!snapshot?.nodes) continue;

    const root = snapshot.nodes[0];
    if (!root?.id || !root.name) continue;

    const apy = typeof root.apy === "number" ? root.apy : null;
    const tvlUsd = typeof root.tvlUsd === "number" ? root.tvlUsd : null;
    const curator =
      typeof root.details?.curator === "string" ? root.details.curator : null;

    const logoKeys = inferLogoKeys(snapshot, root);
    const typeLabel = getTypeLabel(root);

    const idParts = root.id.split(":");
    const protocolFromId = idParts[1] ?? "unknown";
    let protocol = (root.protocol ?? protocolFromId).toLowerCase();

    if (protocol.startsWith("midas")) protocol = "midas";

    const chainFromId = (idParts[0] ?? "global").toLowerCase();

    entries.push({
      id: root.id,
      chain: chainFromId,
      protocol,
      name: root.name,
      ...(typeof root.displayName === "string" && root.displayName.trim()
        ? { displayName: root.displayName.trim() }
        : {}),
      nodeId: root.id,
      apy,
      curator,
      tvlUsd,
      ...(logoKeys.length > 0 ? { logoKeys } : {}),
      ...(typeLabel ? { typeLabel } : {}),
    });
  }

  return entries;
};

export const buildSearchIndex = (
  snapshots: Iterable<Snapshot>,
): SearchIndexEntry[] => {
  return dedupeAndSortSearchIndexEntries(
    collectSearchIndexEntriesFromSnapshots(snapshots),
  );
};

const dedupeAndSortSearchIndexEntries = (
  entries: Iterable<SearchIndexEntry>,
): SearchIndexEntry[] => {
  const seen = new Set<string>();
  const deduped: SearchIndexEntry[] = [];

  for (const entry of entries) {
    const key = `${entry.protocol}|${entry.chain}|${entry.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(entry);
  }

  deduped.sort((a, b) => a.name.localeCompare(b.name));
  return deduped;
};

export const mergeSearchIndexEntries = (params: {
  baseEntries: Iterable<SearchIndexEntry>;
  nextEntries: Iterable<SearchIndexEntry>;
  replaceProtocols: Iterable<string>;
}): SearchIndexEntry[] => {
  // In dev we sometimes regenerate only a subset of adapters. Before this
  // merge helper existed, rebuilding the search index from that subset dropped
  // unrelated protocols from `search-index.json`. Keep the existing entries for
  // untouched protocols and replace only the protocols regenerated in the
  // current run.
  const protocols = new Set(
    Array.from(params.replaceProtocols, (value) =>
      value.trim().toLowerCase(),
    ).filter(Boolean),
  );

  const retainedBaseEntries = Array.from(params.baseEntries).filter((entry) => {
    const protocolFolder = inferProtocolFolderFromNodeId(entry.id);
    return !protocolFolder || !protocols.has(protocolFolder);
  });

  return dedupeAndSortSearchIndexEntries([
    ...retainedBaseEntries,
    ...params.nextEntries,
  ]);
};

export const buildSearchIndexFromProtocolGroups = (
  groups: Iterable<GraphSnapshotGroup>,
): SearchIndexEntry[] => {
  const snapshots: Snapshot[] = [];

  for (const group of groups) {
    for (const snapshot of Object.values(group)) {
      snapshots.push(snapshot as Snapshot);
    }
  }

  return buildSearchIndex(snapshots);
};
