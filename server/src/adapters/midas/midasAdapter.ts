import type { Edge, Node } from "../../types.js";
import {
  processComplexAppItem,
  processComplexProtocolItem,
  processTokenBalance,
} from "../../resolvers/debank/debankResolver.js";
import { hasDebankAccessKey } from "../../utils.js";
import { buildCanonicalIdentity } from "../../core/canonicalIdentity.js";
import {
  type DeltaYSankeyResponse,
  type DeltaYWalletMetadataResponse,
  fetchMidasVaultCatalog,
  fetchVaultSankey,
  fetchVaultWalletMetadata,
  getWalletCategoryTotalsFromSankey,
  isEvmAddress,
  isWalletLocationName,
  MIDAS_PROVIDER_NAME,
  normalizeWalletCategory,
  UNCLASSIFIED_LOCATION_NAME,
} from "./deltaY.js";
import { getCuratorForAsset } from "./curators.js";
import { getMidasPrimaryDeployment } from "./deployments.js";
import type { Adapter } from "../types.js";

const MIDAS_PROTOCOL = "midas" as const;

export interface MidasAllocation {
  asset: string;
  kind: "unclassified" | "wallet";
  category: string;
  label: string | null;
  navUsd: number;
  linkTitle: string | null;
  link: string | null;
}

interface MidasVaultMetrics {
  apy: number | null;
  navUsd: number | null;
}

const MIDAS_VAULT_CONCURRENCY = 4;

const mapWithConcurrency = async <T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const runWorker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await mapper(
        items[currentIndex] as T,
        currentIndex,
      );
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () =>
      runWorker(),
    ),
  );

  return results;
};

const buildStandaloneAllocationNode = (
  allocation: MidasAllocation,
  chain: string,
): Node => {
  const name = allocation.label?.trim() || "Unspecified Allocation";

  return {
    id: buildCanonicalIdentity({
      chain,
      protocol: MIDAS_PROTOCOL,
      forcedSource: allocation.label?.trim()
        ? "fallback-name"
        : "fallback-unknown",
      fallbackName: allocation.label?.trim() || null,
      resourceId: allocation.label?.trim() || null,
      resourceParts: allocation.label?.trim() ? [] : [allocation.category],
    }).id,
    name,
    details: { kind: "Investment" },
  };
};

const buildUnclassifiedAllocations = (params: {
  asset: string;
  sankey: DeltaYSankeyResponse;
}): MidasAllocation[] => {
  const { asset, sankey } = params;
  let unclassifiedNavUsd = 0;

  for (const row of sankey.data) {
    const locationName = row.dimensions?.locationName?.trim();
    const navUsd = row.navUsd ?? 0;

    if (!locationName || navUsd <= 0) continue;
    if (locationName !== UNCLASSIFIED_LOCATION_NAME) continue;

    unclassifiedNavUsd += navUsd;
  }

  if (unclassifiedNavUsd <= 0) return [];

  return [
    {
      asset,
      kind: "unclassified",
      category: UNCLASSIFIED_LOCATION_NAME,
      label: UNCLASSIFIED_LOCATION_NAME,
      navUsd: unclassifiedNavUsd,
      linkTitle: null,
      link: null,
    },
  ];
};

const buildWalletAllocations = (params: {
  asset: string;
  sankey: DeltaYSankeyResponse;
  walletMetadata: DeltaYWalletMetadataResponse;
}): MidasAllocation[] => {
  const { asset, sankey, walletMetadata } = params;
  const metadataByCategory = new Map<string, { address: string }[]>();

  for (const wallet of walletMetadata.wallets) {
    const address = wallet.address?.trim();
    const category = normalizeWalletCategory(wallet.category?.trim() ?? "");

    if (!address || !isWalletLocationName(category)) continue;

    const existing = metadataByCategory.get(category) ?? [];
    existing.push({
      address,
    });
    metadataByCategory.set(category, existing);
  }

  const allocations: MidasAllocation[] = [];
  const categoryTotals = getWalletCategoryTotalsFromSankey(sankey);

  for (const category of metadataByCategory.keys()) {
    const navUsd = categoryTotals.get(category) ?? 0;

    if (navUsd <= 0) continue;

    const wallets = metadataByCategory.get(category) ?? [];

    if (wallets.length === 1) {
      const wallet = wallets[0];
      if (!wallet) continue;
      const evmAddress = isEvmAddress(wallet.address)
        ? wallet.address.toLowerCase()
        : null;

      allocations.push({
        asset,
        kind: "wallet",
        category,
        label: wallet.address,
        navUsd: 0,
        linkTitle: evmAddress ? "Debank" : null,
        link: evmAddress ? `https://debank.com/profile/${evmAddress}` : null,
      });
      continue;
    }

    for (const wallet of wallets) {
      const evmAddress = isEvmAddress(wallet.address)
        ? wallet.address.toLowerCase()
        : null;

      allocations.push({
        asset,
        kind: "wallet",
        category,
        label: wallet.address,
        navUsd: 0,
        linkTitle: evmAddress ? "Debank" : null,
        link: evmAddress ? `https://debank.com/profile/${evmAddress}` : null,
      });
    }
  }

  return allocations;
};

export const createMidasAdapter = (): Adapter<
  MidasAllocation[],
  MidasAllocation
> => {
  const vaultMetricsByAsset = new Map<string, MidasVaultMetrics>();

  return {
    id: MIDAS_PROTOCOL,
    async fetchCatalog() {
      const catalog = await fetchMidasVaultCatalog();
      vaultMetricsByAsset.clear();

      if (!Array.isArray(catalog.vaults)) {
        throw new Error("Midas API returned invalid vault catalog payload");
      }

      const allocationsByVault = await mapWithConcurrency(
        catalog.vaults,
        MIDAS_VAULT_CONCURRENCY,
        async (vault) => {
          const asset = vault.vaultMetadata?.name?.trim();
          const provider = vault.vaultMetadata?.provider?.trim();

          if (!asset) return [];
          if (provider !== MIDAS_PROVIDER_NAME) return [];

          const vaultMetrics: MidasVaultMetrics = {
            apy: vault.apy ?? null,
            navUsd: vault.navUsd ?? null,
          };
          vaultMetricsByAsset.set(asset, vaultMetrics);

          const [sankey, walletMetadata] = await Promise.all([
            fetchVaultSankey(asset),
            fetchVaultWalletMetadata(asset),
          ]);

          return [
            ...buildUnclassifiedAllocations({ asset, sankey }),
            ...buildWalletAllocations({
              asset,
              sankey,
              walletMetadata,
            }),
          ];
        },
      );

      return allocationsByVault.flat();
    },
    buildRootNode(asset, allocations) {
      const vaultMetrics = vaultMetricsByAsset.get(asset);
      const fallbackTvlUsd = allocations.reduce(
        (sum, allocation) => sum + allocation.navUsd,
        0,
      );
      const tvlUsd = vaultMetrics?.navUsd ?? fallbackTvlUsd;
      const apy = vaultMetrics?.apy ?? null;

      const primaryDeployment = getMidasPrimaryDeployment(asset);
      if (!primaryDeployment) return null;

      const node: Node = {
        id: buildCanonicalIdentity({
          chain: primaryDeployment.chain,
          protocol: MIDAS_PROTOCOL,
          address: primaryDeployment.address,
        }).id,
        chain: primaryDeployment.chain,
        name: asset,
        protocol: MIDAS_PROTOCOL,
        details: {
          kind: "Yield",
          curator: getCuratorForAsset(asset),
        },
        apy,
        tvlUsd,
      };

      return node;
    },
    getAssetByAllocations(catalog) {
      const assetByAllocations: Record<string, MidasAllocation[]> = {};

      for (const allocation of catalog) {
        const product = allocation.asset;
        if (!assetByAllocations[product]) {
          assetByAllocations[product] = [allocation];
        } else {
          assetByAllocations[product].push(allocation);
        }
      }

      return assetByAllocations;
    },
    buildEdge(root, allocationNode, allocation) {
      const edge = {
        from: root.id,
        to: allocationNode.id,
        allocationUsd: allocation.navUsd,
      };

      return edge;
    },
    async normalizeLeaves(root, allocations) {
      const nodes: Node[] = [];
      const edges: Edge[] = [];

      for (const allocation of allocations) {
        if (allocation.category === UNCLASSIFIED_LOCATION_NAME) {
          const allocationNode = buildStandaloneAllocationNode(
            allocation,
            root.chain ?? "eth",
          );

          nodes.push(allocationNode);
          edges.push(this.buildEdge(root, allocationNode, allocation));
        } else if (
          allocation.link &&
          hasDebankAccessKey() &&
          (allocation.linkTitle === "Debank" ||
            allocation.link.startsWith("https://debank.com/profile"))
        ) {
          const url = new URL(allocation.link);
          const segments = url.pathname.split("/");
          const walletAddress = segments[segments.length - 1];

          if (!walletAddress) continue;

          const results = await Promise.all([
            processComplexProtocolItem(walletAddress, root.id),
            processComplexAppItem(walletAddress, root.id),
            processTokenBalance(walletAddress, root.id),
          ]);

          for (const result of results) {
            nodes.push(...result.nodes);
            edges.push(...result.edges);
          }
        } else {
          const allocationNode = buildStandaloneAllocationNode(
            allocation,
            root.chain ?? "eth",
          );

          nodes.push(allocationNode);
          edges.push(this.buildEdge(root, allocationNode, allocation));
        }
      }

      return { nodes, edges };
    },
  };
};
