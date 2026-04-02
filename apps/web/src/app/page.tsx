"use client";

import {
  Suspense,
  useMemo,
  useState,
  useEffect,
  useCallback,
  useDeferredValue,
} from "react";
import { Activity } from "lucide-react";
import { type SearchIndexEntry } from "@/constants";
import { useSearchParams, useRouter } from "next/navigation";
import AssetTreeMap from "@/components/AssetTreeMap";
import { useAssetData } from "@/hooks/useAssetData";
import { RootNodeHeader } from "@/components/RootNodeHeader";
import { AppHeader } from "@/components/AppHeader";
import { GraphNode } from "@/types";
import { BreadcrumbTrail } from "@/components/BreadcrumbTrail";
import { getDirectChildNodes } from "@/lib/graph";
import {
  buildChainLabel,
  buildCuratorOptions,
  buildDropdownResults,
  filterSearchEntries,
  prepareSearchIndex,
} from "@/lib/search";
import {
  compactBreadcrumbs,
  limitBreadcrumbHistory,
  pushBreadcrumbHistory,
  type BreadcrumbItem,
} from "@/lib/breadcrumbs";
import {
  buildEntriesByAddress,
  canonicalizeNodeId,
  canonicalizeProtocolToken,
  resolveGraphTargetEntry,
} from "@/lib/nodeId";
import { formatChainLabel, formatUiLabel } from "@/utils/formatters";

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
  const [graphRootEntriesByAddress, setGraphRootEntriesByAddress] = useState<
    Map<string, SearchIndexEntry[]>
  >(new Map());
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
        label: assetNameById.get(canonicalId) ?? histId,
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
        label: rootNode.name,
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
            label: node.name,
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
      items.push({ label: selectedNode.name, current: true });
    }
    if (isOthersView) items.push({ label: "Others", current: true });
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
        setGraphRootEntriesByAddress(buildEntriesByAddress(json));
      } catch {
        /* ignore */
      }
    };
    void load();
  }, []);

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
  const headerChildren = useMemo(() => {
    if (!graphData || !headerNode) return [];
    return getDirectChildNodes(headerNode, graphData.nodes, graphData.edges);
  }, [graphData, headerNode]);

  if (loading || !graphData) {
    return (
      <div className="w-full h-[60vh] flex items-center justify-center bg-black/[0.02] border border-black/5 rounded-3xl">
        <Activity className="w-8 h-8 text-black/10 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <BreadcrumbTrail items={breadcrumbs} />

      <div className="w-full border border-black bg-[#EAE5D9] shadow-2xl overflow-hidden relative p-3">
        <div className="flex flex-col gap-2 h-[50vh] lg:h-[60vh]">
          {headerNode && (
            <RootNodeHeader
              node={headerNode}
              children={headerChildren}
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
                  const targetEntry = resolveGraphTargetEntry(
                    node,
                    graphRootIds,
                    graphRootEntriesByAddress,
                  );

                  if (hasChildren) {
                    applyLocalDrilldown(node);
                  } else if (
                    targetEntry &&
                    node.id.toLowerCase() !== asset?.id.toLowerCase()
                  ) {
                    const [chainFromId = "global", protocolFromId = ""] =
                      canonicalizeNodeId(targetEntry.id).split(":");
                    const nextHistory = pushBreadcrumbHistory(
                      history,
                      canonicalizeNodeId(asset?.id ?? ""),
                    );
                    onSelectAsset(
                      canonicalizeNodeId(targetEntry.id),
                      (targetEntry.chain || chainFromId || "global").trim(),
                      (targetEntry.protocol || protocolFromId || "").trim(),
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
  const [entryRandomAsset, setEntryRandomAsset] =
    useState<SearchIndexEntry | null>(null);

  // Sync filter state with URL params
  const selectedProtocol = searchParams.get("protocol") || "all";
  const selectedChain = searchParams.get("chain") || "all";
  const selectedCurator = searchParams.get("curator") || "all";
  const apyMin = searchParams.get("apyMin") || "";
  const apyMax = searchParams.get("apyMax") || "";
  const urlQuery = searchParams.get("q") || "";
  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const preparedIndex = useMemo(
    () => prepareSearchIndex(dynamicIndex),
    [dynamicIndex],
  );

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
    const byId = preparedIndex.filter(
      (entry) => entry.normalizedId === normalizedId,
    );
    if (byId.length === 0) return null;
    const strictMatch = byId.find(
      (entry) =>
        (!normalizedChain || entry.normalizedChain === normalizedChain) &&
        (!normalizedProtocol ||
          entry.normalizedProtocol === normalizedProtocol),
    );
    return strictMatch || byId[0] || null;
  }, [preparedIndex, activeAssetId, activeAssetChain, activeAssetProtocol]);

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

  const navigateToAsset = useCallback(
    (
      asset: Pick<SearchIndexEntry, "id" | "chain" | "protocol">,
      mode: "push" | "replace",
      history: string[] = [],
    ) => {
      updateParams(
        {
          id: asset.id,
          assetChain: asset.chain,
          assetProtocol: asset.protocol,
          focus: null,
          focusTrail: null,
          others: null,
          history: history.length > 0 ? history.join(",") : null,
          q: "",
        },
        mode,
      );
    },
    [updateParams],
  );

  const getRandomAsset = useCallback((): SearchIndexEntry | null => {
    if (dynamicIndex.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * dynamicIndex.length);
    return dynamicIndex[randomIndex] ?? null;
  }, [dynamicIndex]);

  useEffect(() => {
    setSearchQuery(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    if (searchQuery === urlQuery) return;

    const timeoutId = window.setTimeout(() => {
      updateParams({ q: searchQuery });
    }, 200);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery, updateParams, urlQuery]);

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
        .map((p) => ({ label: formatUiLabel(p), value: p })),
    ];
  }, [dynamicIndex]);

  const chains = useMemo(() => {
    const set = new Set(dynamicIndex.map((e) => e.chain));
    return [
      { label: "Any Chain", value: "all" },
      ...Array.from(set)
        .sort()
        .map((c) => ({ label: formatChainLabel(c), value: c })),
    ];
  }, [dynamicIndex]);

  const curators = useMemo(() => {
    return buildCuratorOptions(preparedIndex, selectedProtocol, selectedChain);
  }, [preparedIndex, selectedProtocol, selectedChain]);

  const filteredResults = useMemo(() => {
    return filterSearchEntries(preparedIndex, {
      selectedProtocol,
      selectedChain,
      selectedCurator,
      apyMin,
      apyMax,
      query: deferredSearchQuery,
    });
  }, [
    preparedIndex,
    selectedProtocol,
    selectedChain,
    selectedCurator,
    apyMin,
    apyMax,
    deferredSearchQuery,
  ]);

  const dropdownResults = useMemo(
    () => buildDropdownResults(filteredResults),
    [filteredResults],
  );

  const renderAsset = activeAsset ?? entryRandomAsset;

  const onRandom = useCallback(() => {
    const asset = getRandomAsset();
    if (!asset) return;
    navigateToAsset(asset, "push");
  }, [getRandomAsset, navigateToAsset]);

  useEffect(() => {
    if (activeAsset) {
      setEntryRandomAsset(null);
      return;
    }

    if (dynamicIndex.length === 0) {
      setEntryRandomAsset(null);
      return;
    }

    setEntryRandomAsset((current) => {
      if (
        current &&
        dynamicIndex.some(
          (entry) =>
            entry.id === current.id &&
            entry.chain === current.chain &&
            entry.protocol === current.protocol,
        )
      ) {
        return current;
      }

      return getRandomAsset();
    });
  }, [activeAsset, dynamicIndex, getRandomAsset]);

  useEffect(() => {
    if (activeAsset || !entryRandomAsset) {
      return;
    }

    updateParams(
      {
        id: entryRandomAsset.id,
        assetChain: entryRandomAsset.chain,
        assetProtocol: entryRandomAsset.protocol,
        focus: null,
        focusTrail: null,
        others: null,
        history: null,
      },
      "replace",
    );
  }, [activeAsset, entryRandomAsset, updateParams]);

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col font-sans selection:bg-black selection:text-white">
      <AppHeader
        selectedProtocol={selectedProtocol}
        selectedChain={selectedChain}
        selectedCurator={selectedCurator}
        apyMin={apyMin}
        apyMax={apyMax}
        query={searchQuery}
        onQueryChange={setSearchQuery}
        updateParams={updateParams}
        protocols={protocols}
        chains={chains}
        curators={curators}
        dropdownResults={dropdownResults}
        buildChainLabel={buildChainLabel}
        onRandom={onRandom}
      />

      <main className="app-content-frame flex-grow flex flex-col px-6 py-12">
        <UniversalTreemapView
          asset={renderAsset}
          focus={activeFocus}
          onSelectAsset={(id, chain, protocol, history) =>
            navigateToAsset({ id, chain, protocol }, "push", history)
          }
        />
      </main>
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
