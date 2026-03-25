import type { Edge, Node } from "../../types.js";
import {
  processComplexAppItem,
  processComplexProtocolItem,
  processTokenBalance,
} from "../../resolvers/debank/debankResolver.js";
import { hasDebankAccessKey } from "../../utils.js";
import { buildCanonicalIdentity } from "../../core/canonicalIdentity.js";
import type { Adapter } from "../types.js";
import { fetchResolvMetrics, type ResolvMetrics } from "./metrics.js";

const RESOLV_PROTOCOL = "resolv" as const;
// We cannot rely on Debank's non-official bundle endpoint here.
// Source bundle URL: https://debank.com/bundles/220554/portfolio
// These wallet addresses were taken from the full bundle Debank URL, and any
// future wallet additions or removals should be maintained manually in this list.
const RESOLV_WALLETS = [
  "0xd58c41211b00bc4f34bbe546ff2fa909250a1477",
  "0x58e70d8bed174643fb5f177e3f0ab2cfe689487d",
  "0x91eda28735ce089a8b5133476263c3fb8303c8ca",
  "0x40e7f70d8c5dbf7b27dab33ed826484b3c657e56",
  "0x033c208a1626b78e8258ad3e8ee0e6d923cbe709",
  "0xacb7027f271b03b502d65feba617a0d817d62b8e",
  "0x22062b644aadd7e7bb11e58c37bc1b022f4ec3ac",
  "0x2a144e059cd8a8200298976ce55e8938f33b1d3b",
] as const;

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
          ? Promise.resolve([...RESOLV_WALLETS])
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
