import type { GraphNode } from "@/types";
import { ASSET_LOGO_KEYS } from "@/lib/generated/assetLogoKeys";

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
  if (normalized.startsWith("pendle")) return "pendle";
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
  if (!assetId) return "";
  const normalized = normalizeLogoKey(assetId);
  const key = ASSET_LOGO_KEY_ALIASES[normalized] ?? normalized;
  return ASSET_LOGO_KEYS.has(key) ? `/logos/assets/${key}.svg` : "";
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

const ASSET_LOGO_KEY_ALIASES: Record<string, string> = {
  "btc.b": "btck",
  "mc-usr": "mc_usr",
  "mf-one": "mfone",
  stkwell: "well",
  syzusd: "syusd",
  ubtc: "unibtc",
  upgammausdc: "upusdc",
  whlp: "hwhlp",
  wpol: "pol",
  yvausd: "yvvbausd",
};

const EXACT_ASSET_LOGO_KEYS: Record<string, string> = {
  aave: "aave",
  "aave token": "aave",
  axelar: "axelar",
  "axelar wrapped saga": "axelar",
  btc: "wbtc",
  "btc.b": "btck",
  compweth: "eth",
  "compounding open dollar": "cusdo",
  "dai stablecoin": "dai",
  eth: "eth",
  "gm:eth/usd[weth-usdc]": "gm",
  "eth-a": "eth",
  "eth-b": "eth",
  "eth-c": "eth",
  ethereum: "eth",
  "fluid gho token": "gho",
  "fluid tether usd": "usdt",
  "fluid usd coin": "usdc",
  "fluid usdt0": "usdt0",
  "glv [wbtc-usdc]": "glv-wbtc-usdc",
  "glv [weth-usdc]": "glv-weth-usdc",
  gho: "gho",
  "gho token": "gho",
  "liquid staked ether": "wsteth",
  "liquid staked ether 2.0": "eth",
  "lombard staked bitcoin": "lbtc",
  nusd: "snusd",
  "openeden open dollar": "cusdo",
  "paypal usd": "pyusd",
  rlusd: "rlusd",
  siusd: "iusd",
  snusd: "snusd",
  "stakedao-frxmsusd": "stakedao-frxmsusd",
  stkwell: "well",
  syzusd: "syusd",
  steth: "wsteth",
  "syrup usdc": "syrupusdc",
  "syrup usdt": "syrupusdt",
  "tether usd": "usdt",
  "usd coin": "usdc",
  "usd coin/dai stablecoin": "usdc",
  "wbtc-a": "wbtc",
  "wbtc-b": "wbtc",
  "wbtc-c": "wbtc",
  "wrapped btc": "wbtc",
  "wrapped ether": "weth",
  ubtc: "unibtc",
  ueth: "ueth",
  upgammausdc: "upusdc",
  "mc-usr": "mc_usr",
  "mf-one": "mfone",
  wpol: "pol",
  whlp: "hwhlp",
  "wsteth-a": "wsteth",
  "wsteth-b": "wsteth",
  yvausd: "yvvbausd",
};

const PT_SPECIAL_CASES: [RegExp, string][] = [
  [/\b(?:PT|YT)\s+Strata\s+Junior\s+USDe\b/i, "jrusde"],
  [/\b(?:PT|YT)\s+Strata\s+Senior\s+USDe\b/i, "srusde"],
  [/\b(?:PT|YT)\s+Staked\s+cap\s+USD\b/i, "stcusd"],
  [/\b(?:PT|YT)\s+Compounding\s+Open\s+Dollar\b/i, "cusdo"],
  [/\bYT\s+Fluid\s+USDT0\b/i, "usdt0"],
  [/\bPTs\s+USDC\b/i, "usdc"],
];

const PT_LOGO_KEY_OVERRIDES: Record<string, string> = {
  ageth: "pt-ageth",
  avusd: "pt-avusd",
  berastone: "pt-berastone",
  cusd: "pt-cusd",
  lbtc: "pt-lbtc",
  nusd: "snusd",
  sbold: "bold",
  siusd: "iusd",
  snusd: "snusd",
  usdg: "pt-usdg",
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
const WRAPPED_LP_PATTERN = /^wrapped-lp-([a-z0-9.+-]+)-\d{1,2}[a-z]{3}\d{4}$/i;

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

  const wrappedLp = compact.match(WRAPPED_LP_PATTERN)?.[1];
  if (wrappedLp) {
    const wrappedLpPt = `lp-${normalizeLogoKey(wrappedLp)}`;
    if (ASSET_LOGO_KEYS.has(wrappedLpPt)) return wrappedLpPt;

    const wrappedLpExact = EXACT_ASSET_LOGO_KEYS[wrappedLp.toLowerCase()];
    if (wrappedLpExact) return wrappedLpExact;

    const wrappedLpKey = getAssetCandidateKey(wrappedLp);
    if (wrappedLpKey) return wrappedLpKey;
  }

  const colonCandidate = compact.split(":").at(-1)?.trim() ?? "";
  const exactColon = EXACT_ASSET_LOGO_KEYS[colonCandidate.toLowerCase()];
  if (exactColon) return exactColon;
  if (!/\s/.test(colonCandidate)) {
    const colonKey = getAssetCandidateKey(colonCandidate);
    if (colonKey) return colonKey;
  }

  const words = compact
    .split(/[\s/()]+/)
    .map((part) => part.replace(/^[^A-Za-z0-9₮.+-]+|[^A-Za-z0-9₮.+-]+$/g, ""))
    .filter((part) => part.length > 0);

  const candidates = words
    .map(
      (part) =>
        EXACT_ASSET_LOGO_KEYS[part.toLowerCase()] ?? getAssetCandidateKey(part),
    )
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

function getPtSpecificLogos(name: string): string[] | null {
  const ptMarketLogos = getPtMarketLogos(name);
  if (ptMarketLogos) return ptMarketLogos;

  const ptLogo = getPtFamilyLogoPath(name);
  if (ptLogo && /^pt[-\s]/i.test(name.trim())) {
    return [ptLogo];
  }

  return null;
}

function getLogoPathsFromKeys(logoKeys: string[]): string[] {
  return logoKeys
    .map((key) => getBrandedAssetLogoPath(key) ?? getAssetLogoPath(key))
    .filter(
      (path): path is string => typeof path === "string" && path.length > 0,
    );
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
    .replace(/\([^)]*\)$/g, "")
    .replace(/-$/g, "")
    .replace(/-\d{1,2}[A-Z]{3}\d{4}(?:-\d+)?$/i, "")
    .replace(/-\d{4}\/\d{2}\/\d{2}$/i, "")
    .replace(/-\d+$/i, "")
    .trim();
}

function getPtLogoKey(name: string): string | null {
  const compact = name.trim().replace(/\s+/g, " ");
  if (!compact) return null;

  const exactPtNameKey = normalizeLogoKey(compact);
  if (ASSET_LOGO_KEYS.has(exactPtNameKey)) return exactPtNameKey;

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

  if (family.startsWith("yvvbusdc")) return "yvvbusdc";

  const exactPtFamilyKey = `pt-${family}`;
  if (ASSET_LOGO_KEYS.has(exactPtFamilyKey)) return exactPtFamilyKey;

  return (
    PT_LOGO_KEY_OVERRIDES[family] ??
    (PT_REUSABLE_LOGO_KEYS.has(family) ? family : null)
  );
}

function getPtFamilyLogoPath(name: string): string | null {
  const key = getPtLogoKey(name);
  if (!key) return null;

  const path = getAssetLogoPath(key);
  return path || null;
}

function splitMarketPair(name: string): [string, string] | null {
  const separatorIndex = name.indexOf("/");
  if (separatorIndex <= 0 || separatorIndex >= name.length - 1) return null;

  const base = name.slice(0, separatorIndex).trim();
  const quote = name.slice(separatorIndex + 1).trim();
  return base && quote ? [base, quote] : null;
}

function getGeneratedAssetBadgePath(label: string): string {
  const normalized = normalizeLogoKey(label) || "asset";
  const cleanedLabel = label.replace(/[^A-Za-z0-9+.-]+/g, "").toUpperCase();
  const text = (cleanedLabel || normalized.toUpperCase()).slice(0, 3);
  let hash = 0;
  for (const char of normalized) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  const background = `hsl(${hash} 65% 46%)`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="${background}"/><text x="32" y="37" fill="#fff" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" text-anchor="middle">${text}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function getAssetLikeLogoPath(label: string): string {
  const brandedPath = getBrandedAssetLogoPath(label);
  if (brandedPath) return brandedPath;

  const inferredPath = getInferredAssetLogoPath(label);
  if (inferredPath) return inferredPath;

  if (PT_SEGMENT_PATTERN.test(label)) {
    return getPtFamilyLogoPath(label) ?? "";
  }

  const normalized = normalizeLogoKey(label);
  return isNormalizedTokenLike(normalized, 20)
    ? getGeneratedAssetBadgePath(label)
    : "";
}

function getPtMarketLogos(name: string): string[] | null {
  const parts = splitMarketPair(name);
  if (!parts) return null;

  const [baseRaw, quoteRaw] = parts;
  if (!baseRaw || !quoteRaw) return null;

  const baseLogo = getAssetLikeLogoPath(baseRaw);
  const quoteLogo = getAssetLikeLogoPath(quoteRaw);

  if (PT_SEGMENT_PATTERN.test(quoteRaw)) {
    const ptLogo = getPtFamilyLogoPath(quoteRaw);
    if (baseLogo && ptLogo) return [baseLogo, ptLogo];
  }

  if (PT_SEGMENT_PATTERN.test(baseRaw)) {
    const ptLogo = getPtFamilyLogoPath(baseRaw);
    if (ptLogo && quoteLogo) return [ptLogo, quoteLogo];
  }

  if (baseLogo && quoteLogo) {
    return [baseLogo, quoteLogo];
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
  "pendle",
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
  node:
    | GraphNode
    | {
        name: string;
        protocol?: string | null;
        displayName?: string;
        logoKeys?: string[];
      },
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
    | {
        name: string;
        protocol?: string | null;
        displayName?: string;
        logoKeys?: string[];
      },
): string[] {
  const name = node.name.trim();
  const lowerName = name.toLowerCase();
  const normalizedAssetName = normalizeLogoKey(name);

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

    const ptSpecificLogos = getPtSpecificLogos(node.name);
    if (ptSpecificLogos && !hasOnlyGenericPtLogoKeys) return ptSpecificLogos;

    if (hasOnlyGenericPtLogoKeys) {
      if (ptSpecificLogos) return ptSpecificLogos;
    }

    const paths = getLogoPathsFromKeys(logoKeys);
    if (paths.length > 0) return paths;
  }

  const ptSpecificLogos = getPtSpecificLogos(name);
  if (ptSpecificLogos) return ptSpecificLogos;

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

  const chainLogoPath =
    CHAIN_LOGO_KEYS.has(normalizeChainKey(name)) &&
    !ASSET_LOGO_KEYS.has(normalizedAssetName)
      ? getChainLogoPath(name)
      : "";
  if (chainLogoPath) {
    return [chainLogoPath];
  }

  if (lowerName === "mf-one") {
    const path = getAssetLogoPath(lowerName);
    if (path) return [path];
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
    const path = getAssetLogoPath(name);
    if (path) return [path];
  }

  // 2. Check for lending market pattern in name (e.g. "WETH/USDC" or "WETH-USDC")
  const slashParts = splitMarketPair(name);
  if (slashParts) {
    const [base, quote] = slashParts;
    if (isTokenLike(base) && isTokenLike(quote)) {
      const paths = [
        getAssetLikeLogoPath(base),
        getAssetLikeLogoPath(quote),
      ].filter((path): path is string => path.length > 0);
      if (paths.length > 0) return paths;
    }
  }

  // Only treat dash-delimited pairs as markets when both sides look like symbols.
  const dashParts = name.split("-");
  if (dashParts.length === 2) {
    const [base, quote] = dashParts;
    if (isUpperTokenLike(base) && isUpperTokenLike(quote)) {
      const paths = [getAssetLogoPath(base), getAssetLogoPath(quote)].filter(
        (path): path is string => path.length > 0,
      );
      if (paths.length > 0) return paths;
    }
  }

  // 3. Try single asset logo inference from name
  const assetLogo = getInferredAssetLogoPath(name);
  if (assetLogo) return [assetLogo];

  // 4. Fallback to protocol level logo
  if (node.protocol && hasProtocolLogo(node.protocol)) {
    return [getProtocolLogoPath(node.protocol)];
  }

  return [];
}

export function getFallbackMonogram(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "?";
  return trimmed.slice(0, 2).toUpperCase();
}
