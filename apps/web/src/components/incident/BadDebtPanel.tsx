"use client";

interface BadDebtPanelProps {
  realizedDebt: number;
  coveredDebt: number;
  uncoveredGap: number;
  recoveryRate: number;
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function BadDebtPanel({
  realizedDebt,
  coveredDebt,
  uncoveredGap,
  recoveryRate,
}: BadDebtPanelProps) {
  return (
    <div
      className="grid grid-cols-2"
      style={{ gap: 1, backgroundColor: "rgba(0,0,0,0.05)" }}
    >
      {/* Realized debt — red tint */}
      <div
        className="bg-white p-4"
        style={{ borderTop: "2px solid rgba(225,29,72,0.20)" }}
      >
        <p
          className="uppercase font-black mb-1"
          style={{
            fontSize: 8,
            letterSpacing: "0.2em",
            color: "rgba(0,0,0,0.25)",
          }}
        >
          Realized Debt
        </p>
        <p
          className="font-mono font-bold tracking-tight"
          style={{ fontSize: 20, color: "#E11D48" }}
        >
          {formatUsd(realizedDebt)}
        </p>
      </div>

      {/* Covered debt — green tint */}
      <div
        className="bg-white p-4"
        style={{ borderTop: "2px solid rgba(0,163,92,0.20)" }}
      >
        <p
          className="uppercase font-black mb-1"
          style={{
            fontSize: 8,
            letterSpacing: "0.2em",
            color: "rgba(0,0,0,0.25)",
          }}
        >
          Covered
        </p>
        <p
          className="font-mono font-bold tracking-tight"
          style={{ fontSize: 20, color: "#00A35C" }}
        >
          {formatUsd(coveredDebt)}
        </p>
      </div>

      {/* Uncovered gap — neutral */}
      <div className="bg-white p-4">
        <p
          className="uppercase font-black mb-1"
          style={{
            fontSize: 8,
            letterSpacing: "0.2em",
            color: "rgba(0,0,0,0.25)",
          }}
        >
          Uncovered Gap
        </p>
        <p
          className="font-mono font-bold text-black tracking-tight"
          style={{ fontSize: 20 }}
        >
          {formatUsd(uncoveredGap)}
        </p>
      </div>

      {/* Recovery rate — neutral */}
      <div className="bg-white p-4">
        <p
          className="uppercase font-black mb-1"
          style={{
            fontSize: 8,
            letterSpacing: "0.2em",
            color: "rgba(0,0,0,0.25)",
          }}
        >
          Recovery Rate
        </p>
        <p
          className="font-mono font-bold text-black tracking-tight"
          style={{ fontSize: 20 }}
        >
          {formatPercent(recoveryRate)}
        </p>
      </div>
    </div>
  );
}
