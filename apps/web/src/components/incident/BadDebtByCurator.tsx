"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUsdCompact } from "@/lib/incident/format";
import { getCuratorIcon, getProtocolIcon } from "@/lib/incident/logos";
import type { VaultExposure, ToxicBreakdownEntry } from "@/lib/incident/types";

interface BadDebtByCuratorProps {
  vaults: VaultExposure[];
}

/** Pre-exploit oracle prices (stablecoin peg / fair value). */
const ORACLE_PRICES: Record<string, number> = {
  USR: 1.0,
  wstUSR: 1.0,
  RLP: 1.0,
};

const COINGECKO_IDS: Record<string, string> = {
  USR: "resolv-usr",
  wstUSR: "resolv-wstusr",
  RLP: "resolv-rlp",
};

interface CuratorDebt {
  curator: string;
  protocol: string;
  vaultCount: number;
  totalExposureUsd: number;
  badDebtUsd: number;
}

function computeBadDebt(
  breakdown: ToxicBreakdownEntry[],
  marketPrices: Record<string, number>,
): number {
  let badDebt = 0;
  for (const entry of breakdown) {
    const oracle = ORACLE_PRICES[entry.asset] ?? 1.0;
    const market = marketPrices[entry.asset] ?? oracle;
    // Bad debt = amount at oracle price - amount at market price
    // = exposure * (1 - market/oracle)
    const loss = entry.amountUsd * Math.max(0, 1 - market / oracle);
    badDebt += loss;
  }
  return badDebt;
}

function CuratorLogo({
  curator,
  protocol,
}: {
  curator: string;
  protocol: string;
}) {
  const [imgError, setImgError] = useState(false);

  const iconSrc = getCuratorIcon(curator) ?? getProtocolIcon(protocol);

  if (imgError) {
    return (
      <div
        className="rounded flex items-center justify-center flex-shrink-0"
        style={{ width: 24, height: 24, backgroundColor: "#888" }}
      >
        <span className="text-white font-black" style={{ fontSize: 8 }}>
          {curator.slice(0, 2).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <img
      src={iconSrc}
      alt={curator}
      className="flex-shrink-0 rounded"
      style={{ width: 24, height: 24 }}
      onError={() => setImgError(true)}
    />
  );
}

const DEFAULT_VISIBLE = 5;

export function BadDebtByCurator({ vaults }: BadDebtByCuratorProps) {
  const [marketPrices, setMarketPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchPrices() {
      try {
        const ids = Object.values(COINGECKO_IDS).join(",");
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
        const json = await res.json();
        const prices: Record<string, number> = {};
        for (const [symbol, cgId] of Object.entries(COINGECKO_IDS)) {
          if (json[cgId]?.usd != null) {
            prices[symbol] = json[cgId].usd;
          }
        }
        setMarketPrices(prices);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Failed to fetch market prices:", err);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    fetchPrices();
    return () => controller.abort();
  }, []);

  const curatorDebts = useMemo(() => {
    if (Object.keys(marketPrices).length === 0) return [];

    const byCurator = new Map<string, CuratorDebt>();

    for (const ve of vaults) {
      if (ve.breakdown.length === 0) continue;
      const key = ve.vault.curator ?? ve.vault.protocol;
      const existing = byCurator.get(key) ?? {
        curator: ve.vault.curator ?? ve.vault.protocol,
        protocol: ve.vault.protocol,
        vaultCount: 0,
        totalExposureUsd: 0,
        badDebtUsd: 0,
      };
      existing.vaultCount += 1;
      existing.totalExposureUsd += ve.toxicExposureUsd;
      existing.badDebtUsd += computeBadDebt(ve.breakdown, marketPrices);
      byCurator.set(key, existing);
    }

    return Array.from(byCurator.values())
      .filter((d) => d.badDebtUsd > 0)
      .sort((a, b) => b.badDebtUsd - a.badDebtUsd);
  }, [vaults, marketPrices]);

  const totalBadDebt = curatorDebts.reduce((sum, d) => sum + d.badDebtUsd, 0);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center py-6"
        style={{ color: "var(--text-tertiary)", fontSize: 11 }}
      >
        Loading market prices…
      </div>
    );
  }

  if (curatorDebts.length === 0) {
    return (
      <div
        className="flex items-center justify-center py-6"
        style={{ color: "var(--text-tertiary)", fontSize: 11 }}
      >
        No bad debt detected at current prices
      </div>
    );
  }

  return (
    <div>
      {/* Total */}
      <div className="mb-4">
        <p
          className="font-mono font-bold"
          style={{
            fontSize: 28,
            letterSpacing: "-0.03em",
            color: "var(--text-primary)",
          }}
        >
          {formatUsdCompact(totalBadDebt)}
        </p>
        <p
          className="uppercase font-semibold"
          style={{ fontSize: 10, color: "var(--text-tertiary)" }}
        >
          total estimated bad debt at current prices
        </p>
      </div>

      {/* Current market prices */}
      <div className="flex gap-3 mb-4">
        {Object.entries(marketPrices).map(([symbol, price]) => (
          <div
            key={symbol}
            className="flex items-center gap-1.5 rounded px-2 py-1"
            style={{
              backgroundColor: "var(--surface-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            <span
              className="font-black uppercase"
              style={{ fontSize: 9, color: "var(--text-tertiary)" }}
            >
              {symbol}
            </span>
            <span
              className="font-mono font-bold"
              style={{ fontSize: 11, color: "var(--text-primary)" }}
            >
              ${price.toFixed(4)}
            </span>
          </div>
        ))}
      </div>

      {/* By curator */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-1">
        {(expanded ? curatorDebts : curatorDebts.slice(0, DEFAULT_VISIBLE)).map(
          (d) => {
            const pct =
              totalBadDebt > 0 ? (d.badDebtUsd / totalBadDebt) * 100 : 0;
            return (
              <div
                key={d.curator}
                className="flex items-center gap-3 rounded-lg px-3 py-2"
                style={{
                  backgroundColor: "var(--surface-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                <CuratorLogo curator={d.curator} protocol={d.protocol} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span
                      className="font-bold truncate"
                      style={{
                        fontSize: 12,
                        color: "var(--text-primary)",
                      }}
                    >
                      {d.curator}
                    </span>
                    <span
                      className="font-mono"
                      style={{
                        fontSize: 10,
                        color: "var(--text-tertiary)",
                      }}
                    >
                      {d.vaultCount} vault{d.vaultCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {/* Bar */}
                  <div
                    className="mt-1 rounded-full overflow-hidden"
                    style={{
                      height: 4,
                      backgroundColor: "var(--border)",
                    }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: "var(--text-secondary)",
                      }}
                    />
                  </div>
                </div>
                <span
                  className="font-mono font-bold flex-shrink-0"
                  style={{
                    fontSize: 13,
                    color: "var(--text-primary)",
                  }}
                >
                  {formatUsdCompact(d.badDebtUsd)}
                </span>
              </div>
            );
          },
        )}
        {curatorDebts.length > DEFAULT_VISIBLE && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="w-full text-center py-2 rounded-lg transition-colors cursor-pointer"
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--text-secondary)",
              backgroundColor: "var(--surface-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            {expanded
              ? "Show less"
              : `Show ${curatorDebts.length - DEFAULT_VISIBLE} more`}
          </button>
        )}
      </div>
    </div>
  );
}
