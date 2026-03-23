"use client";

import { formatUsdCompact } from "@/lib/incident/format";

interface MetricCardProps {
  label: string;
  value: number;
  format?: "usd" | "number" | "percent";
}

function formatValue(value: number, format: MetricCardProps["format"]): string {
  if (format === "usd") {
    return formatUsdCompact(value);
  }
  if (format === "percent") {
    return `${value.toFixed(1)}%`;
  }
  return new Intl.NumberFormat("en-US").format(value);
}

export function MetricCard({
  label,
  value,
  format = "number",
}: MetricCardProps) {
  return (
    <div className="p-4 surface">
      <p
        className="uppercase font-black mb-1"
        style={{
          fontSize: 8,
          letterSpacing: "0.2em",
          color: "var(--text-tertiary)",
        }}
      >
        {label}
      </p>
      <p
        className="font-mono font-bold tracking-tight"
        style={{ fontSize: 22, color: "var(--text-primary)" }}
      >
        {formatValue(value, format)}
      </p>
    </div>
  );
}
