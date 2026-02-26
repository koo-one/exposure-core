"use client";

import {
  Suspense,
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import Link from "next/link";
import { Search, Activity, Command, Globe, ChevronRight } from "lucide-react";
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

  const [dynamicIndex, setDynamicIndex] = useState<SearchIndexEntry[]>([]);

  // Sync state with URL params
  const selectedProtocol = searchParams.get("protocol") || "all";
  const selectedChain = searchParams.get("chain") || "all";
  const selectedCurator = searchParams.get("curator") || "all";
  const apyMin = searchParams.get("apyMin") || "";
  const apyMax = searchParams.get("apyMax") || "";
  const query = searchParams.get("q") || "";

  const hasFilters =
    selectedProtocol !== "all" ||
    selectedChain !== "all" ||
    selectedCurator !== "all" ||
    apyMin.trim().length > 0 ||
    apyMax.trim().length > 0;

  // Active search includes text query OR any filter/sort.
  const isSearchActive = !!(query || hasFilters);

  const showDropdown = isSearchActive;

  const updateParams = useCallback(
    (newParams: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(newParams).forEach(([key, value]) => {
        if (
          value === null ||
          (value === "all" &&
            (key === "protocol" || key === "curator" || key === "chain")) ||
          (value === "" &&
            (key === "q" || key === "apyMin" || key === "apyMax"))
        ) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

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
    const scope = dynamicIndex.filter((entry) => {
      const protocolMatch =
        selectedProtocol === "all" ||
        entry.protocol.toLowerCase() === selectedProtocol.toLowerCase();
      const chainMatch =
        selectedChain === "all" ||
        entry.chain.toLowerCase() === selectedChain.toLowerCase();
      return protocolMatch && chainMatch;
    });

    const set = new Set<string>();
    for (const entry of scope) {
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
  }, [dynamicIndex, selectedProtocol, selectedChain]);

  useEffect(() => {
    if (selectedCurator === "all") return;
    if (dynamicIndex.length === 0) return;
    const isValid = curators.some((c) => c.value === selectedCurator);
    if (!isValid) updateParams({ curator: "all" });
  }, [selectedCurator, curators, updateParams, dynamicIndex.length]);

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

    if (apyMin.trim().length > 0 || apyMax.trim().length > 0) {
      const parseBound = (s: string): number | null => {
        const trimmed = s.trim();
        if (trimmed.length === 0) return null;
        const n = Number(trimmed);
        return Number.isFinite(n) ? n : null;
      };

      const min = parseBound(apyMin);
      const max = parseBound(apyMax);

      results = results.filter((entry) => {
        const apy = typeof entry.apy === "number" ? entry.apy : null;
        if (apy == null) return false;

        // Normalize to percent for comparison.
        // Some adapters emit APY as a fraction (0.02 == 2%), others emit percent (2 == 2%).
        const apyPercent = apy > 1 ? apy : apy * 100;

        if (min != null && apyPercent < min) return false;
        if (max != null && apyPercent > max) return false;
        return true;
      });
    }

    if (selectedCurator !== "all") {
      results = results.filter((entry) => entry.curator === selectedCurator);
    }

    return results;
  }, [
    selectedProtocol,
    selectedChain,
    selectedCurator,
    apyMin,
    apyMax,
    query,
    dynamicIndex,
  ]);

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col font-sans selection:bg-black selection:text-white">
      {/* Central Search Section */}
      <div
        className={cn(
          "flex flex-col items-center transition-all duration-700 ease-in-out px-6 pt-[18vh] pb-16",
        )}
      >
        <div
          className={cn(
            "w-full max-w-3xl flex flex-col items-center gap-6 transition-all duration-700",
          )}
        >
          {/* Logo */}
          <div
            className={cn(
              "flex items-center gap-4 transition-all duration-500",
              "flex-col text-center",
            )}
          >
            <div
              className={cn(
                "bg-black rounded-2xl flex items-center justify-center shadow-2xl shadow-black/10 transition-all",
                "w-16 h-16 mb-1",
              )}
            >
              <Activity className={cn("text-[#00FF85]", "w-8 h-8")} />
            </div>
            <div>
              <h1
                className={cn(
                  "font-black tracking-tighter uppercase italic leading-none transition-all",
                  "text-3xl",
                )}
              >
                Exposure
              </h1>
              <p className="text-[10px] font-bold text-black/30 uppercase tracking-[0.4em] mt-2">
                Institutional Risk Registry
              </p>
            </div>
          </div>

          {/* Filter Pills Row */}
          <div className="flex items-center justify-center gap-2 pb-1 -mx-2 px-2 transition-all duration-700">
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

            <div
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 border rounded-full transition-all duration-200 group",
                apyMin || apyMax
                  ? "bg-black text-white border-black shadow-lg shadow-black/10"
                  : "bg-white border-black/10 hover:border-black/30 text-black",
              )}
            >
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-widest whitespace-nowrap",
                  apyMin || apyMax ? "text-white/40" : "text-black/40",
                )}
              >
                APY
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  inputMode="decimal"
                  placeholder="MIN"
                  value={apyMin}
                  onChange={(e) => {
                    updateParams({ apyMin: e.target.value });
                  }}
                  className={cn(
                    "w-10 bg-transparent text-[10px] font-bold uppercase tracking-widest placeholder:text-black/20 focus:outline-none",
                    apyMin || apyMax
                      ? "text-white placeholder:text-white/20"
                      : "text-black",
                  )}
                />
                <span
                  className={cn(
                    "text-[10px] font-bold opacity-20",
                    apyMin || apyMax ? "text-white" : "text-black",
                  )}
                >
                  -
                </span>
                <input
                  inputMode="decimal"
                  placeholder="MAX"
                  value={apyMax}
                  onChange={(e) => {
                    updateParams({ apyMax: e.target.value });
                  }}
                  className={cn(
                    "w-10 bg-transparent text-[10px] font-bold uppercase tracking-widest placeholder:text-black/20 focus:outline-none",
                    apyMin || apyMax
                      ? "text-white placeholder:text-white/20"
                      : "text-black",
                  )}
                />
              </div>
            </div>

            <FilterPill
              label="Curator"
              value={selectedCurator}
              options={curators}
              onChange={(v) => updateParams({ curator: v })}
            />
          </div>

          {/* Search Bar Container */}
          <div
            className={cn(
              "relative group transition-all duration-500",
              "w-full max-w-2xl",
            )}
          >
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-black/20 group-focus-within:text-black transition-colors" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search assets, protocols, or chains..."
              value={query}
              onChange={(e) => {
                updateParams({ q: e.target.value });
              }}
              className={cn(
                "w-full pl-14 pr-16 py-3.5 bg-black/[0.02] border border-black/5 rounded-full font-bold uppercase tracking-tight focus:outline-none focus:border-black/10 focus:ring-8 focus:ring-black/[0.01] transition-all placeholder:text-black/10",
                "text-xs shadow-xl shadow-black/[0.01]",
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
          <div className="hidden lg:flex items-center gap-6 shrink-0" />
        </div>
      </div>

      {/* Hero Welcome Message when no filters active */}
      {!isSearchActive && (
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
