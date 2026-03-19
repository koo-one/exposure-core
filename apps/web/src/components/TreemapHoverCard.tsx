import type { GraphNode } from "@/types";
import { cn } from "@/lib/utils";
import { currencyFormatter, formatUiLabel } from "@/utils/formatters";

export interface TreemapHoverCardDatum {
  nodeId?: string;
  name?: string;
  originalValue?: number;
  value?: number;
  percent?: number;
  fullNode?: GraphNode;
  isOthers?: boolean;
  childCount?: number;
  isTerminal?: boolean;
  lendingPair?: {
    collateral?: string | null;
    borrow?: string | null;
  };
}

interface TreemapHoverCardPayloadItem {
  payload?: TreemapHoverCardDatum;
}

export const TreemapHoverCard = ({
  active,
  payload,
  dataItem,
  downstream,
}: {
  active?: boolean;
  payload?: TreemapHoverCardPayloadItem[];
  dataItem?: TreemapHoverCardDatum | null;
  downstream?: { id: string; name: string; allocationUsd: number }[];
}) => {
  const resolved = dataItem ?? payload?.[0]?.payload;
  const isActive = Boolean(dataItem) || Boolean(active);

  if (!isActive) return null;
  if (!resolved) return null;

  const name = String(resolved?.name ?? "");
  const originalValue = Number(resolved?.originalValue ?? resolved?.value ?? 0);
  const percent =
    typeof resolved?.percent === "number" ? resolved.percent : null;
  const isOthers = resolved?.isOthers;
  const isTerminal = resolved?.isTerminal;
  const childCount = resolved?.childCount;
  const collateralToken = (resolved?.lendingPair?.collateral || "").trim();
  const borrowToken = (resolved?.lendingPair?.borrow || "").trim();

  const baseKind = isOthers
    ? `Aggregate (${childCount} Items)`
    : isTerminal
      ? "Terminal Asset"
      : String(resolved?.fullNode?.details?.kind ?? "");

  const subtype =
    typeof resolved?.fullNode?.details?.subtype === "string"
      ? resolved.fullNode.details.subtype.trim()
      : "";

  const kind = subtype && !isOthers ? `${baseKind} • ${subtype}` : baseKind;

  const downstreamRows = Array.isArray(downstream)
    ? downstream
        .filter(
          (d) =>
            d &&
            typeof d.id === "string" &&
            typeof d.name === "string" &&
            typeof d.allocationUsd === "number" &&
            Number.isFinite(d.allocationUsd) &&
            d.allocationUsd !== 0,
        )
        .slice(0, 4)
    : [];

  return (
    <div
      className="pointer-events-none w-[280px] select-none rounded-lg border border-white/10 bg-[#0D0D0D]/95 backdrop-blur-xl p-5 text-white shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]"
      style={{
        transform: "translate3d(0, -10px, 0)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="text-[10px] font-semibold text-white/40 tracking-[0.06em]">
          {formatUiLabel(kind || "Asset")}
        </div>
        <div
          className={cn(
            "w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentcolor]",
            isTerminal
              ? "bg-[#E11D48] text-[#E11D48]"
              : "bg-[#00FF85] text-[#00FF85]",
          )}
        />
      </div>

      <div className="text-sm font-semibold text-white/90 mb-3 tracking-[0.03em]">
        {isOthers ? "Others" : name}
      </div>

      <div className="flex flex-col gap-0.5 mb-6">
        <div className="text-[10px] font-semibold text-white/40 tracking-[0.05em]">
          {isOthers ? "Total Aggregate Value" : "Allocation Value"}
        </div>
        <div
          className={cn(
            "text-3xl font-bold leading-none tracking-tighter font-mono",
            isTerminal ? "text-[#FB7185]" : "text-[#00FF85]",
          )}
        >
          {currencyFormatter.format(originalValue)}
        </div>
      </div>

      {!isOthers && (collateralToken || borrowToken) && (
        <>
          <div className="h-px w-full bg-white/5 my-4" />
          <div className="text-[10px] font-semibold text-white/40 tracking-[0.05em] mb-3">
            Lending Relationship
          </div>
          <div className="flex flex-col gap-2 mb-6">
            {collateralToken ? (
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-semibold text-white/70 tracking-[0.03em]">
                  Collateral
                </div>
                <div className="text-[10px] font-bold text-white/70 font-mono">
                  {collateralToken}
                </div>
              </div>
            ) : null}
            {borrowToken ? (
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-semibold text-white/70 tracking-[0.03em]">
                  Borrow
                </div>
                <div className="text-[10px] font-bold text-white/70 font-mono">
                  {borrowToken}
                </div>
              </div>
            ) : null}
          </div>
        </>
      )}

      {isTerminal && (
        <div className="mb-6 px-3 py-1.5 bg-[#E11D48]/10 border border-[#E11D48]/20 rounded flex items-center justify-center gap-2">
          <div className="w-1 h-1 rounded-full bg-[#E11D48]/60" />
          <span className="text-[9px] font-semibold text-[#FB7185] tracking-[0.06em]">
            End of Path
          </span>
        </div>
      )}

      <div className="h-px w-full bg-white/5 mb-4" />

      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold text-white/40 tracking-[0.05em]">
          Portfolio Share
        </div>
        <div className="text-xs font-bold text-white font-mono">
          {percent === null ? "—" : `${(percent * 100).toFixed(2)}%`}
        </div>
      </div>

      {downstreamRows.length > 0 && !isOthers && (
        <>
          <div className="h-px w-full bg-white/5 my-4" />
          <div className="text-[10px] font-semibold text-white/40 tracking-[0.05em] mb-3">
            1-Hop Downstream
          </div>
          <div className="flex flex-col gap-2">
            {downstreamRows.map((row) => (
              <div key={row.id} className="flex items-center justify-between">
                <div className="text-[10px] font-semibold text-white/70 tracking-[0.03em] truncate pr-3">
                  {row.name || ""}
                </div>
                <div className="text-[10px] font-bold text-white/70 font-mono">
                  {currencyFormatter.format(Math.abs(row.allocationUsd))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
