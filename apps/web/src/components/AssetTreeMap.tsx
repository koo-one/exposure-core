"use client";

import React, { useMemo, useState } from "react";
import { ResponsiveContainer, Treemap, Tooltip } from "recharts";
import { GraphSnapshot, GraphNode, GraphEdge } from "@/types";
import { getDirectChildren } from "@/lib/graph";
import { TreemapHoverCard } from "@/components/TreemapHoverCard";
import { AssetTreeMapTile } from "@/components/AssetTreeMapTile";

interface AssetTreeMapProps {
  data: GraphSnapshot | null;
  rootNodeId?: string;
  onSelect: (
    node: GraphNode,
    meta?: {
      lendingPosition?: "collateral" | "borrow";
    },
  ) => void | Promise<void>;
  selectedNodeId?: string | null;
  lastClick?: { nodeId: string; seq: number } | null;
}

export default function AssetTreeMap({
  data,
  rootNodeId,
  onSelect,
  selectedNodeId,
  lastClick,
}: AssetTreeMapProps) {
  const [pressedNodeId, setPressedNodeId] = useState<string | null>(null);

  const chartData = useMemo(() => {
    if (!data || !rootNodeId) return [];

    const root = data.nodes.find((n) => n.id === rootNodeId);
    if (!root) return [];

    const children = getDirectChildren(root, data.nodes, data.edges);

    const nodesById = new Map(data.nodes.map((n) => [n.id, n] as const));
    const edgesByFrom = new Map<string, GraphEdge[]>();
    for (const edge of data.edges) {
      const list = edgesByFrom.get(edge.from);
      if (list) list.push(edge);
      else edgesByFrom.set(edge.from, [edge]);
    }

    const pickTopTokenName = (
      fromId: string,
      lendingPosition: "collateral" | "borrow",
    ): string | null => {
      const outgoing = edgesByFrom.get(fromId) ?? [];
      let best: GraphEdge | null = null;
      for (const e of outgoing) {
        if (e.lendingPosition !== lendingPosition) continue;
        if (!best || Math.abs(e.allocationUsd) > Math.abs(best.allocationUsd)) {
          best = e;
        }
      }

      const to = best?.to;
      if (!to) return null;
      return nodesById.get(to)?.name ?? null;
    };

    return children.map((c) => ({
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
    }));
  }, [data, rootNodeId]);

  if (!data || chartData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400 font-mono uppercase tracking-widest bg-[#E6EBF8]">
        No Data Channels
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-[#E6EBF8]">
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={chartData}
          dataKey="value"
          aspectRatio={16 / 9}
          stroke="transparent"
          content={
            <AssetTreeMapTile
              onSelect={onSelect}
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
