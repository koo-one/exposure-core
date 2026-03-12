import type { GraphNode } from "@/types";

export function normalizeLogoKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/₮/g, "t")
    .replace(/[^a-z0-9.+-]+/g, "");
}

/**
 * Normalizes protocol names to match filenames in /logos/protocols/*.svg
 * e.g. "morpho-v1" or "morpho-v2" -> "morpho"
 */
export function normalizeProtocolKey(protocol: string): string {
  if (!protocol) return "";
  let normalized = protocol.trim().toLowerCase();
  normalized = normalized.replace(/\s+/g, " ");
  normalized = normalized.replace(/\s+\d+$/, "");
  if (normalized.startsWith("morpho")) return "morpho";
  if (normalized === "fireblock") return "fireblocks";
  return normalized.replace(/\s+/g, "-");
}

/**
 * Normalizes chain names for /logos/chains/*.svg
 */
export function normalizeChainKey(chain: string): string {
  if (!chain) return "";
  const normalized = chain.trim().toLowerCase();

  if (normalized === "ethereum") return "eth";
  if (normalized === "arbitrum") return "arb";
  if (normalized === "unichain") return "uni";

  return normalized;
}

export function getProtocolLogoPath(protocol: string): string {
  return `/logos/protocols/${normalizeProtocolKey(protocol)}.svg`;
}

export function getChainLogoPath(chain: string): string {
  return `/logos/chains/${normalizeChainKey(chain)}.svg`;
}

export function getAssetLogoPath(assetId: string): string {
  if (!assetId || assetId.length > 20) return "";
  const key = normalizeLogoKey(assetId);
  // We optimistically return the path based on the symbol.
  // This avoids maintaining a massive hardcoded list of every SVG in the repo.
  return `/logos/assets/${key}.svg`;
}

const ASSET_NAME_STOPWORDS = new Set<string>([
  "account",
  "alpha",
  "balanced",
  "cash",
  "core",
  "degen",
  "ecosystem",
  "financial",
  "frontier",
  "global",
  "high",
  "highyield",
  "instant",
  "liquid",
  "main",
  "og",
  "perps",
  "position",
  "prime",
  "reactor",
  "spot",
  "value",
  "vault",
  "v1",
  "v2",
  "withdrawable",
  "x",
  "yield",
]);

const EXACT_ASSET_LOGO_KEYS: Record<string, string> = {
  eth: "eth",
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

const GENERIC_PT_LOGO_KEY = "pt";

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
const PT_SEGMENT_PATTERN = /(?:^|\s)(?:e)?PT[-\s]/i;
const TERM_ASSET_PATTERN = /^l([A-Za-z0-9.+]+)-\d+[dwmy]$/i;

function isNormalizedTokenLike(value: string, maxLength = 14): boolean {
  return (
    /^[a-z0-9.+-]+$/.test(value) &&
    value.length >= 2 &&
    value.length <= maxLength
  );
}

function getAssetCandidateKey(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const termAsset = trimmed.match(TERM_ASSET_PATTERN)?.[1];
  const normalized = normalizeLogoKey(termAsset ?? trimmed);
  if (!isNormalizedTokenLike(normalized)) return null;
  if (ASSET_NAME_STOPWORDS.has(normalized)) return null;

  const looksAssetLike =
    /₮/.test(trimmed) ||
    /\d/.test(trimmed) ||
    /[A-Z]{2,}/.test(trimmed) ||
    /[a-z][A-Z]/.test(trimmed);
  return looksAssetLike ? normalized : null;
}

function getBrandedAssetLogoKey(name: string): string | null {
  const compact = name.trim().replace(/\s+/g, " ");
  if (!compact) return null;

  const exact = EXACT_ASSET_LOGO_KEYS[compact.toLowerCase()];
  if (exact) return exact;

  const colonCandidate = compact.split(":").at(-1)?.trim() ?? "";
  const colonKey = getAssetCandidateKey(colonCandidate);
  if (colonKey) return colonKey;

  const words = compact
    .split(/[\s/()]+/)
    .map((part) => part.replace(/^[^A-Za-z0-9₮.+-]+|[^A-Za-z0-9₮.+-]+$/g, ""))
    .filter((part) => part.length > 0);

  const candidates = words
    .map((part) => getAssetCandidateKey(part))
    .filter((value): value is string => Boolean(value));

  return candidates.length > 0 ? candidates[candidates.length - 1] : null;
}

export function inferAssetLogoKey(name: string): string | null {
  const ptKey = getPtLogoKey(name);
  if (ptKey) return ptKey;

  const brandedKey = getBrandedAssetLogoKey(name);
  if (brandedKey) return brandedKey;

  const normalized = normalizeLogoKey(name);
  return isNormalizedTokenLike(normalized, 14) ? normalized : null;
}

function getBrandedAssetLogoPath(name: string): string | null {
  const key = getBrandedAssetLogoKey(name);
  return key ? getAssetLogoPath(key) : null;
}

function getInferredAssetLogoPath(name: string): string | null {
  const key = inferAssetLogoKey(name);
  return key ? getAssetLogoPath(key) : null;
}

function normalizePtFamilyKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function stripPtDateSuffix(value: string): string {
  return value
    .trim()
    .replace(/-\d{1,2}[A-Z]{3}\d{4}(?:-\d+)?$/i, "")
    .replace(/-\d{4}\/\d{2}\/\d{2}$/i, "")
    .replace(/\([^)]*\)$/g, "")
    .replace(/-\d+$/i, "")
    .trim();
}

function getPtLogoKey(name: string): string | null {
  const compact = name.trim().replace(/\s+/g, " ");
  if (!compact) return null;

  for (const [pattern, key] of PT_SPECIAL_CASES) {
    if (pattern.test(compact)) return key;
  }

  const rawFamily =
    compact.match(PT_HYPHENATED_PATTERN)?.[1] ??
    compact.match(PT_SPACED_PATTERN)?.[1] ??
    null;
  if (!rawFamily) return null;

  const family = normalizePtFamilyKey(stripPtDateSuffix(rawFamily));
  if (!family) return null;

  return (
    PT_LOGO_KEY_OVERRIDES[family] ??
    (PT_REUSABLE_LOGO_KEYS.has(family) ? family : GENERIC_PT_LOGO_KEY)
  );
}

function getPtFamilyLogoPath(name: string): string | null {
  const key = getPtLogoKey(name);
  if (!key) return null;

  const path = getAssetLogoPath(key);
  return path || null;
}

function getPtMarketLogos(name: string): string[] | null {
  const parts = name.split("/");
  if (parts.length !== 2) return null;

  const [baseRaw, quoteRaw] = parts.map((part) => part.trim());
  if (!baseRaw || !quoteRaw) return null;

  const isTokenLike = (value: string): boolean => {
    return isNormalizedTokenLike(normalizeLogoKey(value));
  };

  const baseLogo = isTokenLike(baseRaw) ? getAssetLogoPath(baseRaw) : "";

  if (PT_SEGMENT_PATTERN.test(quoteRaw)) {
    const ptLogo = getPtFamilyLogoPath(quoteRaw);
    if (baseLogo && ptLogo) return [baseLogo, ptLogo];
  }

  if (PT_SEGMENT_PATTERN.test(baseRaw)) {
    const ptLogo = getPtFamilyLogoPath(baseRaw);
    const quoteLogo = isTokenLike(quoteRaw) ? getAssetLogoPath(quoteRaw) : "";
    if (ptLogo && quoteLogo) return [ptLogo, quoteLogo];
  }

  const baseBrandedLogo = getBrandedAssetLogoPath(baseRaw);
  const quoteBrandedLogo = getBrandedAssetLogoPath(quoteRaw);
  if (baseBrandedLogo && quoteBrandedLogo) {
    return [baseBrandedLogo, quoteBrandedLogo];
  }

  return null;
}

// Keep this list in sync with apps/web/public/logos/protocols/*.svg.
const PROTOCOL_LOGO_KEYS = new Set<string>([
  "aster",
  "asterdex",
  "binance",
  "bybit",
  "ethena",
  "euler",
  "fireblocks",
  "fordefi",
  "gauntlet",
  "hyperliquid",
  "infinifi",
  "lighter",
  "midas",
  "morpho",
  "okx",
  "prime-broker",
  "resolv",
  "safe",
  "sky",
  "yuzu",
]);

// Prepare for upcoming chain logos in /logos/chains/*.svg.
const CHAIN_LOGO_KEYS = new Set<string>([
  "eth",
  "arb",
  "base",
  "plasma",
  "uni",
]);

export function hasProtocolLogo(protocol?: string | null): boolean {
  if (!protocol) return false;
  return PROTOCOL_LOGO_KEYS.has(normalizeProtocolKey(protocol));
}

export function hasChainLogo(chain?: string | null): chain is string {
  if (!chain) return false;
  return CHAIN_LOGO_KEYS.has(normalizeChainKey(chain));
}

export function getNodeLogoPath(
  node: GraphNode | { name: string; protocol?: string | null },
): string | null {
  const logos = getNodeLogos(node);
  return logos.length > 0 ? logos[0] : null;
}

/**
 * Returns an array of logo paths for a node.
 * If it's a lending market (e.g. "WETH/USDC"), it may return two logos.
 */
export function getNodeLogos(
  node:
    | GraphNode
    | { name: string; protocol?: string | null; logoKeys?: string[] },
): string[] {
  const logos: string[] = [];

  const logoKeys = (() => {
    if (typeof node !== "object" || node == null) return null;
    if (!("logoKeys" in node)) return null;
    const raw = (node as { logoKeys?: unknown }).logoKeys;
    if (!Array.isArray(raw)) return null;
    const keys = raw.filter((v): v is string => typeof v === "string");
    return keys.length > 0 ? keys : null;
  })();

  if (logoKeys) {
    const hasOnlyGenericPtLogoKeys = logoKeys.every((key) => {
      const normalized = key.trim().toLowerCase();
      return normalized === "pt" || normalized === "pendle";
    });

    if (hasOnlyGenericPtLogoKeys) {
      const ptLogo = getPtFamilyLogoPath(node.name);
      if (ptLogo) return [ptLogo];
    }

    const paths = logoKeys
      .map((k) => getAssetLogoPath(k))
      .filter((p) => typeof p === "string" && p.length > 0);
    if (paths.length > 0) return paths;
  }

  const underlyingSymbol = (() => {
    if (typeof node !== "object" || node == null) return null;
    if (!("details" in node)) return null;
    const details = (node as { details?: unknown }).details;
    if (!details || typeof details !== "object") return null;
    if (!("underlyingSymbol" in details)) return null;
    const value = (details as { underlyingSymbol?: unknown }).underlyingSymbol;
    const symbol = typeof value === "string" ? value.trim() : "";
    return symbol ? symbol : null;
  })();

  const displayName = (() => {
    if (typeof node !== "object" || node == null) return null;
    if (!("displayName" in node)) return null;
    const value = (node as { displayName?: unknown }).displayName;
    const display = typeof value === "string" ? value.trim() : "";
    return display ? display : null;
  })();

  if (underlyingSymbol) {
    const assetLogo = getInferredAssetLogoPath(underlyingSymbol);
    if (assetLogo) return [assetLogo];
  }

  if (displayName) {
    const assetLogo = getInferredAssetLogoPath(displayName);
    if (assetLogo) return [assetLogo];
  }

  const name = node.name.trim();
  const lowerName = name.toLowerCase();

  if (lowerName === "mf-one") {
    return [getAssetLogoPath(lowerName)];
  }

  const isTokenLike = (value: string): boolean => {
    return isNormalizedTokenLike(normalizeLogoKey(value), 10);
  };

  const isUpperTokenLike = (value: string): boolean => {
    const normalized = normalizeLogoKey(value);
    return (
      isNormalizedTokenLike(normalized, 10) &&
      /^[A-Z0-9.₮]+$/.test(value.trim())
    );
  };

  const protocolCandidate = (() => {
    if (name.includes(":")) return name.split(":")[0]?.trim() ?? "";
    return name;
  })();

  if (protocolCandidate && hasProtocolLogo(protocolCandidate)) {
    return [getProtocolLogoPath(protocolCandidate)];
  }

  // 1. Prefer known hyphenated single-symbol asset keys (e.g. "mf-one")
  const isLowerHyphenatedAssetKey =
    /^[a-z0-9.]+(?:-[a-z0-9.]+)+$/.test(name) && name.length <= 20;
  if (isLowerHyphenatedAssetKey) {
    return [getAssetLogoPath(name)];
  }

  // 2. Check for lending market pattern in name (e.g. "WETH/USDC" or "WETH-USDC")
  const ptMarketLogos = getPtMarketLogos(name);
  if (ptMarketLogos) return ptMarketLogos;

  const slashParts = name.split("/");
  if (slashParts.length === 2) {
    const [base, quote] = slashParts;
    if (isTokenLike(base) && isTokenLike(quote)) {
      return [getAssetLogoPath(base), getAssetLogoPath(quote)];
    }
  }

  // Only treat dash-delimited pairs as markets when both sides look like symbols.
  const dashParts = name.split("-");
  if (dashParts.length === 2) {
    const [base, quote] = dashParts;
    if (isUpperTokenLike(base) && isUpperTokenLike(quote)) {
      return [getAssetLogoPath(base), getAssetLogoPath(quote)];
    }
  }

  // 3. Try single asset logo inference from name
  const assetLogo = getInferredAssetLogoPath(name);
  if (assetLogo) return [assetLogo];

  // 4. Fallback to protocol level logo
  if (node.protocol && hasProtocolLogo(node.protocol)) {
    return [getProtocolLogoPath(node.protocol)];
  }

  return logos;
}

export function getFallbackMonogram(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "?";
  return trimmed.slice(0, 2).toUpperCase();
}
