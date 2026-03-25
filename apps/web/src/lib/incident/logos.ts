/**
 * Centralized icn logo paths for all entities.
 * All icons live in /logos/icn/icn-{key}.png.
 */

const ICN = (key: string) => `/logos/icn/icn-${key}.png`;

const PROTOCOL_ICN: Record<string, string> = {
  morpho: ICN("morpho"),
  euler: ICN("euler"),
  midas: ICN("midas"),
  inverse: ICN("inversefinance"),
  fluid: ICN("fluid"),
  gearbox: ICN("gearbox"),
  venus: ICN("venusprotocol"),
  "lista-dao": ICN("listadao"),
  upshift: ICN("upshift"),
  yo: ICN("yo"),
  yields: ICN("yo"),
};

const CHAIN_ICN: Record<string, string> = {
  eth: ICN("ethereum"),
  base: ICN("base"),
  arb: ICN("arbitrum"),
  plasma: ICN("plasma"),
  bsc: ICN("bsc"),
  hyperevm: ICN("hyperevm"),
  tac: ICN("tac"),
};

const ASSET_ICN: Record<string, string> = {
  usr: ICN("usr"),
  wstusr: ICN("wstusr"),
  rlp: ICN("rlp"),
};

const CURATOR_ICN: Record<string, string> = {
  gauntlet: ICN("gauntlet"),
  "re7-labs": ICN("re7labs"),
  re7: ICN("re7labs"),
  apostro: ICN("apostro"),
  "august-digital": ICN("augustdigital"),
  august: ICN("augustdigital"),
  "mev-capital": ICN("mevcapital"),
  mevcapital: ICN("mevcapital"),
  "9summits": ICN("9summits"),
  extrafi: ICN("extrafi"),
  clearstar: ICN("clearstar"),
  kpk: ICN("kpk"),
  keyrock: ICN("keyrock"),
  seamless: ICN("seamless"),
  steakhouse: ICN("steakhouse"),
  etherealm: ICN("etherealm"),
};

const PROTOCOL_DISPLAY: Record<
  string,
  { name: string; initials: string; color: string }
> = {
  morpho: { name: "Morpho", initials: "M", color: "#2563eb" },
  euler: { name: "Euler", initials: "E", color: "#e04040" },
  midas: { name: "Midas", initials: "Mi", color: "#8b5cf6" },
  inverse: { name: "Inverse Finance", initials: "IN", color: "#000000" },
  fluid: { name: "Fluid", initials: "FL", color: "#3b82f6" },
  gearbox: { name: "Gearbox", initials: "G", color: "#4a4a4a" },
  yo: { name: "YO", initials: "YO", color: "#6366f1" },
  venus: { name: "Venus", initials: "V", color: "#f59e0b" },
  "lista-dao": { name: "Lista DAO", initials: "L", color: "#3b82f6" },
  upshift: { name: "Upshift", initials: "U", color: "#8b5cf6" },
};

const CHAIN_DISPLAY: Record<string, string> = {
  eth: "Ethereum",
  base: "Base",
  arb: "Arbitrum",
  plasma: "Plasma",
  hyperevm: "HyperEVM",
  bsc: "BSC",
  tac: "TAC",
};

export function getProtocolIcon(protocol: string): string {
  return PROTOCOL_ICN[protocol] ?? ICN(protocol);
}

export function getChainIcon(chain: string): string {
  return CHAIN_ICN[chain] ?? ICN(chain);
}

export function getAssetIcon(symbol: string): string | null {
  return ASSET_ICN[symbol.toLowerCase()] ?? null;
}

export function getProtocolDisplay(protocol: string) {
  return (
    PROTOCOL_DISPLAY[protocol] ?? {
      name: protocol.charAt(0).toUpperCase() + protocol.slice(1),
      initials: protocol.slice(0, 2).toUpperCase(),
      color: "#888",
    }
  );
}

export function getChainDisplayName(chain: string): string {
  return CHAIN_DISPLAY[chain] ?? chain.toUpperCase();
}

export function getCuratorIcon(curator: string): string | null {
  const key = curator.trim().toLowerCase().replace(/\s+/g, "");
  return CURATOR_ICN[key] ?? null;
}

/** @deprecated Use getCuratorIcon instead */
export function getCuratorLogoKey(displayName: string): string | null {
  const normalized = displayName.trim().toLowerCase().replace(/\s+/g, "");
  const mapping: Record<string, string> = {
    gauntlet: "gauntlet",
    re7: "re7-labs",
    re7labs: "re7-labs",
    mevcapital: "mev-capital",
    apostro: "apostro",
    august: "august-digital",
    augustdigital: "august-digital",
    clearstar: "clearstar",
    kpk: "kpk",
    keyrock: "keyrock",
    "9summits": "9summits",
    ninesummits: "9summits",
  };
  return mapping[normalized] ?? null;
}
