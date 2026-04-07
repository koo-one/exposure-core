"use client";

import React from "react";
import { ChevronRight, ShieldCheck, ExternalLink } from "lucide-react";
import {
  currencyFormatter,
  formatChainLabel,
  formatUiLabel,
  percentFormatter,
} from "@/utils/formatters";
import { GraphNode } from "@/types";
import { getCuratorLogos, getNodeLogos } from "@/lib/logos";
import { getCuratorPrimaryUrl } from "@/lib/curators";
import {
  getExplorerUrl,
  getProtocolAppUrl,
  getProtocolAuditUrl,
} from "@/lib/protocol";
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
  const isEulerEarnVault =
    node.protocol === "euler" && node.details?.subtype === "Earn Vault";
  const childAllocatorNames = isEulerEarnVault
    ? Array.from(
        new Set(
          (children ?? [])
            .map((child) => child.details?.curator?.trim() || "")
            .filter(Boolean),
        ),
      )
    : [];
  const curatorNames = (() => {
    const rootCurator = node.details?.curator?.trim() || "";
    if (rootCurator) return [rootCurator];
    if (isEulerEarnVault) return childAllocatorNames;
    return [];
  })();
  const curator = curatorNames.join(", ");
  const curatorLinks = curatorNames.map((name) => ({
    name,
    href: getCuratorPrimaryUrl(name) ?? `/?curator=${encodeURIComponent(name)}`,
    isExternal: Boolean(getCuratorPrimaryUrl(name)),
    logos: getCuratorLogos(name),
  }));
  const curatorLabel = isEulerEarnVault ? "Capital allocator" : "Curator";

  const apyForDisplay =
    typeof node.apy === "number"
      ? node.apy > 1
        ? node.apy / 100
        : node.apy
      : null;

  const appUrl = getProtocolAppUrl(node);
  const explorerUrl = getExplorerUrl(node);
  const auditUrl = getProtocolAuditUrl(node);
  const primaryActionUrl = explorerUrl ?? appUrl;
  const primaryActionLabel = explorerUrl ? "See in explorer" : "Protocol app";
  const showProtocolAppLink = !!appUrl && appUrl !== primaryActionUrl;
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
                <div className="font-mono text-[13px] font-semibold tracking-[0.03em] truncate">
                  {node.name}
                </div>
                <div className="text-[10px] font-semibold text-black/55 tracking-[0.04em] truncate shrink-0">
                  {formatUiLabel(node.protocol)} •{" "}
                  {formatChainLabel(node.chain)}
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-6 shrink-0 border-l border-black/10 pl-4 h-4">
                <div className="flex items-center gap-1.5">
                  <div className="text-[8px] font-semibold text-black/45 tracking-[0.04em]">
                    TVL
                  </div>
                  <div className="text-[10px] font-semibold text-black font-mono">
                    {typeof tvl === "number"
                      ? currencyFormatter.format(tvl)
                      : "—"}
                  </div>
                </div>

                {apyForDisplay !== null && (
                  <div className="flex items-center gap-1.5">
                    <div className="text-[8px] font-semibold text-black/45 tracking-[0.04em]">
                      APY
                    </div>
                    <div className="text-[10px] font-semibold text-[#00A35C] font-mono">
                      {percentFormatter.format(apyForDisplay)}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1.5">
                  <div className="text-[8px] font-semibold text-black/45 tracking-[0.04em]">
                    {curatorLabel}
                  </div>
                  <div
                    className="flex items-center gap-1.5 min-w-0 max-w-[160px] shrink-0"
                    title={curator || undefined}
                  >
                    {curatorLinks.length > 0 ? (
                      curatorLinks
                        .slice(0, 2)
                        .map(({ name, href, isExternal, logos }) => {
                          const content = (
                            <>
                              {logos.length > 0 ? (
                                <span className="inline-flex items-center gap-0.5 shrink-0">
                                  {logos.slice(0, 2).map((logo, idx) => (
                                    <img
                                      key={`${name}-${idx}-${logo}`}
                                      src={logo}
                                      alt=""
                                      className="h-[14px] w-auto max-w-[28px] object-contain shrink-0"
                                      loading="lazy"
                                    />
                                  ))}
                                </span>
                              ) : (
                                <span className="text-[9px] font-semibold text-black/72 tracking-[0.04em] truncate min-w-0">
                                  {name}
                                </span>
                              )}
                            </>
                          );

                          if (isExternal) {
                            return (
                              <span
                                key={name}
                                className="inline-flex items-center gap-1 min-w-0 max-w-[120px] shrink"
                              >
                                {content}
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noreferrer"
                                  aria-label={`Open curator profile for ${name} in a new tab`}
                                  className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-black/10 text-black/50 hover:bg-black/[0.03] hover:text-black/70 transition-colors shrink-0"
                                >
                                  <ExternalLink className="h-2 w-2" />
                                </a>
                              </span>
                            );
                          }

                          return (
                            <span
                              key={name}
                              className="inline-flex items-center gap-1 min-w-0 max-w-[120px] shrink"
                            >
                              {content}
                            </span>
                          );
                        })
                    ) : curator ? (
                      <div className="text-[9px] font-semibold text-black/72 tracking-[0.04em] truncate max-w-[140px]">
                        {curator}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {relationship ? (
              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                <div className="px-1.5 py-0.5 rounded-full border border-black/10 bg-black/[0.03] text-[8px] font-semibold text-black/55 tracking-[0.04em] leading-none">
                  {relationship.rootBadge}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Action Links */}
      <div className="flex items-center gap-2 shrink-0">
        {primaryActionUrl && (
          <a
            href={primaryActionUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1 bg-black text-white text-[8px] font-semibold tracking-[0.04em] rounded-full hover:bg-black/80 transition-colors shadow-sm"
          >
            <ExternalLink className="w-2.5 h-2.5" />
            {primaryActionLabel}
          </a>
        )}
        {showProtocolAppLink && appUrl && (
          <a
            href={appUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1 border border-black/10 bg-white text-[8px] font-semibold tracking-[0.04em] rounded-full hover:bg-black/[0.02] transition-colors text-black/72 shadow-sm"
          >
            <ExternalLink className="w-2.5 h-2.5" />
            Protocol app
          </a>
        )}
        {auditUrl && (
          <a
            href={auditUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1 border border-black/10 bg-white text-[8px] font-semibold tracking-[0.04em] rounded-full hover:bg-black/[0.02] transition-colors text-black/72 shadow-sm"
          >
            <ShieldCheck className="w-2.5 h-2.5" />
            Audit
          </a>
        )}
      </div>
    </div>
  );
}
