import type { Edge, Node } from "../../types.js";
import {
  processComplexAppItem,
  processComplexProtocolItem,
} from "../../resolvers/debank/debankResolver.js";
import { hasDebankAccessKey, toSlug } from "../../utils.js";
import { buildCanonicalIdentity } from "../../core/canonicalIdentity.js";
import {
  buildVaultBaseUrl,
  buildVaultLocationTokensUrl,
  type DeltaYLocationTokensResponse,
  type DeltaYSankeyResponse,
  type DeltaYVaultsResponse,
  type DeltaYWalletMetadataResponse,
  isEvmAddress,
  isWalletLocationName,
  MIDAS_PROVIDER_NAME,
  MIDAS_VAULTS_URL,
  normalizeWalletCategory,
  OFFCHAIN_LOCATION_NAMES,
} from "./deltaY.js";
import { getCuratorForAsset } from "./curators.js";
import { getMidasPrimaryDeployment } from "./deployments.js";
import type { Adapter } from "../types.js";

const MIDAS_PROTOCOL = "midas" as const;

export interface MidasAllocation {
  createdAt: string;
  updatedAt: string;
  id: number;
  product: string;
  firstLevelAllocation: string;
  secondLevelAllocation: string | null;
  thirdLevelAllocation: string | null;
  amount: string;
  linkTitle: string | null;
  link: string | null;
  asOfDate: string | null;
}

const toAmountString = (navUsd: number): string => {
  return String(navUsd / 1000);
};

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
  const name =
    allocation.secondLevelAllocation?.trim() || "Unspecified Allocation";

  return {
    id: buildCanonicalIdentity({
      chain,
      protocol: MIDAS_PROTOCOL,
      forcedSource: allocation.secondLevelAllocation?.trim()
        ? "fallback-name"
        : "fallback-unknown",
      fallbackName: allocation.secondLevelAllocation?.trim() || null,
      resourceId: allocation.secondLevelAllocation?.trim() || null,
      resourceParts: allocation.secondLevelAllocation?.trim()
        ? []
        : [`midas-unlinked-alloc-${allocation.id}`],
    }).id,
    name,
    details: { kind: "Investment" },
  };
};

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Midas API error: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<T>;
};

const fetchOptionalJson = async <T>(url: string): Promise<T | null> => {
  const response = await fetch(url);

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(
      `Midas API error: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<T>;
};

const buildDirectAllocations = (params: {
  asset: string;
  sankey: DeltaYSankeyResponse;
  fetchedAt: string;
  nextId: () => number;
}): MidasAllocation[] => {
  const { asset, sankey, fetchedAt, nextId } = params;
  const totalsByLocation = new Map<string, number>();

  for (const row of sankey.data) {
    const locationName = row.dimensions?.locationName?.trim();
    const navUsd = row.navUsd ?? 0;

    if (!locationName || navUsd <= 0) continue;
    if (isWalletLocationName(locationName)) continue;

    totalsByLocation.set(
      locationName,
      (totalsByLocation.get(locationName) ?? 0) + navUsd,
    );
  }

  return Array.from(totalsByLocation.entries()).map(
    ([locationName, navUsd]) => ({
      createdAt: fetchedAt,
      updatedAt: fetchedAt,
      id: nextId(),
      product: asset,
      firstLevelAllocation: OFFCHAIN_LOCATION_NAMES.has(locationName)
        ? "Offchain Collateral"
        : "Exchanges",
      secondLevelAllocation: locationName,
      thirdLevelAllocation: null,
      amount: toAmountString(navUsd),
      linkTitle: null,
      link: null,
      asOfDate: fetchedAt.slice(0, 10),
    }),
  );
};

const buildWalletAllocations = (params: {
  asset: string;
  walletMetadata: DeltaYWalletMetadataResponse;
  walletTokenSnapshotsByCategory: Map<
    string,
    DeltaYLocationTokensResponse | null
  >;
  fetchedAt: string;
  nextId: () => number;
}): MidasAllocation[] => {
  const {
    asset,
    walletMetadata,
    walletTokenSnapshotsByCategory,
    fetchedAt,
    nextId,
  } = params;

  const metadataByAddress = new Map<
    string,
    { description: string | null; category: string }
  >();

  for (const wallet of walletMetadata.wallets) {
    const address = wallet.address?.trim();
    const category = normalizeWalletCategory(wallet.category?.trim() ?? "");

    if (!address || !isWalletLocationName(category)) continue;

    metadataByAddress.set(address.toLowerCase(), {
      description: wallet.description?.trim() ?? null,
      category,
    });
  }

  const allocations: MidasAllocation[] = [];

  for (const [category, payload] of walletTokenSnapshotsByCategory.entries()) {
    if (!payload) continue;

    const totalsByWallet = new Map<
      string,
      { address: string; description: string | null; navUsd: number }
    >();

    for (const snapshot of payload.tokenSnapshots) {
      const address = snapshot.allocator?.address?.trim();
      const navUsd = snapshot.assetsUsd ?? 0;

      if (!address || navUsd <= 0) continue;

      const key = address.toLowerCase();
      const metadata = metadataByAddress.get(key);
      const description =
        metadata?.description ??
        snapshot.allocator?.description?.trim() ??
        address;
      const current = totalsByWallet.get(key);

      if (current) {
        current.navUsd += navUsd;
      } else {
        totalsByWallet.set(key, { address, description, navUsd });
      }
    }

    for (const { address, description, navUsd } of totalsByWallet.values()) {
      const evmAddress = isEvmAddress(address) ? address.toLowerCase() : null;

      allocations.push({
        createdAt: fetchedAt,
        updatedAt: fetchedAt,
        id: nextId(),
        product: asset,
        firstLevelAllocation: category,
        secondLevelAllocation: description,
        thirdLevelAllocation: null,
        amount: toAmountString(navUsd),
        linkTitle: evmAddress ? "Debank" : null,
        link: evmAddress ? `https://debank.com/profile/${evmAddress}` : null,
        asOfDate: fetchedAt.slice(0, 10),
      });
    }
  }

  return allocations;
};

export const createMidasAdapter = (): Adapter<
  MidasAllocation[],
  MidasAllocation
> => {
  return {
    id: MIDAS_PROTOCOL,
    async fetchCatalog() {
      const fetchedAt = new Date().toISOString();
      const catalog = await fetchJson<DeltaYVaultsResponse>(MIDAS_VAULTS_URL);

      if (!Array.isArray(catalog.vaults)) {
        throw new Error("Midas API returned invalid vault catalog payload");
      }

      let nextIdValue = 1;
      const nextId = () => nextIdValue++;

      const allocationsByVault = await mapWithConcurrency(
        catalog.vaults,
        MIDAS_VAULT_CONCURRENCY,
        async (vault) => {
          const asset = vault.vaultMetadata?.name?.trim();
          const provider = vault.vaultMetadata?.provider?.trim();

          if (!asset) return [];
          if (provider !== MIDAS_PROVIDER_NAME) return [];

          const baseUrl = buildVaultBaseUrl(asset);
          const [
            sankey,
            walletMetadata,
            onchainWallets,
            liquidityBuffer,
            assetsToBeDeployed,
          ] = await Promise.all([
            fetchJson<DeltaYSankeyResponse>(`${baseUrl}/sankey`),
            fetchJson<DeltaYWalletMetadataResponse>(
              `${baseUrl}/wallets-metadata`,
            ),
            fetchOptionalJson<DeltaYLocationTokensResponse>(
              buildVaultLocationTokensUrl(asset, "Onchain Wallets"),
            ),
            fetchOptionalJson<DeltaYLocationTokensResponse>(
              buildVaultLocationTokensUrl(asset, "Liquidity Buffer"),
            ),
            fetchOptionalJson<DeltaYLocationTokensResponse>(
              buildVaultLocationTokensUrl(asset, "Assets To be Deployed"),
            ),
          ]);

          return [
            ...buildDirectAllocations({ asset, sankey, fetchedAt, nextId }),
            ...buildWalletAllocations({
              asset,
              walletMetadata,
              walletTokenSnapshotsByCategory: new Map([
                ["Onchain Wallets", onchainWallets],
                ["Liquidity Buffer", liquidityBuffer],
                ["Assets To be Deployed", assetsToBeDeployed],
              ]),
              fetchedAt,
              nextId,
            }),
          ];
        },
      );

      return allocationsByVault.flat();
    },
    buildRootNode(asset, allocations) {
      const tvlUsd = allocations.reduce(
        (sum, allocation) => sum + Number(allocation.amount) * 1000,
        0,
      );

      const primaryDeployment = getMidasPrimaryDeployment(asset);
      const chain = primaryDeployment?.chain ?? "eth";
      const address = primaryDeployment?.address ?? toSlug(asset);

      const node: Node = {
        id: buildCanonicalIdentity({
          chain,
          protocol: MIDAS_PROTOCOL,
          address,
        }).id,
        chain,
        name: asset,
        protocol: MIDAS_PROTOCOL,
        details: {
          kind: "Yield",
          curator: getCuratorForAsset(asset),
        },
        apy: null,
        tvlUsd,
      };

      return node;
    },
    getAssetByAllocations(catalog) {
      const assetByAllocations: Record<string, MidasAllocation[]> = {};

      for (const allocation of catalog) {
        const product = allocation.product;
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
        allocationUsd: Number(allocation.amount) * 1000,
      };

      return edge;
    },
    async normalizeLeaves(root, allocations) {
      const nodes: Node[] = [];
      const edges: Edge[] = [];

      for (const allocation of allocations) {
        if (
          allocation.firstLevelAllocation === "Exchanges" ||
          allocation.firstLevelAllocation === "Offchain Collateral"
        ) {
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
