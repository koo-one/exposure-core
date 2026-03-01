import type { GraphNode } from "@/types";

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const hasLogoKeys = (value: unknown): value is { logoKeys: unknown } => {
  return isRecord(value) && "logoKeys" in value;
};

const hasDetails = (value: unknown): value is { details: unknown } => {
  return isRecord(value) && "details" in value;
};

export function normalizeLogoKey(input: string): string {
  return input.trim().toLowerCase().replace(/^w/, ""); // handle WETH -> ETH, etc
}

/**
 * Normalizes protocol names to match filenames in /logos/protocols/*.svg
 * e.g. "morpho-v1" or "morpho-v2" -> "morpho"
 */
export function normalizeProtocolKey(protocol: string): string {
  if (!protocol) return "";
  const normalized = protocol.trim().toLowerCase();
  if (normalized.startsWith("morpho")) return "morpho";
  return normalized;
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
  const key = assetId.trim().toLowerCase();
  // We optimistically return the path based on the symbol.
  // This avoids maintaining a massive hardcoded list of every SVG in the repo.
  return `/logos/assets/${key}.svg`;
}

// Keep this list in sync with apps/web/public/logos/protocols/*.svg.
const PROTOCOL_LOGO_KEYS = new Set<string>([
  "ethena",
  "euler",
  "gauntlet",
  "infinifi",
  "midas",
  "morpho",
  "resolv",
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

  const explicitLogoKeys = (() => {
    if (!hasLogoKeys(node)) return null;
    const raw = node.logoKeys;
    if (!Array.isArray(raw)) return null;
    const keys = raw.filter((v): v is string => typeof v === "string");
    return keys.length > 0 ? keys : null;
  })();

  const underlyingSymbol = (() => {
    if (!hasDetails(node)) return "";
    const details = node.details;
    if (!isRecord(details)) return "";
    const raw = details["underlyingSymbol"];
    return typeof raw === "string" ? raw.trim() : "";
  })();

  const primaryAssetKeys =
    explicitLogoKeys ?? (underlyingSymbol ? [underlyingSymbol] : null);

  if (primaryAssetKeys) {
    const assetPaths = primaryAssetKeys
      .map((k) => getAssetLogoPath(k))
      .filter((p) => typeof p === "string" && p.length > 0);

    if (node.protocol && hasProtocolLogo(node.protocol)) {
      assetPaths.push(getProtocolLogoPath(node.protocol));
    }

    if (assetPaths.length > 0) return assetPaths;
  }

  const name = node.name.trim();

  const isTokenLike = (value: string): boolean => {
    const v = value.trim();
    return /^[A-Za-z0-9.]+$/.test(v) && v.length >= 2 && v.length <= 10;
  };

  const isUpperTokenLike = (value: string): boolean => {
    const v = value.trim();
    return /^[A-Z0-9.]+$/.test(v) && v.length >= 2 && v.length <= 10;
  };

  // 1. Prefer known hyphenated single-symbol asset keys (e.g. "mf-one")
  const isLowerHyphenatedAssetKey =
    /^[a-z0-9.]+(?:-[a-z0-9.]+)+$/.test(name) && name.length <= 20;
  if (isLowerHyphenatedAssetKey) {
    return [getAssetLogoPath(name)];
  }

  // 2. Check for lending market pattern in name (e.g. "WETH/USDC" or "WETH-USDC")
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

  // 3. Try single asset logo from name if it looks like a symbol
  const isSymbolic = /^[A-Za-z0-9.]+$/.test(name) && name.length <= 10;
  if (isSymbolic) {
    const assetLogo = getAssetLogoPath(name);
    if (assetLogo) return [assetLogo];
  }

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
