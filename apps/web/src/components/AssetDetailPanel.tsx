"use client";

import { GraphNode, GraphEdge } from "@/types";
import {
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Info,
  ExternalLink,
  ArrowLeft,
  RotateCcw,
} from "lucide-react";
import { useMemo } from "react";
import {
  getNodeLogos,
  getProtocolLogoPath,
  hasProtocolLogo,
  hasChainLogo,
  getChainLogoPath,
} from "@/lib/logos";
import { currencyFormatter, percentFormatter } from "@/utils/formatters";
import Link from "next/link";
import Image from "next/image";
import { getAddress } from "viem";

interface AssetDetailPanelProps {
  selectedNode: GraphNode | null;
  edges: GraphEdge[];
  nodes: GraphNode[];
  rootNodeId?: string;
  originId?: string;
  tvl?: number | null;
  onReset?: () => void;
}

const extractHexAddress = (id: string): string | null => {
  const parts = id.split(":");
  const candidate = (parts[parts.length - 1] ?? "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(candidate)) return null;

  // Euler app routing appears to expect a checksummed address in the URL path.
  try {
    return getAddress(candidate);
  } catch (error) {
    console.warn("Invalid address for external link:", candidate, error);
    return null;
  }
};

const extractHexBytes32 = (id: string): string | null => {
  const parts = id.split(":");
  const candidate = (parts[parts.length - 1] ?? "").trim();
  return /^0x[a-fA-F0-9]{64}$/.test(candidate) ? candidate : null;
};

const slugify = (input: string): string =>
  input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");

const normalizeGraphId = (id: string): string => id.trim().toLowerCase();

const morphoChainPath = (chain: string): string => {
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

const chainMeta = (
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

      // Morpho markets use the bytes32 market id as identifier.
      if (kind === "lending market") {
        const marketId = extractHexBytes32(node.id);
        if (!marketId) return null;

        const slug = (() => {
          // Morpho UI slugs for markets appear to use collateral-loan order.
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

      // Euler has distinct app routes for Earn vaults vs EVK vaults.
      // Example expected by product: https://app.euler.finance/earn/<vaultAddress>?network=base
      const isEulerEarn = name.includes("euler earn");
      if (isEulerEarn) {
        return `https://app.euler.finance/earn/${addr}?network=${network}`;
      }

      return `https://app.euler.finance/vault/${addr}?chainid=${meta.chainId}&network=${network}`;
    },
  },
];

const getProtocolAppUrl = (node: GraphNode): string | null => {
  const protocol = (node.protocol ?? "").trim().toLowerCase();
  if (!protocol) return null;

  const builder = protocolUrlBuilders.find((entry) => entry.match(protocol));
  if (!builder) return null;

  return builder.build(node);
};

const getExplorerUrl = (node: GraphNode): string | null => {
  const addr = extractHexAddress(node.id);
  if (!addr) return null;

  const chain = typeof node.chain === "string" ? node.chain : "";
  const meta = chainMeta(chain);
  if (!meta) return null;

  return `${meta.explorerBase}/address/${addr}`;
};

const getProtocolAuditUrl = (node: GraphNode): string | null => {
  const protocol = (node.protocol ?? "").trim().toLowerCase();
  if (protocol.includes("euler"))
    return "https://docs.euler.finance/security/audits";
  if (protocol.includes("ethena"))
    return "https://docs.ethena.fi/resources/audits";
  return null;
};

export default function AssetDetailPanel({
  selectedNode,
  edges,
  nodes,
  rootNodeId,
  originId,
  tvl,
  onReset,
}: AssetDetailPanelProps) {
  if (!selectedNode) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-black/20 p-12 text-center bg-white border-l border-black">
        <div className="w-16 h-16 bg-black/5 rounded-full flex items-center justify-center mb-8 border border-black/5">
          <Info className="w-8 h-8 opacity-20" />
        </div>
        <h3 className="text-black font-black uppercase tracking-[0.2em] text-[10px] mb-2">
          No Node Selection
        </h3>
        <p className="text-[11px] font-medium leading-relaxed max-w-[200px]">
          Initialize analysis by selecting a data node from the distribution
          map.
        </p>
      </div>
    );
  }

  const totalIncoming = edges
    .filter((e) => e.to === selectedNode.id)
    .reduce((acc, e) => acc + e.allocationUsd, 0);

  const nodesById = useMemo(() => {
    const map = new Map<string, GraphNode>();
    for (const n of nodes) {
      map.set(normalizeGraphId(n.id), n);
    }
    return map;
  }, [nodes]);

  const edgesByFrom = useMemo(() => {
    const map = new Map<string, GraphEdge[]>();
    for (const edge of edges) {
      const fromId = normalizeGraphId(edge.from);
      const list = map.get(fromId);
      if (list) list.push(edge);
      else map.set(fromId, [edge]);
    }
    return map;
  }, [edges]);

  const selectedKind = (selectedNode.details?.kind ?? "").trim().toLowerCase();
  const selectedSubtype =
    typeof selectedNode.details?.subtype === "string"
      ? selectedNode.details.subtype.trim().toLowerCase()
      : "";
  const isVaultLike =
    selectedKind === "yield" || selectedSubtype.includes("vault");

  const marketExposure = useMemo(() => {
    if (!isVaultLike) return null;

    const outgoing = edgesByFrom.get(normalizeGraphId(selectedNode.id)) ?? [];
    if (outgoing.length === 0) return null;

    const isMarket = (id: string): boolean => {
      const node = nodesById.get(normalizeGraphId(id));
      const kind = (node?.details?.kind ?? "").trim().toLowerCase();
      return kind === "lending market";
    };

    const direct: { id: string; name: string; usd: number }[] = [];
    const indirectByMarket = new Map<string, { name: string; usd: number }>();

    for (const e of outgoing) {
      const toId = e.to;
      const toNode = nodesById.get(normalizeGraphId(toId));
      const allocUsd = Math.abs(e.allocationUsd);
      if (!Number.isFinite(allocUsd) || allocUsd <= 0) continue;

      if (isMarket(toId)) {
        direct.push({
          id: toId,
          name: toNode?.name ?? toId,
          usd: allocUsd,
        });
        continue;
      }

      // Indirect exposure: selected vault -> intermediate -> market.
      const childOutgoing = edgesByFrom.get(normalizeGraphId(toId)) ?? [];
      if (childOutgoing.length === 0) continue;

      const marketEdges = childOutgoing.filter((x) => isMarket(x.to));
      if (marketEdges.length === 0) continue;

      const childTotal = childOutgoing.reduce(
        (sum, x) => sum + Math.abs(x.allocationUsd),
        0,
      );
      if (!childTotal) continue;

      for (const me of marketEdges) {
        const weight = Math.abs(me.allocationUsd) / childTotal;
        const impliedUsd = allocUsd * weight;
        if (!Number.isFinite(impliedUsd) || impliedUsd <= 0) continue;

        const marketId = me.to;
        const marketNode = nodesById.get(normalizeGraphId(marketId));
        const name = marketNode?.name ?? marketId;
        const prev = indirectByMarket.get(marketId);
        indirectByMarket.set(marketId, {
          name,
          usd: (prev?.usd ?? 0) + impliedUsd,
        });
      }
    }

    direct.sort((a, b) => b.usd - a.usd);
    const indirect = Array.from(indirectByMarket.entries())
      .map(([id, v]) => ({ id, name: v.name, usd: v.usd }))
      .sort((a, b) => b.usd - a.usd);

    if (direct.length === 0 && indirect.length === 0) return null;

    return {
      direct: direct.slice(0, 5),
      indirect: indirect.slice(0, 5),
    };
  }, [selectedNode, isVaultLike, edgesByFrom, nodesById]);

  const rootOutgoingTotal = (() => {
    if (!rootNodeId) return 0;
    const outgoingFromRoot = edges.filter((e) => e.from === rootNodeId);
    return outgoingFromRoot.reduce(
      (sum, e) => sum + Math.abs(e.allocationUsd),
      0,
    );
  })();

  const shareOfAllocationMap = rootOutgoingTotal
    ? totalIncoming / rootOutgoingTotal
    : 0;

  const apyForDisplay =
    typeof selectedNode.apy === "number"
      ? selectedNode.apy > 1
        ? selectedNode.apy / 100
        : selectedNode.apy
      : null;

  const protocolLabel = (() => {
    if (!selectedNode.protocol) return "UNKNOWN";
    const p = selectedNode.protocol.toLowerCase();
    if (p.includes("morpho-v1")) return "MORPHO V1";
    if (p.includes("morpho-v2")) return "MORPHO V2";
    return selectedNode.protocol.toUpperCase();
  })();

  const subtypeLabel =
    typeof selectedNode.details?.subtype === "string"
      ? selectedNode.details.subtype.trim()
      : "";

  const logoPaths = getNodeLogos(selectedNode);
  const protocolFallbackPath =
    selectedNode.protocol && hasProtocolLogo(selectedNode.protocol)
      ? getProtocolLogoPath(selectedNode.protocol)
      : "";
  const chainLogoPath = hasChainLogo(selectedNode.chain)
    ? getChainLogoPath(selectedNode.chain)
    : null;

  const protocolAppUrl = getProtocolAppUrl(selectedNode);
  const protocolAuditUrl = getProtocolAuditUrl(selectedNode);
  const explorerUrl = getExplorerUrl(selectedNode);
  const primaryExternalUrl = protocolAppUrl ?? explorerUrl;

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden border-l border-black pb-12">
      {/* Institutional Header */}
      <div className="p-10 border-b border-black/5 bg-gradient-to-b from-black/[0.02] to-transparent">
        <div className="flex items-center gap-6 mb-8">
          {onReset && (
            <button
              onClick={onReset}
              className="flex items-center gap-2 text-[10px] font-black text-black hover:opacity-60 transition-all uppercase tracking-[0.2em] group"
            >
              <ArrowLeft className="w-3 h-3 transform group-hover:-translate-x-1 transition-transform" />
              Navigate Parent
            </button>
          )}
          {originId && (
            <Link
              href={`/asset/${encodeURIComponent(originId)}`}
              className="flex items-center gap-2 text-[10px] font-black text-black/40 hover:text-black transition-all uppercase tracking-[0.2em] group border-l border-black/10 pl-6"
            >
              <RotateCcw className="w-3 h-3 transform group-hover:rotate-[-45deg] transition-transform" />
              Reset Origin
            </Link>
          )}
        </div>

        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0 flex items-center -space-x-4 relative">
              {logoPaths.length > 0 ? (
                logoPaths.map((logoPath, idx) => (
                  <div
                    key={logoPath}
                    className="w-14 h-14 bg-white border border-black flex items-center justify-center p-3 rounded-full overflow-hidden shadow-lg z-[10] relative"
                    style={{ zIndex: 10 - idx }}
                  >
                    <img
                      src={logoPath}
                      alt=""
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        if (!protocolFallbackPath) return;
                        const img = e.currentTarget;
                        if (img.dataset.fallbackApplied === "1") return;
                        img.dataset.fallbackApplied = "1";
                        img.src = protocolFallbackPath;
                      }}
                    />
                  </div>
                ))
              ) : (
                <div className="w-14 h-14 bg-black/[0.03] border border-black flex items-center justify-center p-3 relative group">
                  <div className="w-full h-full bg-black/5 flex items-center justify-center text-black/20 font-black text-xl relative z-10">
                    {selectedNode.name.charAt(0)}
                  </div>
                </div>
              )}
            </div>

            <div className="flex-grow pt-1">
              <h2 className="text-2xl font-bold text-black leading-none mb-3 tracking-tighter uppercase italic">
                {selectedNode.name}
              </h2>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="px-2 py-0.5 border border-black text-black text-[9px] font-black uppercase tracking-widest bg-white">
                  {protocolLabel}
                </span>
                {subtypeLabel && (
                  <span className="px-2 py-0.5 border border-black/10 text-black/60 text-[9px] font-black uppercase tracking-widest bg-white">
                    {subtypeLabel.toUpperCase()}
                  </span>
                )}
                {selectedNode.details?.hiddenInProtocolUi && (
                  <span className="px-2 py-0.5 border border-amber-300 text-amber-800 text-[9px] font-black uppercase tracking-widest bg-amber-50">
                    Hidden In Protocol UI
                  </span>
                )}
                {chainLogoPath && (
                  <Image
                    src={chainLogoPath}
                    alt={selectedNode.chain || ""}
                    width={14}
                    height={14}
                    className="object-contain"
                  />
                )}
              </div>
            </div>
          </div>

          <div className="text-right">
            <p className="text-[9px] text-black/30 uppercase font-black tracking-[0.2em] mb-1">
              TVL
            </p>
            <p className="font-bold text-black text-2xl tracking-tighter font-mono">
              {typeof tvl === "number" ? currencyFormatter.format(tvl) : "—"}
            </p>
          </div>
        </div>

        {(primaryExternalUrl || protocolAuditUrl) && (
          <div className="flex items-center gap-3 mt-8">
            {primaryExternalUrl && (
              <a
                href={primaryExternalUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 border border-black/10 bg-white hover:bg-black/[0.02] text-[10px] font-black uppercase tracking-[0.2em] transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Open Protocol
              </a>
            )}
            {protocolAuditUrl && (
              <a
                href={protocolAuditUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 border border-black/10 bg-white hover:bg-black/[0.02] text-[10px] font-black uppercase tracking-[0.2em] transition-colors"
              >
                <ShieldCheck className="w-3 h-3" />
                Audit Report
              </a>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-px bg-black/10 mt-10 border border-black/10">
          <div className="bg-white p-6">
            <p className="text-[10px] text-black/40 uppercase font-black tracking-[0.2em] mb-1">
              Impact Value
            </p>
            <p className="text-3xl font-black text-black tracking-tighter font-mono">
              {currencyFormatter.format(totalIncoming)}
            </p>
          </div>
          <div className="bg-white p-6 flex justify-between items-end relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-[10px] text-black/30 uppercase font-black tracking-[0.2em] mb-1">
                Portfolio Weight
              </p>
              <p className="text-2xl font-black text-black tracking-tighter font-mono">
                {percentFormatter.format(shareOfAllocationMap)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Body */}
      <div className="p-10 space-y-12">
        {/* Performance Metrics */}
        <section>
          <h3 className="text-[10px] font-black text-black/20 uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
            <TrendingUp className="w-3.5 h-3.5" />
            Stream_Performance
          </h3>
          <div className="space-y-5">
            <div className="flex justify-between items-center group">
              <span className="text-[11px] font-bold text-black/40 uppercase tracking-widest group-hover:text-black transition-colors">
                Realized APY
              </span>
              <span className="font-mono font-black text-black text-base">
                {apyForDisplay !== null
                  ? percentFormatter.format(apyForDisplay)
                  : "—"}
              </span>
            </div>
            <div className="w-full h-px bg-black/5" />
            <div className="flex justify-between items-center group">
              <span className="text-[11px] font-bold text-black/40 uppercase tracking-widest group-hover:text-black transition-colors">
                Risk Curator
              </span>
              <span className="font-black text-black text-[11px] uppercase tracking-wider">
                {selectedNode.details?.curator || "Institutional"}
              </span>
            </div>
          </div>
        </section>

        {marketExposure && (
          <section>
            <h3 className="text-[10px] font-black text-black/20 uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
              <Info className="w-3.5 h-3.5" />
              Market_Exposure
            </h3>

            <div className="space-y-5">
              {marketExposure.direct.length > 0 && (
                <div>
                  <div className="text-[9px] font-black text-black/30 uppercase tracking-[0.2em] mb-3">
                    Direct (Vault -&gt; Market)
                  </div>
                  <div className="space-y-2">
                    {marketExposure.direct.map((row) => (
                      <div
                        key={row.id}
                        className="flex items-center justify-between"
                      >
                        <span className="text-[11px] font-bold text-black/50 uppercase tracking-tight truncate pr-4">
                          {row.name}
                        </span>
                        <span className="text-[11px] font-black text-black font-mono">
                          {currencyFormatter.format(row.usd)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {marketExposure.indirect.length > 0 && (
                <div>
                  <div className="text-[9px] font-black text-black/30 uppercase tracking-[0.2em] mb-3">
                    Indirect (Scaled 2-Hop)
                  </div>
                  <div className="space-y-2">
                    {marketExposure.indirect.map((row) => (
                      <div
                        key={row.id}
                        className="flex items-center justify-between"
                      >
                        <span className="text-[11px] font-bold text-black/50 uppercase tracking-tight truncate pr-4">
                          {row.name}
                        </span>
                        <span className="text-[11px] font-black text-black font-mono">
                          {currencyFormatter.format(row.usd)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-[10px] text-black/30 font-medium leading-relaxed">
                Direct uses 1-hop edge weights. Indirect scales 2-hop market
                edges by the intermediate node's internal distribution.
              </div>
            </div>
          </section>
        )}

        {/* Risk Profile */}
        <section>
          <h3 className="text-[10px] font-black text-black/20 uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            Integrity_Audit
          </h3>
          <div className="bg-black/5 border border-black/5 rounded-sm p-6 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-black/20 group-hover:bg-black transition-colors" />
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-white border border-black/5 rounded-sm text-black flex-shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-[10px] font-black text-black uppercase tracking-[0.1em] mb-2 italic">
                  Standard Validation
                </h4>
                <p className="text-[11px] text-black/40 font-medium leading-relaxed mb-6">
                  Verified liquidity profiles for {selectedNode.protocol} remain
                  compliant with institutional risk thresholds.
                </p>

                {selectedNode.details?.healthRate && (
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-black/40 uppercase tracking-[0.2em]">
                        Health Factor
                      </span>
                      <span className="text-[10px] font-mono font-black text-black">
                        {selectedNode.details.healthRate.toFixed(3)}
                      </span>
                    </div>
                    <div className="h-1 bg-black/5 rounded-full overflow-hidden border border-black/5">
                      <div
                        className="h-full bg-black rounded-full"
                        style={{
                          width: `${Math.min(100, (selectedNode.details.healthRate / 2) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
