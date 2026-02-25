import type { GraphNode } from "@/types";

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
  node: GraphNode | { name: string; protocol?: string | null },
): string[] {
  const logos: string[] = [];

  // 1. Check for lending market pattern in name (e.g. "WETH/USDC" or "WETH-USDC")
  const marketParts = node.name.split(/[/-]/);
  if (marketParts.length >= 2 && marketParts.length <= 3) {
    const logo1 = getAssetLogoPath(marketParts[0]);
    const logo2 = getAssetLogoPath(marketParts[1]);

    if (logo1) logos.push(logo1);
    if (logo2) logos.push(logo2);

    if (logos.length >= 2) return logos;
  }

  // 2. Try single asset logo from name if it looks like a symbol
  const isSymbolic =
    /^[A-Za-z0-9.]+$/.test(node.name) && node.name.length <= 10;
  if (isSymbolic) {
    const assetLogo = getAssetLogoPath(node.name);
    if (assetLogo) return [assetLogo];
  }

  // 3. Fallback to protocol level logo
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
