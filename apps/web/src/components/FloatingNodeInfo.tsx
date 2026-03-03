"use client";

import { useState } from "react";
import {
  ChevronRight,
  Info,
  TrendingUp,
  ShieldCheck,
  ExternalLink,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { currencyFormatter, percentFormatter } from "@/utils/formatters";
import { GraphNode } from "@/types";
import { getProtocolAppUrl, getProtocolAuditUrl } from "@/lib/protocol";

interface FloatingNodeInfoProps {
  node: GraphNode;
  tvl?: number | null;
  onBack?: () => void;
}

export function FloatingNodeInfo({ node, tvl, onBack }: FloatingNodeInfoProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const apyForDisplay =
    typeof node.apy === "number"
      ? node.apy > 1
        ? node.apy / 100
        : node.apy
      : null;

  const appUrl = getProtocolAppUrl(node);
  const auditUrl = getProtocolAuditUrl(node);

  return (
    <div className="absolute bottom-6 left-6 right-6 z-40 pointer-events-auto">
      <div
        className={cn(
          "bg-white border border-black shadow-2xl transition-all duration-500 overflow-hidden",
          isExpanded ? "rounded-3xl" : "rounded-full",
        )}
      >
        {/* Header / Compact Bar */}
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-black/5 rounded-full transition-colors"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
            )}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-black/[0.03] border border-black rounded-xl flex items-center justify-center shrink-0">
                <span className="text-xs font-black">
                  {node.name.charAt(0)}
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-black uppercase tracking-tight truncate">
                  {node.name}
                </div>
                <div className="text-[9px] font-bold text-black/30 uppercase tracking-widest mt-0.5 truncate">
                  {node.protocol} • {node.chain}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 shrink-0">
            <div className="hidden sm:block text-right">
              <div className="text-[8px] font-black text-black/20 uppercase tracking-[0.22em]">
                TVL
              </div>
              <div className="text-[11px] font-black text-black font-mono tracking-tight">
                {typeof tvl === "number" ? currencyFormatter.format(tvl) : "—"}
              </div>
            </div>
            {apyForDisplay !== null && (
              <div className="hidden sm:block text-right">
                <div className="text-[8px] font-black text-black/20 uppercase tracking-[0.22em]">
                  APY
                </div>
                <div className="text-[11px] font-black text-[#00FF85] font-mono tracking-tight">
                  {percentFormatter.format(apyForDisplay)}
                </div>
              </div>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-white hover:scale-110 transition-transform"
            >
              {isExpanded ? (
                <X className="w-5 h-5" />
              ) : (
                <Info className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Expanded Info */}
        <div
          className={cn(
            "transition-all duration-500 ease-in-out px-8",
            isExpanded ? "max-h-96 pb-8" : "max-h-0 overflow-hidden",
          )}
        >
          <div className="h-px bg-black/5 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div>
              <h4 className="text-[10px] font-black text-black/20 uppercase tracking-[0.3em] mb-4 flex items-center gap-3">
                <TrendingUp className="w-3.5 h-3.5" />
                Performance
              </h4>
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-bold text-black/40 uppercase tracking-widest">
                    Realized APY
                  </span>
                  <span className="font-mono font-black text-black text-sm">
                    {apyForDisplay !== null
                      ? percentFormatter.format(apyForDisplay)
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-bold text-black/40 uppercase tracking-widest">
                    Risk Curator
                  </span>
                  <span className="font-black text-black text-[10px] uppercase tracking-wider">
                    {node.details?.curator || "Institutional"}
                  </span>
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <h4 className="text-[10px] font-black text-black/20 uppercase tracking-[0.3em] mb-4 flex items-center gap-3">
                <ShieldCheck className="w-3.5 h-3.5" />
                Security & Actions
              </h4>
              <div className="flex flex-wrap gap-3">
                {appUrl && (
                  <a
                    href={appUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-black text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full hover:scale-105 transition-transform"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Protocol
                  </a>
                )}
                {auditUrl && (
                  <a
                    href={auditUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-4 py-2 border border-black/10 bg-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full hover:bg-bg-black/[0.02] transition-colors"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Audit Report
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
