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

interface AssetDetailPanelProps {
  selectedNode: GraphNode | null;
  edges: GraphEdge[];
  rootNodeId?: string;
  originId?: string;
  onReset?: () => void;
}

export default function AssetDetailPanel({
  selectedNode,
  edges,
  rootNodeId,
  originId,
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

  const outgoingCount = edges.filter((e) => e.from === selectedNode.id).length;

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

  return (
    <div className="h-full flex flex-col bg-white overflow-y-auto custom-scrollbar border-l border-black">
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
              href={`/asset/${originId}`}
              className="flex items-center gap-2 text-[10px] font-black text-black/40 hover:text-black transition-all uppercase tracking-[0.2em] group border-l border-black/10 pl-6"
            >
              <RotateCcw className="w-3 h-3 transform group-hover:rotate-[-45deg] transition-transform" />
              Reset Origin
            </Link>
          )}
        </div>

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
            <div className="text-[40px] font-black text-black/[0.03] absolute -right-2 -bottom-4 select-none italic tracking-tighter uppercase transition-colors">
              {percentFormatter.format(shareOfAllocationMap)}
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

        {/* Technical Metadata */}
        <section className="pb-10">
          <h3 className="text-[10px] font-black text-black/20 uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
            <ExternalLink className="w-3.5 h-3.5" />
            System_Metadata
          </h3>
          <div className="text-[10px] text-black/30 font-mono bg-black/[0.02] p-6 border border-black/5 space-y-4">
            <div className="flex flex-col gap-2">
              <span className="text-black/10 uppercase text-[8px] font-black tracking-widest">
                Index Identifier
              </span>
              <span className="break-all text-black/50 select-all leading-relaxed">
                {selectedNode.id}
              </span>
            </div>
            <div className="pt-2 flex items-center justify-between border-t border-black/5 pt-4">
              <span className="text-black/10 uppercase text-[8px] font-black tracking-widest">
                Logic Class
              </span>
              <p className="text-black font-black">
                {selectedNode.details?.kind?.toUpperCase() || "STANDARD"}
              </p>
            </div>
            {outgoingCount > 0 && (
              <div className="pt-2 flex items-center gap-3 text-black">
                <div className="w-1.5 h-1.5 bg-black" />
                <span className="font-black italic tracking-tight uppercase">
                  {outgoingCount} Downstream Active Channels
                </span>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
