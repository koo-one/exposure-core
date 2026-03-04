"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Activity, ChevronRight, RotateCcw } from "lucide-react";

import AssetTreeMap from "@/components/AssetTreeMap";
import { TerminalToast } from "@/components/TerminalToast";
import { RootNodeHeader } from "@/components/RootNodeHeader";
import { AppHeader } from "@/components/AppHeader";

import { useAssetData } from "@/hooks/useAssetData";
import { useTerminalToast } from "@/hooks/useTerminalToast";
import { GraphNode } from "@/types";
import { type SearchIndexEntry } from "@/constants";
import { hasChainLogo, getChainLogoPath } from "@/lib/logos";
import { classifyNodeType, getNodeTypeParts } from "@/lib/nodeType";
import Image from "next/image";

const shortChainLabel = (v: string): string => v.toUpperCase();

const buildChainLabel = (
  chains: { chain: string; entry: SearchIndexEntry; tvlUsd: number | null }[],
): string => {
  const chainNames = Array.from(
    new Set(
      chains
        .map((c) => shortChainLabel(c.chain))
        .filter((label) => label.length > 0),
    ),
  );

  if (chainNames.length <= 1) return chainNames[0] ?? "";
  if (chainNames.length <= 3) return chainNames.join("/");
  return `${chainNames.slice(0, 2).join("/")}+${chainNames.length - 2}`;
};

const isMorphoOrEuler = (protocol: string): boolean => {
  const value = protocol.trim().toLowerCase();
  return value.startsWith("morpho") || value.startsWith("euler");
};

const shouldGroupAcrossChains = (protocol: string): boolean => {
  return !isMorphoOrEuler(protocol);
};

export default function AssetPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const id = params.id as string;
  const chain = searchParams.get("chain") ?? undefined;
  const focus = searchParams.get("focus") ?? undefined;
  const protocol = searchParams.get("protocol") ?? undefined;

  // Origin tracking
  const origin = searchParams.get("origin") ?? undefined;

  // Header State & Search Logic
  const [dynamicIndex, setDynamicIndex] = useState<SearchIndexEntry[]>([]);
  const selectedProtocol = searchParams.get("protocol") || "all";
  const selectedChain = searchParams.get("chain") || "all";
  const selectedCurator = searchParams.get("curator") || "all";
  const apyMin = searchParams.get("apyMin") || "";
  const apyMax = searchParams.get("apyMax") || "";
  const query = searchParams.get("q") || "";

  const {
    graphData,
    loading,
    tvl,
    selectedNode,
    setSelectedNode,
    focusRootNodeId,
    pageTitle,
    applyLocalDrilldown,
    handleBackOneStep,
    resetToRoot,
    jumpToFocus,
    isAtAssetRoot,
    rootNode,
    isOthersView,
    setIsOthersView,
    othersChildrenIds,
    setOthersChildrenIds,
    focusStack,
  } = useAssetData({ id, chain, protocol, focus });

  const { terminalToast, showTerminalToast, closeTerminalToast } =
    useTerminalToast();

  const nodesById = useMemo(() => {
    if (!graphData) return new Map<string, GraphNode>();
    return new Map(graphData.nodes.map((n) => [n.id, n]));
  }, [graphData]);

  const tileClickSeq = useRef(0);
  const lastTileClick = useRef<{ nodeId: string; seq: number } | null>(null);

  const [graphRootIds, setGraphRootIds] = useState<Set<string>>(new Set());
  const infoNode = selectedNode ?? rootNode;

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/search-index");
        if (!response.ok) return;
        const json = (await response.json()) as SearchIndexEntry[];
        if (!Array.isArray(json)) return;
        setDynamicIndex(json);
        setGraphRootIds(new Set(json.map((e) => e.id.toLowerCase())));
      } catch (error) {
        console.error("Failed to load search index:", error);
      }
    };
    void load();
  }, []);

  const updateParams = useCallback(
    (newParams: Record<string, string | null>) => {
      // If navigating to a different asset, redirect to that asset page
      if (newParams.id && newParams.id.toLowerCase() !== id.toLowerCase()) {
        const p = new URLSearchParams();
        if (newParams.assetChain) p.set("chain", newParams.assetChain);
        if (newParams.assetProtocol) p.set("protocol", newParams.assetProtocol);
        router.push(
          `/asset/${encodeURIComponent(newParams.id)}${p.size ? `?${p.toString()}` : ""}`,
        );
        return;
      }

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
    [router, searchParams, id],
  );

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

  const filteredResults = useMemo(() => {
    let results = dynamicIndex;
    if (selectedProtocol !== "all")
      results = results.filter(
        (e) => e.protocol.toLowerCase() === selectedProtocol.toLowerCase(),
      );
    if (selectedChain !== "all")
      results = results.filter(
        (e) => e.chain.toLowerCase() === selectedChain.toLowerCase(),
      );
    if (query) {
      const q = query.toLowerCase();
      results = results.filter((entry) =>
        `${entry.name} ${entry.id} ${entry.protocol} ${entry.chain}`
          .toLowerCase()
          .includes(q),
      );
    }
    // Simple APY filter logic
    if (apyMin || apyMax) {
      const min = apyMin ? parseFloat(apyMin) : -Infinity;
      const max = apyMax ? parseFloat(apyMax) : Infinity;
      results = results.filter((e) => {
        const a =
          typeof e.apy === "number" ? (e.apy > 1 ? e.apy : e.apy * 100) : null;
        if (a === null) return false;
        return a >= min && a <= max;
      });
    }
    if (selectedCurator !== "all")
      results = results.filter((entry) => entry.curator === selectedCurator);
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

  const dropdownResults = useMemo(() => {
    interface GroupInternal {
      key: string;
      protocol: string;
      name: string;
      logoKeys?: string[];
      primary: SearchIndexEntry;
      entries: Map<
        string,
        { chain: string; entry: SearchIndexEntry; tvlUsd: number | null }
      >;
    }
    const groups = new Map<string, GroupInternal>();
    const safeTvl = (v: unknown): number | null =>
      typeof v === "number" && Number.isFinite(v) ? v : null;

    for (const entry of filteredResults) {
      const protocol = (entry.protocol ?? "").trim();
      const name = (entry.name ?? "").trim();
      const chain = (entry.chain ?? "global").trim().toLowerCase();
      const baseKey = `${protocol.toLowerCase()}|${name.toLowerCase()}`;
      const key = shouldGroupAcrossChains(protocol)
        ? baseKey
        : `${baseKey}|${chain}|${entry.id.trim().toLowerCase()}`;
      const tvlUsd = safeTvl(entry.tvlUsd);
      const existing = groups.get(key);
      if (!existing) {
        const entries = new Map<
          string,
          { chain: string; entry: SearchIndexEntry; tvlUsd: number | null }
        >();
        const entryKey = `${chain}|${entry.id.trim().toLowerCase()}`;
        entries.set(entryKey, { chain, entry, tvlUsd });
        groups.set(key, {
          key,
          protocol,
          name: name || entry.name,
          logoKeys: entry.logoKeys,
          primary: entry,
          entries,
        });
        continue;
      }
      const entryKey = `${chain}|${entry.id.trim().toLowerCase()}`;
      const current = existing.entries.get(entryKey);
      if (!current || (tvlUsd ?? -1) > (current.tvlUsd ?? -1))
        existing.entries.set(entryKey, { chain, entry, tvlUsd });
      const primaryTvl = safeTvl(existing.primary.tvlUsd) ?? -1;
      const nextTvl = tvlUsd ?? -1;
      if (nextTvl > primaryTvl) existing.primary = entry;
    }

    const result = Array.from(groups.values()).map((g) => {
      const chains = Array.from(g.entries.values()).map((rec) => ({
        chain: rec.chain,
        entry: rec.entry,
        tvlUsd: rec.tvlUsd,
      }));
      chains.sort((a, b) => (b.tvlUsd ?? -1) - (a.tvlUsd ?? -1));
      const finiteTvls = chains
        .map((c) => c.tvlUsd)
        .filter(
          (v): v is number => typeof v === "number" && Number.isFinite(v),
        );
      const totalTvlUsd = (() => {
        if (!finiteTvls.length) return null;
        if (finiteTvls.length === 1) return finiteTvls[0] ?? null;
        return finiteTvls.reduce((sum, v) => sum + v, 0);
      })();
      return {
        key: g.key,
        protocol: g.protocol,
        name: g.name,
        logoKeys: g.logoKeys,
        chains,
        totalTvlUsd,
        primary: g.primary,
      };
    });
    result.sort((a, b) => (b.totalTvlUsd ?? -1) - (a.totalTvlUsd ?? -1));
    return result;
  }, [filteredResults]);

  const handleSelectOthers = (childIds: string[]) => {
    setOthersChildrenIds(childIds);
    setIsOthersView(true);
  };

  const handleDrilldownSelect = async (node: GraphNode) => {
    if (!node?.id) return;

    tileClickSeq.current += 1;
    lastTileClick.current = { nodeId: node.id, seq: tileClickSeq.current };
    setSelectedNode(node);

    const normalizedNodeId = node.id.trim().toLowerCase();
    const isKnownAsset = graphRootIds.has(normalizedNodeId);

    if (isKnownAsset && normalizedNodeId !== id.toLowerCase()) {
      const queryParams = new URLSearchParams();
      const nextProtocol = (node.protocol ?? protocol)?.trim();
      const nextChain = (node.chain ?? chain)?.trim();
      if (nextProtocol) queryParams.set("protocol", nextProtocol);
      if (nextChain) queryParams.set("chain", nextChain);
      queryParams.set("origin", origin || id);

      router.push(
        `/asset/${encodeURIComponent(normalizedNodeId)}?${queryParams.toString()}`,
      );
      return;
    }

    const hasChildren =
      graphData?.edges.some((e) => e.from === node.id) ?? false;
    if (hasChildren) {
      applyLocalDrilldown(node);
    } else {
      showTerminalToast(
        `Terminal Node Reach: ${node.name} has no further downstream allocations.`,
      );
    }
  };

  const breadcrumbs = useMemo(() => {
    const items = [];
    if (origin && origin !== id) {
      items.push({
        label: origin.toUpperCase(),
        href: `/asset/${encodeURIComponent(origin)}`,
      });
    }
    if (rootNode) {
      items.push({
        label: rootNode.name.toUpperCase(),
        href: isAtAssetRoot ? undefined : "#",
        onClick: isAtAssetRoot ? undefined : () => resetToRoot(),
      });
    }
    if (graphData && focusStack && focusStack.length > 0) {
      focusStack.forEach((nodeId) => {
        if (rootNode && nodeId === rootNode.id) return;
        const node = nodesById.get(nodeId);
        if (node)
          items.push({
            label: node.name.toUpperCase(),
            href: "#",
            onClick: () => jumpToFocus(node.id),
          });
      });
    }
    if (
      !isAtAssetRoot &&
      selectedNode &&
      selectedNode.id !== rootNode?.id &&
      !isOthersView
    ) {
      items.push({ label: selectedNode.name.toUpperCase(), current: true });
    }
    if (isOthersView) items.push({ label: "OTHERS", current: true });
    return items;
  }, [
    origin,
    id,
    rootNode,
    graphData,
    focusStack,
    selectedNode,
    isAtAssetRoot,
    isOthersView,
    resetToRoot,
    jumpToFocus,
    nodesById,
  ]);

  const chainLogoPath = hasChainLogo(chain) ? getChainLogoPath(chain) : null;
  const activeNodeType = getNodeTypeParts((selectedNode ?? rootNode)?.details);
  const activeNodeTypeLabel = activeNodeType.label;
  const activeNodeTypeCategory = classifyNodeType(activeNodeType);

  const typeBadgeClassName = (() => {
    if (!activeNodeTypeLabel) return "";
    const base =
      "px-2.5 py-1 border text-[8px] uppercase font-black tracking-[0.22em] rounded-full";
    switch (activeNodeTypeCategory) {
      case "yield-vault":
        return `${base} bg-emerald-50 border-emerald-200 text-emerald-700`;
      case "lending":
        return `${base} bg-blue-50 border-blue-200 text-blue-700`;
      case "staked-locked":
        return `${base} bg-amber-50 border-emerald-200 text-amber-700`;
      default:
        return `${base} bg-black/[0.02] border-black/10 text-black/60`;
    }
  })();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white gap-6">
        <Loader2 className="w-10 h-10 text-black animate-spin" />
        <p className="text-black font-mono text-[10px] uppercase tracking-[0.3em] animate-pulse">
          Establishing Data Connection
        </p>
      </div>
    );
  }

  if (!graphData) {
    return (
      <div className="p-8 text-center text-black h-screen flex flex-col items-center justify-center bg-[#E6EBF8]">
        <div className="bg-white p-12 rounded-sm border border-black max-w-md w-full shadow-2xl">
          <h2 className="text-lg font-bold text-black mb-4 tracking-tight uppercase">
            Registry Access Denied
          </h2>
          <p className="text-black/60 mb-10 text-xs leading-relaxed font-mono">
            ID_{id.toUpperCase()} not found in the indexed distribution network.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center w-full px-8 py-4 bg-black text-white font-bold text-[10px] uppercase tracking-[0.2em] rounded-sm hover:bg-black/80 transition-colors"
          >
            Return to Registry
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white font-sans selection:bg-black selection:text-white">
      {terminalToast && (
        <TerminalToast toast={terminalToast} onClose={closeTerminalToast} />
      )}

      <AppHeader
        selectedProtocol={selectedProtocol}
        selectedChain={selectedChain}
        selectedCurator={selectedCurator}
        apyMin={apyMin}
        apyMax={apyMax}
        query={query}
        updateParams={updateParams}
        protocols={protocols}
        chains={chains}
        curators={curators}
        dropdownResults={dropdownResults}
        buildChainLabel={buildChainLabel}
      />

      <div className="bg-black/[0.02] border-b border-black/5 px-10 py-4 flex items-center justify-between">
        <div className="flex items-center gap-12">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              {breadcrumbs.map((crumb, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  {idx > 0 && (
                    <ChevronRight className="w-2.5 h-2.5 text-black/20" />
                  )}
                  {crumb.onClick ? (
                    <button
                      onClick={crumb.onClick}
                      className="text-[8px] font-black text-black/40 hover:text-black uppercase tracking-[0.2em] transition-colors"
                    >
                      {crumb.label}
                    </button>
                  ) : crumb.href ? (
                    <Link
                      href={crumb.href}
                      className="text-[8px] font-black text-black/40 hover:text-black uppercase tracking-[0.2em] transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-[8px] font-black text-black/40 uppercase tracking-[0.2em]">
                      {crumb.label}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold text-black tracking-tight uppercase">
                {pageTitle}
              </h1>
              {activeNodeTypeLabel && (
                <div className={typeBadgeClassName} title={activeNodeTypeLabel}>
                  {activeNodeTypeLabel}
                </div>
              )}
              {chainLogoPath && (
                <Image
                  src={chainLogoPath}
                  alt={chain || ""}
                  width={16}
                  height={16}
                  className="object-contain"
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {origin && (
            <Link
              href={`/asset/${encodeURIComponent(origin)}`}
              className="flex items-center gap-2 px-3 py-2 bg-black text-white text-[9px] font-black uppercase tracking-widest rounded hover:bg-black/80 transition-all shadow-lg shadow-black/10 group"
            >
              <RotateCcw className="w-3 h-3 group-hover:rotate-[-45deg] transition-transform" />{" "}
              Reset to Origin
            </Link>
          )}
          <button className="p-2 border border-black rounded hover:bg-black hover:text-white transition-all">
            <Activity className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <main className="flex-grow flex flex-col min-h-0 px-6 md:px-24 lg:px-40 py-12">
        <div className="flex-grow relative bg-[#EAE5D9] overflow-hidden border border-black shadow-2xl flex flex-col p-3 gap-2">
          {infoNode && (
            <RootNodeHeader
              node={infoNode}
              tvl={tvl}
              onBack={
                !isAtAssetRoot || isOthersView ? handleBackOneStep : undefined
              }
            />
          )}
          <div className="flex-grow relative bg-[#E6EBF8] border border-black overflow-hidden">
            <AssetTreeMap
              data={graphData}
              rootNodeId={focusRootNodeId || rootNode?.id}
              graphRootIds={graphRootIds}
              onSelect={handleDrilldownSelect}
              onSelectOthers={handleSelectOthers}
              isOthersView={isOthersView}
              othersChildrenIds={othersChildrenIds}
              selectedNodeId={selectedNode?.id}
              lastClick={lastTileClick.current}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
