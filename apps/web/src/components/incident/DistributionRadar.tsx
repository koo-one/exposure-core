"use client";

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface RadarEntry {
  name: string;
  value: number;
  iconSrc?: string;
}

interface DistributionRadarProps {
  entries: RadarEntry[];
}

/** Minimum axes for a meaningful polygon. */
const MIN_AXES = 3;

/**
 * Custom tick renderer for PolarAngleAxis.
 * Shows an icon (if available) + uppercase label at each radar vertex.
 */
function renderCustomTick({
  x,
  y,
  payload,
  entries,
}: {
  x: number;
  y: number;
  payload: { value: string };
  entries: RadarEntry[];
}) {
  const entry = entries.find((e) => e.name === payload.value);
  const iconSrc = entry?.iconSrc;
  const iconSize = 24;
  const gap = 4;

  return (
    <g transform={`translate(${x},${y})`}>
      {iconSrc ? (
        <>
          <image
            href={iconSrc}
            x={-iconSize / 2}
            y={-iconSize - gap}
            width={iconSize}
            height={iconSize}
          />
          <text
            x={0}
            y={gap + 10}
            textAnchor="middle"
            fontSize={9}
            fontWeight={800}
            fill="var(--text-tertiary)"
            style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
          >
            {payload.value}
          </text>
        </>
      ) : (
        <text
          x={0}
          y={4}
          textAnchor="middle"
          fontSize={9}
          fontWeight={800}
          fill="var(--text-tertiary)"
          style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
        >
          {payload.value}
        </text>
      )}
    </g>
  );
}

export function DistributionRadar({ entries }: DistributionRadarProps) {
  if (entries.length < MIN_AXES) return null;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={entries} outerRadius="70%">
        <PolarGrid gridType="polygon" stroke="var(--text-tertiary)" />
        <PolarAngleAxis
          dataKey="name"
          tick={(props: Record<string, unknown>) =>
            renderCustomTick({ ...props, entries } as Parameters<
              typeof renderCustomTick
            >[0])
          }
        />
        <PolarRadiusAxis
          domain={[0, "dataMax"]}
          tick={false}
          axisLine={false}
        />
        <Radar
          dataKey="value"
          stroke="#3b82f6"
          fill="rgba(59,130,246,0.3)"
          strokeWidth={2}
          dot={{ r: 4, fill: "#3b82f6", strokeWidth: 0 }}
        />
        <Tooltip
          content={({ payload }) => {
            if (!payload?.[0]) return null;
            const d = payload[0].payload as RadarEntry;
            return (
              <div
                style={{
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--text-tertiary)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 12,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                }}
              >
                <div className="flex items-center gap-2">
                  {d.iconSrc && (
                    <img
                      src={d.iconSrc}
                      alt={d.name}
                      className="w-4 h-4 rounded-full"
                    />
                  )}
                  <span
                    style={{
                      fontWeight: 700,
                      color: "var(--text-primary)",
                    }}
                  >
                    {d.name}
                  </span>
                </div>
                <div
                  style={{
                    color: "var(--text-secondary)",
                    marginTop: 2,
                  }}
                >
                  {d.value.toFixed(1)}%
                </div>
              </div>
            );
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
