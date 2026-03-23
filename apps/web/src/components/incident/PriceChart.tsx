"use client";

import { useState } from "react";

interface PriceChartProps {
  currentPrice: number;
  priceChange24h: number;
  pegPrice: number;
}

const TIME_RANGES = ["1D", "7D", "1M", "ALL"] as const;
type TimeRange = (typeof TIME_RANGES)[number];

// Static mock sparkline points (normalized 0–1, representing price deviation).
// Simulates a de-peg event: stable → drop → partial recovery.
const MOCK_SPARKLINE_POINTS: [number, number][] = [
  [0, 0.05],
  [0.05, 0.04],
  [0.1, 0.05],
  [0.15, 0.06],
  [0.2, 0.04],
  [0.25, 0.05],
  [0.3, 0.04],
  [0.35, 0.06],
  [0.4, 0.05],
  [0.42, 0.07],
  [0.45, 0.25],
  [0.48, 0.55],
  [0.5, 0.75],
  [0.52, 0.85],
  [0.55, 0.72],
  [0.6, 0.65],
  [0.65, 0.6],
  [0.7, 0.58],
  [0.75, 0.55],
  [0.8, 0.52],
  [0.85, 0.48],
  [0.9, 0.45],
  [0.95, 0.43],
  [1.0, 0.42],
];

function buildSparklinePath(
  points: [number, number][],
  width: number,
  height: number,
): string {
  if (points.length === 0) return "";
  const scaled = points.map(([x, y]) => [x * width, y * height] as const);
  const d = scaled
    .map(
      ([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`,
    )
    .join(" ");
  return d;
}

function buildFillPath(
  points: [number, number][],
  width: number,
  height: number,
): string {
  if (points.length === 0) return "";
  const line = buildSparklinePath(points, width, height);
  return `${line} L ${width} ${height} L 0 ${height} Z`;
}

export function PriceChart({
  currentPrice,
  priceChange24h,
  pegPrice,
}: PriceChartProps) {
  const [activeRange, setActiveRange] = useState<TimeRange>("7D");

  const isDown = priceChange24h < 0;
  const changeColor = isDown ? "#E11D48" : "#00A35C";
  const changeSign = isDown ? "" : "+";

  const svgWidth = 300;
  const svgHeight = 60;
  const linePath = buildSparklinePath(
    MOCK_SPARKLINE_POINTS,
    svgWidth,
    svgHeight,
  );
  const fillPath = buildFillPath(MOCK_SPARKLINE_POINTS, svgWidth, svgHeight);
  const gradientId = "usr-sparkline-gradient";

  return (
    <div className="bg-white p-4">
      {/* Header label */}
      <p
        className="uppercase font-black mb-2"
        style={{
          fontSize: 8,
          letterSpacing: "0.2em",
          color: "rgba(0,0,0,0.25)",
        }}
      >
        USR Price
      </p>

      {/* Price + change */}
      <div className="flex items-baseline gap-2 mb-3">
        <span
          className="font-mono font-bold text-black"
          style={{ fontSize: 28, letterSpacing: "-0.03em" }}
        >
          ${currentPrice.toFixed(4)}
        </span>
        <span
          className="font-mono font-bold"
          style={{ fontSize: 13, color: changeColor }}
        >
          {isDown ? "▼" : "▲"} {changeSign}
          {priceChange24h.toFixed(2)}%
        </span>
        <span
          className="font-mono"
          style={{ fontSize: 10, color: "rgba(0,0,0,0.3)" }}
        >
          peg: ${pegPrice.toFixed(2)}
        </span>
      </div>

      {/* Sparkline SVG */}
      <div className="w-full mb-3" style={{ height: svgHeight }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="none"
          width="100%"
          height={svgHeight}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1a8fa8" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#1a8fa8" stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Fill area */}
          <path d={fillPath} fill={`url(#${gradientId})`} />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#1a8fa8"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Peg line */}
          <line
            x1={0}
            y1={svgHeight * 0.05}
            x2={svgWidth}
            y2={svgHeight * 0.05}
            stroke="rgba(0,0,0,0.1)"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        </svg>
      </div>

      {/* Time range selector */}
      <div className="flex items-center gap-1">
        {TIME_RANGES.map((range) => {
          const active = range === activeRange;
          return (
            <button
              key={range}
              onClick={() => setActiveRange(range)}
              className="rounded-full transition-colors"
              style={{
                padding: "3px 10px",
                backgroundColor: active ? "#000" : "transparent",
                color: active ? "#fff" : "rgba(0,0,0,0.35)",
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                border: active ? "none" : "1px solid rgba(0,0,0,0.08)",
                cursor: "pointer",
              }}
            >
              {range}
            </button>
          );
        })}
      </div>
    </div>
  );
}
