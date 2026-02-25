"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Search,
  Activity,
  Command,
  ArrowRight,
  Grid,
  Filter,
  Globe,
  Menu,
  X,
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

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [dynamicIndex, setDynamicIndex] = useState<SearchIndexEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Sync state with URL params
  const selectedProtocol = searchParams.get("protocol") || "all";
  const query = searchParams.get("q") || "";

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

  const protocols = useMemo(() => {
    const set = new Set(dynamicIndex.map((e) => e.protocol));
    return ["all", ...Array.from(set).sort()];
  }, [dynamicIndex]);

  const filteredResults = useMemo(() => {
    let results = dynamicIndex;

    if (selectedProtocol !== "all") {
      results = results.filter(
        (e) => e.protocol.toLowerCase() === selectedProtocol.toLowerCase(),
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

    return results;
  }, [selectedProtocol, query, dynamicIndex]);

  const updateParams = (newParams: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([key, value]) => {
      if (
        value === null ||
        (value === "all" && key === "protocol") ||
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
    <div className="min-h-screen bg-white flex flex-col font-sans selection:bg-black selection:text-white">
      <div className="flex flex-grow overflow-hidden">
        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Left Protocol Rail */}
        <aside
          className={`
          fixed inset-y-0 left-0 z-50 w-64 border-r border-black/5 bg-black/[0.01] flex flex-col shrink-0 
          transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        >
          <div className="p-8 border-b border-black/5 flex items-center justify-between">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-black text-[#00FF85] text-[9px] font-black uppercase tracking-[0.3em] rounded-sm mb-4">
                <Activity className="w-3 h-3" />
                Registry
              </div>
              <h2 className="text-sm font-black text-black uppercase tracking-widest italic">
                Protocols
              </h2>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden p-2 hover:bg-black/5 rounded-sm"
            >
              <X className="w-5 h-5 text-black/20" />
            </button>
          </div>

          <nav className="flex-grow p-4 space-y-1 overflow-y-auto custom-scrollbar">
            {protocols.map((p) => {
              const hasLogo = hasProtocolLogo(p);
              return (
                <button
                  key={p}
                  onClick={() => {
                    updateParams({ protocol: p });
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-4 px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all rounded-sm border-l-4 ${
                    selectedProtocol === p
                      ? "bg-black text-white border-[#00FF85]"
                      : "text-black/40 hover:bg-black/5 hover:text-black border-transparent"
                  }`}
                >
                  <div className="w-5 h-5 flex items-center justify-center shrink-0 overflow-hidden rounded-sm transition-all">
                    {p === "all" ? (
                      <Globe className="w-4 h-4" />
                    ) : hasLogo ? (
                      <Image
                        src={getProtocolLogoPath(p)}
                        alt={p}
                        width={16}
                        height={16}
                        className="object-contain"
                      />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-current opacity-20" />
                    )}
                  </div>
                  <span className="truncate">{p}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-8 border-t border-black/5">
            <p className="text-[10px] font-black text-black/20 uppercase tracking-[0.4em] leading-relaxed">
              Exposure Core v1.2
              <br /> Institutional Build
            </p>
          </div>
        </aside>

        {/* Main Content Pane */}
        <main className="flex-grow flex flex-col bg-white overflow-y-auto relative h-screen">
          {/* Top Search Bar */}
          <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-black/5 px-6 lg:px-10 py-6 flex items-center justify-between gap-4 lg:gap-8">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 bg-black/[0.02] border border-black/5 rounded-sm"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex-grow relative group max-w-2xl">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-black/20 group-focus-within:text-black transition-colors" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by name, ID, or chain..."
                value={query}
                onChange={(e) => updateParams({ q: e.target.value })}
                className="w-full pl-14 pr-16 py-4 bg-black/[0.02] border border-black/10 rounded-sm text-sm font-bold uppercase tracking-tight focus:outline-none focus:border-black focus:ring-4 focus:ring-[#00FF85]/10 transition-all placeholder:text-black/10"
              />
              <div className="hidden sm:flex absolute right-6 top-1/2 -translate-y-1/2 items-center gap-2 px-2 py-1 bg-black/5 border border-black/5 rounded-sm text-[8px] font-black text-black/40 uppercase tracking-widest">
                <Command className="w-2.5 h-2.5" /> K
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-6">
              <div className="text-right">
                <div className="text-[10px] font-black text-black/20 uppercase tracking-[0.3em]">
                  Matches
                </div>
                <div className="text-sm font-black text-black">
                  {filteredResults.length} Assets
                </div>
              </div>
              <div className="h-8 w-px bg-black/5" />
              <div className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-sm text-[10px] font-black uppercase tracking-widest shadow-lg shadow-black/10">
                <Grid className="w-3 h-3 text-[#00FF85]" />
                Grid View
              </div>
            </div>
          </div>

          {/* Root Node Grid */}
          <div className="p-6 lg:p-10 flex-grow">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-pulse">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="h-48 bg-black/5 rounded-sm border border-black/5"
                  />
                ))}
              </div>
            ) : filteredResults.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredResults.map((result) => {
                  const logoPaths = getNodeLogos(result);
                  const chainLogoPath = hasChainLogo(result.chain)
                    ? getChainLogoPath(result.chain)
                    : null;

                  return (
                    <Link
                      key={`${result.id}-${result.chain}-${result.protocol}`}
                      href={`/asset/${result.id}?chain=${result.chain}&protocol=${encodeURIComponent(result.protocol)}`}
                      className="group flex flex-col bg-white border border-black/10 rounded-sm p-6 hover:border-black hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] transition-all relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-1 h-0 bg-[#00FF85] group-hover:h-full transition-all duration-300" />

                      <div className="flex items-start justify-between mb-8">
                        <div className="flex items-center -space-x-2">
                          {logoPaths.length > 0 ? (
                            logoPaths.map((logoPath, idx) => (
                              <div
                                key={logoPath}
                                className="w-10 h-10 bg-white border border-black/10 rounded-full flex items-center justify-center overflow-hidden transition-all group-hover:border-black/20 shadow-sm"
                                style={{ zIndex: 10 - idx }}
                              >
                                <Image
                                  src={logoPath}
                                  alt={result.name}
                                  width={24}
                                  height={24}
                                  className="object-contain"
                                />
                              </div>
                            ))
                          ) : (
                            <div className="w-10 h-10 bg-black/5 border border-black/5 rounded-sm flex items-center justify-center text-black/20 font-black text-sm group-hover:text-black transition-all">
                              {result.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        {chainLogoPath && (
                          <Image
                            src={chainLogoPath}
                            alt={result.chain}
                            width={16}
                            height={16}
                            className="object-contain"
                          />
                        )}
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-lg font-black text-black uppercase tracking-tight italic group-hover:text-[#00FF85] transition-colors">
                          {result.name}
                        </h3>
                        <p className="text-[10px] font-bold text-black/30 uppercase tracking-[0.2em] font-mono">
                          {result.protocol} // {result.id.slice(0, 8)}...
                        </p>
                      </div>

                      <div className="mt-8 pt-6 border-t border-black/5 flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-black/20 group-hover:text-black transition-colors">
                        Analyze Exposure
                        <ArrowRight className="w-3 h-3 transform group-hover:translate-x-1 transition-all" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-40 text-center">
                <Filter className="w-12 h-12 text-black/5 mb-6" />
                <h3 className="text-xl font-black text-black uppercase tracking-tighter italic mb-2">
                  No results found
                </h3>
                <p className="text-sm font-medium text-black/40 max-w-xs uppercase tracking-widest leading-relaxed">
                  Refine your search criteria or select a different protocol
                  rail.
                </p>
                <button
                  onClick={() => updateParams({ q: "", protocol: "all" })}
                  className="mt-8 px-6 py-3 border border-black text-[10px] font-black uppercase tracking-[0.3em] hover:bg-black hover:text-white transition-all"
                >
                  Reset Explorer
                </button>
              </div>
            )}
          </div>

          <footer className="p-10 border-t border-black/5 bg-black/[0.01] mt-auto">
            <p className="text-[9px] font-black text-black/20 uppercase tracking-[0.6em] text-center">
              Paradigm Risk Intelligence // Dynamic Index Monitoring Active
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
