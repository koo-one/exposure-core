"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ResponsiveContainer, Treemap, Tooltip } from "recharts";
import { GraphSnapshot, GraphNode, GraphEdge } from "@/types";
import { getDirectChildren } from "@/lib/graph";
import { TreemapHoverCard } from "@/components/TreemapHoverCard";
import { AssetTreeMapTile } from "@/components/AssetTreeMapTile";

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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setContainerSize({
        width: Math.max(0, Math.floor(rect.width)),
        height: Math.max(0, Math.floor(rect.height)),
      });
    };

    update();

    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

    const normalizeId = (id: string): string => id.trim().toLowerCase();

    const nodesById = new Map(
      data.nodes.map((n) => [normalizeId(n.id), n] as const),
    );
    const edgesByFrom = new Map<string, GraphEdge[]>();
    for (const edge of data.edges) {
      const fromId = normalizeId(edge.from);
      const list = edgesByFrom.get(fromId);
      if (list) list.push(edge);
      else edgesByFrom.set(fromId, [edge]);
    }

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
        value: Math.abs(c.value),
        originalValue: c.edge.allocationUsd,
        percent: c.percent,
        nodeId: c.id,
        fullNode: c.node,
        lendingPosition: c.edge.lendingPosition,
        isTerminal,
      };
    });

    if (isOthersView) return mappedChildren;

    // Others aggregation logic
    // Goal: group physically small tiles.
    // We approximate physical size via area: tile area ~= percent * containerArea.
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

    // If everything is tiny, keep a few largest tiles visible (avoid a full-screen "OTHERS" tile).
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
  ]);

  if (!data || chartData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400 font-mono uppercase tracking-widest bg-[#E6EBF8]">
        No Data Channels
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full bg-[#E6EBF8] relative">
      {isOthersView && (
        <div className="absolute top-10 right-10 z-20 pointer-events-none">
          <div className="px-5 py-2.5 bg-black border border-black text-[9px] font-black text-[#00FF85] uppercase tracking-[0.3em] shadow-xl">
            Aggregate View // Others ({chartData.length})
          </div>
        </div>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={chartData}
          dataKey="value"
          aspectRatio={16 / 9}
          stroke="transparent"
          content={
            <AssetTreeMapTile
              onSelect={onSelect}
              onSelectOthers={onSelectOthers}
              selectedNodeId={selectedNodeId}
              pressedNodeId={pressedNodeId}
              onPressStart={setPressedNodeId}
              onPressEnd={() => setPressedNodeId(null)}
              lastClick={lastClick ?? null}
            />
          }
          isAnimationActive={false}
        >
          <Tooltip content={<TreemapHoverCard />} cursor={false} />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
