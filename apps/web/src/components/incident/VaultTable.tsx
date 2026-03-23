"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import type { VaultExposure, ToxicAssetDef } from "@/lib/incident/types";
import { slugifyVaultName } from "@/lib/incident/types";
import { formatUsdCompact } from "@/lib/incident/format";
import { getCuratorLogoKey } from "@/lib/incident/logos";
import { StatusBadge } from "./StatusBadge";
import { ExposureBar } from "./ExposureBar";

interface VaultTableProps {
  vaults: VaultExposure[];
  toxicAssets: ToxicAssetDef[];
  slug: string;
}

type SortColumn = "name" | "exposurePct" | "exposureUsd" | "status";
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

const PROTOCOL_FALLBACK: Record<string, { initials: string; color: string }> = {
  morpho: { initials: "M", color: "#2563eb" },
  euler: { initials: "E", color: "#e04040" },
  midas: { initials: "Mi", color: "#8b5cf6" },
  inverse: { initials: "IN", color: "#000000" },
  fluid: { initials: "FL", color: "#3b82f6" },
  gearbox: { initials: "G", color: "#4a4a4a" },
};

function VaultLogo({
  protocol,
  curator,
}: {
  protocol: string;
  curator?: string;
}) {
  const [primaryError, setPrimaryError] = useState(false);
  const [fallbackError, setFallbackError] = useState(false);
  const fb = PROTOCOL_FALLBACK[protocol] ?? {
    initials: protocol.slice(0, 2).toUpperCase(),
    color: "#888",
  };

  const curatorKey = curator ? getCuratorLogoKey(curator) : null;
  const primaryLogo = curatorKey
    ? `/logos/curators/${curatorKey}.svg`
    : `/logos/protocols/${protocol}.svg`;
  const fallbackLogo = `/logos/protocols/${protocol}.svg`;

  if (primaryError && fallbackError) {
    return (
      <div
        title={protocol}
        className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: fb.color }}
      >
        <span className="text-white font-black" style={{ fontSize: 8 }}>
          {fb.initials}
        </span>
      </div>
    );
  }

  if (primaryError) {
    return (
      <img
        src={fallbackLogo}
        alt={protocol}
        title={protocol}
        className="w-5 h-5 flex-shrink-0"
        onError={() => setFallbackError(true)}
      />
    );
  }

  return (
    <img
      src={primaryLogo}
      alt={curator ?? protocol}
      title={curator ?? protocol}
      className="w-5 h-5 flex-shrink-0"
      onError={() => setPrimaryError(true)}
    />
  );
}

function ProtocolLogo({ protocol }: { protocol: string }) {
  const [imgError, setImgError] = useState(false);
  const fb = PROTOCOL_FALLBACK[protocol] ?? {
    initials: protocol.slice(0, 2).toUpperCase(),
    color: "#888",
  };

  if (imgError) {
    return (
      <div
        title={protocol}
        className="w-5 h-5 rounded flex items-center justify-center"
        style={{ backgroundColor: fb.color }}
      >
        <span className="text-white font-black" style={{ fontSize: 8 }}>
          {fb.initials}
        </span>
      </div>
    );
  }

  return (
    <img
      src={`/logos/protocols/${protocol}.svg`}
      alt={protocol}
      title={protocol}
      className="w-5 h-5"
      onError={() => setImgError(true)}
    />
  );
}

function ChainLogo({ chain }: { chain: string }) {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <span
        className="rounded px-1.5 py-0.5 text-xs font-mono uppercase"
        style={{
          backgroundColor: "rgba(0,0,0,0.04)",
          color: "rgba(0,0,0,0.50)",
        }}
      >
        {chain}
      </span>
    );
  }

  return (
    <img
      src={`/logos/chains/${chain}.svg`}
      alt={chain}
      title={chain}
      className="w-4 h-4"
      onError={() => setImgError(true)}
    />
  );
}

/* ── Filter Dropdown ── */
interface FilterDropdownProps {
  label: string;
  options: string[];
  active: Set<string>;
  onToggle: (value: string) => void;
  capitalize?: boolean;
  uppercase?: boolean;
}

function FilterDropdown({
  label,
  options,
  active,
  onToggle,
  capitalize: cap,
  uppercase: upper,
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const count = active.size;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
        style={{
          border: "1px solid rgba(0,0,0,0.10)",
          color: count > 0 ? "#000" : "rgba(0,0,0,0.50)",
          backgroundColor: count > 0 ? "rgba(0,0,0,0.04)" : "transparent",
        }}
      >
        <span>{label}</span>
        {count > 0 && (
          <span
            className="rounded-full px-1.5 text-[10px] font-bold text-white"
            style={{ backgroundColor: "#000" }}
          >
            {count}
          </span>
        )}
        <span
          className="text-[10px]"
          style={{ color: "rgba(0,0,0,0.30)", marginLeft: 2 }}
        >
          {open ? "\u25B2" : "\u25BC"}
        </span>
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-50 rounded-lg py-1 min-w-[160px]"
          style={{
            backgroundColor: "#fff",
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          }}
        >
          {options.map((opt) => {
            const isActive = active.has(opt);
            let display = opt;
            if (upper) display = opt.toUpperCase();
            else if (cap) display = opt.charAt(0).toUpperCase() + opt.slice(1);
            return (
              <button
                key={opt}
                onClick={() => onToggle(opt)}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-black/[0.03] transition-colors"
              >
                <span
                  className="w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0"
                  style={{
                    borderColor: isActive ? "#000" : "rgba(0,0,0,0.15)",
                    backgroundColor: isActive ? "#000" : "transparent",
                  }}
                >
                  {isActive && (
                    <svg
                      width="8"
                      height="8"
                      viewBox="0 0 8 8"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M1.5 4L3.25 5.75L6.5 2.25"
                        stroke="white"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span style={{ color: "rgba(0,0,0,0.70)" }}>{display}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function VaultTable({ vaults, toxicAssets, slug }: VaultTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("exposureUsd");
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
        <span style={{ color: "rgba(0,0,0,0.20)" }} className="ml-1">
          &uarr;&darr;
        </span>
      );
    return (
      <span className="ml-1" style={{ color: "rgba(0,0,0,0.50)" }}>
        {sortDirection === "asc" ? "\u25B2" : "\u25BC"}
      </span>
    );
  }

  return (
    <div>
      {/* Filter Dropdowns + Search */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <FilterDropdown
          label="Protocol"
          options={protocols}
          active={activeProtocols}
          onToggle={(v) => toggleFilter(setActiveProtocols, v)}
          capitalize
        />
        <FilterDropdown
          label="Chain"
          options={chains}
          active={activeChains}
          onToggle={(v) => toggleFilter(setActiveChains, v)}
          uppercase
        />
        <FilterDropdown
          label="Status"
          options={statuses}
          active={activeStatuses}
          onToggle={(v) => toggleFilter(setActiveStatuses, v)}
          capitalize
        />
        <div className="flex-1 min-w-[180px]">
          <input
            type="text"
            placeholder="Search vaults..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg px-3 py-1.5 text-xs text-black placeholder:text-black/30 outline-none focus:ring-1 focus:ring-black/10"
            style={{
              backgroundColor: "rgba(0,0,0,0.02)",
              border: "1px solid rgba(0,0,0,0.06)",
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div
        className="overflow-x-auto rounded-lg"
        style={{ border: "1px solid rgba(0,0,0,0.06)" }}
      >
        <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "28%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "4%" }} />
          </colgroup>
          <thead
            className="sticky top-0 z-10 text-xs uppercase"
            style={{
              backgroundColor: "rgba(0,0,0,0.03)",
              borderBottom: "1px solid rgba(0,0,0,0.06)",
              color: "rgba(0,0,0,0.35)",
            }}
          >
            <tr>
              <th
                className="px-4 py-3 text-left cursor-pointer hover:text-black/70 transition-colors whitespace-nowrap"
                onClick={() => handleSort("name")}
              >
                Vault
                <SortIndicator col="name" />
              </th>
              <th className="px-4 py-3 text-left whitespace-nowrap">
                Protocol
              </th>
              <th className="px-4 py-3 text-left whitespace-nowrap">Chains</th>
              <th className="px-4 py-3 text-left whitespace-nowrap">
                Exposure
              </th>
              <th
                className="px-4 py-3 text-right cursor-pointer hover:text-black/70 transition-colors whitespace-nowrap"
                onClick={() => handleSort("exposureUsd")}
              >
                At-Risk $
                <SortIndicator col="exposureUsd" />
              </th>
              <th
                className="px-4 py-3 text-right cursor-pointer hover:text-black/70 transition-colors whitespace-nowrap"
                onClick={() => handleSort("exposurePct")}
              >
                %<SortIndicator col="exposurePct" />
              </th>
              <th
                className="px-4 py-3 text-right cursor-pointer hover:text-black/70 transition-colors whitespace-nowrap"
                onClick={() => handleSort("status")}
              >
                Status
                <SortIndicator col="status" />
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((ve, i) => {
              const isPending = ve.status === "pending";
              return (
                <tr
                  key={i}
                  className="transition-colors"
                  style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.02)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/incident/${slug}/vault/${slugifyVaultName(ve.vault.name)}`}
                      className="flex items-center gap-2 hover:text-black/70 transition-colors"
                    >
                      <VaultLogo
                        protocol={ve.vault.protocol}
                        curator={ve.vault.curator}
                      />
                      <div className="min-w-0">
                        <span className="font-medium text-black block truncate">
                          {ve.vault.name}
                        </span>
                        {ve.vault.curator && (
                          <span
                            className="block truncate"
                            style={{ fontSize: 10, color: "rgba(0,0,0,0.35)" }}
                          >
                            {ve.vault.curator}
                          </span>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <ProtocolLogo protocol={ve.vault.protocol} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {ve.vault.chains.map((c) => (
                        <ChainLogo key={c} chain={c} />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {isPending ? (
                      <span style={{ color: "rgba(0,0,0,0.20)" }}>&mdash;</span>
                    ) : (
                      <ExposureBar
                        breakdown={ve.breakdown}
                        toxicAssets={toxicAssets}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono whitespace-nowrap">
                    {isPending ? (
                      <span style={{ color: "rgba(0,0,0,0.20)" }}>&mdash;</span>
                    ) : (
                      <span style={{ color: "rgba(0,0,0,0.70)" }}>
                        {formatUsdCompact(ve.toxicExposureUsd)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono whitespace-nowrap">
                    {isPending ? (
                      <span style={{ color: "rgba(0,0,0,0.20)" }}>pending</span>
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
                  <td className="px-4 py-3 text-right">
                    <StatusBadge status={ve.vault.status} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link
                      href={`/incident/${slug}/vault/${slugifyVaultName(ve.vault.name)}`}
                      className="text-black/20 hover:text-black/50 transition-colors"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M4.5 2.5L8 6L4.5 9.5"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </Link>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm"
                  style={{ color: "rgba(0,0,0,0.30)" }}
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
        style={{ color: "rgba(0,0,0,0.20)" }}
      >
        {sorted.length} of {vaults.length} vaults
      </p>
    </div>
  );
}
