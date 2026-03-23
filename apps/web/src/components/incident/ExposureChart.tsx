"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface ExposureChartProps {
  data: { name: string; value: number; color: string }[];
  title: string;
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div
      className="rounded px-3 py-2 text-sm"
      style={{
        backgroundColor: "rgba(9,9,11,0.95)",
        border: "1px solid rgba(255,255,255,0.10)",
        color: "rgba(255,255,255,0.9)",
      }}
    >
      <p className="font-medium">{item.payload.name}</p>
      <p className="font-mono" style={{ color: item.payload.color }}>
        {formatUsd(item.value)}
      </p>
    </div>
  );
}

export function ExposureChart({ data, title }: ExposureChartProps) {
  const height = Math.max(200, Math.min(300, data.length * 40 + 40));

  return (
    <div>
      <p
        className="text-sm uppercase tracking-wider mb-3"
        style={{ color: "rgba(255,255,255,0.35)" }}
      >
        {title}
      </p>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
        >
          <XAxis
            type="number"
            hide
            style={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={90}
            tick={{ fill: "rgba(255,255,255,0.70)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
          />
          <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={20}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
