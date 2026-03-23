import type { GraphSnapshot } from "@/types";
import type { ToxicBreakdownEntry, ToxicAllocation } from "./types";

export interface DetectionResult {
  status: "loaded" | "pending" | "error";
  totalAllocationUsd: number;
  toxicExposureUsd: number;
  exposurePct: number;
  breakdown: ToxicBreakdownEntry[];
  toxicAllocations: ToxicAllocation[];
}

/**
 * Given a collateral token name (the part after "/" in a Morpho pair, or a
 * full Euler vault name), attempts to identify which toxic asset it represents.
 *
 * Derivative patterns handled:
 *   PT-<TOKEN>-<DATE>     — Pendle principal token (e.g. PT-RLP-9APR2026)
 *   MC-<TOKEN>            — MC-wrapped token      (e.g. MC-USR)
 *
 * Returns the matched toxic asset symbol, or null if none matched.
 */
function matchToxicAsset(token: string, toxicAssets: string[]): string | null {
  // Direct exact match (case-sensitive, as symbols are uppercase)
  if (toxicAssets.includes(token)) {
    return token;
  }

  // PT-<TOKEN>-<DATE> derivative (Pendle)
  const ptMatch = token.match(/^PT-([^-]+(?:-[^-]+)*?)-\d+[A-Z]+\d+$/);
  if (ptMatch) {
    const underlying = ptMatch[1];
    if (toxicAssets.includes(underlying)) {
      return underlying;
    }
  }

  // MC-<TOKEN> derivative
  const mcMatch = token.match(/^MC-(.+)$/);
  if (mcMatch) {
    const underlying = mcMatch[1];
    if (toxicAssets.includes(underlying)) {
      return underlying;
    }
  }

  return null;
}

/**
 * Given a full vault/market name that does NOT contain "/", checks whether
 * it references any toxic asset via substring or derivative pattern.
 *
 * Uses word-boundary-aware matching to avoid false positives (e.g. "USRA"
 * should not match "USR").
 *
 * Also handles derivative tokens inside vault names:
 *   "Resolv PT-USR-29MAY2025"  → USR
 *   "Euler Arbitrum Yield RLP" → RLP
 */
function matchSubstringToxic(
  name: string,
  toxicAssets: string[],
): string | null {
  // First try derivative patterns embedded in the name
  // PT-<TOKEN>-<DATE> anywhere in the string
  const ptEmbedded = name.match(/PT-([^-\s]+)-\d+[A-Z]+\d+/);
  if (ptEmbedded) {
    const underlying = ptEmbedded[1];
    if (toxicAssets.includes(underlying)) {
      return underlying;
    }
  }

  // MC-<TOKEN> anywhere in the string
  const mcEmbedded = name.match(/MC-([^\s/]+)/);
  if (mcEmbedded) {
    const underlying = mcEmbedded[1];
    if (toxicAssets.includes(underlying)) {
      return underlying;
    }
  }

  // Word-boundary substring match for direct token names.
  // A "word boundary" here means the token must not be immediately preceded
  // or followed by a letter or digit (allows hyphens and spaces as delimiters).
  for (const asset of toxicAssets) {
    // Escape regex special characters in the asset symbol
    const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`);
    if (re.test(name)) {
      return asset;
    }
  }

  return null;
}

/**
 * Detects toxic exposure in a single graph snapshot rooted at rootNodeId.
 *
 * Detection layers (in order, with dedup via edgeKey Set):
 *   Layer 2a — Morpho slash pattern:   "LOAN/COLLATERAL"
 *               → match collateral side (parts[1]) for exact or derivative
 *   Layer 2b — Euler substring pattern: no "/" in name
 *               → word-boundary substring + derivative matching
 *   Layer 4  — ID whitelist:            target node ID in toxicNodeIds
 *
 * Edges with allocationUsd <= 0 are skipped. Edges that match via multiple
 * layers are counted only once.
 */
export function detectToxicExposure(
  snapshot: GraphSnapshot | null | undefined,
  rootNodeId: string,
  toxicAssets: string[],
  toxicNodeIds: string[],
): DetectionResult {
  const empty: DetectionResult = {
    status: "pending",
    totalAllocationUsd: 0,
    toxicExposureUsd: 0,
    exposurePct: 0,
    breakdown: [],
    toxicAllocations: [],
  };

  if (!snapshot) {
    return empty;
  }

  // Build a nodeId → node name lookup
  const nodeNameById = new Map<string, string>();
  for (const node of snapshot.nodes) {
    nodeNameById.set(node.id, node.name);
  }

  // Filter edges from root with positive allocation
  const rootEdges = snapshot.edges.filter(
    (e) => e.from === rootNodeId && e.allocationUsd > 0,
  );

  let totalAllocationUsd = 0;
  for (const edge of rootEdges) {
    totalAllocationUsd += edge.allocationUsd;
  }

  // Per-asset accumulation: asset symbol → total USD
  const byAsset = new Map<string, number>();
  const toxicAllocations: ToxicAllocation[] = [];
  // Track matched edges to avoid double-counting
  const matchedEdgeKeys = new Set<string>();

  const recordMatch = (
    edgeKey: string,
    asset: string,
    allocationUsd: number,
    nodeId: string,
    nodeName: string,
  ) => {
    if (matchedEdgeKeys.has(edgeKey)) return;
    matchedEdgeKeys.add(edgeKey);

    byAsset.set(asset, (byAsset.get(asset) ?? 0) + allocationUsd);

    // Derive chain from nodeId ("chain:protocol:address")
    const chain = nodeId.split(":")[0] ?? "unknown";
    toxicAllocations.push({
      nodeId,
      nodeName,
      asset,
      allocationUsd,
      chain,
    });
  };

  for (const edge of rootEdges) {
    const edgeKey = `${edge.from}→${edge.to}`;
    const targetId = edge.to;
    const targetName = nodeNameById.get(targetId) ?? "";

    let matched = false;

    if (targetName.includes("/")) {
      // Layer 2a: Morpho slash pattern — LOAN/COLLATERAL
      // Toxic asset must be on the COLLATERAL side (parts[1])
      const parts = targetName.split("/");
      const collateral = parts[1];
      if (collateral !== undefined) {
        const asset = matchToxicAsset(collateral, toxicAssets);
        if (asset !== null) {
          recordMatch(edgeKey, asset, edge.allocationUsd, targetId, targetName);
          matched = true;
        }
      }
    } else {
      // Layer 2b: Euler / free-form vault names — substring match
      const asset = matchSubstringToxic(targetName, toxicAssets);
      if (asset !== null) {
        recordMatch(edgeKey, asset, edge.allocationUsd, targetId, targetName);
        matched = true;
      }
    }

    if (!matched) {
      // Layer 4: ID whitelist safety net
      if (toxicNodeIds.includes(targetId)) {
        // We don't have a specific asset symbol from this layer; use a
        // generic sentinel so the amount is still counted.
        const asset = "unknown";
        recordMatch(edgeKey, asset, edge.allocationUsd, targetId, targetName);
      }
    }
  }

  // Also apply Layer 4 for slash-named nodes that didn't match name patterns
  // (already covered above — if matched is true we skip, otherwise whitelist
  //  check runs regardless of whether name has "/" or not).

  const toxicExposureUsd = Array.from(byAsset.values()).reduce(
    (s, v) => s + v,
    0,
  );

  const breakdown: ToxicBreakdownEntry[] = Array.from(byAsset.entries()).map(
    ([asset, amountUsd]) => ({
      asset,
      amountUsd,
      pct: totalAllocationUsd > 0 ? amountUsd / totalAllocationUsd : 0,
    }),
  );

  const exposurePct =
    totalAllocationUsd > 0 ? toxicExposureUsd / totalAllocationUsd : 0;

  return {
    status: "loaded",
    totalAllocationUsd,
    toxicExposureUsd,
    exposurePct,
    breakdown,
    toxicAllocations,
  };
}
