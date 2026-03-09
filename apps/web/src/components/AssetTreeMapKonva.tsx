"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  Stage,
  Layer,
  Rect,
  Text,
  Group,
  Image as KonvaImage,
} from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { SceneContext } from "konva/lib/Context";
import * as d3 from "d3-hierarchy";
import useImage from "use-image";
import { GraphNode } from "@/types";
import { currencyFormatter } from "@/utils/formatters";
import { getNodeLogos } from "@/lib/logos";

interface AllocationItem {
  id: string;
  name: string;
  value: number;
}

interface TreemapTileDatum {
  name: string;
  value: number;
  originalValue: number;
  percent: number;
  nodeId: string;
  fullNode?: GraphNode;
  lendingPosition?: "collateral" | "borrow";
  isTerminal?: boolean;
  typeLabel?: string;
  isVault?: boolean;
  directLeavesCount?: number;
  allocations?: AllocationItem[];
  isOthers?: boolean;
  childIds?: string[];
  childCount?: number;
}

interface AssetTreeMapKonvaProps {
  data: TreemapTileDatum[];
  width: number;
  height: number;
  onSelect: (
    node: GraphNode,
    meta?: { lendingPosition?: "collateral" | "borrow" },
  ) => void;
  onSelectOthers?: (childIds: string[]) => void;
  selectedNodeId?: string | null;
  pressedNodeId: string | null;
  onPressStart: (nodeId: string) => void;
  onPressEnd: () => void;
  lastClick: { nodeId: string; seq: number } | null;
  onHover: (
    datum: TreemapTileDatum,
    point: { clientX: number; clientY: number },
  ) => void;
  onHoverEnd: () => void;
}

const TILE_STYLE = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 11,
  colors: {
    othersFill: "#EAE5D9",
    terminalFill: "#FFF1F2",
    defaultFill: "#E6EBF8",
    defaultText: "#000000",
    terminalText: "#9F1239",
    terminalStroke: "rgba(225, 29, 72, 0.5)",
    selectionFill: "rgba(0, 0, 0, 0.08)",
    innerBorder: "#000000",
    innerFill: "#E6EBF8",
    innerText: "rgba(0,0,0,0.6)",
  },
  header: {
    min: 16,
    max: 26,
    ratio: 0.2,
    fallback: 20,
  },
  logo: {
    size: 16,
    step: 12,
    gutter: 12,
    maxCount: 3,
    minWidth: 60,
    minHeight: 50,
  },
  padding: {
    tileInset: 1,
    textX: 8,
    inner: 6,
    innerTextInset: 24,
  },
  thresholds: {
    labelWidth: 40,
    labelHeight: 20,
    minTextWidth: 28,
    innerWidth: 80,
    innerHeight: 80,
  },
  terminalDash: [4, 3],
};

const SR_ONLY_STYLE: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  border: 0,
  whiteSpace: "nowrap",
};

const getTileLabel = (data: TreemapTileDatum) => {
  const isOthers = data.isOthers;
  if (isOthers) {
    return `+${data.childCount || 0} others ${currencyFormatter.format(data.originalValue)}`;
  }
  return `${data.name} ${currencyFormatter.format(data.originalValue)}`;
};

const getInsetBounds = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  inset = TILE_STYLE.padding.tileInset,
) => {
  const startX = Math.round(x0);
  const startY = Math.round(y0);
  const endX = Math.round(x1);
  const endY = Math.round(y1);

  return {
    x: startX + inset,
    y: startY + inset,
    width: Math.max(0, endX - startX - inset),
    height: Math.max(0, endY - startY - inset),
  };
};

const AssetLogo = React.memo(
  ({
    url,
    x,
    y,
    size,
  }: {
    url: string;
    x: number;
    y: number;
    size: number;
  }) => {
    const [image] = useImage(url);
    if (!image) return null;
    return <KonvaImage image={image} x={x} y={y} width={size} height={size} />;
  },
);

AssetLogo.displayName = "AssetLogo";

const TreemapTileKonva = React.memo(
  ({
    node,
    onSelect,
    onSelectOthers,
    selectedNodeId,
    pressedNodeId,
    onPressStart,
    onPressEnd,
    lastClick,
    onHover,
    onHoverEnd,
  }: {
    node: d3.HierarchyRectangularNode<TreemapTileDatum>;
    onSelect: (
      node: GraphNode,
      meta?: { lendingPosition?: "collateral" | "borrow" },
    ) => void;
    onSelectOthers?: (childIds: string[]) => void;
    selectedNodeId?: string | null;
    pressedNodeId: string | null;
    onPressStart: (nodeId: string) => void;
    onPressEnd: () => void;
    lastClick: { nodeId: string; seq: number } | null;
    onHover: (
      datum: TreemapTileDatum,
      point: { clientX: number; clientY: number },
    ) => void;
    onHoverEnd: () => void;
  }) => {
    const { x0, y0, x1, y1, data } = node;
    const tileBounds = getInsetBounds(x0, y0, x1, y1);
    const x = tileBounds.x;
    const y = tileBounds.y;
    const width = tileBounds.width;
    const height = tileBounds.height;

    const nodeId = data.nodeId;
    const isSelected =
      selectedNodeId === nodeId || lastClick?.nodeId === nodeId;
    const isPressed = pressedNodeId === nodeId;
    const isOthers = data.isOthers;
    const isVault = !!data.isVault;
    const isTerminal = !isOthers && !!data.isTerminal;
    const hasAllocations = !!data.allocations && data.allocations.length > 0;

    const fill = isOthers
      ? TILE_STYLE.colors.othersFill
      : isTerminal
        ? TILE_STYLE.colors.terminalFill
        : TILE_STYLE.colors.defaultFill;

    const textColor = isTerminal
      ? TILE_STYLE.colors.terminalText
      : TILE_STYLE.colors.defaultText;

    const headerHeight =
      isOthers || hasAllocations || isVault
        ? Math.min(
            TILE_STYLE.header.max,
            Math.max(
              TILE_STYLE.header.min,
              Math.floor(height * TILE_STYLE.header.ratio),
            ),
          )
        : 0;

    const logoPaths = data.fullNode ? getNodeLogos(data.fullNode) : [];
    const logoCount = Math.min(logoPaths.length, TILE_STYLE.logo.maxCount);
    const label = getTileLabel(data);
    const fontSize = TILE_STYLE.fontSize;

    const textX =
      logoCount > 0 && width > TILE_STYLE.logo.minWidth
        ? TILE_STYLE.padding.textX +
          logoCount * TILE_STYLE.logo.step +
          TILE_STYLE.logo.gutter
        : TILE_STYLE.padding.textX;

    const handleClick = useCallback(() => {
      if (isOthers && onSelectOthers && data.childIds) {
        onSelectOthers(data.childIds);
      } else if (data.fullNode) {
        onSelect(data.fullNode, { lendingPosition: data.lendingPosition });
      }
    }, [isOthers, onSelectOthers, data, onSelect]);

    const handlePointerMove = useCallback(
      (e: KonvaEventObject<MouseEvent>) => {
        onHover(data, { clientX: e.evt.clientX, clientY: e.evt.clientY });
      },
      [data, onHover],
    );

    // Nested Treemap Calculation
    const innerMargin = TILE_STYLE.padding.inner;
    const availW = Math.max(0, width - innerMargin * 2);
    const availH = Math.max(0, height - headerHeight - innerMargin * 2);

    const nestedLayout = useMemo(() => {
      const allocations = data.allocations || [];
      if (allocations.length === 0 || availW < 40 || availH < 30) return null;

      const items = allocations.slice(0, 12);
      const hierarchy = d3
        .hierarchy<{ children: AllocationItem[] } | AllocationItem>({
          children: items,
        })
        .sum((d) => ("value" in d ? d.value : 0))
        .sort((a, b) => (b.value || 0) - (a.value || 0));

      const treemap = d3
        .treemap<{ children: AllocationItem[] } | AllocationItem>()
        .size([availW, availH])
        .padding(0)
        .round(true);

      const root = treemap(hierarchy);
      return {
        children: root.children || [],
        othersCount: Math.max(0, allocations.length - 12),
      };
    }, [data.allocations, availW, availH]);

    return (
      <Group
        x={x}
        y={y}
        onClick={handleClick}
        onTap={handleClick}
        onMouseDown={() => !isTerminal && onPressStart(nodeId)}
        onMouseUp={onPressEnd}
        onMouseEnter={handlePointerMove}
        onMouseMove={handlePointerMove}
        onMouseLeave={onHoverEnd}
      >
        <Rect
          width={width}
          height={height}
          fill={fill}
          opacity={isPressed || isSelected ? 0.8 : 1}
        />
        {isSelected && (
          <Rect
            width={width}
            height={height}
            fill={TILE_STYLE.colors.selectionFill}
            listening={false}
          />
        )}

        {width > TILE_STYLE.thresholds.labelWidth &&
          height > TILE_STYLE.thresholds.labelHeight && (
            <Group
              clipFunc={(ctx: SceneContext) => {
                ctx.rect(
                  0,
                  0,
                  width,
                  headerHeight || TILE_STYLE.header.fallback,
                );
              }}
            >
              {logoPaths.slice(0, TILE_STYLE.logo.maxCount).map((path, idx) => (
                <AssetLogo
                  key={path}
                  url={path}
                  x={TILE_STYLE.padding.textX + idx * TILE_STYLE.logo.step}
                  y={
                    (headerHeight || TILE_STYLE.header.fallback) / 2 -
                    TILE_STYLE.logo.size / 2
                  }
                  size={TILE_STYLE.logo.size}
                />
              ))}
              <Text
                text={label}
                x={textX}
                y={
                  (headerHeight || TILE_STYLE.header.fallback) / 2 -
                  fontSize / 2
                }
                width={Math.max(0, width - textX - 4)}
                ellipsis
                wrap="none"
                fontSize={fontSize}
                fontFamily={TILE_STYLE.fontFamily}
                fill={textColor}
                fontStyle="bold"
                listening={false}
              />
            </Group>
          )}

        {nestedLayout && (
          <Group x={innerMargin} y={headerHeight + innerMargin}>
            <Rect
              width={availW}
              height={availH}
              fill={TILE_STYLE.colors.innerBorder}
              listening={false}
            />

            {nestedLayout.children.map((n, idx: number) => {
              const bounds = getInsetBounds(n.x0, n.y0, n.x1, n.y1);
              const nw = bounds.width;
              const nh = bounds.height;
              const nestedData = n.data as AllocationItem;

              return (
                <Group key={idx} x={bounds.x} y={bounds.y}>
                  <Rect
                    width={nw}
                    height={nh}
                    fill={TILE_STYLE.colors.defaultFill}
                    listening={false}
                  />
                  {nw > 35 && nh > 12 && (
                    <Text
                      text={nestedData.name.toUpperCase()}
                      x={2}
                      y={2}
                      width={nw - 6}
                      fontSize={10.5}
                      fontFamily={TILE_STYLE.fontFamily}
                      fill={TILE_STYLE.colors.innerText}
                      wrap="none"
                      ellipsis
                      listening={false}
                    />
                  )}
                </Group>
              );
            })}

            {availW > 0 && (
              <Rect
                x={availW - 1}
                y={0}
                width={1}
                height={availH}
                fill={TILE_STYLE.colors.innerBorder}
                listening={false}
              />
            )}

            {availH > 0 && (
              <Rect
                x={0}
                y={availH - 1}
                width={availW}
                height={1}
                fill={TILE_STYLE.colors.innerBorder}
                listening={false}
              />
            )}

            {nestedLayout.othersCount > 0 && availW > 60 && availH > 40 && (
              <Text
                text={`+${nestedLayout.othersCount} OTHERS`}
                x={availW - 55}
                y={availH - 10}
                width={50}
                fontSize={6}
                fontFamily={TILE_STYLE.fontFamily}
                fill={TILE_STYLE.colors.innerText}
                fontStyle="bold"
                align="right"
                listening={false}
              />
            )}
          </Group>
        )}

        {isTerminal && (
          <Rect
            width={width}
            height={height}
            stroke={TILE_STYLE.colors.terminalStroke}
            strokeWidth={1}
            dash={TILE_STYLE.terminalDash}
            listening={false}
          />
        )}
      </Group>
    );
  },
);

TreemapTileKonva.displayName = "TreemapTileKonva";

export function AssetTreeMapKonva({
  data,
  width,
  height,
  onSelect,
  onSelectOthers,
  selectedNodeId,
  pressedNodeId,
  onPressStart,
  onPressEnd,
  lastClick,
  onHover,
  onHoverEnd,
}: AssetTreeMapKonvaProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const root = useMemo(() => {
    const rootData: TreemapTileDatum & { children: TreemapTileDatum[] } = {
      name: "root",
      value: 0,
      originalValue: 0,
      percent: 0,
      nodeId: "root",
      children: data,
    };
    const hierarchy = d3
      .hierarchy<TreemapTileDatum>(rootData)
      .sum((d) => d.value)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    return d3
      .treemap<TreemapTileDatum>()
      .size([width - 1, height - 1])
      .padding(0)
      .round(false)(hierarchy);
  }, [data, width, height]);

  const [dpr, setDpr] = useState(1);
  const [stageOffset, setStageOffset] = useState({ x: 0, y: 0 });
  useEffect(() => {
    setDpr(window.devicePixelRatio || 1);
  }, []);

  useEffect(() => {
    const measureOffset = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      setStageOffset({
        x: Math.round(rect.left) - rect.left,
        y: Math.round(rect.top) - rect.top,
      });
    };

    measureOffset();

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => measureOffset());

    if (containerRef.current && resizeObserver) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener("resize", measureOffset);
    window.addEventListener("scroll", measureOffset, true);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measureOffset);
      window.removeEventListener("scroll", measureOffset, true);
    };
  }, []);

  const tiles = useMemo(() => {
    return root.children?.map((node, i) => (
      <TreemapTileKonva
        key={(node.data as TreemapTileDatum).nodeId || i}
        node={node as d3.HierarchyRectangularNode<TreemapTileDatum>}
        onSelect={onSelect}
        onSelectOthers={onSelectOthers}
        selectedNodeId={selectedNodeId}
        pressedNodeId={pressedNodeId}
        onPressStart={onPressStart}
        onPressEnd={onPressEnd}
        lastClick={lastClick}
        onHover={onHover}
        onHoverEnd={onHoverEnd}
      />
    ));
  }, [
    root,
    onSelect,
    onSelectOthers,
    selectedNodeId,
    pressedNodeId,
    onPressStart,
    onPressEnd,
    lastClick,
    onHover,
    onHoverEnd,
  ]);

  const handleTileAction = useCallback(
    (datum: TreemapTileDatum) => {
      if (datum.isOthers && onSelectOthers && datum.childIds) {
        onSelectOthers(datum.childIds);
      } else if (datum.fullNode) {
        onSelect(datum.fullNode, { lendingPosition: datum.lendingPosition });
      }
    },
    [onSelect, onSelectOthers],
  );

  if (width <= 0 || height <= 0) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width,
        height,
        transform: `translate(${stageOffset.x}px, ${stageOffset.y}px)`,
      }}
    >
      <Stage
        width={width}
        height={height}
        pixelRatio={dpr}
        style={{ backgroundColor: "black" }}
      >
        <Layer>
          <Rect width={width} height={height} fill="black" />
          {tiles}
        </Layer>
      </Stage>
      <div style={SR_ONLY_STYLE}>
        {root.children?.map((node, index) => {
          const datum = node.data;
          return (
            <button
              key={datum.nodeId || index}
              type="button"
              onClick={() => handleTileAction(datum)}
            >
              {getTileLabel(datum)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
