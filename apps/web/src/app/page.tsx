"use client";

import { Suspense, useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Search,
  Activity,
  Command,
  ArrowRight,
  Filter,
  Globe,
  LayoutGrid,
  ChevronRight,
} from "lucide-react";
import { type SearchIndexEntry } from "@/constants";
import { useSearchParams, useRouter } from "next/navigation";
import {
  hasProtocolLogo,
  getProtocolLogoPath,
  getNodeLogos,
  hasChainLogo,
  getChainLogoPath,
} from "@/lib/logos";
import Image from "next/image";
import { FilterPill } from "@/components/FilterPill";
import { cn } from "@/lib/utils";

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [dynamicIndex, setDynamicIndex] = useState<SearchIndexEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFocused, setIsFocused] = useState(false);

  // Sync state with URL params
  const selectedProtocol = searchParams.get("protocol") || "all";
  const selectedChain = searchParams.get("chain") || "all";
  const selectedCurator = searchParams.get("curator") || "all";
  const apySort = searchParams.get("apySort") || "default";
  const query = searchParams.get("q") || "";

  const hasFilters =
    selectedProtocol !== "all" ||
    selectedChain !== "all" ||
    selectedCurator !== "all" ||
    apySort !== "default";

  // Active search includes text query OR any filter/sort.
  const isSearchActive = !!(query || hasFilters);

  // Once pinned by interaction, it stays pinned for this session unless reset
  const [isPinned, setIsPinned] = useState(hasFilters);

  useEffect(() => {
    if (isSearchActive) setIsPinned(true);
  }, [isSearchActive]);

  // Grid is only visible when filters are active and there is no text query.
  const showGrid = isSearchActive && !query;
  const showDropdown = isFocused && query.length > 0;

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/search-index");
        if (!response.ok) return;
        const json = (await response.json()) as unknown;
        if (!Array.isArray(json)) return;
        setDynamicIndex(json as SearchIndexEntry[]);
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const protocols = useMemo(() => {
    const set = new Set(dynamicIndex.map((e) => e.protocol));
    return [
      { label: "All Protocols", value: "all" },
      ...Array.from(set)
        .sort()
        .map((p) => ({ label: p, value: p })),
    ];
  }, [dynamicIndex]);

  const chains = useMemo(() => {
    const set = new Set(dynamicIndex.map((e) => e.chain));
    return [
      { label: "Any Chain", value: "all" },
      ...Array.from(set)
        .sort()
        .map((c) => ({ label: c, value: c })),
    ];
  }, [dynamicIndex]);

  const curators = useMemo(() => {
    const set = new Set<string>();
    for (const entry of dynamicIndex) {
      if (typeof entry.curator !== "string") continue;
      const value = entry.curator.trim();
      if (!value) continue;
      set.add(value);
    }
    return [
      { label: "Anyone", value: "all" },
      ...Array.from(set)
        .sort((a, b) => a.localeCompare(b))
        .map((c) => ({ label: c, value: c })),
    ];
  }, [dynamicIndex]);

  const apySortOptions = [
    { label: "Default", value: "default" },
    { label: "APY: High to Low", value: "desc" },
    { label: "APY: Low to High", value: "asc" },
  ];

  const filteredResults = useMemo(() => {
    let results = dynamicIndex;

    if (selectedProtocol !== "all") {
      results = results.filter(
        (e) => e.protocol.toLowerCase() === selectedProtocol.toLowerCase(),
      );
    }

    if (selectedChain !== "all") {
      results = results.filter(
        (e) => e.chain.toLowerCase() === selectedChain.toLowerCase(),
      );
    }

    if (query) {
      const q = query.toLowerCase();
      results = results.filter((entry) => {
        const haystack =
          `${entry.name} ${entry.id} ${entry.nodeId} ${entry.protocol} ${entry.chain}`.toLowerCase();
        return haystack.includes(q);
      });
    }

    if (selectedCurator !== "all") {
      results = results.filter((entry) => entry.curator === selectedCurator);
    }

    if (apySort !== "default") {
      const dir = apySort === "asc" ? "asc" : "desc";
      results = [...results].sort((a, b) => {
        const aApy = typeof a.apy === "number" ? a.apy : null;
        const bApy = typeof b.apy === "number" ? b.apy : null;

        if (aApy == null && bApy == null) return 0;
        if (aApy == null) return 1;
        if (bApy == null) return -1;

        return dir === "asc" ? aApy - bApy : bApy - aApy;
      });
    }

    return results;
  }, [
    selectedProtocol,
    selectedChain,
    selectedCurator,
    apySort,
    query,
    dynamicIndex,
  ]);

  const updateParams = (newParams: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([key, value]) => {
      if (
        value === null ||
        (value === "all" &&
          (key === "protocol" || key === "curator" || key === "chain")) ||
        (value === "default" && key === "apySort") ||
        (!value && key === "q")
      ) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col font-sans selection:bg-black selection:text-white">
      {/* Central Search Section */}
      <div
        className={cn(
          "flex flex-col items-center transition-all duration-700 ease-in-out px-6",
          isPinned
            ? "pt-12 pb-8 border-b border-black/[0.03] bg-white/50 backdrop-blur-md sticky top-0 z-40"
            : "pt-[25vh] pb-20",
        )}
      >
        <div
          className={cn(
            "w-full max-w-3xl flex flex-col items-center gap-8 transition-all duration-700",
            isPinned
              ? "lg:flex-row lg:max-w-[1400px] lg:justify-between lg:gap-6"
              : "",
          )}
        >
          {/* Logo */}
          <div
            className={cn(
              "flex items-center gap-4 transition-all duration-500",
              isPinned ? "lg:shrink-0" : "flex-col text-center",
            )}
          >
            <div
              className={cn(
                "bg-black rounded-2xl flex items-center justify-center shadow-2xl shadow-black/10 transition-all",
                isPinned ? "w-10 h-10" : "w-20 h-20 mb-2",
              )}
            >
              <Activity
                className={cn(
                  "text-[#00FF85]",
                  isPinned ? "w-5 h-5" : "w-10 h-10",
                )}
              />
            </div>
            <div>
              <h1
                className={cn(
                  "font-black tracking-tighter uppercase italic leading-none transition-all",
                  isPinned ? "text-lg" : "text-4xl",
                )}
              >
                Exposure
              </h1>
              {!isPinned && (
                <p className="text-[12px] font-bold text-black/30 uppercase tracking-[0.4em] mt-3">
                  Institutional Risk Registry
                </p>
              )}
            </div>
          </div>

          {/* Search Bar Container */}
          <div
            className={cn(
              "relative group transition-all duration-500",
              isPinned ? "flex-grow max-w-xl" : "w-full max-w-2xl",
            )}
            ref={dropdownRef}
          >
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-black/20 group-focus-within:text-black transition-colors" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search assets, protocols, or chains..."
              value={query}
              onFocus={() => setIsFocused(true)}
              onChange={(e) => {
                updateParams({ q: e.target.value });
                setIsFocused(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setIsFocused(false);
                }
              }}
              className={cn(
                "w-full pl-14 pr-16 py-5 bg-black/[0.02] border border-black/5 rounded-full font-bold uppercase tracking-tight focus:outline-none focus:border-black/10 focus:ring-[12px] focus:ring-black/[0.015] transition-all placeholder:text-black/10",
                isPinned
                  ? "text-xs py-4"
                  : "text-sm shadow-2xl shadow-black/[0.02]",
              )}
            />
            <div className="hidden sm:flex absolute right-6 top-1/2 -translate-y-1/2 items-center gap-2 px-2.5 py-1.5 bg-black/5 border border-black/5 rounded-lg text-[9px] font-black text-black/40 uppercase tracking-widest pointer-events-none">
              <Command className="w-2.5 h-2.5" /> K
            </div>

            {/* Related Words / Suggestions Dropdown */}
            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-4 bg-white border border-black/[0.08] rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.12)] z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-2">
                  {filteredResults.length > 0 ? (
                    filteredResults.slice(0, 8).map((result) => (
                      <Link
                        key={`${result.id}-${result.chain}-${result.protocol}`}
                        href={`/asset/${result.id}?chain=${result.chain}&protocol=${encodeURIComponent(result.protocol)}`}
                        onClick={() => setIsFocused(false)}
                        className="flex items-center justify-between p-4 hover:bg-black/[0.02] rounded-2xl transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-black/[0.03] rounded-xl flex items-center justify-center shrink-0">
                            {getNodeLogos(result)[0] ? (
                              <Image
                                src={getNodeLogos(result)[0]}
                                alt={result.name}
                                width={20}
                                height={20}
                                className="object-contain"
                              />
                            ) : (
                              <span className="text-[10px] font-black">
                                {result.name.charAt(0)}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="text-[11px] font-black uppercase tracking-tight italic group-hover:text-[#00FF85] transition-colors">
                              {result.name}
                            </div>
                            <div className="text-[9px] font-bold text-black/30 uppercase tracking-widest mt-0.5">
                              {result.protocol} • {result.chain}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-black/10 group-hover:translate-x-1 group-hover:text-black transition-all" />
                      </Link>
                    ))
                  ) : (
                    <div className="p-8 text-center">
                      <p className="text-[10px] font-bold text-black/30 uppercase tracking-[0.2em]">
                        No related matches found
                      </p>
                    </div>
                  )}
                </div>
                {filteredResults.length > 8 && (
                  <div className="p-4 bg-black/[0.01] border-t border-black/[0.03] text-center">
                    <p className="text-[9px] font-black text-black/20 uppercase tracking-[0.3em]">
                      +{filteredResults.length - 8} more results available
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stats / Mobile View Logic */}
          {isPinned && (
            <div className="hidden lg:flex items-center gap-6 shrink-0">
              <div className="text-right">
                <div className="text-[9px] font-black text-black/20 uppercase tracking-[0.2em]">
                  Matches
                </div>
                <div className="text-sm font-black text-black">
                  {filteredResults.length}
                </div>
              </div>
              <div className="h-8 w-px bg-black/[0.05]" />
              <div className="p-2.5 bg-black/[0.03] rounded-xl border border-black/5">
                <LayoutGrid className="w-4 h-4 text-black/60" />
              </div>
            </div>
          )}
        </div>

        {/* Filter Pills Row */}
        <div
          className={cn(
            "flex items-center justify-center gap-3 pb-2 -mx-2 px-2 transition-all duration-700",
            isPinned ? "mt-6 max-w-[1400px] w-full" : "mt-10",
          )}
        >
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
                  width={14}
                  height={14}
                  className="object-contain"
                />
              ) : (
                <Globe className="w-3.5 h-3.5 text-black/20" />
              )
            }
          />

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
                  width={14}
                  height={14}
                  className="object-contain"
                />
              ) : (
                <Activity className="w-3.5 h-3.5 text-black/20" />
              )
            }
          />

          <FilterPill
            label="Curator"
            value={selectedCurator}
            options={curators}
            onChange={(v) => updateParams({ curator: v })}
          />

          {isPinned && (
            <FilterPill
              label="Sort"
              value={apySort}
              options={apySortOptions}
              onChange={(v) => updateParams({ apySort: v })}
            />
          )}
        </div>
      </div>

      {/* Main Content Grid - Only shown when filters are active but NO text search is typing */}
      <main
        className={cn(
          "max-w-[1400px] mx-auto w-full p-6 lg:p-10 flex-grow transition-opacity duration-500",
          showGrid ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      >
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 animate-pulse">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="h-56 bg-black/[0.02] rounded-3xl border border-black/[0.03]"
              />
            ))}
          </div>
        ) : filteredResults.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filteredResults.map((result) => {
              const logoPaths = getNodeLogos(result);
              const chainLogoPath = hasChainLogo(result.chain)
                ? getChainLogoPath(result.chain)
                : null;

              return (
                <Link
                  key={`${result.id}-${result.chain}-${result.protocol}`}
                  href={`/asset/${result.id}?chain=${result.chain}&protocol=${encodeURIComponent(result.protocol)}`}
                  className="group flex flex-col bg-white border border-black/[0.05] rounded-3xl p-8 hover:border-black/[0.1] hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] hover:-translate-y-2 transition-all relative overflow-hidden"
                >
                  <div className="flex items-start justify-between mb-10">
                    <div className="flex items-center -space-x-3">
                      {logoPaths.length > 0 ? (
                        logoPaths.map((logoPath, idx) => (
                          <div
                            key={logoPath}
                            className="w-14 h-14 bg-white border border-black/[0.06] rounded-full flex items-center justify-center overflow-hidden transition-all group-hover:border-black/10 shadow-sm"
                            style={{ zIndex: 10 - idx }}
                          >
                            <Image
                              src={logoPath}
                              alt={result.name}
                              width={32}
                              height={32}
                              className="object-contain"
                            />
                          </div>
                        ))
                      ) : (
                        <div className="w-14 h-14 bg-black/[0.02] border border-black/5 rounded-full flex items-center justify-center text-black/20 font-black text-sm group-hover:text-black transition-all">
                          {result.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    {chainLogoPath && (
                      <div className="w-7 h-7 bg-black/[0.03] rounded-full flex items-center justify-center border border-black/5">
                        <Image
                          src={chainLogoPath}
                          alt={result.chain}
                          width={16}
                          height={16}
                          className="object-contain opacity-40 group-hover:opacity-100 transition-opacity"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-black uppercase tracking-tight italic group-hover:text-[#00FF85] transition-colors leading-tight">
                      {result.name}
                    </h3>
                    <div className="flex items-center gap-2.5">
                      <span className="text-[11px] font-bold text-black/30 uppercase tracking-[0.15em]">
                        {result.protocol}
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-black/[0.08]" />
                      <span className="text-[11px] font-bold text-black/30 uppercase tracking-[0.15em]">
                        {result.chain}
                      </span>
                    </div>
                  </div>

                  <div className="mt-10 pt-8 border-t border-black/[0.04] flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-black/20 group-hover:text-black transition-colors">
                    <span className="flex items-center gap-2.5">
                      <Activity className="w-3.5 h-3.5" />
                      View Analysis
                    </span>
                    <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1.5 transition-all" />
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-40 text-center">
            <div className="w-24 h-24 bg-black/[0.02] rounded-full flex items-center justify-center mb-8">
              <Filter className="w-10 h-10 text-black/5" />
            </div>
            <h3 className="text-2xl font-black text-black uppercase tracking-tighter italic mb-3">
              No results found
            </h3>
            <p className="text-sm font-medium text-black/40 max-w-xs uppercase tracking-widest leading-relaxed">
              Refine your search criteria or adjust your filters.
            </p>
            <button
              onClick={() => {
                updateParams({
                  q: "",
                  protocol: "all",
                  chain: "all",
                  curator: "all",
                });
                setIsPinned(false);
              }}
              className="mt-10 px-10 py-4 bg-black text-white text-[11px] font-black uppercase tracking-[0.4em] hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-black/20 rounded-full"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </main>

      {/* Hero Welcome Message when no filters active */}
      {!isPinned && (
        <div className="flex-grow flex flex-col items-center justify-center px-6 -mt-20">
          <div className="max-w-2xl text-center space-y-6 animate-in fade-in zoom-in duration-1000">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-black/[0.02] border border-black/5 rounded-full text-[10px] font-black uppercase tracking-[0.3em] text-black/40">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00FF85] animate-pulse" />
              Live Index Synchronized
            </div>
            <p className="text-sm font-medium text-black/30 uppercase tracking-[0.2em] leading-relaxed">
              Access high-fidelity risk metrics across Euler, Morpho, Midas and
              more. Search by asset name or use filters to begin analysis.
            </p>
          </div>
        </div>
      )}

      <footer className="p-12 border-t border-black/[0.03] bg-black/[0.01] mt-auto">
        <div className="max-w-[1400px] mx-auto flex flex-col items-center gap-6">
          <p className="text-[10px] font-black text-black/20 uppercase tracking-[0.6em] text-center">
            Paradigm Risk Intelligence // Dynamic Index Monitoring Active
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <HomeInner />
    </Suspense>
  );
}
