"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import {
  GraphSnapshot,
  GraphNode,
  GraphEdge,
  GraphAllocationPreview,
} from "@/types";
import { getDirectChildren } from "@/lib/graph";
import { getNodeTypeLabel } from "@/lib/nodeType";
import {
  TreemapHoverCard,
  type TreemapHoverCardDatum,
} from "@/components/TreemapHoverCard";
import dynamic from "next/dynamic";
import { normalizeId } from "@/utils/formatters";
import { getAllocationRelationshipBadge } from "@/lib/rootRelationship";

const AssetTreeMapKonva = dynamic(
  () => import("./AssetTreeMapKonva").then((m) => m.AssetTreeMapKonva),
  {
    ssr: false,
  },
);

const getMorphoCollateralLabel = (
  marketName: string,
  rootUnderlyingSymbol: string,
): string => {
  const parts = marketName
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) return marketName;
  if (!rootUnderlyingSymbol) return parts[parts.length - 1] ?? marketName;

  const normalizedUnderlying = rootUnderlyingSymbol.toLowerCase();
  const nonDebtParts = parts.filter(
    (part) => part.toLowerCase() !== normalizedUnderlying,
  );

  return (
    nonDebtParts[nonDebtParts.length - 1] ??
    parts[parts.length - 1] ??
    marketName
  );
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
    if (!data || !rootNodeId || !graphIndex) return [];

    const root = data.nodes.find((n) => n.id === rootNodeId);
    if (!root) return [];

    const isMorphoRoot = (root.protocol ?? "")
      .trim()
      .toLowerCase()
      .startsWith("morpho");
    const rootUnderlyingSymbol =
      typeof root.details?.underlyingSymbol === "string"
        ? root.details.underlyingSymbol.trim()
        : "";
    let children = getDirectChildren(root, data.nodes, data.edges);

    if (isOthersView && othersChildrenIds) {
      const scope = new Set(
        othersChildrenIds.map((id) => id.trim().toLowerCase()),
      );
      children = children.filter((c) => scope.has(c.id.trim().toLowerCase()));
    }

    const { nodesById, edgesByFrom } = graphIndex;

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

    const isLendingNode = (node: GraphNode | undefined): boolean => {
      const kind = (node?.details?.kind ?? "").trim().toLowerCase();
      return kind.startsWith("lending");
    };

    const nestedAllocationsByNodeId = new Map<string, GraphAllocationPreview[]>(
      Object.entries(data.nestedAllocations ?? {}).map(
        ([nodeId, allocations]) => [normalizeId(nodeId), allocations],
      ),
    );

    const mappedChildren = children.map((c) => {
      const isLeafInSnapshot = isTerminalNodeId(c.id);
      const hasDownstreamGraph = canDetectTerminal
        ? graphRootIds.has(normalizeId(c.id))
        : true;

      const isTerminal = isLeafInSnapshot && !hasDownstreamGraph;

      const normalizedChildId = normalizeId(c.id);
      const outgoingEdges = edgesByFrom.get(normalizedChildId) ?? [];
      const directLeavesCount = outgoingEdges.length;
      const node = c.node;
      const lendingPair =
        node && isLendingNode(node)
          ? (() => {
              const borrow = pickTopTokenName(node.id, "borrow");
              const collateral = pickTopTokenName(node.id, "collateral");

              if (!borrow && !collateral) return null;

              return {
                borrow,
                collateral,
              };
            })()
          : null;
      const allocations =
        nestedAllocationsByNodeId.get(normalizedChildId) ??
        outgoingEdges
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

      const typeLabel = c.node ? getNodeTypeLabel(c.node.details) : "";
      const kind = (c.node?.details?.kind ?? "").toLowerCase();
      const subtype = (c.node?.details?.subtype ?? "").toLowerCase();
      const isVault =
        kind === "yield" || kind === "lending" || subtype.includes("vault");
      const isMorphoLendingMarket = isMorphoRoot && isLendingNode(node);

      return {
        name: (() => {
          if (!node) return c.id;

          if (lendingPair) {
            const { collateral, borrow } = lendingPair;
            if (isMorphoLendingMarket && collateral) return collateral;
            if (collateral && borrow) return `${collateral}/${borrow}`;
            if (collateral) return collateral;
            if (borrow) return borrow;
          }

          if (isMorphoLendingMarket) {
            return getMorphoCollateralLabel(node.name, rootUnderlyingSymbol);
          }

          return node.name;
        })(),
        logoNode: isMorphoLendingMarket
          ? {
              name: (() => {
                if (lendingPair?.collateral) return lendingPair.collateral;
                if (node) {
                  return getMorphoCollateralLabel(
                    node.name,
                    rootUnderlyingSymbol,
                  );
                }
                return c.id;
              })(),
              logoKeys: lendingPair?.collateral
                ? [lendingPair.collateral]
                : undefined,
            }
          : undefined,
        lendingPair: lendingPair ?? undefined,
        secondaryLabel: getAllocationRelationshipBadge(root, node),
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
  ]);

  if (!data || chartData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-[#E6EBF8] font-mono text-gray-500 tracking-[0.06em]">
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
          <div className="px-5 py-2.5 bg-black border border-black text-[9px] font-semibold text-[#00FF85] tracking-[0.08em] shadow-xl">
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
