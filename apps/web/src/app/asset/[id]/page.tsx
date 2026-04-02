"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  useDeferredValue,
} from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Activity, RotateCcw } from "lucide-react";

import AssetTreeMap from "@/components/AssetTreeMap";
import { TerminalToast } from "@/components/TerminalToast";
import { RootNodeHeader } from "@/components/RootNodeHeader";
import { AppHeader } from "@/components/AppHeader";
import { BreadcrumbTrail } from "@/components/BreadcrumbTrail";

import { useAssetData } from "@/hooks/useAssetData";
import { useTerminalToast } from "@/hooks/useTerminalToast";
import { GraphNode } from "@/types";
import { type SearchIndexEntry } from "@/constants";
import { hasChainLogo, getChainLogoPath } from "@/lib/logos";
import {
  buildEntriesByAddress,
  canonicalizeNodeId,
  canonicalizeProtocolToken,
  resolveGraphTargetEntry,
} from "@/lib/nodeId";
import { classifyNodeType, getNodeTypeParts } from "@/lib/nodeType";
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
import Image from "next/image";
import { formatChainLabel, formatUiLabel } from "@/utils/formatters";

export default function AssetPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const id = params.id as string;
  const chain = searchParams.get("chain") ?? undefined;
  const focus = searchParams.get("focus") ?? undefined;
  const protocol = searchParams.get("protocol") ?? undefined;
  const canonicalAssetId = useMemo(() => canonicalizeNodeId(id), [id]);
  const canonicalProtocol = useMemo(
    () => (protocol ? canonicalizeProtocolToken(protocol) : undefined),
    [protocol],
  );

  // History tracking across assets
  const history = useMemo(() => {
    const raw = searchParams.get("history");
    return raw ? limitBreadcrumbHistory(raw.split(",")) : [];
  }, [searchParams]);

  // Origin tracking
  const origin = history[0] ?? searchParams.get("origin") ?? undefined;

  // Header State & Search Logic
  const [dynamicIndex, setDynamicIndex] = useState<SearchIndexEntry[]>([]);
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
    othersChildrenIds,
    showOthersView,
    focusStack,
  } = useAssetData({
    id: canonicalAssetId,
    chain,
    protocol: canonicalProtocol,
    focus,
  });

  const { terminalToast, showTerminalToast, closeTerminalToast } =
    useTerminalToast();

  const nodesById = useMemo(() => {
    if (!graphData) return new Map<string, GraphNode>();
    return new Map(graphData.nodes.map((n) => [n.id, n]));
  }, [graphData]);

  const tileClickSeq = useRef(0);
  const lastTileClick = useRef<{ nodeId: string; seq: number } | null>(null);

  const infoNode = selectedNode ?? rootNode;
  const graphRootIds = useMemo(
    () => new Set(preparedIndex.map((entry) => entry.normalizedId)),
    [preparedIndex],
  );
  const graphRootEntriesByAddress = useMemo(
    () => buildEntriesByAddress(preparedIndex),
    [preparedIndex],
  );
  const activeRootEntry = useMemo(() => {
    return preparedIndex.find(
      (entry) => entry.normalizedId === canonicalAssetId,
    );
  }, [canonicalAssetId, preparedIndex]);
  const headerNode =
    infoNode && rootNode && infoNode.id === rootNode.id && activeRootEntry
      ? {
          ...infoNode,
          displayName: activeRootEntry.displayName ?? infoNode.displayName,
          logoKeys: activeRootEntry.logoKeys ?? infoNode.logoKeys,
        }
      : infoNode;
  const headerChildren = useMemo(() => {
    if (!graphData || !headerNode) return [];
    return getDirectChildNodes(headerNode, graphData.nodes, graphData.edges);
  }, [graphData, headerNode]);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/search-index");
        if (!response.ok) return;
        const json = (await response.json()) as SearchIndexEntry[];
        if (!Array.isArray(json)) return;
        setDynamicIndex(json);
      } catch (error) {
        console.error("Failed to load search index:", error);
      }
    };
    void load();
  }, []);

  const updateParams = useCallback(
    (
      newParams: Record<string, string | null>,
      mode: "push" | "replace" = "replace",
    ) => {
      // If navigating to a different asset, redirect to that asset page
      if (
        newParams.id &&
        canonicalizeNodeId(newParams.id) !== canonicalAssetId
      ) {
        const p = new URLSearchParams();
        if (newParams.assetChain) p.set("chain", newParams.assetChain);
        if (newParams.assetProtocol) p.set("protocol", newParams.assetProtocol);
        router.push(
          `/asset/${encodeURIComponent(canonicalizeNodeId(newParams.id))}${p.size ? `?${p.toString()}` : ""}`,
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
      const url = params.toString() ? `?${params.toString()}` : "?";
      const navigate = mode === "push" ? router.push : router.replace;
      navigate(url, { scroll: false });
    },
    [router, searchParams, canonicalAssetId],
  );

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

  const handleDrilldownSelect = async (node: GraphNode) => {
    if (!node?.id) return;

    tileClickSeq.current += 1;
    lastTileClick.current = { nodeId: node.id, seq: tileClickSeq.current };
    setSelectedNode(node);

    const targetEntry = resolveGraphTargetEntry(
      node,
      graphRootIds,
      graphRootEntriesByAddress,
    );

    if (
      targetEntry &&
      canonicalizeNodeId(targetEntry.id) !== canonicalAssetId
    ) {
      const queryParams = new URLSearchParams(searchParams.toString());
      const nextProtocol = (targetEntry.protocol ?? protocol)?.trim();
      const nextChain = (targetEntry.chain ?? chain)?.trim();
      if (nextProtocol) queryParams.set("protocol", nextProtocol);
      else queryParams.delete("protocol");
      if (nextChain) queryParams.set("chain", nextChain);
      else queryParams.delete("chain");

      queryParams.delete("focus");
      queryParams.delete("focusTrail");
      queryParams.delete("others");
      queryParams.delete("origin");

      const nextHistory = pushBreadcrumbHistory(history, id);
      if (nextHistory.length > 0) {
        queryParams.set("history", nextHistory.join(","));
      } else {
        queryParams.delete("history");
      }

      router.push(
        `/asset/${encodeURIComponent(canonicalizeNodeId(targetEntry.id))}?${queryParams.toString()}`,
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
    const items: BreadcrumbItem[] = [];

    history.forEach((histId, idx) => {
      const entry = dynamicIndex.find(
        (e) => canonicalizeNodeId(e.id) === canonicalizeNodeId(histId),
      );
      const label = entry ? entry.name : histId;
      const nextHistory = limitBreadcrumbHistory(history.slice(0, idx));
      const querySuffix =
        nextHistory.length > 0 ? `?history=${nextHistory.join(",")}` : "";

      items.push({
        label,
        href: `/asset/${encodeURIComponent(histId)}${querySuffix}`,
      });
    });

    if (rootNode) {
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
    dynamicIndex,
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
      "px-2.5 py-1 border text-[8px] font-semibold tracking-[0.05em] rounded-full";
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
        <p className="text-black font-mono text-[10px] tracking-[0.08em] animate-pulse">
          Establishing Data Connection
        </p>
      </div>
    );
  }

  if (!graphData) {
    return (
      <div className="p-8 text-center text-black h-screen flex flex-col items-center justify-center bg-[#E6EBF8]">
        <div className="bg-white p-12 rounded-sm border border-black max-w-md w-full shadow-2xl">
          <h2 className="text-lg font-semibold text-black mb-4 tracking-[0.03em]">
            Registry Access Denied
          </h2>
          <p className="text-black/60 mb-10 text-xs leading-relaxed font-mono">
            {id} was not found in the indexed distribution network.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center w-full px-8 py-4 bg-black text-white font-semibold text-[10px] tracking-[0.05em] rounded-sm hover:bg-black/80 transition-colors"
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
        query={searchQuery}
        onQueryChange={setSearchQuery}
        updateParams={updateParams}
        protocols={protocols}
        chains={chains}
        curators={curators}
        dropdownResults={dropdownResults}
        buildChainLabel={buildChainLabel}
      />

      <div className="border-b border-black/5 bg-black/[0.02]">
        <div className="app-content-frame flex items-center justify-between px-10 py-4">
          <div className="flex items-center gap-12">
            <div className="flex flex-col">
              <div className="flex items-center gap-4">
                <h1 className="text-lg font-semibold text-black tracking-[0.03em]">
                  {pageTitle}
                </h1>
                {activeNodeTypeLabel && (
                  <div
                    className={typeBadgeClassName}
                    title={activeNodeTypeLabel}
                  >
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
                className="flex items-center gap-2 px-3 py-2 bg-black text-white text-[9px] font-semibold tracking-[0.05em] rounded hover:bg-black/80 transition-all shadow-lg shadow-black/10 group"
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
      </div>

      <main className="app-content-frame flex-grow flex flex-col min-h-0 px-6 py-12">
        <div className="flex min-h-0 flex-grow flex-col gap-4">
          <BreadcrumbTrail items={breadcrumbs} />

          <div className="flex-grow relative bg-[#EAE5D9] overflow-hidden border border-black shadow-2xl flex flex-col p-3 gap-2 h-[50vh] lg:h-[60vh]">
            {headerNode && (
              <RootNodeHeader
                node={headerNode}
                children={headerChildren}
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
                onSelectOthers={showOthersView}
                isOthersView={isOthersView}
                othersChildrenIds={othersChildrenIds}
                selectedNodeId={selectedNode?.id}
                lastClick={lastTileClick.current}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
