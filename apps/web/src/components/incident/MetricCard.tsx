"use client";

interface MetricCardProps {
  label: string;
  value: number;
  format?: "usd" | "number" | "percent";
}

function formatValue(value: number, format: MetricCardProps["format"]): string {
  if (format === "usd") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
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
    <div className="bg-white p-4">
      <p
        className="uppercase font-black mb-1"
        style={{
          fontSize: 8,
          letterSpacing: "0.2em",
          color: "rgba(0,0,0,0.25)",
        }}
      >
        {label}
      </p>
      <p
        className="font-mono font-bold text-black tracking-tight"
        style={{ fontSize: 22 }}
      >
        {formatValue(value, format)}
      </p>
    </div>
  );
}
