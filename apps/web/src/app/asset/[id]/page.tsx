"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Activity,
  ChevronRight,
  RotateCcw,
} from "lucide-react";

import AssetTreeMap from "@/components/AssetTreeMap";
import AssetDetailPanel from "@/components/AssetDetailPanel";
import { TerminalToast } from "@/components/TerminalToast";

import { useAssetData } from "@/hooks/useAssetData";
import { useTerminalToast } from "@/hooks/useTerminalToast";
import { currencyFormatter } from "@/utils/formatters";
import { GraphNode } from "@/types";
import { hasChainLogo, getChainLogoPath } from "@/lib/logos";
import Image from "next/image";

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
    isAtAssetRoot,
    rootNode,
    isOthersView,
    setIsOthersView,
    othersChildrenIds,
    setOthersChildrenIds,
  } = useAssetData({ id, chain, protocol, focus });

  const { terminalToast, showTerminalToast, closeTerminalToast } =
    useTerminalToast();

  const tileClickSeq = useRef(0);
  const lastTileClick = useRef<{ nodeId: string; seq: number } | null>(null);

  const [graphRootIds, setGraphRootIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const normalizeId = (value: string): string => value.trim().toLowerCase();

    const load = async () => {
      try {
        const res = await fetch("/api/search-index");
        if (!res.ok) return;
        const json = (await res.json()) as unknown;
        if (!Array.isArray(json)) return;

        const set = new Set<string>();
        for (const item of json) {
          if (!item || typeof item !== "object") continue;
          const rec = item as { nodeId?: unknown; id?: unknown };
          const nodeId =
            typeof rec.nodeId === "string"
              ? rec.nodeId
              : typeof rec.id === "string"
                ? rec.id
                : null;
          if (!nodeId) continue;
          set.add(normalizeId(nodeId));
        }

        if (!cancelled) setGraphRootIds(set);
      } catch {
        // ignore
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectOthers = (childIds: string[]) => {
    setOthersChildrenIds(childIds);
    setIsOthersView(true);
  };

  const handleDrilldownSelect = async (
    node: GraphNode,
    meta?: {
      lendingPosition?: "collateral" | "borrow";
    },
  ) => {
    if (!node?.id) return;

    tileClickSeq.current += 1;
    lastTileClick.current = { nodeId: node.id, seq: tileClickSeq.current };
    setSelectedNode(node);

    const normalizedNodeId = node.id.trim().toLowerCase();
    const normalizedAssetId = id.trim().toLowerCase();

    const canNavigateToChildGraph =
      normalizedNodeId.length > 0 && normalizedNodeId !== normalizedAssetId;
    const isLendingEdge = Boolean(meta?.lendingPosition);
    const isLendingNode =
      (node.details?.kind ?? "").toLowerCase() === "lending";
    const shouldAttemptRouteNavigation =
      canNavigateToChildGraph && !isLendingEdge && !isLendingNode;

    if (shouldAttemptRouteNavigation) {
      const queryParams = new URLSearchParams();
      const nextProtocol = (node.protocol ?? protocol)?.trim();
      const nextChain = (node.chain ?? chain)?.trim();
      if (nextProtocol) queryParams.set("protocol", nextProtocol);
      if (nextChain) queryParams.set("chain", nextChain);

      // Persist or set origin
      const currentOrigin = origin || id;
      queryParams.set("origin", currentOrigin);

      const headUrl = `/api/graph/${encodeURIComponent(normalizedNodeId)}${
        queryParams.size ? `?${queryParams.toString()}` : ""
      }`;

      try {
        const res = await fetch(headUrl, { method: "HEAD" });
        if (res.ok) {
          await new Promise((r) => setTimeout(r, 150));
          router.push(
            `/asset/${encodeURIComponent(normalizedNodeId)}${
              queryParams.size ? `?${queryParams.toString()}` : ""
            }`,
          );
          return;
        }
      } catch {
        // Fallback
      }
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
      items.push({ label: origin.toUpperCase(), href: `/asset/${origin}` });
    }
    items.push({ label: pageTitle.toUpperCase(), current: true });
    return items;
  }, [origin, id, pageTitle]);

  const chainLogoPath = hasChainLogo(chain) ? getChainLogoPath(chain) : null;

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
    <div className="h-screen flex flex-col bg-white overflow-hidden font-sans selection:bg-black selection:text-white">
      {terminalToast && (
        <TerminalToast toast={terminalToast} onClose={closeTerminalToast} />
      )}

      {/* Institutional Header */}
      <header className="bg-white border-b border-black px-10 py-6 flex justify-between items-center z-30 flex-shrink-0">
        <div className="flex items-center gap-12">
          <Link
            href="/"
            className="flex items-center gap-3 text-black hover:opacity-60 transition-all group"
          >
            <ArrowLeft className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
              Dashboard
            </span>
          </Link>

          <div className="flex flex-col">
            <div className="flex items-center gap-3 mb-1">
              {breadcrumbs.map((crumb, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  {idx > 0 && (
                    <ChevronRight className="w-3 h-3 text-black/20" />
                  )}
                  {crumb.href ? (
                    <Link
                      href={crumb.href}
                      className="text-[9px] font-black text-black/40 hover:text-black uppercase tracking-[0.2em] transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-[9px] font-black text-black/40 uppercase tracking-[0.2em]">
                      {crumb.label}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-black tracking-tight uppercase">
                {pageTitle}
              </h1>
              {chainLogoPath && (
                <Image
                  src={chainLogoPath}
                  alt={chain || ""}
                  width={18}
                  height={18}
                  className="object-contain"
                />
              )}
              <div className="px-2 py-0.5 border border-black text-black text-[8px] uppercase font-black tracking-[0.2em] rounded-sm">
                BETA_V0.1
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-16">
          <div className="text-right">
            <p className="text-[9px] text-black/30 uppercase font-black tracking-[0.2em] mb-1">
              Distribution Aggregate
            </p>
            <p className="font-bold text-black text-2xl tracking-tighter font-mono">
              {tvl ? currencyFormatter.format(tvl) : "—"}
            </p>
          </div>
          {origin && (
            <Link
              href={`/asset/${origin}`}
              className="flex items-center gap-2 px-4 py-3 bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-black/80 transition-all shadow-lg shadow-black/10 group"
            >
              <RotateCcw className="w-3.5 h-3.5 group-hover:rotate-[-45deg] transition-transform" />
              Reset to Origin
            </Link>
          )}
          <button className="p-3 border border-black rounded-sm hover:bg-black hover:text-white transition-all">
            <Activity className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Primary Layout */}
      <main className="flex-grow flex flex-col lg:flex-row overflow-hidden">
        {/* Visualization Region */}
        <div className="flex-grow h-[65vh] lg:h-auto lg:w-2/3 relative bg-[#E6EBF8] overflow-hidden border-r border-black">
          <div className="absolute top-10 left-10 z-20 pointer-events-none">
            <div className="px-5 py-2.5 bg-white border border-black text-[9px] font-black text-black uppercase tracking-[0.3em] shadow-xl">
              Open Interest Distribution // Active_Stream
            </div>
          </div>

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

        {/* Intelligence Region */}
        <aside className="lg:w-[450px] h-[35vh] lg:h-auto bg-white flex flex-col z-20 overflow-hidden shadow-[-20px_0_60px_rgba(0,0,0,0.05)]">
          <AssetDetailPanel
            selectedNode={selectedNode}
            edges={graphData.edges}
            rootNodeId={focusRootNodeId || rootNode?.id}
            originId={origin}
            onReset={
              !isAtAssetRoot || isOthersView ? handleBackOneStep : undefined
            }
          />
        </aside>
      </main>
    </div>
  );
}
