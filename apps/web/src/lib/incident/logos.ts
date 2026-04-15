import {
  getAssetLogoPath,
  getChainLogoPath,
  getCuratorLogos,
  getProtocolLogoPath,
  hasChainLogo,
  hasProtocolLogo,
  inferAssetLogoKey,
  normalizeChainKey,
  normalizeProtocolKey,
} from "@/lib/logos";
import { formatChainLabel } from "@/utils/formatters";

const DEFAULT_ENTITY_COLOR = "#6b7280";

const PROTOCOL_META: Record<
  string,
  { name: string; initials: string; color: string }
> = {
  aave: { name: "Aave", initials: "A", color: "#7c3aed" },
  euler: { name: "Euler", initials: "E", color: "#e04040" },
  ethena: { name: "Ethena", initials: "ET", color: "#0ea5e9" },
  fluid: { name: "Fluid", initials: "FL", color: "#3b82f6" },
  gauntlet: { name: "Gauntlet", initials: "G", color: "#111827" },
  gearbox: { name: "Gearbox", initials: "G", color: "#4a4a4a" },
  inverse: { name: "Inverse Finance", initials: "IN", color: "#111827" },
  "lista-dao": { name: "Lista DAO", initials: "L", color: "#3b82f6" },
  midas: { name: "Midas", initials: "Mi", color: "#8b5cf6" },
  morpho: { name: "Morpho", initials: "M", color: "#2563eb" },
  pendle: { name: "Pendle", initials: "P", color: "#14b8a6" },
  resolv: { name: "Resolv", initials: "R", color: "#0ea5e9" },
  safe: { name: "Safe", initials: "S", color: "#059669" },
  sky: { name: "Sky", initials: "S", color: "#0f172a" },
  upshift: { name: "Upshift", initials: "U", color: "#8b5cf6" },
  venus: { name: "Venus", initials: "V", color: "#f59e0b" },
  yo: { name: "YO", initials: "YO", color: "#6366f1" },
  yuzu: { name: "Yuzu", initials: "Y", color: "#f97316" },
};

const CHAIN_DISPLAY: Record<string, string> = {
  arb: "Arbitrum",
  base: "Base",
  bsc: "BSC",
  eth: "Ethereum",
  global: "Global",
  hyperevm: "HyperEVM",
  plasma: "Plasma",
  tac: "TAC",
  uni: "Unichain",
};

function normalizeDisplayValue(value: string): string {
  return value
    .trim()
    .replace(/[_/:-]+/g, " ")
    .replace(/\s+/g, " ");
}

function humanizeSlug(value: string): string {
  const normalized = normalizeDisplayValue(value.toLowerCase());
  if (!normalized) return "";

  return normalized
    .split(" ")
    .filter(Boolean)
    .map((part) => {
      if (/^[a-z]{2,4}$/.test(part) && ["dao", "evm", "tac"].includes(part)) {
        return part.toUpperCase();
      }
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

export function getEntityInitials(value: string): string {
  const normalized = normalizeDisplayValue(value);
  if (!normalized) return "";

  const parts = normalized.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }

  const compact = parts[0].replace(/[^A-Za-z0-9]/g, "");
  if (!compact) return "";

  return compact.slice(0, 2).toUpperCase();
}

export function getProtocolIcon(protocol: string): string {
  const key = normalizeProtocolKey(protocol);
  return key && hasProtocolLogo(key) ? getProtocolLogoPath(key) : "";
}

export function getChainIcon(chain: string): string {
  const key = normalizeChainKey(chain);
  return key && hasChainLogo(key) ? getChainLogoPath(key) : "";
}

export function getAssetIcon(symbol: string): string | null {
  const directPath = getAssetLogoPath(symbol);
  if (directPath) return directPath;

  const inferredKey = inferAssetLogoKey(symbol);
  if (!inferredKey) return null;

  const inferredPath = getAssetLogoPath(inferredKey);
  return inferredPath || null;
}

export function getProtocolDisplay(protocol: string) {
  const key = normalizeProtocolKey(protocol);
  const known = PROTOCOL_META[key];
  if (known) return known;

  const name = humanizeSlug(key || protocol);
  return {
    name,
    initials: getEntityInitials(name || protocol),
    color: DEFAULT_ENTITY_COLOR,
  };
}

export function getChainDisplayName(chain: string): string {
  const key = normalizeChainKey(chain);
  return CHAIN_DISPLAY[key] ?? formatChainLabel(key || chain);
}

export function getCuratorIcon(curator: string): string | null {
  return getCuratorLogos(curator)[0] ?? null;
}

export function getCuratorDisplay(curator: string, protocol?: string) {
  const label = normalizeDisplayValue(curator);
  const protocolDisplay = protocol ? getProtocolDisplay(protocol) : null;
  const name = label || protocolDisplay?.name || "";

  return {
    name,
    initials: getEntityInitials(name),
    color: protocolDisplay?.color ?? DEFAULT_ENTITY_COLOR,
  };
}

/** @deprecated Use getCuratorIcon instead */
export function getCuratorLogoKey(displayName: string): string | null {
  const logoPath = getCuratorIcon(displayName);
  const match = logoPath?.match(/\/logos\/curators\/([^.]+)\.[a-z]+$/i);
  return match?.[1] ?? null;
}
