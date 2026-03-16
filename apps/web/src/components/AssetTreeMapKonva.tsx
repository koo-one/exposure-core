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
  logoNode?: {
    name: string;
    protocol?: string | null;
    logoKeys?: string[];
  };
  lendingPosition?: "collateral" | "borrow";
  lendingPair?: {
    collateral?: string | null;
    borrow?: string | null;
    borrowAmount?: number | null;
  };
  secondaryLabel?: string | null;
  isTerminal?: boolean;
  typeLabel?: string;
  isVault?: boolean;
  directLeavesCount?: number;
  allocations?: AllocationItem[];
  isOthers?: boolean;
  childIds?: string[];
  childCount?: number;
}

interface TileActionHandlers {
  onSelect: (
    node: GraphNode,
    meta?: { lendingPosition?: "collateral" | "borrow" },
  ) => void;
  onSelectOthers?: (childIds: string[]) => void;
}

interface TileHeaderLayout {
  height: number;
  visibility: {
    logo: boolean;
    value: boolean;
    secondary: boolean;
  };
  logo: {
    x: number;
    y: number;
    size: number;
  };
  label: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  value: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  secondary: {
    x: number;
    y: number;
    width: number;
  };
}

interface NestedLayout {
  children: d3.HierarchyRectangularNode<
    { children: AllocationItem[] } | AllocationItem
  >[];
  othersCount: number;
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
  letterSpacing: -0.3,
  colors: {
    othersFill: "#EAE5D9",
    terminalFill: "#FFF1F2",
    defaultFill: "#E6EBF8",
    hoverFill: "#4AD280",
    hoverText: "#FFFFFF",
    defaultText: "#000000",
    terminalText: "#9F1239",
    selectionFill: "rgba(0, 0, 0, 0.08)",
    innerBorder: "#000000",
    innerText: "rgba(0,0,0,0.6)",
    badgeBackground: "rgba(74,210,128,0.16)",
    badgeBackgroundHover: "rgba(255,255,255,0.26)",
    badgeTextHover: "rgba(255,255,255,0.88)",
  },
  textMeasure: {
    labelCharWidth: 6.6,
    valueCharWidth: 7,
  },
  header: {
    min: 18,
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
    labelFontSize: 9,
    labelLetterSpacing: -0.2,
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
    textY: 6,
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

const getTileNameText = (data: TreemapTileDatum) => {
  const isOthers = data.isOthers;
  const name = (data.name || "").toUpperCase();
  if (isOthers) {
    return `+${data.childCount || 0} OTHERS`;
  }
  return name;
};

const getTileValueText = (data: TreemapTileDatum) => {
  return currencyFormatter.format(data.originalValue);
};

const getTileAccessibleLabel = (data: TreemapTileDatum) => {
  return `${getTileNameText(data)} ${getTileValueText(data)}`;
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

const runTileAction = (
  datum: TreemapTileDatum,
  { onSelect, onSelectOthers }: TileActionHandlers,
) => {
  if (datum.isOthers && onSelectOthers && datum.childIds) {
    onSelectOthers(datum.childIds);
  } else if (datum.fullNode) {
    onSelect(datum.fullNode, { lendingPosition: datum.lendingPosition });
  }
};

const computeTileHeaderLayout = ({
  width,
  height,
  logoCount,
  label,
  valueLabel,
  secondaryLabel,
  headerHeight,
}: {
  width: number;
  height: number;
  logoCount: number;
  label: string;
  valueLabel: string;
  secondaryLabel: string;
  headerHeight: number;
}): TileHeaderLayout => {
  const {
    thresholds,
    logo,
    fontSize,
    padding,
    header: headerStyle,
  } = TILE_STYLE;
  const paddingX = padding.textX;

  const canShowSecondary =
    !!secondaryLabel &&
    width > thresholds.othersLabelWidth &&
    height > thresholds.othersLabelHeight;
  const canShowValue = width > 120;

  const logoSize = logo.size;
  const rowHeight = logoCount > 0 && width > 92 ? logoSize : fontSize + 2;
  const badgeHeight = 10;
  const badgeGap = 1;
  const contentStackHeight =
    rowHeight + (canShowSecondary ? badgeGap + badgeHeight : 0);

  const logoGap = 6;
  const valueGap = 6;
  const totalContentWidth = Math.max(0, width - paddingX * 2);

  const stackTop = padding.textY;
  const finalHeaderHeight = Math.max(
    headerHeight,
    stackTop + contentStackHeight,
    headerStyle.fallback,
  );

  const canShowLogo = logoCount > 0 && width > 92 && finalHeaderHeight >= 16;
  const logoAreaWidth = canShowLogo ? logoSize + logoGap : 0;
  const valueAreaWidth = canShowValue
    ? Math.min(60, valueLabel.length * TILE_STYLE.textMeasure.valueCharWidth)
    : 0;
  const maxLabelAreaWidth = Math.max(
    0,
    totalContentWidth -
      logoAreaWidth -
      (canShowValue ? valueAreaWidth + valueGap : 0),
  );
  const estimatedLabelWidth =
    label.length * TILE_STYLE.textMeasure.labelCharWidth;
  const actualLabelWidth = Math.min(maxLabelAreaWidth, estimatedLabelWidth);

  const labelX = paddingX + logoAreaWidth;
  const valueX = labelX + actualLabelWidth + valueGap;

  return {
    height: finalHeaderHeight,
    visibility: {
      logo: canShowLogo,
      value: canShowValue,
      secondary: canShowSecondary,
    },
    logo: {
      x: paddingX,
      y: stackTop + (rowHeight - logoSize) / 2,
      size: logoSize,
    },
    label: {
      x: labelX,
      y: stackTop,
      width: actualLabelWidth,
      height: rowHeight,
    },
    value: {
      x: valueX,
      y: stackTop,
      width: valueAreaWidth,
      height: rowHeight,
    },
    secondary: {
      x: labelX,
      y: stackTop + rowHeight + badgeGap,
      width: Math.min(
        Math.max(42, secondaryLabel.length * 5.5 + 10),
        totalContentWidth - logoAreaWidth,
      ),
    },
  };
};

const computeNestedLayout = ({
  allocations,
  availW,
  availH,
}: {
  allocations?: AllocationItem[];
  availW: number;
  availH: number;
}): NestedLayout | null => {
  const items = allocations || [];
  if (
    items.length === 0 ||
    availW < TILE_STYLE.nested.minLayoutWidth ||
    availH < TILE_STYLE.nested.minLayoutHeight
  ) {
    return null;
  }

  const visibleItems = items.slice(0, TILE_STYLE.nested.maxItems);
  const hierarchy = d3
    .hierarchy<{ children: AllocationItem[] } | AllocationItem>({
      children: visibleItems,
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
    othersCount: Math.max(0, items.length - TILE_STYLE.nested.maxItems),
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

const TileHeaderText = React.memo(
  ({
    text,
    x,
    y,
    width,
    height,
    fill,
    align = "left",
  }: {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fill: string;
    align?: "left" | "right" | "center";
  }) => {
    return (
      <Text
        text={text}
        x={x}
        y={y}
        width={width}
        height={height}
        align={align}
        verticalAlign="middle"
        ellipsis
        wrap="none"
        fontSize={TILE_STYLE.fontSize}
        fontFamily={TILE_STYLE.fontFamily}
        fill={fill}
        fontStyle="bold"
        letterSpacing={TILE_STYLE.letterSpacing}
        listening={false}
      />
    );
  },
);

TileHeaderText.displayName = "TileHeaderText";

const TileHeaderBadge = React.memo(
  ({
    text,
    x,
    y,
    width,
    isHovered,
  }: {
    text: string;
    x: number;
    y: number;
    width: number;
    isHovered: boolean;
  }) => {
    return (
      <Group x={x} y={y} listening={false}>
        <Rect
          width={width}
          height={10}
          cornerRadius={5}
          fill={
            isHovered
              ? TILE_STYLE.colors.badgeBackgroundHover
              : TILE_STYLE.colors.badgeBackground
          }
        />
        <Text
          text={text}
          x={0}
          y={2}
          width={width}
          height={8}
          align="center"
          verticalAlign="middle"
          ellipsis
          wrap="none"
          fontSize={7}
          fontFamily={TILE_STYLE.fontFamily}
          fill={
            isHovered
              ? TILE_STYLE.colors.badgeTextHover
              : TILE_STYLE.colors.innerText
          }
          fontStyle="bold"
          letterSpacing={-0.1}
          listening={false}
        />
      </Group>
    );
  },
);

TileHeaderBadge.displayName = "TileHeaderBadge";

const TileHeaderMainRow = React.memo(
  ({
    headerLayout,
    logoUrl,
    label,
    valueLabel,
    textColor,
  }: {
    headerLayout: TileHeaderLayout;
    logoUrl?: string;
    label: string;
    valueLabel: string;
    textColor: string;
  }) => {
    return (
      <>
        {headerLayout.visibility.logo && logoUrl && (
          <AssetLogo
            url={logoUrl}
            x={headerLayout.logo.x}
            y={headerLayout.logo.y}
            size={headerLayout.logo.size}
          />
        )}
        <TileHeaderText
          text={label}
          x={headerLayout.label.x}
          y={headerLayout.label.y}
          width={headerLayout.label.width}
          height={headerLayout.label.height}
          fill={textColor}
        />
        {headerLayout.visibility.value && (
          <TileHeaderText
            text={valueLabel}
            x={headerLayout.value.x}
            y={headerLayout.value.y}
            width={headerLayout.value.width}
            height={headerLayout.value.height}
            fill={textColor}
            align="right"
          />
        )}
      </>
    );
  },
);

TileHeaderMainRow.displayName = "TileHeaderMainRow";

const NestedAllocationLabel = React.memo(
  ({ name, width }: { name: string; width: number }) => {
    return (
      <Text
        text={name}
        x={TILE_STYLE.nested.labelInset}
        y={TILE_STYLE.nested.labelInset}
        width={width - TILE_STYLE.nested.labelWidthOffset}
        fontSize={TILE_STYLE.nested.labelFontSize}
        fontFamily={TILE_STYLE.fontFamily}
        fill={TILE_STYLE.colors.innerText}
        fontStyle="bold"
        letterSpacing={TILE_STYLE.nested.labelLetterSpacing}
        wrap="none"
        ellipsis
        listening={false}
      />
    );
  },
);

NestedAllocationLabel.displayName = "NestedAllocationLabel";

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

    const [isHovered, setIsHovered] = useState(false);

    const nodeId = data.nodeId;
    const isSelected =
      selectedNodeId === nodeId || lastClick?.nodeId === nodeId;
    const isPressed = pressedNodeId === nodeId;
    const isOthers = data.isOthers;
    const isVault = !!data.isVault;
    const isTerminal = !isOthers && !!data.isTerminal;
    const hasAllocations = !!data.allocations && data.allocations.length > 0;

    const fill = isHovered
      ? TILE_STYLE.colors.hoverFill
      : isOthers
        ? TILE_STYLE.colors.othersFill
        : isTerminal
          ? TILE_STYLE.colors.terminalFill
          : TILE_STYLE.colors.defaultFill;

    const textColor = isHovered
      ? TILE_STYLE.colors.hoverText
      : isTerminal
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

    const logoPaths = useMemo(
      () =>
        data.logoNode
          ? getNodeLogos(data.logoNode)
          : data.fullNode
            ? getNodeLogos(data.fullNode)
            : [],
      [data.logoNode, data.fullNode],
    );
    const logoCount = Math.min(logoPaths.length, TILE_STYLE.logo.maxCount);
    const label = getTileNameText(data);
    const valueLabel = getTileValueText(data);
    const secondaryLabel = data.secondaryLabel?.toUpperCase() ?? "";

    const handleClick = useCallback(() => {
      runTileAction(data, { onSelect, onSelectOthers });
    }, [data, onSelect, onSelectOthers]);

    const handleMouseEnter = useCallback(
      (e: KonvaEventObject<MouseEvent>) => {
        setIsHovered(true);
        onHover(data, { clientX: e.evt.clientX, clientY: e.evt.clientY });
      },
      [data, onHover],
    );

    const handleMouseLeave = useCallback(() => {
      setIsHovered(false);
      onHoverEnd();
    }, [onHoverEnd]);

    const handleMouseMove = useCallback(
      (e: KonvaEventObject<MouseEvent>) => {
        onHover(data, { clientX: e.evt.clientX, clientY: e.evt.clientY });
      },
      [data, onHover],
    );

    // 1. Calculate Header Layout
    const headerLayout = useMemo(
      () =>
        computeTileHeaderLayout({
          width,
          height,
          logoCount,
          label,
          valueLabel,
          secondaryLabel,
          headerHeight,
        }),
      [
        width,
        height,
        logoCount,
        label,
        valueLabel,
        secondaryLabel,
        headerHeight,
      ],
    );

    // 2. Nested Treemap Calculation
    const innerMargin = TILE_STYLE.padding.inner;
    const availW = Math.max(0, width - innerMargin * 2);
    const availH = Math.max(0, height - headerLayout.height - innerMargin * 2);

    const nestedLayout = useMemo(
      () =>
        computeNestedLayout({
          allocations: data.allocations,
          availW,
          availH,
        }),
      [data.allocations, availW, availH],
    );

    return (
      <Group
        x={x}
        y={y}
        onClick={handleClick}
        onTap={handleClick}
        onMouseDown={() => !isTerminal && onPressStart(nodeId)}
        onMouseUp={onPressEnd}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
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
                ctx.rect(0, 0, width, headerLayout.height);
              }}
            >
              <TileHeaderMainRow
                headerLayout={headerLayout}
                logoUrl={logoPaths[0]}
                label={label}
                valueLabel={valueLabel}
                textColor={textColor}
              />
              {headerLayout.visibility.secondary && (
                <TileHeaderBadge
                  text={secondaryLabel}
                  x={headerLayout.secondary.x}
                  y={headerLayout.secondary.y}
                  width={headerLayout.secondary.width}
                  isHovered={isHovered}
                />
              )}
            </Group>
          )}

        {nestedLayout && (
          <Group x={innerMargin} y={headerLayout.height + innerMargin}>
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
                      <NestedAllocationLabel
                        name={(nestedData.name || "").toUpperCase()}
                        width={nw}
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
                  fontSize={7}
                  fontFamily={TILE_STYLE.fontFamily}
                  fill={TILE_STYLE.colors.innerText}
                  fontStyle="bold"
                  letterSpacing={TILE_STYLE.nested.labelLetterSpacing}
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
      runTileAction(datum, { onSelect, onSelectOthers });
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
                {getTileAccessibleLabel(datum)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
