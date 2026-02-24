'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, ArrowRight, Activity, Command  } from 'lucide-react';
import { type SearchIndexEntry } from '@/constants';

interface SearchResult {
  id: string;
  name: string;
  network: string;
  protocol: string;
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [dynamicIndex, setDynamicIndex] = useState<SearchIndexEntry[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/search-index');
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

  const searchResults = useMemo(() => {
    if (!query) return [];
    const q = query.toLowerCase();
    const results: SearchResult[] = [];

    for (const entry of dynamicIndex) {
      const haystack = `${entry.name} ${entry.id} ${entry.nodeId} ${entry.protocol} ${entry.chain}`.toLowerCase();
      if (!haystack.includes(q)) continue;
      results.push({
        id: entry.id,
        name: entry.name,
        network: entry.chain,
        protocol: entry.protocol,
      });
    }

    const deduped: SearchResult[] = [];
    const seen = new Set<string>();
    for (const item of results) {
      const key = `${item.id}|${item.network}|${item.protocol}|${item.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
      if (deduped.length >= 50) break;
    }

    return deduped;
  }, [query, dynamicIndex]);

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans selection:bg-black selection:text-white">
      <main className="flex-grow flex flex-col items-center justify-center p-10 max-w-5xl mx-auto w-full relative">
        <div className="w-full text-center mb-24 space-y-8 relative z-10">
          <div className="inline-flex items-center gap-4 px-5 py-2 bg-black/[0.02] border border-black rounded-sm text-black text-[10px] font-black uppercase tracking-[0.4em] mb-6">
              <Activity className="w-3.5 h-3.5" />
              Institutional Index Active
          </div>
          <h1 className="text-7xl md:text-9xl font-black text-black tracking-tighter leading-[0.85] uppercase italic">
            EXPOSURE<br/><span className="text-[#00FF85] drop-shadow-[0_0_15px_rgba(0,255,133,0.3)]">CORE</span>
          </h1>
          <p className="text-xl text-black/40 font-medium max-w-lg mx-auto leading-relaxed tracking-tight border-t border-black/5 pt-8">
            Professional visualization of open interest and capital distribution across decentralized networks.
          </p>
        </div>

        <div className="w-full max-w-2xl relative z-20">
          <div className="relative group">
            <div className="absolute inset-y-0 left-8 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-black/20 group-focus-within:text-black transition-colors" />
            </div>
            <input
              type="text"
              className="block w-full pl-20 pr-24 py-8 bg-white border border-black rounded-sm text-2xl text-black shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] placeholder-black/10 focus:outline-none focus:ring-4 focus:ring-[#00FF85]/10 transition-all font-bold uppercase tracking-tight"
              placeholder="SEARCH_REGISTRY..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <div className="absolute inset-y-0 right-8 flex items-center pointer-events-none">
               <div className="flex items-center gap-2 px-3 py-2 bg-black border border-black rounded-sm text-[10px] font-black text-white uppercase tracking-widest shadow-2xl">
                  <Command className="w-3.5 h-3.5" /> K
               </div>
            </div>
          </div>

          {(query.length > 0) && (
            <div className="absolute top-full left-0 right-0 mt-8 bg-white rounded-sm shadow-[0_50px_100px_-20px_rgba(0,0,0,0.2)] border border-black overflow-hidden z-50 animate-in fade-in slide-in-from-top-4 duration-300">
              {searchResults.length > 0 ? (
                <div className="divide-y divide-black/5 max-h-[550px] overflow-y-auto custom-scrollbar">
                  {searchResults.map((result) => (
                      <Link
                        key={`${result.id}-${result.network}-${result.protocol}`}
href={`/asset/${encodeURIComponent(result.id)}?chain=${encodeURIComponent(result.network)}&protocol=${encodeURIComponent(result.protocol)}`}
                        className="flex items-center justify-between px-12 py-8 hover:bg-black hover:text-white transition-all group border-l-[6px] border-transparent hover:border-[#00FF85]"
                      >
                      <div className="flex items-center gap-8">
                          <div className="w-14 h-14 bg-black/5 border border-black rounded-sm flex items-center justify-center text-black/20 font-black text-xl group-hover:bg-white group-hover:text-black transition-all">
                             {result.name.charAt(0)}
                          </div>
                          <div className="flex flex-col items-start pt-1">
                              <span className="font-black text-2xl tracking-tighter flex items-center gap-4 uppercase italic">
                                {result.name}
                                <span className="px-2 py-0.5 border border-current opacity-30 text-[9px] font-black uppercase tracking-widest rounded-sm not-italic">
                                  {result.network}
                                </span>
                              </span>
                              <span className="text-[11px] font-bold opacity-40 uppercase tracking-[0.3em] mt-2 font-mono">
                                {result.protocol}
                              </span>
                          </div>
                      </div>
                      <div className="w-12 h-12 rounded-full border border-current flex items-center justify-center opacity-20 group-hover:opacity-100 group-hover:bg-[#00FF85] group-hover:border-[#00FF85] transition-all">
                        <ArrowRight className="w-5 h-5 group-hover:text-black transform group-hover:translate-x-1 transition-all" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="p-20 text-center">
                  <p className="text-black/20 font-black uppercase tracking-[0.4em] text-sm italic">Zero Registry matches for this query</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-24 flex flex-wrap justify-center gap-8 relative z-10">
          <span className="text-[10px] font-black text-black/10 uppercase tracking-[0.6em] w-full text-center mb-4 italic">Common Institutional Inquiries</span>
          {['Morpho', 'mHYPER', 'Ethena', 'mBTC'].map((term) => (
            <button
              key={term}
              onClick={() => setQuery(term)}
              className="px-8 py-4 bg-white border border-black rounded-sm text-[11px] font-black text-black/40 uppercase tracking-[0.3em] hover:bg-black hover:text-white hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.2)] transition-all active:scale-95"
            >
              {term}
            </button>
          ))}
        </div>
      </main>

      <footer className="p-12 text-center border-t border-black/5 bg-black/[0.01]">
         <p className="text-[10px] font-black text-black/20 uppercase tracking-[0.6em]">
            © 2026 Paradigm // Distributed Risk Intelligence Platform
         </p>
      </footer>
    </div>
  );
}
