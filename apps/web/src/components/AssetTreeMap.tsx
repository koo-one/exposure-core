"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { GraphSnapshot, GraphNode, GraphEdge } from "@/types";
import { getDirectChildren } from "@/lib/graph";
import { getNodeTypeLabel } from "@/lib/nodeType";
import {
  TreemapHoverCard,
  type TreemapHoverCardDatum,
} from "@/components/TreemapHoverCard";
import dynamic from "next/dynamic";
import { normalizeId } from "@/utils/formatters";

const AssetTreeMapKonva = dynamic(
  () => import("./AssetTreeMapKonva").then((m) => m.AssetTreeMapKonva),
  {
    ssr: false,
  },
);

const isGraphSnapshot = (value: unknown): value is GraphSnapshot => {
  if (!value || typeof value !== "object") return false;

  const snapshot = value as Partial<GraphSnapshot>;
  return Array.isArray(snapshot.nodes) && Array.isArray(snapshot.edges);
};

interface AssetTreeMapProps {
  data: GraphSnapshot | null;
  rootNodeId?: string;
  graphRootIds?: Set<string> | null;
  onSelect: (
    node: GraphNode,
    meta?: {
      lendingPosition?: "collateral" | "borrow";
    },
  ) => void | Promise<void>;
  selectedNodeId?: string | null;
  lastClick?: { nodeId: string; seq: number } | null;
  isOthersView?: boolean;
  othersChildrenIds?: string[];
  onSelectOthers?: (childIds: string[]) => void;
}

export default function AssetTreeMap({
  data,
  rootNodeId,
  graphRootIds,
  onSelect,
  selectedNodeId,
  lastClick,
  isOthersView,
  othersChildrenIds,
  onSelectOthers,
}: AssetTreeMapProps) {
  const [pressedNodeId, setPressedNodeId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const tooltipRef = useRef<HTMLDivElement>(null);
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  const [hoverState, setHoverState] = useState<{
    datum: TreemapHoverCardDatum;
    clientX: number;
    clientY: number;
  } | null>(null);
  const [tooltipSize, setTooltipSize] = useState<{
    w: number;
    h: number;
  } | null>(null);
  const [allocationsByNodeId, setAllocationsByNodeId] = useState<
    Map<string, { id: string; name: string; value: number; node?: GraphNode }[]>
  >(new Map());
  const [attemptedNestedNodeIds, setAttemptedNestedNodeIds] = useState<
    Set<string>
  >(new Set());
  const measureContainer = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    setContainerSize({
      width: Math.max(0, Math.floor(rect.width)),
      height: Math.max(0, Math.floor(rect.height)),
    });
  }, []);

  useEffect(() => {
    setHoverState(null);
    setTooltipSize(null);
  }, [rootNodeId, isOthersView]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    measureContainer();

    const ro = new ResizeObserver(() => measureContainer());
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [measureContainer]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => measureContainer());
    return () => window.cancelAnimationFrame(frame);
  }, [measureContainer, rootNodeId, isOthersView, othersChildrenIds, data]);

  useEffect(() => {
    if (!hoverState) return;
    const el = tooltipRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const w = Math.max(0, Math.floor(rect.width));
    const h = Math.max(0, Math.floor(rect.height));
    if (w === 0 || h === 0) return;
    setTooltipSize({ w, h });
  }, [hoverState?.datum]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.createElement("div");
    document.body.appendChild(el);
    setPortalEl(el);

    return () => {
      if (el.parentNode) el.parentNode.removeChild(el);
    };
  }, []);

  const graphIndex = useMemo(() => {
    if (!data) return null;

    const nodesById = new Map<string, GraphNode>();
    for (const n of data.nodes) nodesById.set(normalizeId(n.id), n);

    const edgesByFrom = new Map<string, GraphEdge[]>();
    for (const edge of data.edges) {
      const fromId = normalizeId(edge.from);
      const list = edgesByFrom.get(fromId);
      if (list) list.push(edge);
      else edgesByFrom.set(fromId, [edge]);
    }

    return { nodesById, edgesByFrom };
  }, [data]);

  const downstream = useMemo(() => {
    const nodeId = hoverState?.datum?.nodeId ?? null;
    if (!nodeId) return [];
    if (!graphIndex) return [];
    if (nodeId === "others") return [];

    const outgoing = graphIndex.edgesByFrom.get(normalizeId(nodeId)) ?? [];
    if (outgoing.length === 0) return [];

    const enriched = outgoing
      .map((e) => {
        const to = graphIndex.nodesById.get(normalizeId(e.to));
        return {
          id: e.to,
          name: to?.name ?? e.to,
          allocationUsd:
            typeof e.allocationUsd === "number" ? e.allocationUsd : 0,
        };
      })
      .filter((x) => Number.isFinite(x.allocationUsd) && x.allocationUsd !== 0)
      .sort((a, b) => Math.abs(b.allocationUsd) - Math.abs(a.allocationUsd));

    return enriched.slice(0, 4);
  }, [hoverState, graphIndex]);

  const chartData = useMemo(() => {
    if (!data || !rootNodeId) return [];

    const root = data.nodes.find((n) => n.id === rootNodeId);
    if (!root) return [];

    let children = getDirectChildren(root, data.nodes, data.edges);

    if (isOthersView && othersChildrenIds) {
      const scope = new Set(
        othersChildrenIds.map((id) => id.trim().toLowerCase()),
      );
      children = children.filter((c) => scope.has(c.id.trim().toLowerCase()));
    }

    const nodesById =
      graphIndex?.nodesById ??
      new Map(data.nodes.map((n) => [normalizeId(n.id), n] as const));
    const edgesByFrom =
      graphIndex?.edgesByFrom ??
      (() => {
        const map = new Map<string, GraphEdge[]>();
        for (const edge of data.edges) {
          const fromId = normalizeId(edge.from);
          const list = map.get(fromId);
          if (list) list.push(edge);
          else map.set(fromId, [edge]);
        }
        return map;
      })();

    const isTerminalNodeId = (nodeId: string): boolean => {
      return (edgesByFrom.get(normalizeId(nodeId)) ?? []).length === 0;
    };

    const pickTopTokenName = (
      fromId: string,
      lendingPosition: "collateral" | "borrow",
    ): string | null => {
      const outgoing = edgesByFrom.get(normalizeId(fromId)) ?? [];
      let best: GraphEdge | null = null;
      for (const e of outgoing) {
        if (e.lendingPosition !== lendingPosition) continue;
        if (!best || Math.abs(e.allocationUsd) > Math.abs(best.allocationUsd)) {
          best = e;
        }
      }

      const to = best?.to;
      if (!to) return null;
      return nodesById.get(normalizeId(to))?.name ?? null;
    };
    const canDetectTerminal = graphRootIds instanceof Set;

    const mappedChildren = children.map((c) => {
      const isLeafInSnapshot = isTerminalNodeId(c.id);
      const hasDownstreamGraph = canDetectTerminal
        ? graphRootIds.has(normalizeId(c.id))
        : true;

      const isTerminal = isLeafInSnapshot && !hasDownstreamGraph;

      const outgoingEdges = edgesByFrom.get(normalizeId(c.id)) ?? [];
      const directLeavesCount = outgoingEdges.length;

      // Map allocations for mini-treemap within the tile
      const localAllocations = outgoingEdges
        .map((e) => {
          const toNode = nodesById.get(normalizeId(e.to));
          return {
            id: e.to,
            name: toNode?.name ?? e.to,
            value: Math.abs(e.allocationUsd),
            node: toNode,
          };
        })
        .sort((a, b) => b.value - a.value);

      const fallbackKey = normalizeId(c.id);
      const allocations =
        allocationsByNodeId.get(fallbackKey) ?? localAllocations;

      const typeLabel = c.node ? getNodeTypeLabel(c.node.details) : "";
      const kind = (c.node?.details?.kind ?? "").toLowerCase();
      const subtype = (c.node?.details?.subtype ?? "").toLowerCase();
      const isVault =
        kind === "yield" || kind === "lending" || subtype.includes("vault");

      return {
        name: (() => {
          const node = c.node;
          if (!node) return c.id;

          if (node.details?.kind === "Lending") {
            const borrow = pickTopTokenName(node.id, "borrow");
            const collateral = pickTopTokenName(node.id, "collateral");

            if (collateral && borrow) return `${collateral}/${borrow}`;
            if (collateral) return collateral;
            if (borrow) return borrow;
          }

          return node.name;
        })(),
        value: c.value,
        originalValue: c.edge.allocationUsd,
        percent: c.percent,
        nodeId: c.id,
        fullNode: c.node,
        lendingPosition: c.edge.lendingPosition,
        isTerminal,
        typeLabel,
        isVault,
        directLeavesCount,
        allocations,
      };
    });

    if (isOthersView) return mappedChildren;

    // Others aggregation logic
    const OTHERS_AGGREGATION_MIN_TILE_AREA_PX = 2800; // ~53x53px
    const OTHERS_AGGREGATION_MIN_COUNT = 3;
    const OTHERS_AGGREGATION_MIN_MAJOR_COUNT = 6;

    const containerArea = containerSize.width * containerSize.height;
    const minPercentByArea =
      containerArea > 0
        ? OTHERS_AGGREGATION_MIN_TILE_AREA_PX / containerArea
        : 0.005;
    const MIN_PERCENT = Math.min(0.02, Math.max(0.001, minPercentByArea));

    const sorted = [...mappedChildren].sort((a, b) => b.value - a.value);

    let major = sorted.filter((c) => c.percent >= MIN_PERCENT);
    let minor = sorted.filter((c) => c.percent < MIN_PERCENT);

    if (
      major.length === 0 &&
      sorted.length > OTHERS_AGGREGATION_MIN_MAJOR_COUNT
    ) {
      major = sorted.slice(0, OTHERS_AGGREGATION_MIN_MAJOR_COUNT);
      const majorIds = new Set(major.map((c) => c.nodeId));
      minor = sorted.filter((c) => !majorIds.has(c.nodeId));
    }

    if (minor.length >= OTHERS_AGGREGATION_MIN_COUNT) {
      const minorTotalValue = minor.reduce((sum, c) => sum + c.value, 0);
      const minorTotalPercent = minor.reduce((sum, c) => sum + c.percent, 0);

      return [
        ...major,
        {
          name: "OTHERS",
          value: minorTotalValue,
          originalValue: minorTotalValue,
          percent: minorTotalPercent,
          nodeId: "others",
          isOthers: true,
          childIds: minor.map((c) => c.nodeId),
          childCount: minor.length,
          directLeavesCount: minor.length,
          allocations: minor.map((m) => ({
            id: m.nodeId,
            name: m.name,
            value: m.value,
            node: m.fullNode,
          })),
        },
      ];
    }

    return sorted;
  }, [
    data,
    rootNodeId,
    isOthersView,
    othersChildrenIds,
    containerSize,
    graphRootIds,
    graphIndex,
    allocationsByNodeId,
  ]);

  useEffect(() => {
    if (!data || !rootNodeId) return;

    const root = data.nodes.find((n) => n.id === rootNodeId);
    if (!root) return;

    let children = getDirectChildren(root, data.nodes, data.edges);
    if (isOthersView && othersChildrenIds) {
      const scope = new Set(
        othersChildrenIds.map((id) => id.trim().toLowerCase()),
      );
      children = children.filter((c) => scope.has(c.id.trim().toLowerCase()));
    }

    const missingIds = children
      .map((child) => normalizeId(child.id))
      .filter(
        (id) => !allocationsByNodeId.has(id) && !attemptedNestedNodeIds.has(id),
      );

    if (missingIds.length === 0) return;

    let cancelled = false;

    const load = async () => {
      const updates = new Map<
        string,
        { id: string; name: string; value: number; node?: GraphNode }[]
      >();
      const attempted = new Set<string>();

      await Promise.all(
        missingIds.slice(0, 50).map(async (id) => {
          attempted.add(id);
          try {
            const response = await fetch(
              `/api/graph/${encodeURIComponent(id)}`,
            );
            if (!response.ok) return;

            const payload = (await response.json()) as unknown;
            if (!isGraphSnapshot(payload)) return;

            const snapshot = payload;

            const nodesById = new Map(
              snapshot.nodes.map(
                (node) => [normalizeId(node.id), node] as const,
              ),
            );
            const allocations = snapshot.edges
              .filter((edge) => normalizeId(edge.from) === id)
              .map((edge) => {
                const node = nodesById.get(normalizeId(edge.to));
                return {
                  id: edge.to,
                  name: node?.name ?? edge.to,
                  value: Math.abs(edge.allocationUsd),
                  node,
                };
              })
              .filter(
                (entry) => Number.isFinite(entry.value) && entry.value > 0,
              )
              .sort((a, b) => b.value - a.value);

            if (allocations.length > 0) {
              updates.set(id, allocations);
            }
          } catch (error) {
            console.error(`Failed to fetch 2-hop data for node ${id}:`, error);
          }
        }),
      );

      if (cancelled) return;

      setAttemptedNestedNodeIds((prev) => {
        const next = new Set(prev);
        attempted.forEach((id) => next.add(id));
        return next;
      });

      if (updates.size === 0) return;

      setAllocationsByNodeId((prev) => {
        const next = new Map(prev);
        updates.forEach((allocations, id) => {
          next.set(id, allocations);
        });
        return next;
      });
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    allocationsByNodeId,
    attemptedNestedNodeIds,
    data,
    isOthersView,
    othersChildrenIds,
    rootNodeId,
  ]);

  if (!data || chartData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400 font-mono uppercase tracking-widest bg-[#E6EBF8]">
        No Data Channels
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-black relative overflow-hidden"
    >
      {isOthersView && (
        <div className="absolute top-10 right-10 z-20 pointer-events-none">
          <div className="px-5 py-2.5 bg-black border border-black text-[9px] font-black text-[#00FF85] uppercase tracking-[0.3em] shadow-xl">
            Aggregate View // Others ({chartData.length})
          </div>
        </div>
      )}
      <div
        key={`${rootNodeId ?? ""}|${isOthersView ? "others" : "main"}|${
          Array.isArray(othersChildrenIds) ? othersChildrenIds.length : 0
        }`}
        className="w-full h-full"
      >
        <AssetTreeMapKonva
          data={chartData}
          width={containerSize.width}
          height={containerSize.height}
          onSelect={onSelect}
          onSelectOthers={onSelectOthers}
          selectedNodeId={selectedNodeId}
          pressedNodeId={pressedNodeId}
          onPressStart={setPressedNodeId}
          onPressEnd={() => setPressedNodeId(null)}
          lastClick={lastClick ?? null}
          onHover={(
            datum: TreemapHoverCardDatum,
            point: { clientX: number; clientY: number },
          ) => {
            setHoverState({
              datum,
              clientX: point.clientX,
              clientY: point.clientY,
            });
          }}
          onHoverEnd={() => setHoverState(null)}
        />
      </div>

      {hoverState && portalEl
        ? createPortal(
            <div
              ref={tooltipRef}
              className="fixed z-50 pointer-events-none"
              style={(() => {
                const pad = 14;
                const offsetX = 18;
                const offsetY = 14;

                const w = tooltipSize?.w ?? 280;
                const h = tooltipSize?.h ?? 170;

                const viewportWidth =
                  typeof window === "undefined"
                    ? containerSize.width
                    : window.innerWidth;
                const viewportHeight =
                  typeof window === "undefined"
                    ? containerSize.height
                    : window.innerHeight;

                const maxX = Math.max(pad, viewportWidth - pad - w);
                const maxY = Math.max(pad, viewportHeight - pad - h);

                const left = Math.max(
                  pad,
                  Math.min(maxX, hoverState.clientX + offsetX),
                );
                const top = Math.max(
                  pad,
                  Math.min(maxY, hoverState.clientY + offsetY),
                );

                return {
                  left,
                  top,
                  willChange: "transform",
                  transform: "translate3d(0, 0, 0)",
                } as React.CSSProperties;
              })()}
            >
              <TreemapHoverCard
                dataItem={hoverState.datum}
                downstream={downstream}
              />
            </div>,
            portalEl,
          )
        : null}
    </div>
  );
}
