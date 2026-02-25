import type { GraphNode } from "@/types";

export function normalizeLogoKey(input: string): string {
  return input.trim().toLowerCase();
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

// Public assets under apps/web/public are served from the site root.
export function getMidasAssetLogoPath(assetId: string): string {
  return `/logos/midas/${normalizeLogoKey(assetId)}.svg`;
}

export function getProtocolLogoPath(protocol: string): string {
  return `/logos/protocols/${normalizeProtocolKey(protocol)}.svg`;
}

export function getChainLogoPath(chain: string): string {
  return `/logos/chains/${normalizeChainKey(chain)}.svg`;
}

// Keep this list in sync with apps/web/public/logos/midas/*.svg.
const MIDAS_ASSET_LOGO_KEYS = new Set<string>([
  "mapollo",
  "mbasis",
  "mbtc",
  "medge",
  "mevbtc",
  "mf-one",
  "mfarm",
  "mhyper",
  "mhyperbtc",
  "mhypereth",
  "mmev",
  "mre7btc",
  "mre7sol",
  "mre7yield",
  "msyrupusd",
  "mtbill",
  "mxrp",
]);

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

export function hasMidasAssetLogo(assetId: string): boolean {
  return MIDAS_ASSET_LOGO_KEYS.has(normalizeLogoKey(assetId));
}

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
  if (!node.protocol) return null;

  // 1. Try Midas specific asset logo
  if (node.protocol === "midas") {
    if (hasMidasAssetLogo(node.name)) {
      return getMidasAssetLogoPath(node.name);
    }
  }

  // 2. Fallback to protocol level logo
  if (hasProtocolLogo(node.protocol)) {
    return getProtocolLogoPath(node.protocol);
  }

  return null;
}

export function getFallbackMonogram(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "?";
  return trimmed.slice(0, 2).toUpperCase();
}
