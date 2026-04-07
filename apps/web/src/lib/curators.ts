export interface CuratorProfileLinks {
  twitter?: string;
}

const CURATOR_PROFILE_LINKS: Record<string, CuratorProfileLinks> = {
  alphagrowth: {
    twitter: "https://twitter.com/alphagrowth1",
  },
  alphaping: {
    twitter: "https://x.com/__AlphaPING__",
  },
  api3: {
    twitter: "https://x.com/api3dao",
  },
  "9summits": {
    twitter: "https://twitter.com/9summits_io",
  },
  anthiaslabs: {
    twitter: "https://x.com/anthiasxyz",
  },
  apollocrypto: {
    twitter: "https://twitter.com/ApolloCryptoAu",
  },
  apostro: {
    twitter: "https://twitter.com/apostroxyz",
  },
  augustdigital: {
    twitter: "https://x.com/august_digital",
  },
  avantgarde: {
    twitter: "https://twitter.com/avantgardefi",
  },
  clearstar: {
    twitter: "https://twitter.com/clearstarlabs",
  },
  cozyfinance: {
    twitter: "https://x.com/cozyfinance",
  },
  edgeultrayield: {
    twitter: "https://x.com/ultrayieldapp",
  },
  eulerdao: {
    twitter: "https://twitter.com/eulerfinance",
  },
  felix: {
    twitter: "https://x.com/felixprotocol",
  },
  steakhousefinancial: {
    twitter: "https://x.com/SteakhouseFi",
  },
  flowdesk: {},
  fasanaracapital: {},
  infinifi: {
    twitter: "https://x.com/infiniFi",
  },
  k3capital: {
    twitter: "https://x.com/k3_capital",
  },
  keyring: {
    twitter: "https://twitter.com/KEYRING_PRO",
  },
  keyrock: {
    twitter: "https://x.com/KeyrockTrading",
  },
  kpk: {
    twitter: "https://x.com/kpk_io",
  },
  re7labs: {
    twitter: "https://x.com/Re7Labs",
  },
  re7capital: {
    twitter: "https://x.com/Re7Labs",
  },
  mevcapital: {
    twitter: "https://x.com/mevcapital?lang=en",
  },
  ouroboroscapital: {
    twitter: "https://x.com/ouroboroscap8",
  },
  gauntlet: {
    twitter: "https://twitter.com/gauntlet_xyz",
  },
  hyperithm: {
    twitter: "https://twitter.com/hyperithm",
  },
  pangolins: {
    twitter: "https://x.com/pangolindex",
  },
  blockanalitica: {
    twitter: "https://twitter.com/BlockAnalitica",
  },
  bprotocol: {
    twitter: "https://twitter.com/bprotocoleth",
  },
  resolv: {
    twitter: "https://x.com/resolvfinance",
  },
  rockawayx: {
    twitter: "https://x.com/Rockaway_X",
  },
  skymoney: {
    twitter: "https://x.com/SkyMoney",
  },
  stakedao: {
    twitter: "https://twitter.com/StakeDAOHQ",
  },
  yearn: {
    twitter: "https://twitter.com/yearnfi",
  },
  ultrayield: {
    twitter: "https://x.com/ultrayieldapp",
  },
};

function normalizeCuratorLookupKey(curator: string): string {
  return curator
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

export function getCuratorProfileLinks(
  curator?: string | null,
): CuratorProfileLinks | null {
  if (!curator) return null;
  return CURATOR_PROFILE_LINKS[normalizeCuratorLookupKey(curator)] ?? null;
}

export function getCuratorPrimaryUrl(curator?: string | null): string | null {
  const links = getCuratorProfileLinks(curator);
  return links?.twitter ?? null;
}
