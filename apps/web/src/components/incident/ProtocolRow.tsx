"use client";

import { useState } from "react";
import { formatUsdCompact } from "@/lib/incident/format";
import { getAssetIcon } from "@/lib/incident/logos";
export { getCuratorLogoKey } from "@/lib/incident/logos";

interface BreakdownEntry {
  asset: string;
  amountUsd: number;
  color: string;
}

interface ProtocolRowProps {
  name: string;
  logoSrc?: string;
  fallbackInitials: string;
  fallbackColor: string;
  meta: string;
  amount?: string;
  statusText?: string;
  breakdown?: BreakdownEntry[];
}

/** Mini donut chart (SVG) — pure render, no state */
function MiniDonut({
  breakdown,
  total,
  size = 32,
}: {
  breakdown: BreakdownEntry[];
  total: number;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 3;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const segments = breakdown
    .filter((b) => b.amountUsd > 0 && total > 0)
    .map((b) => {
      const pct = b.amountUsd / total;
      const len = circumference * pct;
      const seg = { ...b, len, offset, pct };
      offset += len;
      return seg;
    });

  return (
    <svg
      width={size}
      height={size}
      className="flex-shrink-0"
      style={{ transform: "rotate(-90deg)" }}
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="rgba(0,0,0,0.04)"
        strokeWidth={4}
      />
      {segments.map((seg) => (
        <circle
          key={seg.asset}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={seg.color}
          strokeWidth={4}
          strokeDasharray={`${seg.len} ${circumference - seg.len}`}
          strokeDashoffset={-seg.offset}
          strokeLinecap="butt"
        />
      ))}
    </svg>
  );
}

export function ProtocolRow({
  name,
  logoSrc,
  fallbackInitials,
  fallbackColor,
  meta,
  amount,
  statusText,
  breakdown,
}: ProtocolRowProps) {
  const [imgError, setImgError] = useState(false);
  const [hover, setHover] = useState(false);
  const showFallback = !logoSrc || imgError;

  const total = breakdown?.reduce((s, b) => s + b.amountUsd, 0) ?? 0;
  const hasBreakdown = breakdown && breakdown.length > 0 && total > 0;

  return (
    <div
      className="relative flex items-center gap-3 px-3 py-2.5 transition-colors cursor-default"
      style={{
        borderRadius: 4,
        backgroundColor: hover ? "rgba(0,0,0,0.02)" : "",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Tooltip — anchored to the row */}
      {hover && hasBreakdown && (
        <div
          className="absolute right-0 bottom-full mb-1 z-50 rounded-lg py-2 px-3 min-w-[180px]"
          style={{
            backgroundColor: "#1a1a1a",
            boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
          }}
        >
          {breakdown
            .filter((b) => b.amountUsd > 0)
            .map((b) => {
              const icon = getAssetIcon(b.asset);
              return (
                <div
                  key={b.asset}
                  className="flex items-center justify-between gap-3 py-1"
                >
                  <div className="flex items-center gap-2">
                    {icon ? (
                      <img
                        src={icon}
                        alt={b.asset}
                        className="w-4 h-4 rounded-full"
                      />
                    ) : (
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: b.color }}
                      />
                    )}
                    <span className="text-white text-xs font-medium">
                      {b.asset}
                    </span>
                  </div>
                  <span className="text-white/60 text-xs font-mono">
                    {formatUsdCompact(b.amountUsd)}
                  </span>
                </div>
              );
            })}
        </div>
      )}
      {/* Logo / Initials */}
      <div
        className="flex-shrink-0 flex items-center justify-center rounded-lg overflow-hidden"
        style={{ width: 28, height: 28 }}
      >
        {showFallback ? (
          <div
            className="w-full h-full flex items-center justify-center rounded-lg"
            style={{ backgroundColor: fallbackColor }}
          >
            <span
              className="font-black text-white"
              style={{ fontSize: 10, letterSpacing: "-0.02em" }}
            >
              {fallbackInitials.slice(0, 2).toUpperCase()}
            </span>
          </div>
        ) : (
          <img
            src={logoSrc}
            alt={name}
            width={28}
            height={28}
            className="w-full h-full object-contain rounded-lg"
            onError={() => setImgError(true)}
          />
        )}
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div
          className="font-black truncate"
          style={{ fontSize: 11, color: "var(--text-primary)" }}
        >
          {name}
        </div>
        <div
          className="truncate"
          style={{ color: "var(--text-secondary)", fontSize: 9, fontWeight: 500 }}
        >
          {meta}
        </div>
      </div>

      {/* Mini donut + amount */}
      {breakdown && breakdown.length > 0 && total > 0 ? (
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className="font-mono font-bold"
            style={{ fontSize: 11, color: "var(--text-primary)" }}
          >
            {formatUsdCompact(total)}
          </span>
          <MiniDonut breakdown={breakdown} total={total} size={32} />
        </div>
      ) : (
        <div className="flex flex-col items-end flex-shrink-0">
          {amount && (
            <span
              className="font-mono font-bold"
              style={{ fontSize: 11, color: "var(--text-primary)" }}
            >
              {amount}
            </span>
          )}
          {statusText && (
            <span
              className="uppercase font-black"
              style={{
                fontSize: 8,
                letterSpacing: "0.12em",
                color: "var(--text-tertiary)",
              }}
            >
              {statusText}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
