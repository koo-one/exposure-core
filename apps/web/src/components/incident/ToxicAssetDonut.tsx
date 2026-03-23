"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatUsdCompact } from "@/lib/incident/format";

export interface DonutEntry {
  symbol: string;
  exposureUsd: number;
  color: string;
  iconPath: string | null;
}

interface ToxicAssetDonutProps {
  entries: DonutEntry[];
  total: number;
}

function LegendIcon({
  iconPath,
  color,
  symbol,
}: {
  iconPath: string | null;
  color: string;
  symbol: string;
}) {
  const [imgError, setImgError] = useState(false);

  if (iconPath && !imgError) {
    return (
      <img
        src={iconPath}
        alt={symbol}
        width={16}
        height={16}
        className="w-4 h-4 rounded-full flex-shrink-0"
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className="w-4 h-4 rounded-full flex-shrink-0"
      style={{ backgroundColor: color }}
    />
  );
}

export function ToxicAssetDonut({ entries, total }: ToxicAssetDonutProps) {
  if (entries.length === 0) {
    return (
      <span
        className="font-mono"
        style={{ fontSize: 10, color: "var(--text-tertiary)" }}
      >
        No data
      </span>
    );
  }

  return (
    <div className="flex items-center gap-6">
      {/* Donut */}
      <div className="relative w-[140px] h-[140px] flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={entries}
              dataKey="exposureUsd"
              nameKey="symbol"
              cx="50%"
              cy="50%"
              innerRadius={38}
              outerRadius={68}
              paddingAngle={1}
              strokeWidth={0}
            >
              {entries.map((entry) => (
                <Cell key={entry.symbol} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              wrapperStyle={{ zIndex: 10 }}
              content={({ payload }) => {
                if (!payload?.[0]) return null;
                const d = payload[0].payload as DonutEntry;
                const pct =
                  total > 0 ? ((d.exposureUsd / total) * 100).toFixed(1) : "0";
                return (
                  <div
                    style={{
                      backgroundColor: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "8px 12px",
                      fontSize: 12,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      {d.iconPath ? (
                        <img
                          src={d.iconPath}
                          alt={d.symbol}
                          className="w-4 h-4 rounded-full"
                        />
                      ) : (
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: d.color }}
                        />
                      )}
                      <span
                        style={{
                          fontWeight: 700,
                          color: "var(--text-primary)",
                        }}
                      >
                        {d.symbol}
                      </span>
                    </div>
                    <div
                      style={{ color: "var(--text-secondary)", marginTop: 2 }}
                    >
                      {formatUsdCompact(d.exposureUsd)} ({pct}%)
                    </div>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center justify-center">
            <span
              className="font-mono text-[13px] font-bold leading-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {formatUsdCompact(total)}
            </span>
            <span
              className="text-[7px] uppercase tracking-widest"
              style={{ color: "var(--text-tertiary)" }}
            >
              Total
            </span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col justify-center gap-2">
        {entries.map((entry) => {
          const pct =
            total > 0 ? ((entry.exposureUsd / total) * 100).toFixed(1) : "0";
          return (
            <div key={entry.symbol} className="flex items-center gap-2">
              <LegendIcon
                iconPath={entry.iconPath}
                color={entry.color}
                symbol={entry.symbol}
              />
              <span
                className="font-black uppercase"
                style={{
                  fontSize: 11,
                  color: "var(--text-primary)",
                  lineHeight: 1,
                }}
              >
                {entry.symbol}
              </span>
              <span
                className="font-mono"
                style={{
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  lineHeight: 1,
                }}
              >
                {formatUsdCompact(entry.exposureUsd)} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
