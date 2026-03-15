"use client";

import { Suspense, useMemo, useState, useEffect, useCallback } from "react";
import { Activity } from "lucide-react";
import { type SearchIndexEntry } from "@/constants";
import { useSearchParams, useRouter } from "next/navigation";
import AssetTreeMap from "@/components/AssetTreeMap";
import { useAssetData } from "@/hooks/useAssetData";
import { RootNodeHeader } from "@/components/RootNodeHeader";
import { AppHeader } from "@/components/AppHeader";
import { GraphNode } from "@/types";
import { BreadcrumbTrail } from "@/components/BreadcrumbTrail";
import {
  compactBreadcrumbs,
  limitBreadcrumbHistory,
  pushBreadcrumbHistory,
  type BreadcrumbItem,
} from "@/lib/breadcrumbs";
import { canonicalizeNodeId, canonicalizeProtocolToken } from "@/lib/nodeId";

const shortChainLabel = (value: string): string => {
  const v = value.trim().toLowerCase();
  switch (v) {
    case "eth":
    case "ethereum":
      return "ETH";
    case "arb":
    case "arbitrum":
    case "arbitrum-one":
      return "ARB";
    case "op":
    case "optimism":
      return "OP";
    case "base":
      return "BASE";
    case "polygon":
    case "matic":
      return "POLY";
    case "uni":
    case "unichain":
      return "UNI";
    case "hyper":
    case "hyperliquid":
      return "HYPER";
    case "global":
      return "GLOBAL";
    default:
      return v.toUpperCase();
  }
};

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

function UniversalTreemapView({
  asset,
  focus,
  onSelectAsset,
}: {
  asset: SearchIndexEntry | null;
  focus?: string;
  onSelectAsset: (
    id: string,
    chain: string,
    protocol: string,
    history: string[],
  ) => void;
}) {
  const searchParams = useSearchParams();
  const history = useMemo(() => {
    const raw = searchParams.get("history");
    return raw ? limitBreadcrumbHistory(raw.split(",")) : [];
  }, [searchParams]);

  const {
    graphData,
    loading,
    tvl,
    selectedNode,
    focusRootNodeId,
    applyLocalDrilldown,
    handleBackOneStep,
    resetToRoot,
    jumpToFocus,
    rootNode,
    isOthersView,
    othersChildrenIds,
    showOthersView,
    focusStack,
  } = useAssetData(
    asset
      ? {
          id: canonicalizeNodeId(asset.id),
          chain: asset.chain.trim().toLowerCase(),
          protocol: canonicalizeProtocolToken(asset.protocol),
          focus,
        }
      : null,
  );

  const [graphRootIds, setGraphRootIds] = useState<Set<string>>(new Set());
  const [assetNameById, setAssetNameById] = useState<Map<string, string>>(
    new Map(),
  );

  const nodesById = useMemo(() => {
    if (!graphData) return new Map<string, GraphNode>();
    return new Map(graphData.nodes.map((n) => [n.id, n]));
  }, [graphData]);

  const breadcrumbs = useMemo(() => {
    const items: BreadcrumbItem[] = [];

    history.forEach((histId, idx) => {
      const canonicalId = canonicalizeNodeId(histId);
      const [chainFromId = "global", protocolFromId = ""] =
        canonicalId.split(":");
      items.push({
        label: (assetNameById.get(canonicalId) ?? histId).toUpperCase(),
        onClick: () =>
          onSelectAsset(
            canonicalId,
            chainFromId || "global",
            protocolFromId || "",
            limitBreadcrumbHistory(history.slice(0, idx)),
          ),
      });
    });

    if (rootNode) {
      const isAtAssetRoot = focusRootNodeId === rootNode.id;
      items.push({
        label: rootNode.name.toUpperCase(),
        current: isAtAssetRoot && !isOthersView,
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
            onClick: () => jumpToFocus(node.id),
          });
      });
    }
    const isAtAssetRoot = focusRootNodeId === rootNode?.id;
    if (
      !isAtAssetRoot &&
      selectedNode &&
      selectedNode.id !== rootNode?.id &&
      !isOthersView
    ) {
      items.push({ label: selectedNode.name.toUpperCase(), current: true });
    }
    if (isOthersView) items.push({ label: "OTHERS", current: true });
    return compactBreadcrumbs(items);
  }, [
    history,
    assetNameById,
    onSelectAsset,
    rootNode,
    graphData,
    focusStack,
    selectedNode,
    isOthersView,
    resetToRoot,
    jumpToFocus,
    nodesById,
    focusRootNodeId,
  ]);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/search-index");
        if (!response.ok) return;
        const json = (await response.json()) as SearchIndexEntry[];
        if (!Array.isArray(json)) return;
        const set = new Set<string>();
        const names = new Map<string, string>();
        json.forEach((entry) => {
          const canonicalId = canonicalizeNodeId(entry.id);
          set.add(canonicalId);
          if (!names.has(canonicalId)) {
            names.set(canonicalId, entry.name);
          }
        });
        setGraphRootIds(set);
        setAssetNameById(names);
      } catch {
        /* ignore */
      }
    };
    void load();
  }, []);

  if (loading || !graphData) {
    return (
      <div className="w-full h-[60vh] flex items-center justify-center bg-black/[0.02] border border-black/5 rounded-3xl">
        <Activity className="w-8 h-8 text-black/10 animate-pulse" />
      </div>
    );
  }

  const currentRootId = focusRootNodeId || rootNode?.id;
  const infoNode = selectedNode ?? rootNode;
  const headerNode =
    infoNode && rootNode && infoNode.id === rootNode.id && asset
      ? {
          ...infoNode,
          displayName: asset.displayName ?? infoNode.displayName,
          logoKeys: asset.logoKeys ?? infoNode.logoKeys,
        }
      : infoNode;

  return (
    <div className="w-full flex flex-col gap-4">
      <BreadcrumbTrail items={breadcrumbs} />

      <div className="w-full border border-black bg-[#EAE5D9] shadow-2xl overflow-hidden relative p-3">
        <div className="flex flex-col gap-2 h-[50vh] lg:h-[60vh]">
          {headerNode && (
            <RootNodeHeader
              node={headerNode}
              tvl={tvl}
              onBack={
                isOthersView || (rootNode && focusRootNodeId !== rootNode.id)
                  ? handleBackOneStep
                  : undefined
              }
            />
          )}
          <div className="flex-grow relative bg-[#E6EBF8] overflow-hidden">
            <AssetTreeMap
              data={graphData}
              rootNodeId={currentRootId}
              onSelect={(node) => {
                if (graphData) {
                  const hasChildren = graphData.edges.some(
                    (e) => e.from === node.id,
                  );
                  const canonicalId = canonicalizeNodeId(node.id);
                  const isKnownAsset = graphRootIds.has(canonicalId);

                  if (hasChildren) {
                    applyLocalDrilldown(node);
                  } else if (
                    isKnownAsset &&
                    node.id.toLowerCase() !== asset?.id.toLowerCase()
                  ) {
                    const [chainFromId = "global", protocolFromId = ""] =
                      canonicalId.split(":");
                    const nextHistory = pushBreadcrumbHistory(
                      history,
                      canonicalizeNodeId(asset?.id ?? ""),
                    );
                    onSelectAsset(
                      canonicalId,
                      chainFromId || "global",
                      protocolFromId || "",
                      nextHistory,
                    );
                  }
                }
              }}
              onSelectOthers={showOthersView}
              isOthersView={isOthersView}
              othersChildrenIds={othersChildrenIds}
              selectedNodeId={selectedNode?.id}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [dynamicIndex, setDynamicIndex] = useState<SearchIndexEntry[]>([]);

  // Sync filter state with URL params
  const selectedProtocol = searchParams.get("protocol") || "all";
  const selectedChain = searchParams.get("chain") || "all";
  const selectedCurator = searchParams.get("curator") || "all";
  const apyMin = searchParams.get("apyMin") || "";
  const apyMax = searchParams.get("apyMax") || "";
  const query = searchParams.get("q") || "";

  const activeAssetId = searchParams.get("id");
  const activeAssetChain = searchParams.get("assetChain");
  const activeAssetProtocol = searchParams.get("assetProtocol");
  const activeFocus = searchParams.get("focus") ?? undefined;

  const activeAsset = useMemo(() => {
    if (!activeAssetId) return null;
    const normalizedId = canonicalizeNodeId(activeAssetId);
    const normalizedChain = activeAssetChain?.trim().toLowerCase() ?? null;
    const normalizedProtocol = activeAssetProtocol
      ? canonicalizeProtocolToken(activeAssetProtocol)
      : null;
    const byId = dynamicIndex.filter(
      (e) => canonicalizeNodeId(e.id) === normalizedId,
    );
    if (byId.length === 0) return null;
    const strictMatch = byId.find(
      (e) =>
        (!normalizedChain || e.chain.toLowerCase() === normalizedChain) &&
        (!normalizedProtocol ||
          canonicalizeProtocolToken(e.protocol) === normalizedProtocol),
    );
    return strictMatch || byId[0] || null;
  }, [dynamicIndex, activeAssetId, activeAssetChain, activeAssetProtocol]);

  const updateParams = useCallback(
    (
      newParams: Record<string, string | null>,
      mode: "push" | "replace" = "replace",
    ) => {
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
      const url = params.toString() ? `?${params.toString()}` : "?";
      const navigate = mode === "push" ? router.push : router.replace;
      navigate(url, { scroll: false });
    },
    [router, searchParams],
  );

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/search-index");
        if (!response.ok) return;
        const json = (await response.json()) as SearchIndexEntry[];
        if (!Array.isArray(json)) return;
        setDynamicIndex(json);
      } catch {
        // ignore
      }
    };
    void load();
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
      if (!current || (tvlUsd ?? -1) > (current.tvlUsd ?? -1)) {
        existing.entries.set(entryKey, { chain, entry, tvlUsd });
      }
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

  const topAsset = useMemo(() => {
    if (dynamicIndex.length === 0) return null;
    return [...dynamicIndex].sort(
      (a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0),
    )[0];
  }, [dynamicIndex]);

  useEffect(() => {
    if (!activeAssetId || activeAsset || dynamicIndex.length === 0) {
      return;
    }

    if (topAsset) {
      updateParams(
        {
          id: topAsset.id,
          assetChain: topAsset.chain,
          assetProtocol: topAsset.protocol,
          focus: null,
          focusTrail: null,
          others: null,
        },
        "replace",
      );
      return;
    }

    updateParams(
      {
        id: null,
        assetChain: null,
        assetProtocol: null,
        focus: null,
        focusTrail: null,
        others: null,
      },
      "replace",
    );
  }, [activeAsset, activeAssetId, dynamicIndex.length, topAsset, updateParams]);

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col font-sans selection:bg-black selection:text-white">
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

      <main className="flex-grow flex flex-col px-6 md:px-24 lg:px-40 py-12">
        <UniversalTreemapView
          asset={activeAsset || topAsset}
          focus={activeFocus}
          onSelectAsset={(id, chain, protocol, history) =>
            updateParams(
              {
                id,
                assetChain: chain,
                assetProtocol: protocol,
                focus: null,
                focusTrail: null,
                others: null,
                history: history.length > 0 ? history.join(",") : null,
                q: "",
              },
              "push",
            )
          }
        />
      </main>

      <footer className="p-12 border-t border-black/[0.03] bg-black/[0.01]">
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
