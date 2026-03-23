"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { VaultExposure, ToxicAssetDef } from "@/lib/incident/types";
import { slugifyVaultName } from "@/lib/incident/types";
import { StatusBadge } from "./StatusBadge";
import { ExposureBar } from "./ExposureBar";

interface VaultTableProps {
  vaults: VaultExposure[];
  toxicAssets: ToxicAssetDef[];
  slug: string;
}

type SortColumn =
  | "name"
  | "protocol"
  | "exposurePct"
  | "exposureUsd"
  | "status";
type SortDirection = "asc" | "desc";

const STATUS_ORDER: Record<string, number> = {
  affected: 0,
  covering: 1,
  unknown: 2,
};

function exposureColor(pct: number): string {
  if (pct === 0) return "#22c55e";
  if (pct < 0.05) return "#f59e0b";
  if (pct < 0.15) return "#f97316";
  return "#ef4444";
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function VaultTable({ vaults, toxicAssets, slug }: VaultTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("exposurePct");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [search, setSearch] = useState("");
  const [activeProtocols, setActiveProtocols] = useState<Set<string>>(
    new Set(),
  );
  const [activeChains, setActiveChains] = useState<Set<string>>(new Set());
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(new Set());

  // Extract unique filter values
  const protocols = useMemo(
    () => Array.from(new Set(vaults.map((ve) => ve.vault.protocol))).sort(),
    [vaults],
  );
  const chains = useMemo(
    () => Array.from(new Set(vaults.flatMap((ve) => ve.vault.chains))).sort(),
    [vaults],
  );
  const statuses = useMemo(
    () => Array.from(new Set(vaults.map((ve) => ve.vault.status))).sort(),
    [vaults],
  );

  function toggleFilter<T>(
    set: Set<T>,
    setFn: React.Dispatch<React.SetStateAction<Set<T>>>,
    value: T,
  ) {
    setFn((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function handleSort(col: SortColumn) {
    if (col === sortColumn) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection("desc");
    }
  }

  const filtered = useMemo(() => {
    return vaults.filter((ve) => {
      if (search && !ve.vault.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (activeProtocols.size > 0 && !activeProtocols.has(ve.vault.protocol))
        return false;
      if (
        activeChains.size > 0 &&
        !ve.vault.chains.some((c) => activeChains.has(c))
      )
        return false;
      if (activeStatuses.size > 0 && !activeStatuses.has(ve.vault.status))
        return false;
      return true;
    });
  }, [vaults, search, activeProtocols, activeChains, activeStatuses]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case "name":
          cmp = a.vault.name.localeCompare(b.vault.name);
          break;
        case "protocol":
          cmp = a.vault.protocol.localeCompare(b.vault.protocol);
          break;
        case "exposurePct":
          cmp = a.exposurePct - b.exposurePct;
          break;
        case "exposureUsd":
          cmp = a.toxicExposureUsd - b.toxicExposureUsd;
          break;
        case "status":
          cmp =
            (STATUS_ORDER[a.vault.status] ?? 9) -
            (STATUS_ORDER[b.vault.status] ?? 9);
          break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortColumn, sortDirection]);

  function SortIndicator({ col }: { col: SortColumn }) {
    if (sortColumn !== col)
      return (
        <span style={{ color: "rgba(255,255,255,0.20)" }} className="ml-1">
          ⇅
        </span>
      );
    return (
      <span className="ml-1" style={{ color: "rgba(255,255,255,0.70)" }}>
        {sortDirection === "asc" ? "▲" : "▼"}
      </span>
    );
  }

  return (
    <div>
      {/* Search + Filter Controls */}
      <div className="mb-4 space-y-3">
        <input
          type="text"
          placeholder="Search vaults..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:ring-1 focus:ring-white/20"
          style={{
            backgroundColor: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        />

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2">
          {protocols.map((p) => (
            <button
              key={`proto-${p}`}
              onClick={() =>
                toggleFilter(activeProtocols, setActiveProtocols, p)
              }
              className="rounded-full px-3 py-1 text-xs transition-colors capitalize"
              style={
                activeProtocols.has(p)
                  ? { backgroundColor: "#ffffff", color: "#09090b" }
                  : {
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "rgba(255,255,255,0.50)",
                    }
              }
            >
              {p}
            </button>
          ))}
          {chains.map((c) => (
            <button
              key={`chain-${c}`}
              onClick={() => toggleFilter(activeChains, setActiveChains, c)}
              className="rounded-full px-3 py-1 text-xs transition-colors uppercase"
              style={
                activeChains.has(c)
                  ? { backgroundColor: "#ffffff", color: "#09090b" }
                  : {
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "rgba(255,255,255,0.50)",
                    }
              }
            >
              {c}
            </button>
          ))}
          {statuses.map((s) => (
            <button
              key={`status-${s}`}
              onClick={() => toggleFilter(activeStatuses, setActiveStatuses, s)}
              className="rounded-full px-3 py-1 text-xs transition-colors capitalize"
              style={
                activeStatuses.has(s)
                  ? { backgroundColor: "#ffffff", color: "#09090b" }
                  : {
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "rgba(255,255,255,0.50)",
                    }
              }
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div
        className="overflow-x-auto rounded-lg"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <table className="w-full text-sm">
          <thead
            className="sticky top-0 z-10 text-xs uppercase"
            style={{
              backgroundColor: "#09090b",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.35)",
            }}
          >
            <tr>
              <th
                className="px-4 py-3 text-left cursor-pointer hover:text-white/70 transition-colors whitespace-nowrap"
                onClick={() => handleSort("name")}
              >
                Vault
                <SortIndicator col="name" />
              </th>
              <th
                className="px-4 py-3 text-left cursor-pointer hover:text-white/70 transition-colors whitespace-nowrap"
                onClick={() => handleSort("protocol")}
              >
                Protocol
                <SortIndicator col="protocol" />
              </th>
              <th className="px-4 py-3 text-left whitespace-nowrap">Chains</th>
              <th className="px-4 py-3 text-left whitespace-nowrap">
                Exposure
              </th>
              <th
                className="px-4 py-3 text-right cursor-pointer hover:text-white/70 transition-colors whitespace-nowrap"
                onClick={() => handleSort("exposurePct")}
              >
                Exp %<SortIndicator col="exposurePct" />
              </th>
              <th
                className="px-4 py-3 text-right cursor-pointer hover:text-white/70 transition-colors whitespace-nowrap"
                onClick={() => handleSort("exposureUsd")}
              >
                Exp $<SortIndicator col="exposureUsd" />
              </th>
              <th
                className="px-4 py-3 text-right cursor-pointer hover:text-white/70 transition-colors whitespace-nowrap"
                onClick={() => handleSort("status")}
              >
                Status
                <SortIndicator col="status" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((ve, i) => {
              const isPending = ve.status === "pending";
              return (
                <tr
                  key={i}
                  className="transition-colors"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "rgba(255,255,255,0.02)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/incident/${slug}/vault/${slugifyVaultName(ve.vault.name)}`}
                      className="block hover:text-white transition-colors"
                    >
                      <span className="font-medium text-white">
                        {ve.vault.name}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-sm capitalize"
                      style={{ color: "rgba(255,255,255,0.50)" }}
                    >
                      {ve.vault.protocol}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {ve.vault.chains.map((c) => (
                        <span
                          key={c}
                          className="rounded px-1.5 py-0.5 text-xs font-mono uppercase"
                          style={{
                            backgroundColor: "rgba(255,255,255,0.06)",
                            color: "rgba(255,255,255,0.50)",
                          }}
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 min-w-[80px]">
                    {isPending ? (
                      <span style={{ color: "rgba(255,255,255,0.20)" }}>—</span>
                    ) : (
                      <ExposureBar
                        breakdown={ve.breakdown}
                        toxicAssets={toxicAssets}
                        className="w-20"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono whitespace-nowrap">
                    {isPending ? (
                      <span style={{ color: "rgba(255,255,255,0.20)" }}>
                        pending
                      </span>
                    ) : (
                      <span
                        style={{
                          color: exposureColor(ve.exposurePct),
                        }}
                      >
                        {(ve.exposurePct * 100).toFixed(1)}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono whitespace-nowrap">
                    {isPending ? (
                      <span style={{ color: "rgba(255,255,255,0.20)" }}>—</span>
                    ) : (
                      <span style={{ color: "rgba(255,255,255,0.70)" }}>
                        {formatUsd(ve.toxicExposureUsd)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <StatusBadge
                      status={ve.vault.status}
                      note={ve.vault.statusNote}
                    />
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm"
                  style={{ color: "rgba(255,255,255,0.30)" }}
                >
                  No vaults match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p
        className="mt-2 text-xs text-right"
        style={{ color: "rgba(255,255,255,0.20)" }}
      >
        {sorted.length} of {vaults.length} vaults
      </p>
    </div>
  );
}
