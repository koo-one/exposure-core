"use client";

import { useState } from "react";
import type { ToxicBreakdownEntry, ToxicAssetDef } from "@/lib/incident/types";
import { formatUsdCompact } from "@/lib/incident/format";

interface ExposureBarProps {
  breakdown: ToxicBreakdownEntry[];
  toxicAssets: ToxicAssetDef[];
  className?: string;
}

export function ExposureBar({
  breakdown,
  toxicAssets,
  className,
}: ExposureBarProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const colorBySymbol = Object.fromEntries(
    toxicAssets.map((a) => [a.symbol, a.color]),
  );

  // Normalize pct: if all values are <= 1, treat as ratio (0-1) and multiply by 100
  const maxPct = breakdown.reduce((m, e) => Math.max(m, e.pct), 0);
  const isRatio = breakdown.length > 0 && maxPct <= 1;
  const normalized = breakdown.map((entry) => ({
    ...entry,
    pct: isRatio ? entry.pct * 100 : entry.pct,
  }));

  const totalPct = normalized.reduce((sum, entry) => sum + entry.pct, 0);
  const remainingPct = Math.max(0, 100 - totalPct);

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        className={`flex h-1.5 overflow-hidden rounded-full cursor-pointer ${className ?? ""}`}
        style={{ backgroundColor: "rgba(0,0,0,0.04)" }}
      >
        {normalized.map((entry) => (
          <div
            key={entry.asset}
            style={{
              width: `${entry.pct}%`,
              backgroundColor: colorBySymbol[entry.asset] ?? "rgba(0,0,0,0.15)",
              flexShrink: 0,
            }}
          />
        ))}
        {remainingPct > 0 && normalized.length > 0 && (
          <div
            style={{
              width: `${remainingPct}%`,
              backgroundColor: "rgba(0,0,0,0.04)",
              flexShrink: 0,
            }}
          />
        )}
      </div>

      {/* Tooltip */}
      {showTooltip && normalized.length > 0 && (
        <div
          className="absolute z-50 left-0 bottom-full mb-2 border rounded-lg shadow-lg px-3 py-2 min-w-[160px]"
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--border)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          }}
        >
          {normalized.map((entry) => (
            <div
              key={entry.asset}
              className="flex items-center justify-between gap-4 py-0.5"
              style={{ fontSize: 11 }}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor:
                      colorBySymbol[entry.asset] ?? "rgba(0,0,0,0.15)",
                  }}
                />
                <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>
                  {entry.asset}
                </span>
              </span>
              <span className="font-mono" style={{ color: "var(--text-primary)" }}>
                {entry.pct.toFixed(1)}% · {formatUsdCompact(entry.amountUsd)}
              </span>
            </div>
          ))}
          {remainingPct > 0 && (
            <div
              className="flex items-center justify-between gap-4 py-0.5"
              style={{ fontSize: 11 }}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: "rgba(0,0,0,0.06)" }}
                />
                <span style={{ color: "var(--text-tertiary)", fontWeight: 500 }}>
                  Safe
                </span>
              </span>
              <span className="font-mono" style={{ color: "var(--text-tertiary)" }}>
                {remainingPct.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
