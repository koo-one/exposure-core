"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import type { VaultExposure, ToxicAssetDef } from "@/lib/incident/types";
import { formatUsdCompact, formatNumberCompact } from "@/lib/incident/format";
import {
  getCuratorIcon,
  getProtocolIcon,
  getChainIcon,
  getAssetIcon,
} from "@/lib/incident/logos";
import { StatusBadge } from "./StatusBadge";

interface VaultTableProps {
  vaults: VaultExposure[];
  toxicAssets: ToxicAssetDef[];
}

type SortColumn = "name" | "exposurePct" | "exposureUsd" | "status";
type SortDirection = "asc" | "desc";

const STATUS_ORDER: Record<string, number> = {
  affected: 0,
  covering: 1,
};

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

  const curatorIcn = curator ? getCuratorIcon(curator) : null;
  const primaryLogo = curatorIcn ?? getProtocolIcon(protocol);
  const fallbackLogo = getProtocolIcon(protocol);

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

const CHAIN_NAMES: Record<string, string> = {
  eth: "Ethereum",
  base: "Base",
  arb: "Arbitrum",
  plasma: "Plasma",
};

function LogoWithTooltip({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="relative group/tip inline-flex">
      {children}
      <div
        className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 px-2 py-1 rounded text-[10px] font-medium whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none z-50"
        style={{
          backgroundColor: "#1a1a1a",
          color: "#fff",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function ChainLogo({ chain }: { chain: string }) {
  const [imgError, setImgError] = useState(false);
  const displayName = CHAIN_NAMES[chain] ?? chain.toUpperCase();

  if (imgError) {
    return (
      <span
        className="rounded px-1.5 py-0.5 text-xs font-mono uppercase"
        style={{
          backgroundColor: "var(--surface-secondary)",
          color: "var(--text-secondary)",
        }}
      >
        {chain}
      </span>
    );
  }

  return (
    <LogoWithTooltip label={displayName}>
      <img
        src={getChainIcon(chain)}
        alt={displayName}
        className="w-5 h-5"
        onError={() => setImgError(true)}
      />
    </LogoWithTooltip>
  );
}

const PROTOCOL_NAMES: Record<string, string> = {
  morpho: "Morpho",
  euler: "Euler",
  midas: "Midas",
  inverse: "Inverse Finance",
  fluid: "Fluid",
  gearbox: "Gearbox",
  venus: "Venus",
  "lista-dao": "Lista DAO",
  upshift: "Upshift",
  yo: "YO",
};

function ProtocolLogo({ protocol }: { protocol: string }) {
  const [imgError, setImgError] = useState(false);
  const displayName =
    PROTOCOL_NAMES[protocol] ??
    protocol.charAt(0).toUpperCase() + protocol.slice(1);
  const fb = PROTOCOL_FALLBACK[protocol] ?? {
    initials: protocol.slice(0, 2).toUpperCase(),
    color: "#888",
  };

  if (imgError) {
    return (
      <LogoWithTooltip label={displayName}>
        <div
          className="w-5 h-5 rounded flex items-center justify-center"
          style={{ backgroundColor: fb.color }}
        >
          <span className="text-white font-black" style={{ fontSize: 8 }}>
            {fb.initials}
          </span>
        </div>
      </LogoWithTooltip>
    );
  }

  return (
    <LogoWithTooltip label={displayName}>
      <img
        src={getProtocolIcon(protocol)}
        alt={displayName}
        className="w-5 h-5"
        onError={() => setImgError(true)}
      />
    </LogoWithTooltip>
  );
}

/* ── Filter Logo ── */
function FilterLogo({ src, alt }: { src: string; alt: string }) {
  const [error, setError] = useState(false);
  if (error) return null;
  return (
    <img
      src={src}
      alt={alt}
      className="w-4 h-4 flex-shrink-0"
      onError={() => setError(true)}
    />
  );
}

/** Extract likely underlying asset symbol from vault name */
function inferUnderlyingAsset(name: string): string | null {
  const tokens = ["USDC", "USDT", "ETH", "WETH", "DAI", "USD0", "AUSD", "DOLA"];
  for (const t of tokens) {
    if (name.toUpperCase().includes(t)) return t.toLowerCase();
  }
  return null;
}

/* ── Mini Ring Chart (SVG for proper transparency) ── */
function MiniRing({
  pct,
  size = 16,
  color = "#5792ff",
}: {
  pct: number;
  size?: number;
  color?: string;
}) {
  const clamp = Math.min(Math.max(pct, 0), 1);
  const r = size / 2 - 2;
  const circumference = 2 * Math.PI * r;
  const filled = circumference * clamp;
  return (
    <svg
      width={size}
      height={size}
      className="flex-shrink-0"
      style={{ transform: "rotate(-90deg)" }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(128,128,128,0.15)"
        strokeWidth={2.5}
      />
      {clamp > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeDasharray={`${filled} ${circumference - filled}`}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

/* ── Exposure Token Icons with tooltip ── */
function ExposureTokenIcons({
  breakdown,
  toxicAssets,
}: {
  breakdown: VaultExposure["breakdown"];
  toxicAssets: ToxicAssetDef[];
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const colorBySymbol = Object.fromEntries(
    toxicAssets.map((a) => [a.symbol, a.color]),
  );

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex items-center -space-x-1">
        {breakdown.map((b) => {
          const icon = getAssetIcon(b.asset);
          return icon ? (
            <img
              key={b.asset}
              src={icon}
              alt={b.asset}
              className="w-5 h-5 rounded-full ring-2 ring-white"
            />
          ) : (
            <div
              key={b.asset}
              className="w-5 h-5 rounded-full ring-2 ring-white flex items-center justify-center"
              style={{
                backgroundColor: colorBySymbol[b.asset] ?? "#999",
              }}
            >
              <span
                className="text-white"
                style={{ fontSize: 6, fontWeight: 800 }}
              >
                {b.asset.slice(0, 2)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Tooltip */}
      {showTooltip && breakdown.length > 0 && (
        <div
          className="absolute left-0 bottom-full mb-2 z-50 rounded-lg py-2 px-3 min-w-[220px]"
          style={{
            backgroundColor: "#1a1a1a",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          }}
        >
          {breakdown.map((b) => {
            const icon = getAssetIcon(b.asset);
            const pct = b.pct > 1 ? b.pct / 100 : b.pct;
            return (
              <div
                key={b.asset}
                className="flex items-center justify-between gap-4 py-1"
              >
                <div className="flex items-center gap-2">
                  {icon ? (
                    <img
                      src={icon}
                      alt={b.asset}
                      className="w-4 h-4 rounded-full"
                    />
                  ) : (
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{
                        backgroundColor: colorBySymbol[b.asset] ?? "#999",
                      }}
                    />
                  )}
                  <span className="text-white text-xs font-medium">
                    {b.asset}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/60 text-xs font-mono">
                    {formatUsdCompact(b.amountUsd)}
                  </span>
                  <MiniRing
                    pct={pct}
                    size={14}
                    color={colorBySymbol[b.asset] ?? "#5792ff"}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
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
  logoPath?: (option: string) => string;
}

function FilterDropdown({
  label,
  options,
  active,
  onToggle,
  capitalize: cap,
  uppercase: upper,
  logoPath,
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
          border: "1px solid var(--border)",
          color: count > 0 ? "var(--text-primary)" : "var(--text-secondary)",
          backgroundColor:
            count > 0 ? "var(--surface-secondary)" : "transparent",
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
          style={{ color: "var(--text-tertiary)", marginLeft: 2 }}
        >
          {open ? "\u25B2" : "\u25BC"}
        </span>
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-50 rounded-lg py-1 min-w-[160px]"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
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
                    borderColor: isActive
                      ? "var(--text-primary)"
                      : "var(--border)",
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
                {logoPath && <FilterLogo src={logoPath(opt)} alt={opt} />}
                <span style={{ color: "var(--text-primary)" }}>{display}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function VaultTable({ vaults, toxicAssets }: VaultTableProps) {
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

  // Flatten multi-chain vaults into per-chain rows
  interface FlatRow {
    ve: VaultExposure;
    chain: string;
    totalAllocationUsd: number;
    toxicExposureUsd: number;
    exposurePct: number;
    breakdown: VaultExposure["breakdown"];
  }

  const flattened = useMemo(() => {
    const rows: FlatRow[] = [];
    for (const ve of filtered) {
      if (ve.chainBreakdown && Object.keys(ve.chainBreakdown).length > 1) {
        // Split into per-chain rows
        for (const chain of ve.vault.chains) {
          const cb = ve.chainBreakdown[chain];
          if (cb) {
            rows.push({
              ve,
              chain,
              totalAllocationUsd: cb.totalAllocationUsd,
              toxicExposureUsd: cb.toxicExposureUsd,
              exposurePct:
                cb.totalAllocationUsd > 0
                  ? cb.toxicExposureUsd / cb.totalAllocationUsd
                  : 0,
              breakdown: cb.breakdown,
            });
          } else {
            // Chain has no data yet
            rows.push({
              ve,
              chain,
              totalAllocationUsd: 0,
              toxicExposureUsd: 0,
              exposurePct: 0,
              breakdown: [],
            });
          }
        }
      } else {
        // Single chain or no chain breakdown — show as one row
        rows.push({
          ve,
          chain: ve.vault.chains[0] ?? "",
          totalAllocationUsd: ve.totalAllocationUsd,
          toxicExposureUsd: ve.toxicExposureUsd,
          exposurePct: ve.exposurePct,
          breakdown: ve.breakdown,
        });
      }
    }
    return rows;
  }, [filtered]);

  const sorted = useMemo(() => {
    return [...flattened].sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case "name":
          cmp = a.ve.vault.name.localeCompare(b.ve.vault.name);
          break;
        case "exposurePct":
          cmp = a.exposurePct - b.exposurePct;
          break;
        case "exposureUsd":
          cmp = a.toxicExposureUsd - b.toxicExposureUsd;
          break;
        case "status":
          cmp =
            (STATUS_ORDER[a.ve.vault.status] ?? 9) -
            (STATUS_ORDER[b.ve.vault.status] ?? 9);
          break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [flattened, sortColumn, sortDirection]);

  const renderSortIndicator = (col: SortColumn) => {
    if (sortColumn !== col)
      return (
        <span style={{ color: "var(--text-tertiary)" }} className="ml-1">
          &uarr;&darr;
        </span>
      );
    return (
      <span className="ml-1" style={{ color: "var(--text-secondary)" }}>
        {sortDirection === "asc" ? "\u25B2" : "\u25BC"}
      </span>
    );
  };

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
          logoPath={getProtocolIcon}
        />
        <FilterDropdown
          label="Chain"
          options={chains}
          active={activeChains}
          onToggle={(v) => toggleFilter(setActiveChains, v)}
          uppercase
          logoPath={getChainIcon}
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
            className="w-full rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1"
            style={{
              backgroundColor: "var(--surface-secondary)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-lg overflow-x-auto"
        style={{ border: "1px solid var(--border)" }}
      >
        <table className="w-full text-sm" style={{ minWidth: 700 }}>
          <thead
            className="sticky top-0 z-10 uppercase"
            style={{
              backgroundColor: "var(--surface-secondary)",
              borderBottom: "1px solid var(--border)",
              color: "var(--text-tertiary)",
              fontSize: 10,
              fontWeight: 300,
              letterSpacing: "0.06em",
            }}
          >
            <tr>
              <th className="px-3 py-3 text-left whitespace-nowrap">Network</th>
              <th className="px-3 py-3 text-left whitespace-nowrap">
                Protocol
              </th>
              <th className="px-4 py-3 text-left whitespace-nowrap">Vault</th>
              <th
                className="px-4 py-3 text-left cursor-pointer hover:text-black/70 transition-colors whitespace-nowrap select-none"
                onClick={() => handleSort("exposureUsd")}
              >
                <span className="relative group/th inline-flex items-center gap-1">
                  At-Risk{renderSortIndicator("exposureUsd")}
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className="opacity-30"
                  >
                    <circle
                      cx="8"
                      cy="8"
                      r="7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <text
                      x="8"
                      y="12"
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="700"
                    >
                      ?
                    </text>
                  </svg>
                  <span
                    className="absolute left-0 top-full mt-1 z-50 px-3 py-2 rounded-lg text-[11px] font-normal normal-case tracking-normal leading-snug whitespace-normal w-[220px] text-left opacity-0 group-hover/th:opacity-100 transition-opacity pointer-events-none"
                    style={{ backgroundColor: "#1a1a1a", color: "#fff" }}
                  >
                    Amount of vault capital allocated to toxic Resolv assets
                    (USR, wstUSR, RLP). This is the capital at risk of loss from
                    the exploit.
                  </span>
                </span>
              </th>
              <th className="px-4 py-3 text-left whitespace-nowrap">
                Exposure
              </th>
              <th
                className="px-4 py-3 text-right cursor-pointer hover:text-black/70 transition-colors whitespace-nowrap select-none"
                onClick={() => handleSort("exposurePct")}
              >
                <span className="relative group/th inline-flex items-center gap-1 justify-end">
                  %{renderSortIndicator("exposurePct")}
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className="opacity-30"
                  >
                    <circle
                      cx="8"
                      cy="8"
                      r="7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <text
                      x="8"
                      y="12"
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="700"
                    >
                      ?
                    </text>
                  </svg>
                  <span
                    className="absolute right-0 top-full mt-1 z-50 px-3 py-2 rounded-lg text-[11px] font-normal normal-case tracking-normal leading-snug whitespace-normal w-[220px] text-left opacity-0 group-hover/th:opacity-100 transition-opacity pointer-events-none"
                    style={{ backgroundColor: "#1a1a1a", color: "#fff" }}
                  >
                    Percentage of total vault deposits exposed to toxic Resolv
                    assets. Higher % means greater relative risk for depositors.
                  </span>
                </span>
              </th>
              <th
                className="px-4 py-3 text-right cursor-pointer hover:text-black/70 transition-colors whitespace-nowrap select-none"
                onClick={() => handleSort("status")}
              >
                Status
                {renderSortIndicator("status")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, rowIdx) => {
              const { ve, chain } = row;
              const isPending =
                ve.status === "pending" ||
                (row.toxicExposureUsd === 0 &&
                  row.breakdown.length === 0 &&
                  ve.vault.status !== "recovered" &&
                  ve.vault.status !== "covering");
              return (
                <tr
                  key={`${ve.vault.protocol}-${ve.vault.name}-${chain}-${rowIdx}`}
                  className="transition-colors hover:bg-black/[0.02]"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  {/* Network — single chain per row */}
                  <td
                    className="px-3 py-3"
                    title={CHAIN_NAMES[chain] ?? chain.toUpperCase()}
                  >
                    <ChainLogo chain={chain} />
                  </td>
                  {/* Protocol */}
                  <td
                    className="px-3 py-3"
                    title={
                      PROTOCOL_NAMES[ve.vault.protocol] ?? ve.vault.protocol
                    }
                  >
                    <ProtocolLogo protocol={ve.vault.protocol} />
                  </td>
                  {/* Vault */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <VaultLogo
                        protocol={ve.vault.protocol}
                        curator={ve.vault.curator}
                      />
                      <span
                        className="font-medium truncate min-w-0"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {ve.vault.name}
                      </span>
                    </div>
                  </td>
                  {/* At-Risk */}
                  <td className="px-4 py-3 text-left font-mono whitespace-nowrap">
                    {isPending ? (
                      <span
                        style={{ color: "var(--text-tertiary)", fontSize: 11 }}
                      >
                        unknown
                      </span>
                    ) : (
                      <div style={{ lineHeight: 1.4 }}>
                        <span
                          style={{ fontSize: 12, color: "var(--text-primary)" }}
                        >
                          {formatNumberCompact(row.toxicExposureUsd)}{" "}
                          <span
                            style={{
                              fontWeight: 400,
                              color: "var(--text-secondary)",
                            }}
                          >
                            {inferUnderlyingAsset(
                              ve.vault.name,
                            )?.toUpperCase() ?? "USD"}
                          </span>
                        </span>
                        <div>
                          <span
                            className="inline-block rounded mt-0.5"
                            style={{
                              fontSize: 10,
                              color: "var(--text-secondary)",
                              backgroundColor: "var(--surface-secondary)",
                              padding: "1px 5px",
                            }}
                          >
                            {formatUsdCompact(row.toxicExposureUsd)}
                          </span>
                        </div>
                      </div>
                    )}
                  </td>
                  {/* Exposure — token icons */}
                  <td className="px-4 py-3">
                    {isPending ? (
                      <span
                        style={{ color: "var(--text-tertiary)", fontSize: 11 }}
                      >
                        —
                      </span>
                    ) : row.breakdown.length > 0 ? (
                      <ExposureTokenIcons
                        breakdown={row.breakdown}
                        toxicAssets={toxicAssets}
                      />
                    ) : (
                      <span
                        style={{ color: "var(--text-tertiary)", fontSize: 11 }}
                      >
                        —
                      </span>
                    )}
                  </td>
                  {/* % with mini ring */}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {isPending ? (
                      <span
                        style={{ color: "var(--text-tertiary)", fontSize: 11 }}
                      >
                        —
                      </span>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <span
                          className="font-mono"
                          style={{
                            fontSize: 12,
                            color: "var(--text-secondary)",
                          }}
                        >
                          {(row.exposurePct * 100).toFixed(1)}%
                        </span>
                        <MiniRing pct={row.exposurePct} size={16} />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <StatusBadge status={ve.vault.status} />
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm"
                  style={{ color: "var(--text-tertiary)" }}
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
        style={{ color: "var(--text-tertiary)" }}
      >
        {sorted.length} of {vaults.length} vaults
      </p>
    </div>
  );
}
