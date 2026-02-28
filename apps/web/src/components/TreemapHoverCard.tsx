import type { GraphNode } from "@/types";
import { cn } from "@/lib/utils";
import { currencyFormatter } from "@/utils/formatters";

interface TreemapHoverCardDatum {
  name?: string;
  originalValue?: number;
  value?: number;
  percent?: number;
  fullNode?: GraphNode;
  isOthers?: boolean;
  childCount?: number;
  isTerminal?: boolean;
}

interface TreemapHoverCardPayloadItem {
  payload?: TreemapHoverCardDatum;
}

export const TreemapHoverCard = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TreemapHoverCardPayloadItem[];
}) => {
  if (!active) return null;

  const dataItem = payload?.[0]?.payload;
  if (!dataItem) return null;

  const name = String(dataItem?.name ?? "");
  const originalValue = Number(dataItem?.originalValue ?? dataItem?.value ?? 0);
  const percent =
    typeof dataItem?.percent === "number" ? dataItem.percent : null;
  const isOthers = dataItem?.isOthers;
  const isTerminal = dataItem?.isTerminal;
  const childCount = dataItem?.childCount;

  const kind = isOthers
    ? `Aggregate (${childCount} Items)`
    : isTerminal
      ? "Terminal Asset"
      : String(dataItem?.fullNode?.details?.kind ?? "");

  return (
    <div
      className="pointer-events-none w-[280px] select-none rounded-lg border border-white/10 bg-[#0D0D0D]/95 backdrop-blur-xl p-5 text-white shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]"
      style={{
        transform: "translate3d(0, -10px, 0)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">
          {kind || "Asset"}
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

      <div className="text-sm font-bold text-white/90 mb-3 tracking-tight uppercase">
        {isOthers ? "OTHERS" : name}
      </div>

      <div className="flex flex-col gap-0.5 mb-6">
        <div className="text-[10px] font-black text-white/30 uppercase tracking-[0.1em]">
          {isOthers ? "Total Aggregate Value" : "Allocation Value"}
        </div>
        <div
          className={cn(
            "text-3xl font-black leading-none tracking-tighter font-mono",
            isTerminal ? "text-[#FB7185]" : "text-[#00FF85]",
          )}
        >
          {currencyFormatter.format(originalValue)}
        </div>
      </div>

      {isTerminal && (
        <div className="mb-6 px-3 py-1.5 bg-[#E11D48]/10 border border-[#E11D48]/20 rounded flex items-center justify-center gap-2">
          <div className="w-1 h-1 rounded-full bg-[#E11D48]/60" />
          <span className="text-[9px] font-black text-[#FB7185] uppercase tracking-[0.2em]">
            End of Path
          </span>
        </div>
      )}

      <div className="h-px w-full bg-white/5 mb-4" />

      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black text-white/30 uppercase tracking-[0.1em]">
          Portfolio Share
        </div>
        <div className="text-xs font-black text-white font-mono">
          {percent === null ? "—" : `${(percent * 100).toFixed(2)}%`}
        </div>
      </div>
    </div>
  );
};
