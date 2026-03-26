import type { Edge, Node } from "../../types.js";
import {
  processComplexAppItem,
  processComplexProtocolItem,
  processTokenBalance,
} from "../../resolvers/debank/debankResolver.js";
import { hasDebankAccessKey } from "../../utils.js";
import { buildCanonicalIdentity } from "../../core/canonicalIdentity.js";
import type { Adapter } from "../types.js";
import { fetchYuzuMetrics, type YuzuMetrics } from "./metrics.js";

// We cannot rely on Debank's non-official bundle endpoint here.
// Source bundle URL: https://debank.com/bundles/220643/portfolio
// These wallet addresses were taken from the full bundle Debank URL, and any
// future wallet additions or removals should be maintained manually in this list.
const YUZU_WALLETS = [
  "0x815f5bb257e88b67216a344c7c83a3ea4ee74748",
  "0x502d222e8e4daef69032f55f0c1a999effd78fb3",
  "0x015cc48cc8bc37d80aaff4e43061dbaf94192308",
  "0x6695c0f8706c5ace3bdf8995073179cca47926dc",
  "0x0879aa9e47d3209ce36addcf6561196040a73d8f",
] as const;

const ASSET_YZUSD = "yzUSD" as const;
const ASSET_SYZUSD = "sYzuUSD" as const;
const ASSET_YZPP = "yzPP" as const;

const PLASMA_CHAIN = "plasma" as const;
const YUZU_PROTOCOL = "yuzu" as const;

const YUZU_YZUSD_PLASMA = "0x6695c0f8706c5ace3bdf8995073179cca47926dc" as const;
const YUZU_SYZUSD_PLASMA =
  "0xc8a8df9b210243c55d31c73090f06787ad0a1bf6" as const;
const YUZU_YZPP_PLASMA = "0xebfc8c2fe73c431ef2a371aea9132110aab50dca" as const;

export interface YuzuCatalog {
  wallets: string[];
  metrics: YuzuMetrics;
}

export type YuzuAllocation =
  | { type: "metrics"; data: YuzuMetrics }
  | { type: "debankWallets"; wallets: string[] };

export const createYuzuAdapter = (): Adapter<YuzuCatalog, YuzuAllocation> => {
  return {
    id: YUZU_PROTOCOL,
    async fetchCatalog() {
      const [wallets, metrics] = await Promise.all([
        hasDebankAccessKey()
          ? Promise.resolve([...YUZU_WALLETS])
          : Promise.resolve<string[]>([]),
        fetchYuzuMetrics(),
      ]);

      return { wallets, metrics };
    },
    getAssetByAllocations(catalog) {
      const shared: YuzuAllocation[] = [
        { type: "metrics" as const, data: catalog.metrics },
        { type: "debankWallets" as const, wallets: catalog.wallets },
      ];

      return {
        [ASSET_YZUSD]: shared,
        [ASSET_SYZUSD]: shared,
        [ASSET_YZPP]: shared,
      };
    },
    buildRootNode(asset, allocations) {
      const metricsAlloc = allocations[0];

      if (!metricsAlloc || metricsAlloc.type !== "metrics") return null;

      const metrics = metricsAlloc.data;

      if (asset === ASSET_YZUSD) {
        return {
          id: buildCanonicalIdentity({
            chain: PLASMA_CHAIN,
            protocol: YUZU_PROTOCOL,
            address: YUZU_YZUSD_PLASMA,
          }).id,
          chain: PLASMA_CHAIN,
          name: "yzUSD",
          protocol: YUZU_PROTOCOL,
          details: { kind: "Deposit" },
          tvlUsd: metrics.tvl.yzusd,
        } satisfies Node;
      }

      if (asset === ASSET_SYZUSD) {
        return {
          id: buildCanonicalIdentity({
            chain: PLASMA_CHAIN,
            protocol: YUZU_PROTOCOL,
            address: YUZU_SYZUSD_PLASMA,
          }).id,
          chain: PLASMA_CHAIN,
          name: "syzUSD",
          protocol: YUZU_PROTOCOL,
          details: { kind: "Yield", curator: "yuzu" },
          apy: metrics.apy.syzusd,
          tvlUsd: metrics.tvl.syzusd,
        } satisfies Node;
      }

      if (asset === ASSET_YZPP) {
        return {
          id: buildCanonicalIdentity({
            chain: PLASMA_CHAIN,
            protocol: YUZU_PROTOCOL,
            address: YUZU_YZPP_PLASMA,
          }).id,
          chain: PLASMA_CHAIN,
          name: "yzPP",
          protocol: YUZU_PROTOCOL,
          details: { kind: "Protection", curator: "yuzu" },
          apy: metrics.apy.yzpp,
          tvlUsd: metrics.tvl.yzpp,
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
