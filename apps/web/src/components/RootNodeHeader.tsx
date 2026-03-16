"use client";

import React from "react";
import { ChevronRight, ShieldCheck, ExternalLink } from "lucide-react";
import { currencyFormatter, percentFormatter } from "@/utils/formatters";
import { GraphNode } from "@/types";
import { getNodeLogos } from "@/lib/logos";
import { getProtocolAppUrl, getProtocolAuditUrl } from "@/lib/protocol";
import { getRootRelationshipSemantics } from "@/lib/rootRelationship";

interface RootNodeHeaderProps {
  node: GraphNode;
  children?: GraphNode[];
  tvl?: number | null;
  onBack?: () => void;
}

export function RootNodeHeader({
  node,
  children,
  tvl,
  onBack,
}: RootNodeHeaderProps) {
  const logos = getNodeLogos(node);

  const apyForDisplay =
    typeof node.apy === "number"
      ? node.apy > 1
        ? node.apy / 100
        : node.apy
      : null;

  const appUrl = getProtocolAppUrl(node);
  const auditUrl = getProtocolAuditUrl(node);
  const relationship = getRootRelationshipSemantics(node, children);

  return (
    <div className="flex items-center justify-between gap-4 px-3 py-1.5">
      <div className="flex items-center gap-3 min-w-0 flex-grow">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1 hover:bg-black/5 rounded-full transition-colors shrink-0"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
          </button>
        )}

        <div className="flex items-center gap-3 min-w-0">
          {/* Logos */}
          <div className="relative h-[18px] w-[30px] shrink-0">
            {logos.slice(0, 2).map((logo, idx) => (
              <img
                key={logo}
                src={logo}
                alt=""
                className="w-[18px] h-[18px] object-contain absolute top-0"
                style={{ left: `${idx * 12}px` }}
                loading="lazy"
              />
            ))}
          </div>

          {/* Identity and Metadata Inline */}
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-baseline gap-4 min-w-0">
              <div className="flex items-baseline gap-2 min-w-0">
                <div className="font-mono text-[13px] font-bold uppercase tracking-tight truncate">
                  {node.name}
                </div>
                <div className="text-[10px] font-bold text-black/30 uppercase tracking-widest truncate shrink-0">
                  {node.protocol} • {node.chain}
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-6 shrink-0 border-l border-black/10 pl-4 h-4">
                <div className="flex items-center gap-1.5">
                  <div className="text-[8px] font-bold text-black/20 uppercase tracking-[0.15em]">
                    TVL
                  </div>
                  <div className="text-[10px] font-bold text-black font-mono">
                    {typeof tvl === "number"
                      ? currencyFormatter.format(tvl)
                      : "—"}
                  </div>
                </div>

                {apyForDisplay !== null && (
                  <div className="flex items-center gap-1.5">
                    <div className="text-[8px] font-bold text-black/20 uppercase tracking-[0.15em]">
                      APY
                    </div>
                    <div className="text-[10px] font-bold text-[#00A35C] font-mono">
                      {percentFormatter.format(apyForDisplay)}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1.5">
                  <div className="text-[8px] font-bold text-black/20 uppercase tracking-[0.15em] mr-[-2px]">
                    CURATOR
                  </div>
                  <div className="text-[9px] font-bold text-black/60 uppercase tracking-wide">
                    {node.details?.curator || "Institutional"}
                  </div>
                </div>
              </div>
            </div>

            {relationship ? (
              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                <div className="px-1.5 py-0.5 rounded-full border border-black/10 bg-black/[0.03] text-[8px] font-bold text-black/45 uppercase tracking-[0.15em] leading-none">
                  {relationship.rootBadge}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Action Links */}
      <div className="flex items-center gap-2 shrink-0">
        {appUrl && (
          <a
            href={appUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1 bg-black text-white text-[8px] font-bold uppercase tracking-wider rounded-full hover:bg-black/80 transition-colors shadow-sm"
          >
            <ExternalLink className="w-2.5 h-2.5" />
            Protocol
          </a>
        )}
        {auditUrl && (
          <a
            href={auditUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1 border border-black/10 bg-white text-[8px] font-bold uppercase tracking-wider rounded-full hover:bg-black/[0.02] transition-colors text-black/60 shadow-sm"
          >
            <ShieldCheck className="w-2.5 h-2.5" />
            Audit
          </a>
        )}
      </div>
    </div>
  );
}
