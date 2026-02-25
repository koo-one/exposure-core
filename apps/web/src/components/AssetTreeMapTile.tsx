import type React from "react";

import type { GraphNode } from "@/types";
import { getNodeLogos } from "@/lib/logos";
import { currencyFormatter } from "@/utils/formatters";

interface TreemapTileDatum extends Record<string, unknown> {
  nodeId?: string;
  fullNode?: GraphNode;
  lendingPosition?: "collateral" | "borrow";
  originalValue?: number;
}

interface CustomContentProps extends Record<string, unknown> {
  root?: unknown;
  depth?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  index?: number;
  payload?: TreemapTileDatum;
  colors?: unknown;
  rank?: number;
  nodeId?: string;
  fullNode?: GraphNode;
  lendingPosition?: "collateral" | "borrow";
  originalValue?: number;
  name: string;
  value: number;
  percent: number;
  onSelect: (
    node: GraphNode,
    meta?: {
      lendingPosition?: "collateral" | "borrow";
    },
  ) => void | Promise<void>;
  selectedNodeId?: string | null;
  pressedNodeId: string | null;
  onPressStart: (nodeId: string) => void;
  onPressEnd: () => void;
  lastClick: { nodeId: string; seq: number } | null;
}

const sanitizeSvgId = (value: string): string => {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
};

const ellipsizeToWidth = (
  value: string,
  maxWidthPx: number,
  fontSizePx: number,
): string => {
  const approxCharWidth = fontSizePx * 0.6;
  const maxChars = Math.max(3, Math.floor(maxWidthPx / approxCharWidth));

  if (value.length <= maxChars) return value;
  if (maxChars <= 3) return value.slice(0, 1) + "…";

  return value.slice(0, maxChars - 1) + "…";
};

export const AssetTreeMapTile = (props: Record<string, unknown>) => {
  const typed = props as CustomContentProps;
  const {
    x,
    y,
    width,
    height,
    payload,
    name,
    value,
    onSelect,
    selectedNodeId,
    pressedNodeId,
    onPressStart,
    onPressEnd,
    lastClick,
  } = typed;

  const dataItem = payload || typed;
  const nodeId = dataItem?.nodeId;
  const fullNode = dataItem?.fullNode;

  if (!nodeId || !fullNode) return null;

  const isSelected = selectedNodeId === nodeId;
  const isPressed = pressedNodeId === nodeId;
  const originalValue = dataItem.originalValue ?? value;

  const fill = "#E6EBF8";
  const stroke = "#000000";
  const monoFont = "'JetBrains Mono', monospace";

  const logoPaths = getNodeLogos(fullNode);
  const showLogos = logoPaths.length > 0 && width > 60 && height > 60;

  const clipId = `clip_${sanitizeSvgId(String(nodeId))}`;

  const fontSize = 13;
  const horizontalPadding = 12;
  const availableTextWidth = Math.max(0, width - horizontalPadding * 2);

  const displayText = `${name} ${currencyFormatter.format(originalValue)}`;
  const safeText = ellipsizeToWidth(displayText, availableTextWidth, fontSize);

  const clickFlashActive = lastClick?.nodeId === nodeId;

  const handleActivate = () => {
    void onSelect(fullNode, { lendingPosition: dataItem?.lendingPosition });
  };

  const handleKeyDown: React.KeyboardEventHandler<SVGGElement> = (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    handleActivate();
  };

  return (
    <g
      onPointerDown={() => onPressStart(String(nodeId))}
      onPointerUp={onPressEnd}
      onPointerCancel={onPressEnd}
      onPointerLeave={onPressEnd}
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
      className="exposure-tile"
      role="button"
      tabIndex={0}
      aria-label={String(name)}
      data-node-id={String(nodeId)}
      style={{ cursor: "pointer" }}
    >
      <defs>
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          <rect x={x} y={y} width={width} height={height} />
        </clipPath>
      </defs>

      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill,
          stroke,
          strokeWidth: 1,
          opacity: 1,
        }}
        className={
          isPressed
            ? "exposure-tile-rect exposure-tile-rect--pressed"
            : "exposure-tile-rect"
        }
      />

      {isSelected && (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: "rgba(0, 0, 0, 0.05)",
            stroke,
            strokeWidth: 2,
          }}
          vectorEffect="non-scaling-stroke"
        />
      )}

      {clickFlashActive && (
        <rect
          key={lastClick?.seq}
          x={x}
          y={y}
          width={width}
          height={height}
          className="exposure-tile-click"
          style={{
            fill: "rgba(0, 0, 0, 0.1)",
            stroke,
            strokeWidth: 2,
          }}
          vectorEffect="non-scaling-stroke"
        />
      )}

      <g clipPath={`url(#${clipId})`}>
        {showLogos &&
          logoPaths.map((logoPath, idx) => (
            <image
              key={logoPath}
              href={logoPath}
              x={x + 8 + idx * 12}
              y={y + 8}
              height="18"
              width="18"
              preserveAspectRatio="xMidYMid meet"
            />
          ))}

        {width > 40 && height > 20 && (
          <text
            x={showLogos ? x + 16 + logoPaths.length * 12 : x + 8}
            y={y + 21}
            textAnchor="start"
            fill="#000000"
            fontSize={fontSize}
            fontWeight={400}
            style={{ fontFamily: monoFont }}
          >
            {safeText}
          </text>
        )}
      </g>
    </g>
  );
};
