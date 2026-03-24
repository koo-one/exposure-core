import { roundToTwoDecimals } from "../../utils.js";
import { buildCanonicalIdentity } from "../../core/canonicalIdentity.js";
import type { MorphoAllocation } from "./types.js";

export const MORPHO_API_URL = "https://api.morpho.org/graphql";

export const buildMorphoVaultId = (
  chain: string,
  version: "v1" | "v2",
  address: string,
): string =>
  buildCanonicalIdentity({
    chain,
    protocol: `morpho-${version}`,
    vaultAddress: address,
  }).id;

export const buildMorphoMarketId = (
  chain: string,
  version: "v1" | "v2",
  uniqueKey: string,
): string => {
  return buildCanonicalIdentity({
    chain,
    protocol: `morpho-${version}`,
    marketId: uniqueKey,
  }).id;
};

export const resolveAllocationUsd = (allocation: MorphoAllocation): number => {
  if (allocation.supplyAssetsUsd != null) return allocation.supplyAssetsUsd;

  const loanAsset = allocation.market.loanAsset;

  if (!loanAsset) return 0;

  const assets = Number(allocation.supplyAssets ?? 0);
  const decimals = loanAsset.decimals ?? 0;
  const price = loanAsset.priceUsd ?? 0;
  const normalized = assets / Math.pow(10, decimals);
  const value = normalized * price;

  return roundToTwoDecimals(value);
};
