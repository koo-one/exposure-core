import type { Edge, Node } from "../../types.js";
import { roundToTwoDecimals } from "../../utils.js";
import type { Adapter } from "../types.js";
import {
  FLUID_CHAIN_CONFIGS,
  fetchFluidVaults,
  type FluidChainConfig,
  type FluidVault,
} from "./metrics.js";

const FLUID_PROTOCOL = "fluid";

const fluidNodeId = (chainKey: string, address: string): string =>
  `${chainKey}:${FLUID_PROTOCOL}:${address.toLowerCase()}`;

export interface FluidChainCatalog {
  chainKey: string;
  chainId: number;
  vaults: FluidVault[];
}

export interface FluidAllocation {
  chainKey: string;
  vault: FluidVault;
}

export const createFluidAdapter = (): Adapter<
  FluidChainCatalog[],
  FluidAllocation
> => {
  return {
    id: FLUID_PROTOCOL,

    async fetchCatalog() {
      const fetchChainCatalog = async (
        config: FluidChainConfig,
      ): Promise<FluidChainCatalog> => {
        const vaults = await fetchFluidVaults(config);
        return {
          chainKey: config.chainKey,
          chainId: config.chainId,
          vaults,
        };
      };

      const settled = await Promise.allSettled(
        FLUID_CHAIN_CONFIGS.map((config) => fetchChainCatalog(config)),
      );

      const catalogs: FluidChainCatalog[] = [];
      const failures: { chainId: number; chainKey: string; reason: unknown }[] =
        [];

      for (const [idx, res] of settled.entries()) {
        const config = FLUID_CHAIN_CONFIGS[idx];
        if (!config) continue;

        if (res.status === "fulfilled") {
          catalogs.push(res.value);
        } else {
          failures.push({
            chainId: config.chainId,
            chainKey: config.chainKey,
            reason: res.reason,
          });
        }
      }

      if (failures.length > 0 && catalogs.length > 0) {
        console.warn(
          `Fluid: ${failures.length} chain catalog fetch(es) failed`,
          failures.map((f) => ({
            chainId: f.chainId,
            chainKey: f.chainKey,
            reason: String(f.reason),
          })),
        );
      }

      if (catalogs.length === 0) {
        throw new Error(
          `Fluid: no chain catalogs fetched${failures.length > 0 ? ` (errors: ${failures.map((f) => `${f.chainKey}:${f.chainId} ${String(f.reason)}`).join("; ")})` : ""}`,
        );
      }

      return catalogs;
    },

    getAssetByAllocations(catalog) {
      const result: Record<string, FluidAllocation[]> = {};

      for (const chainCatalog of catalog) {
        for (const vault of chainCatalog.vaults) {
          const assetKey = fluidNodeId(chainCatalog.chainKey, vault.address);
          result[assetKey] = [{ chainKey: chainCatalog.chainKey, vault }];
        }
      }

      return result;
    },

    buildRootNode(_asset, allocations) {
      const alloc = allocations[0];
      if (!alloc) return null;

      const { vault, chainKey } = alloc;

      const vaultName = `${vault.supplySymbol}/${vault.borrowSymbol}`;

      const logoKeys = vault.supplyTokens.map((t) => t.symbol).filter(Boolean);

      return {
        id: fluidNodeId(chainKey, vault.address),
        chain: chainKey,
        name: vaultName,
        displayName: vault.supplySymbol,
        logoKeys,
        protocol: FLUID_PROTOCOL,
        details: {
          kind: "Yield" as const,
          subtype: "Lending Vault",
          curator: null,
        },
        tvlUsd: roundToTwoDecimals(vault.totalSupplyUsd),
        apy: vault.supplyApr,
      } satisfies Node;
    },

    buildEdge(root, allocationNode, allocation) {
      void allocation;
      return {
        from: root.id,
        to: allocationNode.id,
        allocationUsd: 0,
      };
    },

    async normalizeLeaves(root, allocations) {
      const nodes: Node[] = [];
      const edges: Edge[] = [];

      const alloc = allocations[0];
      if (!alloc) return { nodes, edges };

      const { vault, chainKey } = alloc;

      for (const token of vault.supplyTokens) {
        const tokenAddress = token.address.toLowerCase();
        const nodeId = `${chainKey}:token:${tokenAddress}`;

        const tokenShare =
          vault.supplyTokens.length === 1
            ? vault.totalSupplyUsd
            : vault.totalSupplyUsd / vault.supplyTokens.length;

        nodes.push({
          id: nodeId,
          chain: chainKey,
          name: token.symbol,
          displayName: token.symbol,
          logoKeys: [token.symbol],
          protocol: FLUID_PROTOCOL,
          details: { kind: "Deposit" as const },
          tvlUsd: roundToTwoDecimals(tokenShare),
        });

        edges.push({
          from: root.id,
          to: nodeId,
          allocationUsd: roundToTwoDecimals(tokenShare),
        });
      }

      for (const token of vault.borrowTokens) {
        const tokenAddress = token.address.toLowerCase();
        const nodeId = `${chainKey}:token:${tokenAddress}`;

        const tokenShare =
          vault.borrowTokens.length === 1
            ? vault.totalBorrowUsd
            : vault.totalBorrowUsd / vault.borrowTokens.length;

        if (tokenShare > 0) {
          nodes.push({
            id: nodeId,
            chain: chainKey,
            name: token.symbol,
            displayName: token.symbol,
            logoKeys: [token.symbol],
            protocol: FLUID_PROTOCOL,
            details: { kind: "Deposit" as const },
            tvlUsd: roundToTwoDecimals(tokenShare),
          });

          edges.push({
            from: root.id,
            to: nodeId,
            allocationUsd: roundToTwoDecimals(tokenShare),
            lendingPosition: "borrow",
          });
        }
      }

      return { nodes, edges };
    },
  };
};
