"use client";

import type { ToxicBreakdownEntry, ToxicAssetDef } from "@/lib/incident/types";

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
  const colorBySymbol = Object.fromEntries(
    toxicAssets.map((a) => [a.symbol, a.color]),
  );

  const totalPct = breakdown.reduce((sum, entry) => sum + entry.pct, 0);
  const remainingPct = Math.max(0, 100 - totalPct);

  return (
    <div
      className={`flex h-1 w-full overflow-hidden rounded-full ${className ?? ""}`}
      style={{ backgroundColor: "rgba(0,0,0,0.04)" }}
    >
      {breakdown.map((entry) => (
        <div
          key={entry.asset}
          style={{
            width: `${entry.pct}%`,
            backgroundColor: colorBySymbol[entry.asset] ?? "rgba(0,0,0,0.15)",
            flexShrink: 0,
          }}
          title={`${entry.asset}: ${entry.pct.toFixed(1)}%`}
        />
      ))}
      {remainingPct > 0 && breakdown.length > 0 && (
        <div
          style={{
            width: `${remainingPct}%`,
            backgroundColor: "rgba(0,0,0,0.04)",
            flexShrink: 0,
          }}
        />
      )}
    </div>
  );
}
