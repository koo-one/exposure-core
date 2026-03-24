import type { Edge, Node } from "../../types.js";
import {
  processComplexAppItem,
  processComplexProtocolItem,
  processTokenBalance,
} from "../../resolvers/debank/debankResolver.js";
import { fetchBundleWallets } from "../../resolvers/debank/fetcher.js";
import { hasDebankAccessKey } from "../../utils.js";
import { buildCanonicalIdentity } from "../../core/canonicalIdentity.js";
import type { Adapter } from "../types.js";
import { fetchResolvMetrics, type ResolvMetrics } from "./metrics.js";

const RESOLV_BUNDLE_ID = "220554";
const RESOLV_PROTOCOL = "resolv" as const;

const ASSET_USR = "USR" as const;
const ASSET_WSTUSR = "wstUSR" as const;
const ASSET_RLP = "RLP" as const;

export interface ResolvCatalog {
  wallets: string[];
  metrics: ResolvMetrics;
}

export type ResolvAllocation =
  | { type: "metrics"; data: ResolvMetrics }
  | { type: "debankWallets"; wallets: string[] };

export const createResolvAdapter = (): Adapter<
  ResolvCatalog,
  ResolvAllocation
> => {
  return {
    id: RESOLV_PROTOCOL,
    async fetchCatalog() {
      const [wallets, metrics] = await Promise.all([
        hasDebankAccessKey()
          ? fetchBundleWallets(RESOLV_BUNDLE_ID)
          : Promise.resolve<string[]>([]),
        fetchResolvMetrics(),
      ]);

      return { wallets, metrics };
    },
    getAssetByAllocations(catalog) {
      const shared: ResolvAllocation[] = [
        { type: "metrics" as const, data: catalog.metrics },
        { type: "debankWallets" as const, wallets: catalog.wallets },
      ];

      return {
        [ASSET_USR]: shared,
        [ASSET_WSTUSR]: shared,
        [ASSET_RLP]: shared,
      };
    },
    buildRootNode(asset, allocations) {
      const metricsAlloc = allocations[0];

      if (!metricsAlloc || metricsAlloc.type !== "metrics") return null;

      const metrics = metricsAlloc.data;

      if (asset === ASSET_USR) {
        return {
          id: buildCanonicalIdentity({
            chain: "eth",
            protocol: RESOLV_PROTOCOL,
            address: "0x66a1e37c9b0eaddca17d3662d6c05f4decf3e110",
          }).id,
          chain: "eth",
          name: "USR",
          protocol: RESOLV_PROTOCOL,
          details: {
            kind: "Deposit",
          },
          tvlUsd: metrics.tvl.usr,
        };
      }

      if (asset === ASSET_WSTUSR) {
        return {
          id: buildCanonicalIdentity({
            chain: "eth",
            protocol: RESOLV_PROTOCOL,
            address: "0x1202f5c7b4b9e47a1a484e8b270be34dbbc75055",
          }).id,
          chain: "eth",
          name: "wstUSR",
          protocol: RESOLV_PROTOCOL,
          details: {
            kind: "Staked",
          },
          apy: metrics.apy.usr,
          tvlUsd: metrics.tvl.wstusr,
        };
      }

      if (asset === ASSET_RLP) {
        return {
          id: buildCanonicalIdentity({
            chain: "eth",
            protocol: RESOLV_PROTOCOL,
            address: "0x4956b52ae2ff65d74ca2d61207523288e4528f96",
          }).id,
          chain: "eth",
          name: "RLP",
          protocol: RESOLV_PROTOCOL,
          details: { kind: "Protection", curator: "resolv" },
          apy: metrics.apy.rlp,
          tvlUsd: metrics.tvl.rlp,
        };
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

      const walletsAlloc = allocations[1];

      if (!walletsAlloc || walletsAlloc.type !== "debankWallets") {
        return { nodes, edges };
      }

      for (const walletAddress of walletsAlloc.wallets) {
        const results = await Promise.all([
          processComplexProtocolItem(walletAddress, root.id),
          processComplexAppItem(walletAddress, root.id),
          processTokenBalance(walletAddress, root.id),
        ]);

        for (const result of results) {
          nodes.push(...result.nodes);
          edges.push(...result.edges);
        }
      }

      return { nodes, edges };
    },
  };
};
