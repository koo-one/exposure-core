import { normalizeProtocol, roundToTwoDecimals, toSlug } from "../../utils.js";
import { buildCanonicalIdentity } from "../../core/canonicalIdentity.js";
import type { TokenObject } from "./fetcher.js";

const EXACT_ASSET_LOGO_KEYS: Record<string, string> = {
  eth: "eth",
  "gho token": "ghotoken",
  "liquid staked ether 2.0": "eth",
  "lombard staked bitcoin": "lbtc",
  "paypal usd": "pyusd",
  rlusd: "rlusd",
  "syrup usdc": "syrupusdc",
  "syrup usdt": "syrupusdt",
  "tether usd": "usdt",
  "usd coin": "usdc",
  "wrapped btc": "wbtc",
  "wrapped ether": "weth",
};

const PT_SPECIAL_CASES: [RegExp, string][] = [
  [/\bPT\s+Strata\s+Junior\s+USDe\b/i, "jrusde"],
  [/\bPT\s+Strata\s+Senior\s+USDe\b/i, "srusde"],
  [/\bPT\s+Staked\s+cap\s+USD\b/i, "stcusd"],
  [/\bPT\s+Compounding\s+Open\s+Dollar\b/i, "cusdo"],
  [/\bPTs\s+USDC\b/i, "usdc"],
];

const PT_LOGO_KEY_OVERRIDES: Record<string, string> = {
  ageth: "pt-ageth",
  berastone: "pt-berastone",
  lbtc: "pt-lbtc",
  susde: "pt-susde",
  teth: "pt-teth",
  usde: "pt-usde",
};

const PT_REUSABLE_LOGO_KEYS = new Set<string>([
  "alusd",
  "cusdo",
  "ebtc",
  "hbusdt",
  "jrusde",
  "khype",
  "mapollo",
  "medge",
  "mhyper",
  "reusd",
  "rlp",
  "rusd",
  "savusd",
  "srnusd",
  "srusde",
  "stcusd",
  "sts",
  "susdai",
  "susn",
  "syrupusdt",
  "thbill",
  "usdai",
  "usdc",
  "usds",
  "usr",
  "wstkscusd",
  "wstusr",
  "xusd",
  "yoeth",
  "yousd",
  "yusd",
]);

const PT_HYPHENATED_PATTERN = /(?:^|[/\s])(?:e)?PT-([^/\s]+)/i;
const PT_SPACED_PATTERN = /\bPT\s+([A-Za-z0-9.+]+)(?:\s+vault\b|\s+\d|$)/i;

export const normalizeLogoKey = (input: string): string => {
  return input
    .trim()
    .toLowerCase()
    .replace(/₮/g, "t")
    .replace(/[^a-z0-9.+-]+/g, "");
};

const normalizePtFamilyKey = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
};

const stripPtDateSuffix = (value: string): string => {
  return value
    .trim()
    .replace(/-\d{1,2}[A-Z]{3}\d{4}(?:-\d+)?$/i, "")
    .replace(/-\d{4}\/\d{2}\/\d{2}$/i, "")
    .replace(/\([^)]*\)$/g, "")
    .replace(/-\d+$/i, "")
    .trim();
};

export const inferAssetLogoKey = (raw: string): string | null => {
  const value = raw.trim();
  if (!value) return null;

  for (const [pattern, key] of PT_SPECIAL_CASES) {
    if (pattern.test(value)) return key;
  }

  const rawPtFamily =
    value.match(PT_HYPHENATED_PATTERN)?.[1] ??
    value.match(PT_SPACED_PATTERN)?.[1] ??
    null;
  if (rawPtFamily) {
    const family = normalizePtFamilyKey(stripPtDateSuffix(rawPtFamily));
    if (family) {
      return (
        PT_LOGO_KEY_OVERRIDES[family] ??
        (PT_REUSABLE_LOGO_KEYS.has(family) ? family : "pt")
      );
    }
  }

  const exact = EXACT_ASSET_LOGO_KEYS[value.toLowerCase()];
  if (exact) return exact;

  const normalized = normalizeLogoKey(value);
  return normalized.length > 0 ? normalized : null;
};

export const inferTokenLogoKey = (token: TokenObject | null): string | null => {
  if (!token) return null;

  const candidates = [
    token.name,
    token.display_symbol,
    token.symbol,
    token.optimized_symbol,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const key = inferAssetLogoKey(candidate);
    if (key) return key;
  }

  return null;
};

export const resolveTokenProtocolNamespace = (
  token: TokenObject | null,
): string => {
  const explicitProtocol = resolveDebankProtocolNamespace(
    token?.protocol_id ?? "",
    token?.chain ?? "",
  );
  if (explicitProtocol) return explicitProtocol;

  const inferredProtocol = token ? inferTokenLogoKey(token) : null;
  if (inferredProtocol) return inferredProtocol;

  return "token";
};

export const resolveDebankProtocolNamespace = (
  protocol: string,
  chain?: string | null,
): string => {
  const rawProtocol = toSlug(protocol);
  const rawChain = toSlug(chain ?? "");

  if (!rawProtocol) return "";
  if (!rawChain) return normalizeProtocol(rawProtocol);

  const duplicatedChainPrefix = `${rawChain}-`;
  const withoutChainPrefix = rawProtocol.startsWith(duplicatedChainPrefix)
    ? rawProtocol.slice(duplicatedChainPrefix.length)
    : rawProtocol;

  return normalizeProtocol(withoutChainPrefix);
};

export const resolveTokenLogoKeys = (token: TokenObject | null): string[] => {
  const key = inferTokenLogoKey(token);
  return key ? [key] : [];
};

export const buildProtocolListItemId = (
  chain: string,
  protocol: string,
  resourceId: string,
  positionIndex?: string,
): string => {
  return buildCanonicalIdentity({
    chain,
    protocol: resolveDebankProtocolNamespace(protocol, chain),
    resourceId,
    resourceParts: positionIndex ? [positionIndex] : [],
  }).id;
};

export const buildLendingPositionAssetId = (params: {
  chain: string;
  token: TokenObject | null;
}): string => {
  const { chain, token } = params;
  const tokenChain = token?.chain?.trim() || chain;
  const tokenProtocol = resolveTokenProtocolNamespace(token);
  const tokenId = token?.id?.trim() || "";
  const stableAddress = /^0x[a-f0-9]{40}$/i.test(tokenId) ? tokenId : null;
  const fallbackLabel =
    token?.symbol?.trim() ||
    token?.optimized_symbol?.trim() ||
    token?.display_symbol?.trim() ||
    token?.name?.trim() ||
    "unknown";

  return buildCanonicalIdentity({
    chain: tokenChain,
    protocol: tokenProtocol,
    address: stableAddress,
    resourceParts: stableAddress ? [] : ["token", fallbackLabel],
  }).id;
};

export const buildAppListItemId = (
  protocol: string,
  description: string,
  resourceId1: string,
  resourceId2?: string,
): string => {
  return buildCanonicalIdentity({
    protocol,
    includeChain: false,
    resourceId: description,
    resourceParts: [resourceId1, resourceId2 ?? null],
  }).id;
};

export const tokenToUsdValue = (token: TokenObject): number => {
  const amount = token.amount ?? 0;
  const price = token.price ?? 0;
  const value = amount * price;

  return roundToTwoDecimals(value);
};

const MIN_ALLOCATION_USD = 100;

export const isAllocationUsdEligible = (allocUsd: number): boolean => {
  if (allocUsd < MIN_ALLOCATION_USD) return false;

  return true;
};
