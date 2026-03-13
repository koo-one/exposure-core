import type { MockFetchHandler } from "../core/mock-fetch";
import { jsonResponse } from "../core/mock-fetch";
import {
  isWalletLocationName,
  MIDAS_PROVIDER_NAME,
  normalizeWalletCategory,
  toLocationSlug,
  WALLET_LOCATION_NAMES,
} from "../../../src/adapters/midas/deltaY";

export interface MidasAllocationFixture {
  product?: string;
  firstLevelAllocation?: string | null;
  secondLevelAllocation?: string | null;
  amount?: string | null;
  link?: string | null;
}

const parseDebankProfileAddress = (
  link: string | null | undefined,
): string | null => {
  if (!link || !link.includes("debank.com/profile")) return null;

  try {
    const url = new URL(link);
    const segments = url.pathname.split("/");
    const addr = segments[segments.length - 1]?.toLowerCase() ?? "";
    return addr.startsWith("0x") ? addr : null;
  } catch {
    return null;
  }
};

const getVaultRows = (allocations: MidasAllocationFixture[], asset: string) => {
  return allocations.filter((row) => row.product === asset);
};

const sumUsdFromAmount = (value: string | null | undefined): number => {
  return Number(value ?? 0) * 1000;
};

const createVaultsPayload = (allocations: MidasAllocationFixture[]) => {
  const totalsByAsset = new Map<string, number>();

  for (const row of allocations) {
    const asset = row.product?.trim();
    if (!asset) continue;

    totalsByAsset.set(
      asset,
      (totalsByAsset.get(asset) ?? 0) + sumUsdFromAmount(row.amount),
    );
  }

  return {
    vaults: Array.from(totalsByAsset.entries()).map(([asset, navUsd]) => ({
      vaultMetadata: { name: asset, provider: MIDAS_PROVIDER_NAME },
      navUsd,
    })),
  };
};

const createSankeyPayload = (
  allocations: MidasAllocationFixture[],
  asset: string,
) => {
  const totalsByLocation = new Map<string, number>();

  for (const row of getVaultRows(allocations, asset)) {
    const firstLevel = normalizeWalletCategory(
      row.firstLevelAllocation?.trim() ?? "",
    );
    const secondLevel = row.secondLevelAllocation?.trim() ?? "";

    let locationName = "";
    if (isWalletLocationName(firstLevel)) {
      locationName = firstLevel;
    } else if (
      firstLevel === "Exchanges" ||
      firstLevel === "Offchain Collateral"
    ) {
      locationName = secondLevel || firstLevel;
    }

    if (!locationName) continue;

    totalsByLocation.set(
      locationName,
      (totalsByLocation.get(locationName) ?? 0) + sumUsdFromAmount(row.amount),
    );
  }

  return {
    vault: { name: asset },
    data: Array.from(totalsByLocation.entries()).map(
      ([locationName, navUsd]) => ({
        navUsd,
        dimensions: {
          vaultName: asset,
          locationName,
          chainId: "unclassified",
        },
      }),
    ),
  };
};

const createWalletsMetadataPayload = (
  allocations: MidasAllocationFixture[],
  asset: string,
) => {
  const seen = new Set<string>();
  const wallets = [] as {
    address: string;
    category: string;
    description: string | null;
  }[];

  for (const row of getVaultRows(allocations, asset)) {
    const category = normalizeWalletCategory(
      row.firstLevelAllocation?.trim() ?? "",
    );
    if (!isWalletLocationName(category)) continue;

    const address = parseDebankProfileAddress(row.link);
    if (!address) continue;

    const description = row.secondLevelAllocation?.trim() || null;
    const key = `${category}:${address}`;
    if (seen.has(key)) continue;
    seen.add(key);

    wallets.push({ address, category, description });
  }

  return { wallets };
};

const createLocationTokensPayload = (
  allocations: MidasAllocationFixture[],
  asset: string,
  category: string,
) => {
  const tokenSnapshots = getVaultRows(allocations, asset)
    .filter(
      (row) =>
        normalizeWalletCategory(row.firstLevelAllocation?.trim() ?? "") ===
        category,
    )
    .map((row) => ({
      assetsUsd: sumUsdFromAmount(row.amount),
      liabilitiesUsd: 0,
      blockchains: [],
      allocator: {
        address:
          parseDebankProfileAddress(row.link) ??
          row.secondLevelAllocation?.trim() ??
          "",
        category: null,
        description: row.secondLevelAllocation?.trim() || null,
      },
      token: {
        symbol: "fixture",
        logoUrl: null,
        description: null,
      },
      allocation: 0,
      historicalNav: [],
    }));

  return {
    vault: { name: asset },
    location: { name: category, logoUrl: "Icon_Wallet", description: null },
    tokenSnapshots,
  };
};

export const createMidasAllocationsHandler = (config: {
  allocations: MidasAllocationFixture[];
}): MockFetchHandler => {
  const { allocations } = config;

  return async (url) => {
    const parsed = new URL(url);

    if (parsed.origin !== "https://api-midas.deltay.xyz") return null;

    const parts = parsed.pathname.split("/").filter(Boolean);

    if (parts.length === 1 && parts[0] === "vaults") {
      return jsonResponse(createVaultsPayload(allocations));
    }

    if (parts.length >= 2 && parts[0] === "vaults") {
      const asset = decodeURIComponent(parts[1]);

      if (parts.length === 3 && parts[2] === "sankey") {
        return jsonResponse(createSankeyPayload(allocations, asset));
      }

      if (parts.length === 3 && parts[2] === "wallets-metadata") {
        return jsonResponse(createWalletsMetadataPayload(allocations, asset));
      }

      if (
        parts.length === 5 &&
        parts[2] === "locations" &&
        parts[4] === "tokens"
      ) {
        const category = Array.from(WALLET_LOCATION_NAMES).find(
          (name) => toLocationSlug(name) === parts[3],
        );

        if (!category) return null;

        return jsonResponse(
          createLocationTokensPayload(allocations, asset, category),
        );
      }
    }

    return null;
  };
};
