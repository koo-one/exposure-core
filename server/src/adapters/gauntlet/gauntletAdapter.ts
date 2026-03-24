import type { Edge, Node } from "../../types.js";
import type { Adapter } from "../types.js";
import { isAllocationUsdEligible } from "../../resolvers/debank/utils.js";
import { buildCanonicalIdentity } from "../../core/canonicalIdentity.js";
import {
  normalizeChain,
  normalizeProtocol,
  roundToTwoDecimals,
  toSlug,
} from "../../utils.js";
import { fetchGauntletMetrics, type GauntletMetrics } from "./metrics.js";
import { getGauntletPrimaryDeployment } from "./deployments.js";
import { fetchVaultV1s } from "../morpho/vaultV1Query.js";
import { fetchVaultV2s } from "../morpho/vaultV2Query.js";

const GAUNTLET_PROTOCOL = "gauntlet" as const;
const ASSET_GAUNLET_USD_ALPHA = "gtUSDa" as const;

// Gauntlet adapter overrides.
// Intentionally kept as a single exported object so it can be edited manually
// without touching normalization logic.
const GAUNTLET_ASSET_NAME_OVERRIDES: Record<string, string> = {
  // Asset symbol -> UI name
  gtusdcc: "Gauntlet USDC Balanced",
  resolvusdc: "Resolv USDC",
  midasusdc: "Gauntlet USDC RWA",
  exmusdc: "Extrafi XLend USDC",

  // Raw vault/product name -> UI name
  // always check morpho ui, gauntlet ui
  "gauntlet-usdc-core": "Gauntlet USDC Balanced",
};

// Gauntlet UI hides small allocations; match that behavior for snapshot parity.
const MIN_GAUNTLET_UI_ALLOCATION_USD = 100_000;

interface GauntletMorphoProtocolIndex {
  v1: Set<string>;
  v2: Set<string>;
}

let morphoProtocolIndexPromise: Promise<GauntletMorphoProtocolIndex> | null =
  null;

const buildGauntletMorphoProtocolIndex =
  async (): Promise<GauntletMorphoProtocolIndex> => {
    const [v1Vaults, v2Vaults] = await Promise.all([
      fetchVaultV1s(),
      fetchVaultV2s(),
    ]);

    const v1 = new Set<string>();
    const v2 = new Set<string>();

    for (const vault of v1Vaults) {
      const chain = normalizeChain(vault.chain.network);
      v1.add(`${chain}:${vault.address.toLowerCase()}`);
    }

    for (const vault of v2Vaults) {
      const chain = normalizeChain(vault.chain.network);
      v2.add(`${chain}:${vault.address.toLowerCase()}`);
    }

    return { v1, v2 };
  };

const getGauntletMorphoProtocolIndex =
  async (): Promise<GauntletMorphoProtocolIndex> => {
    if (!morphoProtocolIndexPromise) {
      morphoProtocolIndexPromise = buildGauntletMorphoProtocolIndex().catch(
        (error) => {
          morphoProtocolIndexPromise = null;
          throw error;
        },
      );
    }

    return morphoProtocolIndexPromise;
  };

const isGauntletUiAllocationEligible = (allocationUsd: number): boolean => {
  return allocationUsd >= MIN_GAUNTLET_UI_ALLOCATION_USD;
};

const resolveGauntletAllocationProtocol = async (
  chain: string,
  protocol: string,
  assetAddress: string,
): Promise<string> => {
  const normalizedProtocol = normalizeProtocol(protocol);

  if (!normalizedProtocol.startsWith("morpho")) {
    return normalizedProtocol;
  }

  if (!assetAddress) {
    return normalizedProtocol;
  }

  const normalizedChain = normalizeChain(chain);
  const identityKey = `${normalizedChain}:${assetAddress}`.toLowerCase();

  try {
    const index = await getGauntletMorphoProtocolIndex();

    if (index.v2.has(identityKey)) return "morpho-v2";
    if (index.v1.has(identityKey)) return "morpho-v1";
  } catch {
    // Keep Gauntlet output resilient if Morpho catalog fetches fail.
  }

  return normalizedProtocol;
};

const chainIdToChain = (chainId: number): string => {
  const chainName = (() => {
    switch (chainId) {
      case 1:
        return "ethereum";
      case 10:
        return "optimism";
      case 137:
        return "polygon";
      case 42161:
        return "arbitrum";
      case 8453:
        return "base";
      default:
        return String(chainId);
    }
  })();

  return normalizeChain(chainName);
};

export interface GauntletAllocation {
  data: GauntletMetrics;
}

export const createGauntletAdapter = (): Adapter<
  GauntletMetrics,
  GauntletAllocation
> => {
  return {
    id: GAUNTLET_PROTOCOL,
    async fetchCatalog() {
      return fetchGauntletMetrics();
    },
    getAssetByAllocations(catalog) {
      return {
        [ASSET_GAUNLET_USD_ALPHA]: [
          {
            data: catalog,
          },
        ],
      };
    },
    buildRootNode(_asset, allocations) {
      const entry = allocations[0];

      if (!entry) return null;

      const primaryDeployment = getGauntletPrimaryDeployment();

      const node: Node = {
        id: buildCanonicalIdentity({
          chain: primaryDeployment.chain,
          protocol: GAUNTLET_PROTOCOL,
          address: primaryDeployment.address,
        }).id,
        chain: primaryDeployment.chain,
        name: "Gauntlet USD Alpha",
        protocol: GAUNTLET_PROTOCOL,
        details: { kind: "Yield", curator: GAUNTLET_PROTOCOL },
        apy: entry.data.summary.share_price_apy_30d.value,
        tvlUsd: roundToTwoDecimals(entry.data.summary.balance_usd.value),
      };

      return node;
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    buildEdge(root, allocationNode, allocation) {
      const edge: Edge = {
        from: root.id,
        to: allocationNode.id,
        allocationUsd: 0,
      };

      return edge;
    },
    async normalizeLeaves(root, allocations) {
      const nodes: Node[] = [];
      const edges: Edge[] = [];

      const entry = allocations[0];

      if (!entry) return { nodes, edges };

      const groups = entry.data.groups ?? [];

      for (const group of groups) {
        const isSupply = group.group === "supply";
        const isPrimaryAssets =
          group.group === "assets" && group.protocol == null;

        if (!isSupply && !isPrimaryAssets) continue;

        for (const asset of group.assets ?? []) {
          const allocationUsd = asset.metrics.balance_usd.value ?? 0;

          if (!isAllocationUsdEligible(allocationUsd)) continue;

          if (!isGauntletUiAllocationEligible(allocationUsd)) continue;

          const chain = chainIdToChain(asset.chainId);

          const protocol = (() => {
            if (asset.protocol) return asset.protocol;

            if (/^PT-/.test(asset.asset)) return "pendle";

            if (asset.asset === "USDC") return "circle";

            return null;
          })();

          if (!protocol) continue;

          const resolvedProtocol = await resolveGauntletAllocationProtocol(
            chain,
            protocol,
            asset.assetAddress,
          );

          const nodeId = buildCanonicalIdentity({
            chain,
            protocol: resolvedProtocol,
            resourceId: asset.assetAddress,
          }).id;

          const name =
            asset.displayName ??
            GAUNTLET_ASSET_NAME_OVERRIDES[toSlug(asset.asset)] ??
            toSlug(asset.asset);

          nodes.push({
            id: nodeId,
            chain,
            name: name,
            protocol: resolvedProtocol,
          });

          edges.push({ from: root.id, to: nodeId, allocationUsd });
        }
      }

      return { nodes, edges };
    },
  };
};
