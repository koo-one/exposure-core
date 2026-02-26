import type { Edge, Node } from "../../types";
import { roundToTwoDecimals } from "../../utils";
import { formatUnits, type Address } from "viem";
import type { Adapter } from "../types";
import {
  EULER_CHAIN_CONFIGS,
  type EulerChainConfig,
  fetchEulerEarnVaults,
  fetchEulerEvkVaults,
  fetchEulerLabelEntities,
  fetchEulerLabelsVaults,
  fetchEulerPrices,
  fetchEulerVaultOpenInterest,
  type EulerEarnVault,
  type EulerLabelEntity,
  type EulerLabelsVault,
  type EulerEvkVault,
} from "./metrics";

const EULER_PROTOCOL = "euler";

/**
 * EulerEarnVault (subgraph) does not expose the underlying ERC-20 `decimals` for `earnVault.asset`.
 *
 * We need those decimals to convert raw `totalAssets` / `allocatedAssets` (base units) into token units
 * before applying USD prices.
 *
 * Strategy vaults (EVK) do expose `decimals`. When we find an EVK strategy vault whose `asset` matches
 * the Earn underlying `asset`, we reuse that EVK vault's `decimals` as the best available proxy for the
 * underlying token's decimals.
 */
const getEarnAssetDecimals = (
  earnVault: EulerEarnVault,
  evkVaultMap: Map<Address, EulerEvkVault>,
): number => {
  const underlying = earnVault.asset;

  for (const { strategy } of earnVault.strategies) {
    const evk = evkVaultMap.get(strategy);

    if (evk?.asset === underlying) return evk.decimals;
  }

  return 18;
};

const parseRayApy = (raw: string | undefined | null): number | null =>
  raw ? Number(formatUnits(BigInt(raw), 27)) : null;

const getVaultLabelName = (
  labelsByVault: Map<string, EulerLabelsVault>,
  vaultId: Address,
): string | null => {
  const vault = labelsByVault.get(vaultId.toLowerCase());

  if (!vault) return null;

  return vault.name;
};

const eulerNodeId = (chainKey: string, address: Address): string =>
  `${chainKey}:${EULER_PROTOCOL}:${address.toLowerCase()}`;

export interface EulerChainCatalog {
  chainId: number;
  chainKey: string;
  subgraphUrl: string;
  earnVaults: EulerEarnVault[];
  evkVaultMap: Map<Address, EulerEvkVault>;
  labelsByVault: Map<string, EulerLabelsVault>;
  entitiesById: Map<string, EulerLabelEntity>;
  entityNameByAddress: Map<string, string>;
  pricesByAsset: Map<Address, number>;
  openInterestByLiability: Map<Address, Map<Address, number>>;
}

const resolveEulerVaultCurator = (
  labelsByVault: Map<string, EulerLabelsVault>,
  entitiesById: Map<string, EulerLabelEntity>,
  vaultId: Address,
): string | null => {
  const record = labelsByVault.get(vaultId.toLowerCase());
  const entity = record?.entity;
  if (!entity) return null;

  const ids = Array.isArray(entity) ? entity : [entity];
  const names = ids
    .map((id) => entitiesById.get(id)?.name ?? id)
    .map((value) => value.trim())
    .filter(Boolean);

  if (names.length === 0) return null;

  // Stable display string for filtering.
  return names.join(", ");
};

export type EulerAllocation =
  | {
      type: "earnVault";
      chainKey: string;
      earnVault: EulerEarnVault;
      evkVaultMap: Map<Address, EulerEvkVault>;
      labelsByVault: Map<string, EulerLabelsVault>;
      entitiesById: Map<string, EulerLabelEntity>;
      entityNameByAddress: Map<string, string>;
      pricesByAsset: Map<Address, number>;
    }
  | {
      type: "evkVault";
      chainKey: string;
      evkVault: EulerEvkVault;
      collateralOpenInterestUsd: Map<Address, number>;
      evkVaultMap: Map<Address, EulerEvkVault>;
      labelsByVault: Map<string, EulerLabelsVault>;
      entitiesById: Map<string, EulerLabelEntity>;
      entityNameByAddress: Map<string, string>;
      pricesByAsset: Map<Address, number>;
    };

export const createEulerAdapter = (): Adapter<
  EulerChainCatalog[],
  EulerAllocation
> => {
  /**
   * Graph model construction order (mainnet / `eth`):
   * 1) Fetch governed EulerEarn vaults from the subgraph (root nodes of kind "Yield").
   * 2) Fetch Euler labels to override vault display names (matches Euler UI naming).
   * 3) Fetch Euler UI prices to convert token balances to USD.
   * 4) Fetch indexer open-interest to define the EVK root universe and collateral weights.
   * 5) Consolidate all EVK addresses we need:
   *    - Earn strategy EVKs (for Earn -> EVK edges)
   *    - Open-interest liability + collateral EVKs (for EVK -> collateral edges)
   * 6) Batch-fetch EVK vault state (decimals, cash/borrows, supplyApy) from the subgraph.
   *
   * Notes:
   * - Node IDs are address-based (`eth:euler:<address>`) to avoid name collisions.
   * - Earn vault asset decimals are not available on EulerEarnVault in the subgraph; we derive
   *   decimals by matching the Earn underlying `asset` address to an EVK strategy vault's `asset`.
   */
  return {
    id: EULER_PROTOCOL,
    async fetchCatalog() {
      const fetchChainCatalog = async (
        config: EulerChainConfig,
      ): Promise<EulerChainCatalog> => {
        const [
          earnVaults,
          labelsByVault,
          entitiesById,
          pricesByAsset,
          openInterestByLiability,
        ] = await Promise.all([
          fetchEulerEarnVaults(config.subgraphUrl),
          fetchEulerLabelsVaults(config.chainId),
          fetchEulerLabelEntities(config.chainId),
          fetchEulerPrices(config.chainId),
          fetchEulerVaultOpenInterest(config.chainId),
        ]);

        const entityNameByAddress = new Map<string, string>();
        for (const entity of entitiesById.values()) {
          const name = entity.name?.trim();
          if (!name) continue;
          const addresses = entity.addresses ?? {};
          for (const addr of Object.keys(addresses)) {
            entityNameByAddress.set(addr.toLowerCase(), name);
          }
        }

        // We derive EVK addresses from open-interest (Euler UI weight model) to define the EVK root
        // universe + collateral edges, and we also include Earn strategy EVKs so Earn -> EVK leaves
        // have metadata (name/apy/decimals) and we can compute a strategy-weighted Earn APY proxy.
        const evkVaultAddresses: Address[] = [];

        for (const [
          liabilityVault,
          collateralVaults,
        ] of openInterestByLiability) {
          evkVaultAddresses.push(liabilityVault);

          for (const collateralVault of collateralVaults.keys())
            evkVaultAddresses.push(collateralVault);
        }

        for (const earnVault of earnVaults) {
          for (const { strategy } of earnVault.strategies)
            evkVaultAddresses.push(strategy);
        }

        const unique = [
          ...new Set(evkVaultAddresses.map((a) => a.toLowerCase())),
        ];
        const evkVaults = await fetchEulerEvkVaults(
          unique as Address[],
          config.subgraphUrl,
        );

        // mapping evk vault addr with evk vault info (e.g name, supplyApy)
        const evkVaultMap = new Map(
          evkVaults.map((evkVault) => [evkVault.id, evkVault] as const),
        );

        return {
          chainId: config.chainId,
          chainKey: config.chainKey,
          subgraphUrl: config.subgraphUrl,
          earnVaults,
          evkVaultMap,
          labelsByVault,
          entitiesById,
          entityNameByAddress,
          pricesByAsset,
          openInterestByLiability,
        };
      };

      const settled = await Promise.allSettled(
        EULER_CHAIN_CONFIGS.map((config) => fetchChainCatalog(config)),
      );

      const catalogs: EulerChainCatalog[] = [];
      for (const res of settled) {
        if (res.status === "fulfilled") catalogs.push(res.value);
      }

      if (catalogs.length === 0) {
        const firstRejection = settled.find(
          (r): r is PromiseRejectedResult => r.status === "rejected",
        );
        throw new Error(
          `Euler: no chain catalogs fetched${firstRejection ? ` (first error: ${String(firstRejection.reason)})` : ""}`,
        );
      }

      return catalogs;
    },
    getAssetByAllocations(catalog) {
      const result: Record<string, EulerAllocation[]> = {};

      for (const chainCatalog of catalog) {
        const chainKey = chainCatalog.chainKey;

        // process allocations about earn vaults
        for (const earnVault of chainCatalog.earnVaults) {
          if (earnVault.strategies.length === 0) continue;

          const assetKey = eulerNodeId(chainKey, earnVault.id);

          result[assetKey] = [
            {
              type: "earnVault" as const,
              chainKey,
              earnVault,
              evkVaultMap: chainCatalog.evkVaultMap,
              labelsByVault: chainCatalog.labelsByVault,
              entitiesById: chainCatalog.entitiesById,
              entityNameByAddress: chainCatalog.entityNameByAddress,
              pricesByAsset: chainCatalog.pricesByAsset,
            },
          ];
        }

        // process allocations about evk vaults
        for (const [
          liabilityAddr,
          collateralOpenInterestUsd,
        ] of chainCatalog.openInterestByLiability) {
          const evkVault = chainCatalog.evkVaultMap.get(liabilityAddr);
          if (!evkVault) continue;

          const assetKey = eulerNodeId(chainKey, evkVault.id);

          result[assetKey] = [
            {
              type: "evkVault" as const,
              chainKey,
              evkVault,
              collateralOpenInterestUsd,
              evkVaultMap: chainCatalog.evkVaultMap,
              labelsByVault: chainCatalog.labelsByVault,
              entitiesById: chainCatalog.entitiesById,
              entityNameByAddress: chainCatalog.entityNameByAddress,
              pricesByAsset: chainCatalog.pricesByAsset,
            },
          ];
        }
      }

      return result;
    },
    buildRootNode(_asset, allocations) {
      const alloc = allocations[0];

      if (!alloc) return null;

      if (alloc.type === "earnVault") {
        const chainKey = alloc.chainKey;
        const vault = alloc.earnVault;
        const earnVaultDecimals = getEarnAssetDecimals(
          vault,
          alloc.evkVaultMap,
        );

        const totalAssets = Number(
          formatUnits(BigInt(vault.totalAssets), earnVaultDecimals),
        );

        const price = alloc.pricesByAsset.get(vault.asset);
        const tvlUsd = roundToTwoDecimals(
          price == null ? 0 : totalAssets * price,
        );

        return {
          id: eulerNodeId(chainKey, vault.id),
          chain: chainKey,
          name: getVaultLabelName(alloc.labelsByVault, vault.id) ?? vault.name,
          protocol: EULER_PROTOCOL,
          details: {
            kind: "Yield",
            curator: vault.curator
              ? (alloc.entityNameByAddress.get(vault.curator.toLowerCase()) ??
                null)
              : null,
          },
          tvlUsd,
          apy: 0,
        } satisfies Node;
      }

      //evk vault branch
      const chainKey = alloc.chainKey;
      const vault = alloc.evkVault;

      // underlying assets currently lent out (outstanding borrows, includes accrual as interest compounds)
      const totalBorrows = BigInt(vault.state?.totalBorrows ?? "0");

      //underlying assets currently held by the vault (idle/liquid, not borrowed)
      const cash = BigInt(vault.state?.cash ?? "0");

      const price = alloc.pricesByAsset.get(vault.asset);
      const total = Number(formatUnits(totalBorrows + cash, vault.decimals));
      const tvlUsd = roundToTwoDecimals(price == null ? total : total * price);

      return {
        id: eulerNodeId(chainKey, vault.id),
        chain: chainKey,
        name: getVaultLabelName(alloc.labelsByVault, vault.id) ?? vault.name,
        protocol: EULER_PROTOCOL,
        details: {
          kind: "Yield",
          curator:
            resolveEulerVaultCurator(
              alloc.labelsByVault,
              alloc.entitiesById,
              vault.id,
            ) ?? null,
        },
        tvlUsd,
        apy: parseRayApy(vault.state?.supplyApy),
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

      const allocation = allocations[0];

      if (!allocation) return { nodes, edges };

      if (allocation.type === "earnVault") {
        const chainKey = allocation.chainKey;
        const vault = allocation.earnVault;

        const underlyingDecimals = getEarnAssetDecimals(
          vault,
          allocation.evkVaultMap,
        );

        const underlyingPrice = allocation.pricesByAsset.get(vault.asset);

        for (const strategy of vault.strategies) {
          const evkVault = allocation.evkVaultMap.get(strategy.strategy);

          if (!evkVault) continue;

          const evkVaultDisplayName = getVaultLabelName(
            allocation.labelsByVault,
            evkVault.id ?? strategy.strategy,
          );

          const nodeId = eulerNodeId(
            chainKey,
            evkVault?.id ?? strategy.strategy,
          );
          const allocated = Number(
            formatUnits(BigInt(strategy.allocatedAssets), underlyingDecimals),
          );

          const allocationUsd = roundToTwoDecimals(
            underlyingPrice == null ? allocated : allocated * underlyingPrice,
          );

          nodes.push({
            id: nodeId,
            chain: chainKey,
            name: evkVaultDisplayName ?? evkVault.name,
            protocol: EULER_PROTOCOL,
            details: {
              kind: "Yield",
              curator:
                resolveEulerVaultCurator(
                  allocation.labelsByVault,
                  allocation.entitiesById,
                  evkVault.id ?? strategy.strategy,
                ) ?? null,
            },
            apy: parseRayApy(evkVault.state?.supplyApy),
          });

          edges.push({
            from: root.id,
            to: nodeId,
            allocationUsd,
          });
        }

        return { nodes, edges };
      }

      //evk vaults allocation process

      const chainKey = allocation.chainKey;

      for (const [
        collateralVault,
        openInterestUsd,
      ] of allocation.collateralOpenInterestUsd) {
        const evkVault = allocation.evkVaultMap.get(collateralVault);

        if (!evkVault) continue;

        const collateralDisplayName = getVaultLabelName(
          allocation.labelsByVault,
          collateralVault,
        );

        const nodeId = eulerNodeId(chainKey, collateralVault);

        nodes.push({
          id: nodeId,
          chain: chainKey,
          name: collateralDisplayName ?? evkVault.name,
          protocol: EULER_PROTOCOL,
          details: {
            kind: "Yield",
            curator:
              resolveEulerVaultCurator(
                allocation.labelsByVault,
                allocation.entitiesById,
                collateralVault,
              ) ?? null,
          },
          apy: parseRayApy(evkVault.state?.supplyApy),
        });

        edges.push({
          from: root.id,
          to: nodeId,
          allocationUsd: roundToTwoDecimals(openInterestUsd),
        });
      }

      return { nodes, edges };
    },
  };
};
