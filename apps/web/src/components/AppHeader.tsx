"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Search,
  Activity,
  Command,
  Globe,
  ChevronRight,
  SlidersHorizontal,
  X,
  Dices,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SNAPSHOT_TIME_HEADER } from "@/constants";
import type { DropdownGroup } from "@/lib/search";
import {
  hasProtocolLogo,
  getProtocolLogoPath,
  getNodeLogos,
  hasChainLogo,
  getChainLogoPath,
} from "@/lib/logos";
import { FilterPill } from "@/components/FilterPill";

interface AppHeaderProps {
  selectedProtocol: string;
  selectedChain: string;
  selectedCurator: string;
  apyMin: string;
  apyMax: string;
  query: string;
  onQueryChange: (value: string) => void;
  updateParams: (
    params: Record<string, string | null>,
    mode?: "push" | "replace",
  ) => void;
  protocols: { label: string; value: string }[];
  chains: { label: string; value: string }[];
  curators: { label: string; value: string }[];
  dropdownResults: DropdownGroup[];
  buildChainLabel: (chains: DropdownGroup["chains"]) => string;
  onRandom?: () => void;
}

export function AppHeader({
  selectedProtocol,
  selectedChain,
  selectedCurator,
  apyMin,
  apyMax,
  query,
  onQueryChange,
  updateParams,
  protocols,
  chains,
  curators,
  dropdownResults,
  buildChainLabel,
  onRandom,
}: AppHeaderProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [snapshotTime, setSnapshotTime] = useState("");

  const hasActiveFilters =
    selectedProtocol !== "all" ||
    selectedChain !== "all" ||
    selectedCurator !== "all" ||
    apyMin.trim().length > 0 ||
    apyMax.trim().length > 0;

  const isSearchActive = !!(query || hasActiveFilters);
  const showSearchDropdown = isSearchActive && isSearchDropdownOpen;

  const selectSearchResult = useCallback(
    (group: DropdownGroup) => {
      const primary = group.primary;
      onQueryChange("");
      updateParams(
        {
          id: primary.id,
          assetChain: primary.chain,
          assetProtocol: primary.protocol,
          q: "",
        },
        "push",
      );
      setIsSearchDropdownOpen(false);
    },
    [onQueryChange, updateParams],
  );

  // Auto-open search dropdown on query
  useEffect(() => {
    if (query.trim().length > 0) {
      setIsSearchDropdownOpen(true);
    }
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();

    const loadSnapshotTime = async () => {
      try {
        const response = await fetch("/api/search-index", {
          cache: "no-store",
          method: "HEAD",
          signal: controller.signal,
        });
        if (!response.ok) return;

        const rawSnapshotTime = response.headers.get(SNAPSHOT_TIME_HEADER);
        if (!rawSnapshotTime) return;

        const snapshotDate = new Date(rawSnapshotTime);
        if (Number.isNaN(snapshotDate.getTime())) return;

        const year = snapshotDate.getUTCFullYear();
        const month = String(snapshotDate.getUTCMonth() + 1).padStart(2, "0");
        const day = String(snapshotDate.getUTCDate()).padStart(2, "0");

        setSnapshotTime(
          `${year}-${month}-${day} ${snapshotDate.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
            hour12: false,
          })} UTC`,
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        console.error("Failed to load snapshot time:", error);
      }
    };

    void loadSnapshotTime();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (selectedCurator === "all") return;
    if (curators.some((curator) => curator.value === selectedCurator)) return;
    updateParams({ curator: "all" });
  }, [curators, selectedCurator, updateParams]);

  // Click outside to close both dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Handle search dropdown
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(target)
      ) {
        setIsSearchDropdownOpen(false);
      }

      // Handle filter dropdown
      if (
        filterDropdownRef.current &&
        !filterDropdownRef.current.contains(target)
      ) {
        setIsFilterDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchDropdownOpen(true);
      }
      if (e.key === "Escape") {
        setIsSearchDropdownOpen(false);
        setIsFilterDropdownOpen(false);
      }
      if (
        e.key === "Enter" &&
        document.activeElement === searchInputRef.current
      ) {
        if (dropdownResults.length > 0) {
          selectSearchResult(dropdownResults[0]);
          searchInputRef.current?.blur();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dropdownResults, selectSearchResult]);

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-black px-6 py-4 flex items-center justify-between gap-8">
      {/* Brand - Left */}
      <Link href="/" className="flex items-center gap-3 shrink-0 group">
        <div className="bg-black rounded-lg w-8 h-8 flex items-center justify-center transition-transform group-hover:scale-105 shadow-lg shadow-black/10">
          <Activity className="text-[#00FF85] w-4 h-4" />
        </div>
        <div className="flex flex-col -gap-1">
          <span className="font-black tracking-tighter uppercase leading-none text-lg">
            Exposure
          </span>
          <span className="text-[7px] font-bold text-black/30 uppercase tracking-[0.2em]">
            Risk Registry
          </span>
        </div>
      </Link>

      {/* Search & Filters - Center */}
      <div className="flex-grow max-w-2xl relative flex items-center gap-3">
        <div className="relative flex-grow group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-black/20 group-focus-within:text-black transition-colors" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search assets, protocols, or chains..."
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={() => setIsSearchDropdownOpen(true)}
            className="w-full pl-11 pr-12 py-2.5 bg-black/[0.02] border border-black/5 rounded-full font-bold uppercase tracking-tight focus:outline-none focus:border-black/10 focus:ring-4 focus:ring-black/[0.01] transition-all placeholder:text-black/10 text-[11px]"
          />
          <div className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 items-center gap-1.5 px-1.5 py-1 bg-black/5 border border-black/5 rounded text-[8px] font-black text-black/40 uppercase pointer-events-none">
            <Command className="w-2 h-2" /> K
          </div>

          {/* Search Results Dropdown */}
          {showSearchDropdown && (
            <div
              ref={dropdownRef}
              className="absolute top-full left-0 right-0 mt-3 bg-white border border-black/[0.08] rounded-2xl shadow-[0_20px_40px_-12px_rgba(0,0,0,0.12)] z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300"
            >
              <div className="max-h-[350px] overflow-y-auto custom-scrollbar p-1.5">
                {dropdownResults.length > 0 ? (
                  dropdownResults.slice(0, 8).map((group) => {
                    const primary = group.primary;
                    const logoPaths = getNodeLogos({
                      name: group.name,
                      protocol: primary.protocol,
                      logoKeys: primary.logoKeys ?? group.logoKeys,
                    }).slice(0, 2);
                    const chainLabel = buildChainLabel(group.chains);
                    // Keep dropdown rows pinned to full node names; `displayName`
                    // can collapse to a token symbol and must not replace it here.
                    const rowName = group.name || group.displayName || "-";
                    const tvlLabel =
                      typeof group.totalTvlUsd === "number"
                        ? new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: "USD",
                            notation: "compact",
                            maximumFractionDigits: 1,
                          }).format(group.totalTvlUsd)
                        : "—";
                    return (
                      <button
                        key={group.key}
                        onClick={() => selectSearchResult(group)}
                        className="w-full flex items-center justify-between p-3 hover:bg-black/[0.02] rounded-xl transition-all group/item"
                      >
                        <div className="flex items-center gap-3 min-w-0 text-left">
                          <div className="w-8 h-8 bg-black/[0.03] rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                            {logoPaths.length > 0 ? (
                              <div className="flex items-center -space-x-1.5">
                                {logoPaths.map((logoPath, idx) => (
                                  <div
                                    key={logoPath}
                                    className="w-5 h-5 bg-white border border-black/10 rounded-full flex items-center justify-center p-0.5"
                                    style={{ zIndex: 10 - idx }}
                                  >
                                    <Image
                                      src={logoPath}
                                      alt={group.name}
                                      width={14}
                                      height={14}
                                      className="object-contain"
                                    />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[9px] font-black">
                                {group.name.charAt(0)}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[10px] font-black uppercase tracking-tight group-hover/item:text-[#00FF85] transition-colors truncate">
                              {rowName}
                            </div>
                            <div className="text-[8px] font-bold text-black/30 uppercase tracking-widest truncate">
                              {group.protocol} • {chainLabel}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="text-[7px] font-black text-black/20 uppercase">
                              TVL
                            </div>
                            <div className="text-[9px] font-black text-black/70 font-mono">
                              {tvlLabel}
                            </div>
                          </div>
                          <ChevronRight className="w-3 h-3 text-black/10 group-hover/item:translate-x-0.5 transition-all" />
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="p-6 text-center">
                    <p className="text-[9px] font-bold text-black/30 uppercase tracking-widest">
                      No matching assets
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {onRandom ? (
          <button
            onClick={onRandom}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-black/10 hover:border-black/30 bg-white text-black transition-all duration-200 text-[10px] font-black uppercase tracking-widest active:scale-95"
            title="Pick a random asset"
          >
            <Dices className="w-3.5 h-3.5" />
            <span className="hidden md:block">Random</span>
          </button>
        ) : null}

        {/* Filters Button & Dropdown */}
        <div className="relative" ref={filterDropdownRef}>
          <button
            onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-full border transition-all duration-200 text-[10px] font-black uppercase tracking-widest",
              hasActiveFilters || isFilterDropdownOpen
                ? "bg-black text-white border-black shadow-lg shadow-black/10"
                : "bg-white border-black/10 hover:border-black/30 text-black",
            )}
          >
            <SlidersHorizontal
              className={cn(
                "w-3.5 h-3.5",
                hasActiveFilters ? "text-[#00FF85]" : "",
              )}
            />
            <span className="hidden md:block">Filters</span>
            {hasActiveFilters && (
              <div className="w-1.5 h-1.5 rounded-full bg-[#00FF85]" />
            )}
          </button>

          {isFilterDropdownOpen && (
            <div className="absolute top-full right-0 mt-3 w-72 bg-white border border-black shadow-2xl rounded-2xl p-5 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40">
                  Query Filters
                </h3>
                <button
                  onClick={() => setIsFilterDropdownOpen(false)}
                  className="text-black/20 hover:text-black transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[8px] font-black uppercase tracking-widest text-black/30">
                    Protocol Selection
                  </label>
                  <FilterPill
                    label="Protocol"
                    value={selectedProtocol}
                    options={protocols}
                    onChange={(v) => updateParams({ protocol: v })}
                    icon={
                      selectedProtocol !== "all" &&
                      hasProtocolLogo(selectedProtocol) ? (
                        <Image
                          src={getProtocolLogoPath(selectedProtocol)}
                          alt={selectedProtocol}
                          width={12}
                          height={12}
                          className="object-contain"
                        />
                      ) : (
                        <Globe className="w-3 h-3 text-black/20" />
                      )
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[8px] font-black uppercase tracking-widest text-black/30">
                    Chain Network
                  </label>
                  <FilterPill
                    label="Chain"
                    value={selectedChain}
                    options={chains}
                    onChange={(v) => updateParams({ chain: v })}
                    icon={
                      selectedChain !== "all" && hasChainLogo(selectedChain) ? (
                        <Image
                          src={getChainLogoPath(selectedChain)}
                          alt={selectedChain}
                          width={12}
                          height={12}
                          className="object-contain"
                        />
                      ) : (
                        <Activity className="w-3 h-3 text-black/20" />
                      )
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[8px] font-black uppercase tracking-widest text-black/30">
                    APY Range (%)
                  </label>
                  <div className="flex items-center gap-2 p-2 border border-black/10 rounded-xl bg-black/[0.01]">
                    <input
                      inputMode="decimal"
                      placeholder="MIN"
                      value={apyMin}
                      onChange={(e) => updateParams({ apyMin: e.target.value })}
                      className="w-full bg-transparent text-[10px] font-bold uppercase tracking-widest focus:outline-none text-center"
                    />
                    <div className="w-px h-3 bg-black/10" />
                    <input
                      inputMode="decimal"
                      placeholder="MAX"
                      value={apyMax}
                      onChange={(e) => updateParams({ apyMax: e.target.value })}
                      className="w-full bg-transparent text-[10px] font-bold uppercase tracking-widest focus:outline-none text-center"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[8px] font-black uppercase tracking-widest text-black/30">
                    Risk Curator
                  </label>
                  <FilterPill
                    label="Curator"
                    value={selectedCurator}
                    options={curators}
                    onChange={(v) => updateParams({ curator: v })}
                  />
                </div>

                <div className="pt-2 border-t border-black/5 flex justify-end">
                  <button
                    onClick={() => {
                      updateParams({
                        protocol: "all",
                        chain: "all",
                        curator: "all",
                        apyMin: "",
                        apyMax: "",
                        q: "",
                      });
                      setIsFilterDropdownOpen(false);
                    }}
                    className="text-[8px] font-black uppercase tracking-widest text-black/40 hover:text-black transition-colors"
                  >
                    Reset All Filters
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status - Right */}
      <div className="hidden lg:flex items-center gap-4 shrink-0">
        <div className="flex flex-col items-end">
          <span className="text-[8px] font-black text-black/20 uppercase tracking-widest leading-none mb-1">
            Graph Data Snapshot (UTC)
          </span>
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-1 rounded-full bg-amber-400" />
            <span className="text-[9px] font-bold uppercase tracking-tight text-black/60">
              {snapshotTime || "—"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
