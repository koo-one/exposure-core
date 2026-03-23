"use client";

import { useState } from "react";
import { formatUsdCompact } from "@/lib/incident/format";
import { getProtocolIcon } from "@/lib/incident/logos";

export interface CoveringProtocol {
  name: string;
  protocol: string;
}

interface BadDebtPanelProps {
  realizedDebt: number;
  coveredDebt: number;
  uncoveredGap: number;
  recoveryRate: number;
  coveringProtocols?: CoveringProtocol[];
}

const COVERING_FALLBACK: Record<string, { initials: string; color: string }> = {
  fluid: { initials: "FL", color: "#3b82f6" },
  inverse: { initials: "IN", color: "#000000" },
  morpho: { initials: "M", color: "#2563eb" },
  euler: { initials: "E", color: "#e04040" },
  midas: { initials: "Mi", color: "#8b5cf6" },
  gearbox: { initials: "G", color: "#4a4a4a" },
};

function CoveringLogo({ cp }: { cp: CoveringProtocol }) {
  const [imgError, setImgError] = useState(false);
  const fb = COVERING_FALLBACK[cp.protocol] ?? {
    initials: cp.name.slice(0, 2).toUpperCase(),
    color: "#888",
  };

  if (imgError) {
    return (
      <div
        title={cp.name}
        className="rounded flex items-center justify-center flex-shrink-0"
        style={{ width: 20, height: 20, backgroundColor: fb.color }}
      >
        <span className="text-white font-black" style={{ fontSize: 7 }}>
          {fb.initials}
        </span>
      </div>
    );
  }

  return (
    <img
      src={getProtocolIcon(cp.protocol)}
      alt={cp.name}
      title={cp.name}
      className="flex-shrink-0 rounded"
      style={{ width: 20, height: 20 }}
      onError={() => setImgError(true)}
    />
  );
}

function formatPercent(value: number): string {
  const pct = value <= 1 ? value * 100 : value;
  return `${pct.toFixed(1)}%`;
}

export function BadDebtPanel({
  realizedDebt,
  coveredDebt,
  uncoveredGap,
  recoveryRate,
  coveringProtocols = [],
}: BadDebtPanelProps) {
  return (
    <div
      className="grid grid-cols-2"
      style={{ gap: 1, backgroundColor: "var(--border)" }}
    >
      {/* Realized debt — neutral */}
      <div className="p-4" style={{ backgroundColor: "var(--surface)" }}>
        <p
          className="uppercase font-black mb-1"
          style={{
            fontSize: 8,
            letterSpacing: "0.2em",
            color: "var(--text-tertiary)",
          }}
        >
          Realized Debt
        </p>
        <p
          className="font-mono font-bold tracking-tight"
          style={{ fontSize: 20, color: "var(--text-primary)" }}
        >
          {formatUsdCompact(realizedDebt)}
        </p>
      </div>

      {/* Covered debt — neutral with protocol logos */}
      <div className="p-4" style={{ backgroundColor: "var(--surface)" }}>
        <p
          className="uppercase font-black mb-1"
          style={{
            fontSize: 8,
            letterSpacing: "0.2em",
            color: "var(--text-tertiary)",
          }}
        >
          Covered / Promised
        </p>
        {coveredDebt > 0 ? (
          <p
            className="font-mono font-bold tracking-tight"
            style={{ fontSize: 20, color: "var(--text-primary)" }}
          >
            {formatUsdCompact(coveredDebt)}
          </p>
        ) : coveringProtocols.length > 0 ? (
          <div className="flex items-center gap-1.5 mt-1">
            {coveringProtocols.map((cp) => (
              <CoveringLogo key={cp.protocol} cp={cp} />
            ))}
          </div>
        ) : (
          <p
            className="font-mono font-bold tracking-tight"
            style={{ fontSize: 20, color: "var(--text-primary)" }}
          >
            $0
          </p>
        )}
      </div>

      {/* Uncovered gap — neutral */}
      <div className="p-4" style={{ backgroundColor: "var(--surface)" }}>
        <p
          className="uppercase font-black mb-1"
          style={{
            fontSize: 8,
            letterSpacing: "0.2em",
            color: "var(--text-tertiary)",
          }}
        >
          Uncovered Gap
        </p>
        <p
          className="font-mono font-bold tracking-tight"
          style={{ fontSize: 20, color: "var(--text-primary)" }}
        >
          {formatUsdCompact(uncoveredGap)}
        </p>
      </div>

      {/* Recovery rate — neutral */}
      <div className="p-4" style={{ backgroundColor: "var(--surface)" }}>
        <p
          className="uppercase font-black mb-1"
          style={{
            fontSize: 8,
            letterSpacing: "0.2em",
            color: "var(--text-tertiary)",
          }}
        >
          Recovery Rate
        </p>
        <p
          className="font-mono font-bold tracking-tight"
          style={{ fontSize: 20, color: "var(--text-primary)" }}
        >
          {formatPercent(recoveryRate)}
        </p>
      </div>
    </div>
  );
}
