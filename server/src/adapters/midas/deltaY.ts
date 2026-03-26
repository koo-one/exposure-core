import { fetchJsonOrThrow } from "../../utils.js";

export interface DeltaYVaultsResponse {
  vaults: {
    vaultMetadata?: {
      name?: string;
      provider?: string;
    };
    apy?: number | null;
    navUsd?: number | null;
  }[];
}

export interface DeltaYSankeyResponse {
  data: {
    navUsd?: number;
    dimensions?: {
      locationName?: string;
      chainId?: string;
    };
  }[];
}

export interface DeltaYWalletMetadataResponse {
  wallets: {
    address?: string;
    category?: string | null;
  }[];
}

export const MIDAS_PROVIDER_NAME = "Midas";
export const MIDAS_API_BASE_URL = "https://api-midas.deltay.xyz";
export const MIDAS_VAULTS_URL = `${MIDAS_API_BASE_URL}/vaults`;

export const WALLET_LOCATION_NAMES = [
  "Onchain Wallets",
  "Liquidity Buffer",
  "Assets To be Deployed",
] as const;

export const UNCLASSIFIED_LOCATION_NAME = "Unclassified";

export const normalizeWalletCategory = (value: string): string => {
  if (value === "Available Liquidity Buffer") return "Liquidity Buffer";
  if (value === "To be Deployed Assets") return "Assets To be Deployed";
  return value;
};

export const isWalletLocationName = (value: string): boolean => {
  return WALLET_LOCATION_NAMES.includes(
    normalizeWalletCategory(value) as (typeof WALLET_LOCATION_NAMES)[number],
  );
};

export const toLocationSlug = (value: string): string => {
  return normalizeWalletCategory(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export const isEvmAddress = (value: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
};

export const buildVaultBaseUrl = (asset: string): string => {
  return `${MIDAS_API_BASE_URL}/vaults/${encodeURIComponent(asset)}`;
};

export const fetchMidasVaultCatalog =
  async (): Promise<DeltaYVaultsResponse> => {
    return fetchJsonOrThrow<DeltaYVaultsResponse>(MIDAS_VAULTS_URL, {
      errorContext: "Midas API",
    });
  };

export const fetchVaultSankey = async (
  asset: string,
): Promise<DeltaYSankeyResponse> => {
  return fetchJsonOrThrow<DeltaYSankeyResponse>(
    `${buildVaultBaseUrl(asset)}/sankey`,
    {
      errorContext: "Midas API",
    },
  );
};

export const fetchVaultWalletMetadata = async (
  asset: string,
): Promise<DeltaYWalletMetadataResponse> => {
  return fetchJsonOrThrow<DeltaYWalletMetadataResponse>(
    `${buildVaultBaseUrl(asset)}/wallets-metadata`,
    {
      errorContext: "Midas API",
    },
  );
};

export const getWalletCategoryTotalsFromSankey = (
  sankey: DeltaYSankeyResponse,
): Map<string, number> => {
  const totals = new Map<string, number>();

  for (const row of sankey.data) {
    const locationName = normalizeWalletCategory(
      row.dimensions?.locationName?.trim() ?? "",
    );
    const navUsd = row.navUsd ?? 0;

    if (!isWalletLocationName(locationName) || navUsd <= 0) continue;

    totals.set(locationName, (totals.get(locationName) ?? 0) + navUsd);
  }

  return totals;
};
