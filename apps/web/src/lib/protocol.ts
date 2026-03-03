import { GraphNode } from "@/types";
import { getAddress } from "viem";

export const extractHexAddress = (id: string): string | null => {
  const parts = id.split(":");
  const candidate = (parts[parts.length - 1] ?? "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(candidate)) return null;

  try {
    return getAddress(candidate);
  } catch {
    return null;
  }
};

export const extractHexBytes32 = (id: string): string | null => {
  const parts = id.split(":");
  const candidate = (parts[parts.length - 1] ?? "").trim();
  return /^0x[a-fA-F0-9]{64}$/.test(candidate) ? candidate : null;
};

export const slugify = (input: string): string =>
  input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");

export const morphoChainPath = (chain: string): string => {
  const c = chain.trim().toLowerCase();
  const chainMap: Record<string, string> = {
    eth: "ethereum",
    ethereum: "ethereum",
    arb: "arbitrum",
    arbitrum: "arbitrum",
    "arbitrum-one": "arbitrum",
    op: "optimism",
    optimism: "optimism",
    matic: "polygon",
    polygon: "polygon",
    base: "base",
  };
  return chainMap[c] ?? c;
};

export const chainMeta = (
  chain: string,
): {
  chainId: number;
  eulerNetwork: string;
  explorerBase: string;
} | null => {
  const c = chain.trim().toLowerCase();
  if (c === "ethereum" || c === "eth")
    return {
      chainId: 1,
      eulerNetwork: "ethereum",
      explorerBase: "https://etherscan.io",
    };
  if (c === "arbitrum" || c === "arb" || c === "arbitrum-one")
    return {
      chainId: 42161,
      eulerNetwork: "arbitrum",
      explorerBase: "https://arbiscan.io",
    };
  if (c === "optimism" || c === "op")
    return {
      chainId: 10,
      eulerNetwork: "optimism",
      explorerBase: "https://optimistic.etherscan.io",
    };
  if (c === "base")
    return {
      chainId: 8453,
      eulerNetwork: "base",
      explorerBase: "https://basescan.org",
    };
  if (c === "polygon" || c === "matic")
    return {
      chainId: 137,
      eulerNetwork: "polygon",
      explorerBase: "https://polygonscan.com",
    };
  return null;
};

const protocolUrlBuilders: {
  match: (protocol: string) => boolean;
  build: (node: GraphNode) => string | null;
}[] = [
  {
    match: (protocol) => protocol.includes("ethena"),
    build: () => "https://app.ethena.fi/",
  },
  {
    match: (protocol) => protocol.includes("gauntlet"),
    build: () => "https://app.gauntlet.xyz/vaults/gtusda",
  },
  {
    match: (protocol) => protocol.includes("infinifi"),
    build: () => "https://app.infinifi.xyz/deposit",
  },
  {
    match: (protocol) => protocol.includes("midas"),
    build: (node) => {
      const parts = node.id.split(":");
      const candidate = (parts[parts.length - 1] ?? "").trim();
      const key = slugify(candidate);
      return key ? `https://midas.app/${key}` : "https://midas.app/";
    },
  },
  {
    match: (protocol) => protocol.includes("resolv"),
    build: () => "https://app.resolv.xyz/overview",
  },
  {
    match: (protocol) => protocol.includes("sky"),
    build: () => "https://app.sky.money/?network=ethereum",
  },
  {
    match: (protocol) => protocol.includes("yuzu"),
    build: () => "https://app.yuzu.money/",
  },
  {
    match: (protocol) => protocol.includes("morpho"),
    build: (node) => {
      const chainPath = morphoChainPath(
        typeof node.chain === "string" ? node.chain : "",
      );
      if (!chainPath) return null;

      const kind = (node.details?.kind ?? "").trim().toLowerCase();

      if (kind === "lending market") {
        const marketId = extractHexBytes32(node.id);
        if (!marketId) return null;

        const slug = (() => {
          const parts = (node.name ?? "").split("/").map((p) => p.trim());
          if (parts.length === 2 && parts[0] && parts[1]) {
            return slugify(`${parts[1]}-${parts[0]}`);
          }
          return slugify(node.name ?? "");
        })();

        return `https://app.morpho.org/${chainPath}/market/${marketId}/${slug}`;
      }

      const addr = extractHexAddress(node.id);
      if (!addr) return null;

      const slug = slugify(node.name ?? "");
      return `https://app.morpho.org/${chainPath}/vault/${addr}/${slug}`;
    },
  },
  {
    match: (protocol) => protocol.includes("euler"),
    build: (node) => {
      const chain = typeof node.chain === "string" ? node.chain : "";
      const meta = chainMeta(chain);
      if (!meta) return null;

      const addr = extractHexAddress(node.id);
      if (!addr) return null;

      const network = encodeURIComponent(meta.eulerNetwork);
      const name = (node.name ?? "").trim().toLowerCase();

      const isEulerEarn = name.includes("euler earn");
      if (isEulerEarn) {
        return `https://app.euler.finance/earn/${addr}?network=${network}`;
      }

      return `https://app.euler.finance/vault/${addr}?chainid=${meta.chainId}&network=${network}`;
    },
  },
];

export const getProtocolAppUrl = (node: GraphNode): string | null => {
  const protocol = (node.protocol ?? "").trim().toLowerCase();
  if (!protocol) return null;

  const builder = protocolUrlBuilders.find((entry) => entry.match(protocol));
  if (!builder) return null;

  return builder.build(node);
};

export const getExplorerUrl = (node: GraphNode): string | null => {
  const addr = extractHexAddress(node.id);
  if (!addr) return null;

  const chain = typeof node.chain === "string" ? node.chain : "";
  const meta = chainMeta(chain);
  if (!meta) return null;

  return `${meta.explorerBase}/address/${addr}`;
};

export const getProtocolAuditUrl = (node: GraphNode): string | null => {
  const protocol = (node.protocol ?? "").trim().toLowerCase();
  if (protocol.includes("euler"))
    return "https://docs.euler.finance/security/audits";
  if (protocol.includes("ethena"))
    return "https://docs.ethena.fi/resources/audits";
  return null;
};
