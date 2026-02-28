import * as React from "react";

import type { GraphNode } from "@/types";
import { getNodeLogos } from "@/lib/logos";
import { cn } from "@/lib/utils";
import { currencyFormatter } from "@/utils/formatters";

interface TreemapTileDatum extends Record<string, unknown> {
  nodeId?: string;
  fullNode?: GraphNode;
  typeLabel?: string;
  lendingPosition?: "collateral" | "borrow";
  originalValue?: number;
  isOthers?: boolean;
  childIds?: string[];
  childCount?: number;
  isTerminal?: boolean;
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
  typeLabel?: string;
  lendingPosition?: "collateral" | "borrow";
  originalValue?: number;
  isTerminal?: boolean;
  name: string;
  value: number;
  percent: number;
  onSelect: (
    node: GraphNode,
    meta?: {
      lendingPosition?: "collateral" | "borrow";
    },
  ) => void | Promise<void>;
  onSelectOthers?: (childIds: string[]) => void;
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

const estimateTextWidthPx = (value: string, fontSizePx: number): number => {
  // Simple approximation for uppercase-heavy UI labels.
  return Math.ceil(value.length * fontSizePx * 0.62);
};

const estimateBadgeTextWidthPx = (
  value: string,
  fontSizePx: number,
  letterSpacingEm: number,
): number => {
  const len = value.length;
  if (len <= 0) return 0;

  // Approximate glyph width + letter spacing between characters.
  const base = len * fontSizePx * 0.62;
  const spacing = Math.max(0, len - 1) * fontSizePx * letterSpacingEm;
  return Math.ceil(base + spacing);
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
    onSelectOthers,
    selectedNodeId,
    pressedNodeId,
    onPressStart,
    onPressEnd,
    lastClick,
  } = typed;

  const [isShaking, setIsShaking] = React.useState(false);

  const dataItem = payload || typed;
  const nodeId = dataItem?.nodeId;
  const fullNode = dataItem?.fullNode;
  const isOthers = dataItem?.isOthers;
  const isTerminal = !isOthers && !!dataItem?.isTerminal;

  if (!nodeId || (!fullNode && !isOthers)) return null;

  const isSelected = selectedNodeId === nodeId;
  const isPressed = pressedNodeId === nodeId;
  const originalValue = dataItem.originalValue ?? value;
  const typeLabel =
    typeof dataItem?.typeLabel === "string" ? dataItem.typeLabel.trim() : "";

  // Refined terminal color palette - Muted Red (Clear "End of Path" signal)
  const terminalFill = "#FFF1F2"; // Rose 50
  const terminalStroke = "rgba(225, 29, 72, 0.2)"; // Rose 600 with alpha
  const terminalTextColor = "#9F1239"; // Rose 800

  const fill = isOthers ? "#000000" : isTerminal ? terminalFill : "#E6EBF8";
  const stroke = isOthers ? "#00FF85" : isTerminal ? terminalStroke : "#000000";
  const textColor = isOthers
    ? "#00FF85"
    : isTerminal
      ? terminalTextColor
      : "#000000";
  const monoFont = "'JetBrains Mono', monospace";

  const strokeDasharray = isTerminal ? "4 3" : undefined;
  const showTerminalBadge = isTerminal && width >= 80 && height >= 36;
  const showTerminalDot =
    isTerminal && !showTerminalBadge && width >= 42 && height >= 28;

  const logoPaths = fullNode ? getNodeLogos(fullNode) : [];
  const showLogos = logoPaths.length > 0 && width > 60 && height > 60;

  const clipId = `clip_${sanitizeSvgId(String(nodeId))}`;
  const patternId = `pattern_${sanitizeSvgId(String(nodeId))}`;

  const fontSize = 13;
  const horizontalPadding = 12;

  const typeBadge = (() => {
    if (isOthers) return null;
    if (!typeLabel) return null;
    if (width < 140 || height < 42) return null;

    const kind =
      typeof fullNode?.details?.kind === "string"
        ? fullNode.details.kind.trim().toLowerCase()
        : "";
    const subtype =
      typeof fullNode?.details?.subtype === "string"
        ? fullNode.details.subtype.trim().toLowerCase()
        : "";
    const lowerLabel = typeLabel.toLowerCase();

    // Badge color criteria (match top bar):
    // - Yield-related vaults: yield / vault products
    // - Lending-related: lending position / lending markets
    // - Staked/Locked: staked or locked positions
    const isYieldVault =
      kind === "yield" ||
      subtype.includes("vault") ||
      lowerLabel.includes("vault");
    const isLending =
      kind.includes("lending") || lowerLabel.includes("lending");
    const isStakedOrLocked =
      kind === "staked" ||
      kind === "locked" ||
      lowerLabel.includes("staked") ||
      lowerLabel.includes("locked");

    const colors = (() => {
      if (isYieldVault) {
        return {
          fill: "#ECFDF5", // emerald-50
          stroke: "#A7F3D0", // emerald-200
          text: "#047857", // emerald-700
        };
      }
      if (isLending) {
        return {
          fill: "#EFF6FF", // blue-50
          stroke: "#BFDBFE", // blue-200
          text: "#1D4ED8", // blue-700
        };
      }
      if (isStakedOrLocked) {
        return {
          fill: "#FFFBEB", // amber-50
          stroke: "#FDE68A", // amber-200
          text: "#B45309", // amber-700
        };
      }

      return {
        fill: "rgba(0,0,0,0.02)",
        stroke: "rgba(0,0,0,0.10)",
        text: "rgba(0,0,0,0.60)",
      };
    })();

    const text = typeLabel.toUpperCase();
    const fontSizePx = 8;
    const padX = 10;
    const heightPx = 16;
    const letterSpacingEm = 0.22;
    const widthPx = Math.min(
      Math.max(
        56,
        estimateBadgeTextWidthPx(text, fontSizePx, letterSpacingEm) + padX * 2,
      ),
      Math.max(56, Math.floor(width - horizontalPadding * 2)),
    );

    return {
      text,
      fontSizePx,
      padX,
      heightPx,
      widthPx,
      letterSpacingEm,
      colors,
    };
  })();

  const baseTextX = showLogos ? x + 16 + logoPaths.length * 12 : x + 8;
  const badgeGapPx = typeBadge ? 10 : 0;
  const reservedRightPx = typeBadge ? badgeGapPx + typeBadge.widthPx : 0;

  const displayText = (() => {
    if (isOthers) {
      return `${name} (${dataItem.childCount}) ${currencyFormatter.format(originalValue)}`;
    }

    return `${name} ${currencyFormatter.format(originalValue)}`;
  })();

  const safeText = (() => {
    const maxTextWidthPx = Math.max(
      0,
      x + width - 8 - baseTextX - reservedRightPx,
    );
    return ellipsizeToWidth(displayText, maxTextWidthPx, fontSize);
  })();

  const safeTextWidthPx = estimateTextWidthPx(safeText, fontSize);
  const badgeX = baseTextX + safeTextWidthPx + badgeGapPx;

  const clickFlashActive = lastClick?.nodeId === nodeId;

  const handleActivate = () => {
    if (isTerminal) {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 400);
    }

    const childIds = dataItem.childIds;
    if (isOthers && onSelectOthers && Array.isArray(childIds)) {
      onSelectOthers(childIds);
    } else if (fullNode) {
      void onSelect(fullNode, { lendingPosition: dataItem?.lendingPosition });
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<SVGGElement> = (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    handleActivate();
  };

  return (
    <g
      onPointerDown={() => !isTerminal && onPressStart(String(nodeId))}
      onPointerUp={onPressEnd}
      onPointerCancel={onPressEnd}
      onPointerLeave={onPressEnd}
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
      className={cn("exposure-tile", isShaking && "exposure-tile-shake")}
      role="button"
      tabIndex={0}
      aria-label={String(name)}
      data-node-id={String(nodeId)}
      style={{ cursor: isTerminal ? "default" : "pointer" }}
    >
      <defs>
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          <rect x={x} y={y} width={width} height={height} />
        </clipPath>
        {isTerminal && (
          <pattern
            id={patternId}
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="8"
              stroke="rgba(0,0,0,0.03)"
              strokeWidth="1"
            />
          </pattern>
        )}
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
          strokeDasharray,
          strokeLinecap: "round",
          opacity: 1,
        }}
        className={
          isPressed && !isTerminal
            ? "exposure-tile-rect exposure-tile-rect--pressed"
            : "exposure-tile-rect"
        }
      />

      {isTerminal && (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: `url(#${patternId})`,
            stroke: "none",
          }}
          pointerEvents="none"
        />
      )}

      {isSelected && !isTerminal && (
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

      {clickFlashActive && !isTerminal && (
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
        {showTerminalBadge && (
          <g>
            <rect
              x={x + width - 40}
              y={y + 8}
              width={32}
              height={14}
              rx={6}
              style={{
                fill: "#FECDD3", // Rose 200
                stroke: "none",
              }}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={x + width - 24}
              y={y + 18}
              textAnchor="middle"
              fill="#9F1239" // Rose 800
              fontSize={9}
              fontWeight={800}
              style={{ fontFamily: monoFont, letterSpacing: "0.1em" }}
            >
              END
            </text>
          </g>
        )}

        {showTerminalDot && (
          <circle
            cx={x + width - 12}
            cy={y + 12}
            r={4}
            style={{
              fill: "#E11D48", // Rose 600
              stroke: "none",
            }}
            vectorEffect="non-scaling-stroke"
          />
        )}

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
            x={baseTextX}
            y={y + 21}
            textAnchor="start"
            fill={textColor}
            fontSize={fontSize}
            fontWeight={400}
            style={{ fontFamily: monoFont }}
          >
            {safeText}
          </text>
        )}

        {typeBadge && width > 40 && height > 20 && (
          <g pointerEvents="none">
            <rect
              x={badgeX}
              y={y + 21 - typeBadge.heightPx + 2}
              width={typeBadge.widthPx}
              height={typeBadge.heightPx}
              rx={typeBadge.heightPx / 2}
              ry={typeBadge.heightPx / 2}
              style={{
                fill: typeBadge.colors.fill,
                stroke: typeBadge.colors.stroke,
                strokeWidth: 1,
              }}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={badgeX + typeBadge.padX}
              y={y + 21 - typeBadge.heightPx + 2 + typeBadge.heightPx / 2}
              textAnchor="start"
              dominantBaseline="middle"
              fill={typeBadge.colors.text}
              fontSize={typeBadge.fontSizePx}
              fontWeight={900}
              style={{
                fontFamily:
                  "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
                letterSpacing: `${typeBadge.letterSpacingEm}em`,
              }}
            >
              {typeBadge.text}
            </text>
          </g>
        )}
      </g>
    </g>
  );
};
