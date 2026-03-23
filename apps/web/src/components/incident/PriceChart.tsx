"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const COINGECKO_ID = "resolv-usr";
const TIME_RANGES = ["1D", "7D", "30D"] as const;
type TimeRange = (typeof TIME_RANGES)[number];

const RANGE_DAYS: Record<TimeRange, number> = {
  "1D": 1,
  "7D": 7,
  "30D": 30,
};

interface PricePoint {
  timestamp: number;
  price: number;
}

export function PriceChart() {
  const [data, setData] = useState<PricePoint[]>([]);
  const [activeRange, setActiveRange] = useState<TimeRange>("7D");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchPrices() {
      try {
        const res = await fetch(
          `https://api.coingecko.com/api/v3/coins/${COINGECKO_ID}/market_chart?vs_currency=usd&days=30`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
        const json = await res.json();
        if (!Array.isArray(json.prices)) throw new Error("Unexpected response");
        const points: PricePoint[] = json.prices.map(
          ([timestamp, price]: [number, number]) => ({
            timestamp,
            price,
          }),
        );
        setData(points);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Failed to fetch USR price data:", err);
          if (!controller.signal.aborted) setError(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    fetchPrices();
    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => {
    const cutoff = Date.now() - RANGE_DAYS[activeRange] * 24 * 60 * 60 * 1000;
    return data.filter((p) => p.timestamp >= cutoff);
  }, [data, activeRange]);

  const { currentPrice, priceChange24h } = useMemo(() => {
    if (data.length === 0) return { currentPrice: 0, priceChange24h: 0 };
    const price = data[data.length - 1].price;
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const dayAgoPoint = data.find((p) => p.timestamp >= oneDayAgo);
    const change =
      dayAgoPoint && dayAgoPoint.price > 0
        ? ((price - dayAgoPoint.price) / dayAgoPoint.price) * 100
        : 0;
    return { currentPrice: price, priceChange24h: change };
  }, [data]);

  const isDown = priceChange24h < 0;
  const changeColor = isDown ? "#E11D48" : "#00A35C";
  const changeSign = isDown ? "" : "+";

  const chartColor = "#5792ff";

  return (
    <div className="px-5 py-4 flex flex-col" style={{ backgroundColor: "var(--surface)" }}>
      {/* Panel label */}
      <p
        className="uppercase font-black mb-2"
        style={{
          fontSize: 8,
          letterSpacing: "0.2em",
          color: "var(--text-tertiary)",
        }}
      >
        USR Price
      </p>

      {/* Price + change */}
      {!loading && data.length > 0 && (
        <div className="flex items-baseline gap-2 mb-3">
          <span
            className="font-mono font-bold"
            style={{ fontSize: 28, letterSpacing: "-0.03em", color: "var(--text-primary)" }}
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
            style={{ fontSize: 10, color: "var(--text-tertiary)" }}
          >
            peg: $1.00
          </span>
        </div>
      )}

      {/* Chart */}
      <div className="flex-1" style={{ minHeight: 120 }}>
        {loading ? (
          <div
            className="flex items-center justify-center h-full"
            style={{ color: "var(--text-tertiary)", fontSize: 11 }}
          >
            Loading…
          </div>
        ) : error ? (
          <div
            className="flex items-center justify-center h-full"
            style={{ color: "var(--text-tertiary)", fontSize: 11 }}
          >
            Price data unavailable
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={filtered}>
              <defs>
                <linearGradient id="usrGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColor} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="timestamp"
                tickFormatter={(ts: number) => {
                  const d = new Date(ts);
                  return activeRange === "1D"
                    ? d.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : d.toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      });
                }}
                tick={{ fontSize: 9, fill: "var(--text-tertiary)" }}
                axisLine={false}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                domain={[0, 1.05]}
                tick={{ fontSize: 9, fill: "var(--text-tertiary)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                width={45}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  fontSize: 11,
                  padding: "6px 10px",
                }}
                labelFormatter={(ts) =>
                  new Date(ts as number).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                }
                formatter={(value) => [
                  `$${(value as number).toFixed(4)}`,
                  "USR",
                ]}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={chartColor}
                strokeWidth={1.5}
                fill="url(#usrGradient)"
                dot={false}
                activeDot={{ r: 3, fill: chartColor }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Time range selector */}
      <div className="flex items-center gap-1 mt-2">
        {TIME_RANGES.map((range) => {
          const active = range === activeRange;
          return (
            <button
              key={range}
              onClick={() => setActiveRange(range)}
              className="rounded-full transition-colors select-none cursor-pointer"
              style={{
                padding: "3px 10px",
                backgroundColor: active ? "var(--text-primary)" : "transparent",
                color: active ? "var(--surface)" : "var(--text-secondary)",
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
                border: active ? "none" : "1px solid rgba(0,0,0,0.08)",
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
