export interface DeltaYVaultsResponse {
  vaults: {
    vaultMetadata?: {
      name?: string;
      provider?: string;
    };
  }[];
}

export interface DeltaYSankeyResponse {
  data: {
    navUsd?: number;
    dimensions?: {
      locationName?: string;
    };
  }[];
}

export interface DeltaYWalletMetadataResponse {
  wallets: {
    address?: string;
    category?: string | null;
    description?: string | null;
  }[];
}

export interface DeltaYLocationTokensResponse {
  tokenSnapshots: {
    assetsUsd?: number;
    allocator?: {
      address?: string;
      description?: string | null;
    };
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

export const OFFCHAIN_LOCATION_NAMES = new Set([
  "MIDAS",
  "Settlement Funds In Process",
  "Unclassified",
]);

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

export const buildVaultLocationTokensUrl = (
  asset: string,
  locationName: string,
): string => {
  return `${buildVaultBaseUrl(asset)}/locations/${toLocationSlug(locationName)}/tokens`;
};
