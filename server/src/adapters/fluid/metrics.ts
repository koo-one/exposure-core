import { zeroAddress } from "viem";

export interface FluidChainConfig {
  chainId: number;
  chainKey: string;
}

export const FLUID_CHAIN_CONFIGS: readonly FluidChainConfig[] = [
  { chainId: 1, chainKey: "eth" },
  { chainId: 42161, chainKey: "arb" },
  { chainId: 8453, chainKey: "base" },
  { chainId: 9745, chainKey: "plasma" },
  { chainId: 56, chainKey: "bsc" },
  { chainId: 137, chainKey: "polygon" },
];

// ── Raw API response types ──

export interface FluidTokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  price: string;
  chainId: string;
  logoUrl?: string;
  coingeckoId?: string;
  stakingApr?: string;
}

/** Supply/borrow token can be a single token (token0 only) or a DEX pair (token0 + token1). */
export interface FluidTokenPair {
  token0: FluidTokenInfo;
  token1?: { address: string } & Partial<FluidTokenInfo>;
}

export interface FluidVaultRaw {
  id: string;
  type: string; // "1"=simple, "2"=DEX collateral, "3"=DEX debt, "4"=DEX both
  address: string;
  supplyToken: FluidTokenPair;
  borrowToken: FluidTokenPair;
  totalSupply: string;
  totalBorrow: string;
  collateralFactor: number;
  liquidationThreshold: number;
  totalPositions: string;
  supplyRate: {
    vault: { rate: string };
  };
  borrowRate: {
    vault: { rate: string };
  };
  rewards?: { token: FluidTokenInfo; apr: string }[];
  metadata?: { pegged?: boolean };
}

// ── Parsed types ──

export interface FluidVault {
  id: string;
  type: number;
  address: string;
  chainKey: string;
  supplySymbol: string;
  borrowSymbol: string;
  supplyTokens: FluidTokenInfo[];
  borrowTokens: FluidTokenInfo[];
  totalSupplyUsd: number;
  totalBorrowUsd: number;
  supplyApr: number;
  borrowApr: number;
  collateralFactor: number;
  totalPositions: number;
}

const isValidToken = (
  token: { address: string } & Partial<FluidTokenInfo>,
): token is FluidTokenInfo =>
  token.address !== zeroAddress && token.symbol !== undefined;

const tokenAmountToUsd = (
  raw: string,
  decimals: number,
  price: string,
): number => {
  const amount = Number(BigInt(raw)) / 10 ** decimals;
  return amount * Number(price);
};

/**
 * For DEX-type vaults (type 2/3/4), supply or borrow has two tokens.
 * DEX pair amounts are denominated in 18 decimals (LP shares),
 * not the individual token decimals. Use token0 price for USD conversion.
 */
const computeUsd = (rawAmount: string, tokenPair: FluidTokenPair): number => {
  const t0 = tokenPair.token0;
  if (!isValidToken(t0)) return 0;
  const t1 =
    tokenPair.token1 && isValidToken(tokenPair.token1)
      ? tokenPair.token1
      : null;
  // DEX pairs use 18-decimal LP shares; single tokens use their own decimals
  const decimals = t1 ? 18 : t0.decimals;
  return tokenAmountToUsd(rawAmount, decimals, t0.price);
};

const buildSymbol = (pair: FluidTokenPair): string => {
  const t0 = isValidToken(pair.token0) ? pair.token0.symbol : null;
  const t1 =
    pair.token1 && isValidToken(pair.token1) ? pair.token1.symbol : null;
  if (t0 && t1) return `${t0}-${t1}`;
  return t0 ?? "?";
};

const collectTokens = (pair: FluidTokenPair): FluidTokenInfo[] => {
  const tokens: FluidTokenInfo[] = [];
  if (isValidToken(pair.token0)) tokens.push(pair.token0);
  if (pair.token1 && isValidToken(pair.token1)) tokens.push(pair.token1);
  return tokens;
};

const parseVault = (raw: FluidVaultRaw, chainKey: string): FluidVault => ({
  id: raw.id,
  type: Number(raw.type),
  address: raw.address.toLowerCase(),
  chainKey,
  supplySymbol: buildSymbol(raw.supplyToken),
  borrowSymbol: buildSymbol(raw.borrowToken),
  supplyTokens: collectTokens(raw.supplyToken),
  borrowTokens: collectTokens(raw.borrowToken),
  totalSupplyUsd: computeUsd(raw.totalSupply, raw.supplyToken),
  totalBorrowUsd: computeUsd(raw.totalBorrow, raw.borrowToken),
  supplyApr: Number(raw.supplyRate?.vault?.rate ?? 0) / 100,
  borrowApr: Number(raw.borrowRate?.vault?.rate ?? 0) / 100,
  collateralFactor: raw.collateralFactor,
  totalPositions: Number(raw.totalPositions),
});

const API_BASE = "https://api.fluid.instadapp.io/v2";

export const fetchFluidVaults = async (
  config: FluidChainConfig,
): Promise<FluidVault[]> => {
  const url = `${API_BASE}/${config.chainId}/vaults`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Fluid vaults fetch failed for ${config.chainKey}:${config.chainId} (${response.status})`,
    );
  }

  const raw: FluidVaultRaw[] = await response.json();
  return raw.map((v) => parseVault(v, config.chainKey));
};
