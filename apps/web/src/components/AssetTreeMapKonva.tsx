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
    selectionFill: "rgba(0, 0, 0, 0.08)",
    innerBorder: "#000000",
    innerText: "rgba(0,0,0,0.6)",
  },
  header: {
    min: 16,
    max: 26,
    ratio: 0.2,
    fallback: 20,
  },
  nested: {
    minLayoutWidth: 40,
    minLayoutHeight: 30,
    maxItems: 12,
    othersLabelMinWidth: 60,
    othersLabelMinHeight: 40,
    othersLabelWidth: 50,
    othersLabelOffsetX: 55,
    othersLabelOffsetY: 10,
    labelMinWidth: 35,
    labelMinHeight: 12,
    labelInset: 2,
    labelWidthOffset: 6,
    labelFontSize: 10.5,
  },
  logo: {
    size: 16,
    step: 12,
    gutter: 12,
    maxCount: 3,
    minWidth: 60,
  },
  padding: {
    textX: 8,
    inner: 6,
  },
  thresholds: {
    labelWidth: 40,
    labelHeight: 20,
    othersLabelWidth: 90,
    othersLabelHeight: 56,
  },
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

const getPackedTileBounds = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) => {
  const startX = Math.round(x0);
  const startY = Math.round(y0);
  const endX = Math.round(x1);
  const endY = Math.round(y1);

  return {
    x: startX,
    y: startY,
    width: Math.max(0, endX - startX - 1),
    height: Math.max(0, endY - startY - 1),
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
    const tileBounds = getPackedTileBounds(x0, y0, x1, y1);
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
      if (
        allocations.length === 0 ||
        availW < TILE_STYLE.nested.minLayoutWidth ||
        availH < TILE_STYLE.nested.minLayoutHeight
      ) {
        return null;
      }

      const items = allocations.slice(0, TILE_STYLE.nested.maxItems);
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
        othersCount: Math.max(
          0,
          allocations.length - TILE_STYLE.nested.maxItems,
        ),
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

        {isOthers &&
          data.childCount &&
          width > TILE_STYLE.thresholds.othersLabelWidth &&
          height > TILE_STYLE.thresholds.othersLabelHeight && (
            <Text
              text={`+${data.childCount} OTHERS`}
              x={TILE_STYLE.padding.textX}
              y={headerHeight + 6}
              width={Math.max(0, width - TILE_STYLE.padding.textX * 2)}
              fontSize={12}
              fontFamily={TILE_STYLE.fontFamily}
              fill={TILE_STYLE.colors.defaultText}
              fontStyle="bold"
              wrap="none"
              ellipsis
              listening={false}
            />
          )}

        {nestedLayout && (
          <Group x={innerMargin} y={headerHeight + innerMargin}>
            <Rect
              width={availW}
              height={availH}
              fill={TILE_STYLE.colors.innerBorder}
              listening={false}
            />

            {nestedLayout.children.map((n) => {
              const bounds = getPackedTileBounds(n.x0, n.y0, n.x1, n.y1);
              const nw = bounds.width;
              const nh = bounds.height;
              const nestedData = n.data as AllocationItem;

              return (
                <Group key={nestedData.id} x={bounds.x} y={bounds.y}>
                  <Rect
                    width={nw}
                    height={nh}
                    fill={TILE_STYLE.colors.defaultFill}
                    listening={false}
                  />
                  {nw > TILE_STYLE.nested.labelMinWidth &&
                    nh > TILE_STYLE.nested.labelMinHeight && (
                      <Text
                        text={nestedData.name.toUpperCase()}
                        x={TILE_STYLE.nested.labelInset}
                        y={TILE_STYLE.nested.labelInset}
                        width={nw - TILE_STYLE.nested.labelWidthOffset}
                        fontSize={TILE_STYLE.nested.labelFontSize}
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
                x={0}
                y={0}
                width={availW}
                height={1}
                fill={TILE_STYLE.colors.innerBorder}
                listening={false}
              />
            )}

            {availH > 0 && (
              <Rect
                x={0}
                y={0}
                width={1}
                height={availH}
                fill={TILE_STYLE.colors.innerBorder}
                listening={false}
              />
            )}

            {nestedLayout.othersCount > 0 &&
              availW > TILE_STYLE.nested.othersLabelMinWidth &&
              availH > TILE_STYLE.nested.othersLabelMinHeight && (
                <Text
                  text={`+${nestedLayout.othersCount} OTHERS`}
                  x={availW - TILE_STYLE.nested.othersLabelOffsetX}
                  y={availH - TILE_STYLE.nested.othersLabelOffsetY}
                  width={TILE_STYLE.nested.othersLabelWidth}
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
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const stageWidth = Math.max(0, Math.floor(width));
  const stageHeight = Math.max(0, Math.floor(height));

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
      .size([stageWidth, stageHeight])
      .padding(0)
      .round(true)(hierarchy);
  }, [data, stageWidth, stageHeight]);

  const [dpr, setDpr] = useState(1);
  const [stageOffset, setStageOffset] = useState({ x: 0, y: 0 });
  useEffect(() => {
    setDpr(window.devicePixelRatio || 1);
  }, []);

  useEffect(() => {
    const measureOffset = () => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;

      const nextOffset = {
        x: Math.round(rect.left) - rect.left,
        y: Math.round(rect.top) - rect.top,
      };

      setStageOffset((prev) =>
        prev.x === nextOffset.x && prev.y === nextOffset.y ? prev : nextOffset,
      );
    };

    measureOffset();

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => measureOffset());

    if (wrapperRef.current && resizeObserver) {
      resizeObserver.observe(wrapperRef.current);
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

  if (stageWidth <= 0 || stageHeight <= 0) return null;

  return (
    <div
      ref={wrapperRef}
      style={{
        position: "relative",
        width: stageWidth,
        height: stageHeight,
      }}
    >
      <div
        style={{
          position: "relative",
          width: stageWidth,
          height: stageHeight,
          transform: `translate(${stageOffset.x}px, ${stageOffset.y}px)`,
        }}
      >
        <Stage width={stageWidth} height={stageHeight} pixelRatio={dpr}>
          <Layer>
            <Rect width={stageWidth} height={stageHeight} fill="black" />
            {tiles}
            {stageWidth > 0 && (
              <Rect
                width={stageWidth}
                height={1}
                fill="black"
                listening={false}
              />
            )}
            {stageHeight > 0 && (
              <Rect
                width={1}
                height={stageHeight}
                fill="black"
                listening={false}
              />
            )}
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
    </div>
  );
}
