import type { Edge, Node } from "../../types";
import { roundToTwoDecimals, scaleByDecimals, toSlug } from "../../utils";
import type { Adapter } from "../types";
import { fetchEthenaCatalog, type EthenaCatalog } from "./metrics";

const ETHENA_PROTOCOL = "ethena" as const;

const ASSET_USDE = "USDe" as const;
const ASSET_SUSDE = "sUSDe" as const;

export interface EthenaAllocation {
  type: "overview";
  data: EthenaCatalog;
}

const buildBackingNodeId = (exchange: string, asset: string): string => {
  const exchangeSlug = toSlug(exchange);
  const assetSlug = toSlug(asset);

  // Keep IDs stable and unique across the whole graph while reflecting the
  // requested shape: "<exchange>:<asset>".
  return `global:${ETHENA_PROTOCOL}:${exchangeSlug}:${assetSlug}`;
};

export const createEthenaAdapter = (): Adapter<
  EthenaCatalog,
  EthenaAllocation
> => {
  return {
    id: ETHENA_PROTOCOL,
    async fetchCatalog() {
      return fetchEthenaCatalog();
    },
    getAssetByAllocations(catalog) {
      const shared: EthenaAllocation[] = [
        { type: "overview" as const, data: catalog },
      ];

      return {
        [ASSET_USDE]: shared,
        [ASSET_SUSDE]: shared,
      };
    },
    buildRootNode(asset, allocations) {
      const alloc = allocations[0];

      if (!alloc || alloc.type !== "overview") return null;

      const ethenaAssets = alloc.data.backing.chain_metrics.latest.data;

      if (asset === ASSET_USDE) {
        const tvlUsd = (() => {
          const supplyWei = Number(ethenaAssets.totalUsdeSupply);
          const priceUsd = Number(ethenaAssets.usdePrice);

          return roundToTwoDecimals(scaleByDecimals(supplyWei, 18) * priceUsd);
        })();

        return {
          id: "eth:ethena:0x4c9edd5852cd905f086c759e8383e09bff1e68b3",
          chain: "eth",
          name: ASSET_USDE,
          protocol: ETHENA_PROTOCOL,
          details: { kind: "Deposit" },
          tvlUsd,
        } satisfies Node;
      }

      if (asset === ASSET_SUSDE) {
        const tvlUsd = (() => {
          const supplyWei = Number(ethenaAssets.totalSusdeSupply);
          const priceUsd = Number(ethenaAssets.susdePrice);

          return roundToTwoDecimals(scaleByDecimals(supplyWei, 18) * priceUsd);
        })();

        return {
          id: "eth:ethena:0x9d39a5de30e57443bff2a8307a4256c8797a3497",
          chain: "eth",
          name: ASSET_SUSDE,
          protocol: ETHENA_PROTOCOL,
          details: { kind: "Staked" },
          apy: alloc.data.susdeApy,
          tvlUsd,
        } satisfies Node;
      }

      return null;
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

      const alloc = allocations[0];

      if (!alloc || alloc.type !== "overview") {
        return { nodes, edges };
      }

      const collateral =
        alloc.data.backing.collateral_metrics.latest.data.collateral;

      const entries = collateral
        .map((entry) => ({
          exchange: entry.exchange,
          asset: entry.asset,
          usd: Number(entry.usdAmount ?? 0),
        }))
        .filter((e) => e.usd > 0);

      for (const entry of entries) {
        const allocationNode: Node = {
          id: buildBackingNodeId(entry.exchange, entry.asset),
          chain: "global",
          name: `${entry.exchange}: ${entry.asset}`,
          details: { kind: "Investment" },
        };

        nodes.push(allocationNode);

        edges.push({
          from: root.id,
          to: allocationNode.id,
          allocationUsd: roundToTwoDecimals(entry.usd),
        });
      }

      return { nodes, edges };
    },
  };
};
