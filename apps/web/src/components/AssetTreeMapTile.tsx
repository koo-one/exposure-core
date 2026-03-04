import * as React from "react";

import type { GraphNode } from "@/types";
import {
  getNodeLogos,
  getProtocolLogoPath,
  hasProtocolLogo,
} from "@/lib/logos";
import { currencyFormatter } from "@/utils/formatters";
import { classifyNodeType, getNodeTypeParts } from "@/lib/nodeType";

interface TreemapTileDatum extends Record<string, unknown> {
  nodeId?: string;
  fullNode?: GraphNode;
  typeLabel?: string;
  lendingPosition?: "collateral" | "borrow";
  originalValue?: number;
  isOthers?: boolean;
  isVault?: boolean;
  childIds?: string[];
  childCount?: number;
  isTerminal?: boolean;
  directLeavesCount?: number;
  allocations?: { id: string; name: string; value: number }[];
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
  isVault?: boolean;
  directLeavesCount?: number;
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
  onPressStart: (nodeId: string) => void;
  onPressEnd: () => void;
  lastClick: { nodeId: string; seq: number } | null;

  onHover?: (
    datum: TreemapTileDatum,
    point: { clientX: number; clientY: number },
  ) => void;
  onHoverEnd?: () => void;
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
  if (maxChars <= 3) return "...";

  return value.slice(0, maxChars - 3) + "...";
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
    onPressStart,
    onPressEnd,
    lastClick,
    onHover,
    onHoverEnd,
  } = typed;

  const dataItem = payload || typed;
  const nodeId = dataItem?.nodeId;
  const fullNode = dataItem?.fullNode;
  const isOthers = dataItem?.isOthers;
  const isVault = !!dataItem?.isVault;
  const isTerminal = !isOthers && !!dataItem?.isTerminal;
  const directLeavesCount =
    typeof dataItem?.directLeavesCount === "number" &&
    Number.isFinite(dataItem.directLeavesCount)
      ? Math.max(0, Math.floor(dataItem.directLeavesCount))
      : null;

  const allocations = Array.isArray(dataItem?.allocations)
    ? (dataItem.allocations as TreemapTileDatum["allocations"])
    : null;
  const hasAllocations = !!allocations && allocations.length > 0;

  if (!nodeId || (!fullNode && !isOthers)) return null;

  const isSelected = selectedNodeId === nodeId;
  const originalValue = dataItem.originalValue ?? value;
  const typeLabel =
    typeof dataItem?.typeLabel === "string" ? dataItem.typeLabel.trim() : "";

  // Refined terminal color palette - Muted Red (Clear "End of Path" signal)
  const terminalFill = "#FFF1F2"; // Rose 50
  const terminalStroke = "rgba(225, 29, 72, 0.2)"; // Rose 600 with alpha
  const terminalTextColor = "#9F1239"; // Rose 800

  // "Others" tile specific style (beige/light gray background)
  const othersFill = "#EAE5D9"; // Beige-ish gray from Image 1 / detailnodestyle.png
  const othersStroke = "#000000";

  const fill =
    isOthers || isVault || hasAllocations
      ? othersFill
      : isTerminal
        ? terminalFill
        : "#E6EBF8";
  const stroke =
    isOthers || isVault || hasAllocations
      ? othersStroke
      : isTerminal
        ? terminalStroke
        : "#000000";
  const textColor =
    isOthers || isVault || hasAllocations
      ? "#000000"
      : isTerminal
        ? terminalTextColor
        : "#000000";
  const monoFont = "'JetBrains Mono', monospace";

  const strokeDasharray = isTerminal ? "4 3" : undefined;
  const showTerminalBadge = isTerminal && width >= 80 && height >= 36;
  const showTerminalDot =
    isTerminal && !showTerminalBadge && width >= 42 && height >= 28;

  const showLeavesCount =
    !isOthers &&
    !isTerminal &&
    directLeavesCount !== null &&
    directLeavesCount > 0 &&
    width >= 90 &&
    height >= 40 &&
    !((isVault || hasAllocations) && width > 150);

  const logoPaths = fullNode ? getNodeLogos(fullNode) : [];
  const showLogos = logoPaths.length > 0 && width > 60 && height > 60;

  const headerHeight =
    isOthers || hasAllocations || isVault
      ? Math.min(28, Math.max(14, Math.floor(height * 0.22)))
      : 0;
  const headerCenterY = headerHeight ? y + headerHeight / 2 : y + 17;

  const protocolFallbackPath =
    fullNode?.protocol && hasProtocolLogo(fullNode.protocol)
      ? getProtocolLogoPath(fullNode.protocol)
      : "";

  const clipId = `clip_${sanitizeSvgId(String(nodeId))}`;
  const patternId = `pattern_${sanitizeSvgId(String(nodeId))}`;

  const fontSize = 13;
  const horizontalPadding = 12;

  const typeBadge = (() => {
    if (isOthers) return null;
    if (!typeLabel) return null;
    if (width < 140 || height < 42) return null;

    const category = classifyNodeType(
      getNodeTypeParts(fullNode?.details ?? null, typeLabel),
    );

    const colors = (() => {
      if (category === "yield-vault") {
        return {
          fill: "#ECFDF5", // emerald-50
          stroke: "#A7F3D0", // emerald-200
          text: "#047857", // emerald-700
        };
      }
      if (category === "lending") {
        return {
          fill: "#EFF6FF", // blue-50
          stroke: "#BFDBFE", // blue-200
          text: "#1D4ED8", // blue-700
        };
      }
      if (category === "staked-locked") {
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
  const headerTextX = showLogos ? x + 8 + logoPaths.length * 12 + 20 : x + 8;
  const badgeGapPx = typeBadge ? 6 : 0;
  const reservedRightPx = typeBadge ? badgeGapPx + typeBadge.widthPx : 0;

  const headerText = (() => {
    if (!hasAllocations && !isOthers && !isVault) return "";

    if (isVault && !hasAllocations) {
      return `${name} ${currencyFormatter.format(originalValue)}`;
    }

    const count =
      typeof dataItem.childCount === "number" && dataItem.childCount > 0
        ? dataItem.childCount
        : (allocations?.length ?? 0);

    const suffix = `${currencyFormatter.format(originalValue)}`;

    if (isOthers) return `${name} +${count} ${suffix}`;
    return `${name} +${count} others ${suffix}`;
  })();

  const displayText = (() => {
    if (hasAllocations || isOthers || isVault) return "";
    return `${name} ${currencyFormatter.format(originalValue)}`;
  })();

  const headerDisplayText = headerText
    ? ellipsizeToWidth(
        headerText,
        Math.max(0, width - (headerTextX - x) - 8),
        fontSize,
      )
    : "";
  const headerTextWidthPx = headerDisplayText
    ? estimateTextWidthPx(headerDisplayText, fontSize)
    : 0;

  const maxTextWidthPx = Math.max(
    0,
    width - (baseTextX - x) - 8 - reservedRightPx,
  );

  const safeText = ellipsizeToWidth(displayText, maxTextWidthPx, fontSize);

  const safeTextWidthPx = Math.min(
    estimateTextWidthPx(safeText, fontSize),
    maxTextWidthPx,
  );
  const badgeX =
    headerDisplayText && (isOthers || hasAllocations || isVault)
      ? headerTextX + headerTextWidthPx + badgeGapPx
      : baseTextX + safeTextWidthPx + badgeGapPx;
  const badgeAvailablePx = Math.max(0, width - (badgeX - x) - 8);
  const finalTypeBadge =
    typeBadge && badgeAvailablePx >= typeBadge.widthPx ? typeBadge : null;
  const badgeBaseY =
    isOthers || hasAllocations || isVault ? headerCenterY : y + 21;

  const clickFlashActive = lastClick?.nodeId === nodeId;

  // Mini-treemap rendering logic (Squarify)
  // For "Others":
  // - Top bar (header)
  // - Body area filled with smaller rectangles
  const renderAllocations = () => {
    if (!hasAllocations && !isVault) return null;
    if (width < 90 || height < 90) return null;

    const HEADER_HEIGHT = 28;
    const MARGIN = 6;
    const INNER_GAP = 2;
    const headerHeight = Math.min(
      HEADER_HEIGHT,
      Math.max(14, Math.floor(height * 0.22)),
    );
    const margin = Math.min(
      MARGIN,
      Math.max(2, Math.floor(Math.min(width, height) / 4)),
    );

    if (!hasAllocations && isVault) {
      return null;
    }

    // Area available for inner rectangles
    const availW = Math.max(0, width - margin * 2 - INNER_GAP * 2);
    const availH = Math.max(
      0,
      height - headerHeight - margin * 2 - INNER_GAP * 2,
    );

    if (availW < 24 || availH < 24 || !allocations) return null;

    const items = allocations
      .filter((item) => Number.isFinite(item.value) && item.value > 0)
      .map((item) => ({
        id: item.id,
        name: item.name,
        value: item.value,
      }));

    if (items.length === 0) return null;

    return (
      <g>
        <rect
          x={x + margin + INNER_GAP}
          y={y + headerHeight + margin + INNER_GAP}
          width={availW}
          height={availH}
          style={{
            fill: "#E6EBF8",
            stroke: "#000000",
            strokeWidth: 1,
          }}
          pointerEvents="none"
        />
        <text
          x={x + margin + INNER_GAP + 6}
          y={y + headerHeight + margin + INNER_GAP + 18}
          fontSize={10}
          fill="rgba(0,0,0,0.8)"
          style={{ fontFamily: monoFont, letterSpacing: "0.08em" }}
        >
          {ellipsizeToWidth(
            `+${items.length} OTHERS`,
            Math.max(0, availW - 12),
            10,
          )}
        </text>
      </g>
    );
  };

  const handleActivate = () => {
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
      onPointerLeave={() => {
        onPressEnd();
        onHoverEnd?.();
      }}
      onPointerMove={(e) => {
        if (!onHover) return;
        onHover(dataItem, { clientX: e.clientX, clientY: e.clientY });
      }}
      onPointerEnter={(e) => {
        if (!onHover) return;
        onHover(dataItem, { clientX: e.clientX, clientY: e.clientY });
      }}
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
      className="exposure-tile"
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
        className="exposure-tile-rect"
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
          x={x}
          y={y}
          width={width}
          height={height}
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

        {showLeavesCount && (
          <g pointerEvents="none">
            <rect
              x={x + width - 54}
              y={y + 8}
              width={46}
              height={16}
              rx={8}
              style={{
                fill: "rgba(0,0,0,0.03)",
                stroke: "rgba(0,0,0,0.10)",
                strokeWidth: 1,
              }}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={x + width - 31}
              y={y + 19}
              textAnchor="middle"
              fill="rgba(0,0,0,0.65)"
              fontSize={9}
              fontWeight={900}
              style={{ fontFamily: monoFont, letterSpacing: "0.12em" }}
            >
              {directLeavesCount}
            </text>
          </g>
        )}

        {showLogos &&
          logoPaths.map((logoPath, idx) => (
            <image
              key={logoPath}
              href={logoPath}
              onError={(e) => {
                if (!protocolFallbackPath) return;
                const el = e.currentTarget;
                const alreadyApplied =
                  el.getAttribute("data-fallback-applied") === "1";
                if (alreadyApplied) return;

                const current = el.getAttribute("href") || "";
                if (current === protocolFallbackPath) return;

                el.setAttribute("data-fallback-applied", "1");
                el.setAttribute("href", protocolFallbackPath);
              }}
              x={x + 8 + idx * 12}
              y={headerCenterY - 9}
              height="18"
              width="18"
              preserveAspectRatio="xMidYMid meet"
            />
          ))}

        {width > 40 && height > 20 && (
          <text
            x={baseTextX}
            y={
              isOthers || hasAllocations || isVault
                ? y + headerHeight + 14
                : y + 21
            }
            textAnchor="start"
            fill={textColor}
            fontSize={fontSize}
            fontWeight={isOthers || hasAllocations || isVault ? 700 : 400}
            style={{ fontFamily: monoFont }}
          >
            {safeText}
          </text>
        )}

        {(isOthers || hasAllocations || isVault) && headerText && (
          <text
            x={headerTextX}
            y={headerCenterY}
            textAnchor="start"
            fill={textColor}
            fontSize={fontSize}
            fontWeight={700}
            dominantBaseline="middle"
            style={{ fontFamily: monoFont }}
          >
            {ellipsizeToWidth(headerText, width - 16, fontSize)}
          </text>
        )}

        {finalTypeBadge && width > 40 && height > 20 && (
          <g pointerEvents="none">
            <rect
              x={badgeX}
              y={badgeBaseY - finalTypeBadge.heightPx / 2}
              width={finalTypeBadge.widthPx}
              height={finalTypeBadge.heightPx}
              rx={finalTypeBadge.heightPx / 2}
              ry={finalTypeBadge.heightPx / 2}
              style={{
                fill: finalTypeBadge.colors.fill,
                stroke: finalTypeBadge.colors.stroke,
                strokeWidth: 1,
              }}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={badgeX + finalTypeBadge.padX}
              y={badgeBaseY}
              textAnchor="start"
              dominantBaseline="middle"
              fill={finalTypeBadge.colors.text}
              fontSize={finalTypeBadge.fontSizePx}
              fontWeight={900}
              style={{
                fontFamily:
                  "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
                letterSpacing: `${finalTypeBadge.letterSpacingEm}em`,
              }}
            >
              {finalTypeBadge.text}
            </text>
          </g>
        )}

        {renderAllocations()}
      </g>
    </g>
  );
};
