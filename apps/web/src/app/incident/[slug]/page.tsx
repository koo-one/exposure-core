import { notFound } from "next/navigation";
import { loadIncidentConfig } from "@/lib/incident/config";
import { detectToxicExposure } from "@/lib/incident/detection";
import { loadProtocolSnapshots } from "@/lib/graphLoader";
import { inferProtocolFolderFromNodeId } from "@/lib/blobPaths";
import { formatUsdCompact } from "@/lib/incident/format";
import type {
  AdapterVault,
  IncidentSummary,
  VaultExposure,
  ToxicBreakdownEntry,
} from "@/lib/incident/types";
import type { GraphSnapshot } from "@/types";
import { IncidentBanner } from "@/components/incident/IncidentBanner";
import { PriceChart } from "@/components/incident/PriceChart";
import { BadDebtPanel } from "@/components/incident/BadDebtPanel";
import { MetricCard } from "@/components/incident/MetricCard";
import { ProtocolRow } from "@/components/incident/ProtocolRow";
import { TimelinePanel } from "@/components/incident/TimelinePanel";
import { AnimatedCounter } from "@/components/incident/AnimatedCounter";
import { VaultTable } from "@/components/incident/VaultTable";

export const revalidate = 600;

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function computeSummary(
  vaults: VaultExposure[],
  config: { lastUpdated: string },
): IncidentSummary {
  const byProtocol: IncidentSummary["byProtocol"] = {};
  const byAsset: IncidentSummary["byAsset"] = {};
  const byChain: IncidentSummary["byChain"] = {};
  let totalTvl = 0;
  let totalToxic = 0;
  const protocols = new Set<string>();
  let coveringCount = 0;

  for (const ve of vaults) {
    totalTvl += ve.totalAllocationUsd;
    totalToxic += ve.toxicExposureUsd;
    protocols.add(ve.vault.protocol);
    if (ve.vault.status === "covering") coveringCount++;

    const p = (byProtocol[ve.vault.protocol] ??= {
      exposureUsd: 0,
      vaultCount: 0,
    });
    p.exposureUsd += ve.toxicExposureUsd;
    p.vaultCount += 1;

    for (const b of ve.breakdown) {
      const a = (byAsset[b.asset] ??= { exposureUsd: 0 });
      a.exposureUsd += b.amountUsd;
    }

    for (const chain of ve.vault.chains) {
      const c = (byChain[chain] ??= { exposureUsd: 0, vaultCount: 0 });
      c.vaultCount += 1;
      if (ve.chainBreakdown?.[chain]) {
        c.exposureUsd += ve.chainBreakdown[chain].toxicExposureUsd;
      }
    }
  }

  return {
    totalAffectedTvlUsd: totalTvl,
    totalToxicExposureUsd: totalToxic,
    vaultCount: vaults.length,
    protocolCount: protocols.size,
    coveringCount,
    byProtocol,
    byAsset,
    byChain,
    dataTimestamp: config.lastUpdated,
  };
}

// Protocol display config for logos + fallback
const PROTOCOL_DISPLAY: Record<string, { color: string; initials: string }> = {
  morpho: { color: "#2563eb", initials: "M" },
  euler: { color: "#e04040", initials: "E" },
  midas: { color: "#8b5cf6", initials: "Mi" },
  inverse: { color: "#000000", initials: "IN" },
  fluid: { color: "#3b82f6", initials: "FL" },
  gearbox: { color: "#4a4a4a", initials: "G" },
};

export default async function IncidentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const config = await loadIncidentConfig(slug);
  if (!config) notFound();

  const toxicSymbols = config.toxicAssets.map((a) => a.symbol);

  // Group adapter vaults by protocol folder to minimize blob fetches
  const adapterVaults = config.affectedVaults.filter(
    (v): v is AdapterVault => v.source === "adapter",
  );
  const protocolFolders = new Set<string>();
  for (const vault of adapterVaults) {
    for (const nodeId of Object.values(vault.nodeIds)) {
      const folder = inferProtocolFolderFromNodeId(nodeId);
      if (folder) protocolFolders.add(folder);
    }
  }

  const snapshotsByProtocol = new Map<string, Record<string, GraphSnapshot>>();
  await Promise.all(
    Array.from(protocolFolders).map(async (folder) => {
      const snapshots = await loadProtocolSnapshots(folder);
      snapshotsByProtocol.set(folder, snapshots);
    }),
  );

  const vaults: VaultExposure[] = [];

  for (const vault of config.affectedVaults) {
    if (vault.source === "manual") {
      vaults.push({
        vault,
        status: vault.exposureUsd > 0 ? "loaded" : "pending",
        totalAllocationUsd: vault.exposureUsd,
        toxicExposureUsd: vault.exposureUsd,
        exposurePct: vault.exposureUsd > 0 ? 1 : 0,
        breakdown: vault.toxicAssetBreakdown,
      });
      continue;
    }

    let totalAlloc = 0;
    let totalToxic = 0;
    const assetTotals = new Map<string, number>();
    const allToxicAllocations: VaultExposure["toxicAllocations"] = [];
    const chainBreakdown: NonNullable<VaultExposure["chainBreakdown"]> = {};
    let anyLoaded = false;

    for (const [chain, nodeId] of Object.entries(vault.nodeIds)) {
      const folder = inferProtocolFolderFromNodeId(nodeId);
      const snapshots = folder ? snapshotsByProtocol.get(folder) : undefined;
      const snapshot = snapshots?.[nodeId] ?? null;

      const result = detectToxicExposure(
        snapshot,
        nodeId,
        toxicSymbols,
        config.toxicAssetNodeIds,
      );

      if (result.status === "loaded") {
        anyLoaded = true;
        totalAlloc += result.totalAllocationUsd;
        totalToxic += result.toxicExposureUsd;
        for (const b of result.breakdown) {
          assetTotals.set(
            b.asset,
            (assetTotals.get(b.asset) ?? 0) + b.amountUsd,
          );
        }
        if (result.toxicAllocations) {
          allToxicAllocations.push(...result.toxicAllocations);
        }
        chainBreakdown[chain] = {
          nodeId,
          totalAllocationUsd: result.totalAllocationUsd,
          toxicExposureUsd: result.toxicExposureUsd,
          breakdown: result.breakdown,
        };
      }
    }

    const breakdown: ToxicBreakdownEntry[] = Array.from(
      assetTotals.entries(),
    ).map(([asset, amountUsd]) => ({
      asset,
      amountUsd,
      pct: totalAlloc > 0 ? amountUsd / totalAlloc : 0,
    }));

    vaults.push({
      vault,
      status: anyLoaded ? "loaded" : "pending",
      totalAllocationUsd: totalAlloc,
      toxicExposureUsd: totalToxic,
      exposurePct: totalAlloc > 0 ? totalToxic / totalAlloc : 0,
      breakdown,
      chainBreakdown:
        Object.keys(chainBreakdown).length > 0 ? chainBreakdown : undefined,
      toxicAllocations:
        allToxicAllocations.length > 0 ? allToxicAllocations : undefined,
    });
  }

  const summary = computeSummary(vaults, config);

  // Protocols sorted by exposure descending
  const sortedProtocols = Object.entries(summary.byProtocol).sort(
    ([, a], [, b]) => b.exposureUsd - a.exposureUsd,
  );

  // Highest exposure % vault
  const highestPctVault = vaults
    .filter((ve) => ve.status === "loaded")
    .sort((a, b) => b.exposurePct - a.exposurePct)[0];

  // Donut chart: compute conic-gradient from byAsset
  const assetEntries = Object.entries(summary.byAsset).sort(
    ([, a], [, b]) => b.exposureUsd - a.exposureUsd,
  );
  const assetColorBySymbol = Object.fromEntries(
    config.toxicAssets.map((a) => [a.symbol, a.color]),
  );
  const totalAssetExposure = assetEntries.reduce(
    (sum, [, v]) => sum + v.exposureUsd,
    0,
  );
  let cumulativeDeg = 0;
  const conicStops = assetEntries.map(([symbol, { exposureUsd }]) => {
    const deg =
      totalAssetExposure > 0 ? (exposureUsd / totalAssetExposure) * 360 : 0;
    const color = assetColorBySymbol[symbol] ?? "#999";
    const start = cumulativeDeg;
    cumulativeDeg += deg;
    return `${color} ${start.toFixed(1)}deg ${cumulativeDeg.toFixed(1)}deg`;
  });
  const conicGradient =
    conicStops.length > 0
      ? `conic-gradient(${conicStops.join(", ")})`
      : "conic-gradient(#ddd 0deg 360deg)";

  // Static timeline entries for TimelinePanel (tagged)
  const timelineEntries = [
    {
      date: "Mar 22, 2026",
      tag: "exploit" as const,
      text: "USR depegs following Resolv Labs exploit; price drops to $0.58.",
    },
    {
      date: "Mar 22, 2026",
      tag: "curator" as const,
      text: "Gauntlet pauses deposits across affected Morpho vaults as a precautionary measure.",
    },
    {
      date: "Mar 22, 2026",
      tag: "response" as const,
      text: "Inverse Finance announces coverage of DOLA bad debt from the exploit.",
    },
    {
      date: "Mar 22, 2026",
      tag: "curator" as const,
      text: "Re7 Labs reduces USR allocation in Re7 USDC vault on Base.",
    },
    {
      date: "Mar 23, 2026",
      tag: "update" as const,
      text: "Exposure Core contagion dashboard launched with 29+ affected vaults tracked.",
    },
  ];

  const timestamp = formatDate(summary.dataTimestamp);

  // Panel header shared style helper
  const panelHeader = (title: string) => (
    <div className="text-[8px] font-black text-black/30 tracking-[0.3em] uppercase mb-3 pb-2 border-b border-black/[0.04]">
      {title}
    </div>
  );

  // Token icon path helper
  const tokenIconPath = (symbol: string): string | null => {
    const key = symbol.toLowerCase();
    const map: Record<string, string> = {
      usr: "/logos/assets/usr.svg",
      wstusr: "/logos/assets/wstusr.svg",
      rlp: "/logos/assets/rlp.svg",
    };
    return map[key] ?? null;
  };

  // Covering protocols for BadDebtPanel
  const coveringProtocolsMap = new Map<string, string>();
  for (const ve of vaults) {
    if (ve.vault.status === "covering") {
      coveringProtocolsMap.set(ve.vault.protocol, ve.vault.name);
    }
  }
  const coveringProtocolsList = Array.from(coveringProtocolsMap.entries()).map(
    ([protocol, name]) => ({ name, protocol }),
  );

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Centered content container */}
      <div className="max-w-[1280px] mx-auto px-6 py-6">
        {/* Outer wrapper with gap-px grid-line effect */}
        <div
          className="flex flex-col"
          style={{ gap: 1, backgroundColor: "rgba(0,0,0,0.06)" }}
        >
          {/* ── Incident Banner ── */}
          <div className="bg-white px-5 py-3">
            <IncidentBanner
              title={config.title}
              description={config.description}
              timestamp={formatDate(config.incidentDate)}
              status={config.status}
            />
          </div>

          {/* ── Row 1: Total At-Risk | USR Price Chart ── */}
          <div
            className="grid grid-cols-1 md:grid-cols-2"
            style={{ gap: 1, backgroundColor: "rgba(0,0,0,0.06)" }}
          >
            {/* Total At-Risk */}
            <div className="bg-white px-5 py-4">
              {panelHeader("Total At-Risk Allocation")}
              <div className="flex flex-col gap-1">
                <div
                  className="font-mono font-bold text-black"
                  style={{
                    fontSize: 48,
                    letterSpacing: "-0.03em",
                    lineHeight: 1,
                  }}
                >
                  <AnimatedCounter
                    target={summary.totalToxicExposureUsd}
                    format="usd"
                  />
                </div>
                <p
                  className="uppercase font-semibold"
                  style={{ fontSize: 10, color: "rgba(0,0,0,0.30)" }}
                >
                  across {summary.vaultCount} vault
                  {summary.vaultCount !== 1 ? "s" : ""} ·{" "}
                  {summary.protocolCount} protocol
                  {summary.protocolCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {/* USR Price Chart */}
            <PriceChart
              currentPrice={0.5823}
              priceChange24h={-41.77}
              pegPrice={1.0}
            />
          </div>

          {/* ── Row 2: Bad Debt Status | Donut by Toxic Asset ── */}
          <div
            className="grid grid-cols-1 md:grid-cols-3"
            style={{ gap: 1, backgroundColor: "rgba(0,0,0,0.06)" }}
          >
            {/* Bad Debt (spans 2 cols) */}
            <div className="md:col-span-2 bg-white px-5 py-4">
              {panelHeader("Bad Debt Status")}
              <BadDebtPanel
                realizedDebt={summary.totalToxicExposureUsd}
                coveredDebt={0}
                uncoveredGap={summary.totalToxicExposureUsd}
                recoveryRate={0}
                coveringProtocols={coveringProtocolsList}
              />
            </div>

            {/* Donut by Toxic Asset */}
            <div className="bg-white px-5 py-4">
              {panelHeader("By Toxic Asset")}
              <div className="flex items-center gap-6">
                {/* Donut */}
                <div
                  className="w-[100px] h-[100px] rounded-full relative flex-shrink-0"
                  style={{ background: conicGradient }}
                >
                  <div className="absolute inset-[28px] rounded-full bg-white flex items-center justify-center">
                    <div className="flex flex-col items-center justify-center">
                      <span className="font-mono text-[11px] font-bold leading-tight">
                        {formatUsdCompact(totalAssetExposure)}
                      </span>
                      <span className="text-[7px] text-black/25 uppercase tracking-widest">
                        Total
                      </span>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-col justify-center gap-2">
                  {assetEntries.map(([symbol, { exposureUsd }]) => {
                    const iconPath = tokenIconPath(symbol);
                    return (
                      <div key={symbol} className="flex items-center gap-2">
                        {iconPath ? (
                          <img
                            src={iconPath}
                            alt={symbol}
                            width={16}
                            height={16}
                            className="w-4 h-4 rounded-full flex-shrink-0"
                          />
                        ) : (
                          <div
                            className="w-4 h-4 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor:
                                assetColorBySymbol[symbol] ?? "#999",
                            }}
                          />
                        )}
                        <div>
                          <span
                            className="font-black uppercase"
                            style={{ fontSize: 9, color: "rgba(0,0,0,0.65)" }}
                          >
                            {symbol}
                          </span>
                          <span
                            className="ml-1.5 font-mono"
                            style={{ fontSize: 9, color: "rgba(0,0,0,0.35)" }}
                          >
                            {formatUsdCompact(exposureUsd)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {assetEntries.length === 0 && (
                    <span
                      className="font-mono"
                      style={{ fontSize: 10, color: "rgba(0,0,0,0.25)" }}
                    >
                      No data
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Row 3: Metrics Strip (4-col) ── */}
          <div
            className="grid grid-cols-2 md:grid-cols-4"
            style={{ gap: 1, backgroundColor: "rgba(0,0,0,0.06)" }}
          >
            <MetricCard
              label="Affected Vaults"
              value={summary.vaultCount}
              format="number"
            />
            <MetricCard
              label="Protocols Impacted"
              value={summary.protocolCount}
              format="number"
            />
            <MetricCard
              label="Covering"
              value={summary.coveringCount}
              format="number"
            />
            <MetricCard
              label="Highest Exposure %"
              value={highestPctVault ? highestPctVault.exposurePct * 100 : 0}
              format="percent"
            />
          </div>

          {/* ── Row 4: Exposure by Protocol | Timeline ── */}
          <div
            className="grid grid-cols-1 md:grid-cols-2"
            style={{ gap: 1, backgroundColor: "rgba(0,0,0,0.06)" }}
          >
            {/* Exposure by Protocol */}
            <div className="bg-white px-5 py-4">
              {panelHeader("Exposure by Protocol")}
              <div className="space-y-1">
                {sortedProtocols.map(([protocol, data]) => {
                  const display = PROTOCOL_DISPLAY[protocol] ?? {
                    color: "#888",
                    initials: protocol.slice(0, 2).toUpperCase(),
                  };
                  const protocolBreakdown = vaults
                    .filter((ve) => ve.vault.protocol === protocol)
                    .flatMap((ve) => ve.breakdown)
                    .reduce<ToxicBreakdownEntry[]>((acc, b) => {
                      const existing = acc.find((e) => e.asset === b.asset);
                      if (existing) {
                        existing.amountUsd += b.amountUsd;
                        existing.pct += b.pct;
                      } else {
                        acc.push({ ...b });
                      }
                      return acc;
                    }, []);

                  return (
                    <div key={protocol}>
                      <ProtocolRow
                        name={capitalize(protocol)}
                        logoSrc={`/logos/protocols/${protocol}.svg`}
                        fallbackInitials={display.initials}
                        fallbackColor={display.color}
                        meta={`${data.vaultCount} vault${data.vaultCount !== 1 ? "s" : ""}`}
                        amount={formatUsdCompact(data.exposureUsd)}
                        exposureBar={protocolBreakdown.map((b) => ({
                          color:
                            assetColorBySymbol[b.asset] ?? "rgba(0,0,0,0.15)",
                          width: `${Math.min(b.pct * 100, 100)}%`,
                        }))}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-white px-5 py-4">
              {panelHeader("Timeline")}
              <TimelinePanel entries={timelineEntries} />
            </div>
          </div>

          {/* ── Row 5: Vault Table (full-width) ── */}
          <div className="bg-white px-5 py-4">
            {panelHeader("All Affected Vaults")}
            <VaultTable
              vaults={vaults}
              toxicAssets={config.toxicAssets}
              slug={slug}
            />
          </div>

          {/* ── Footer ── */}
          <div className="bg-white mt-px px-5 py-3 flex justify-between text-[8px] font-semibold text-black/15 uppercase tracking-wide">
            <span>
              Exposure Core · Data refreshed every 10 min · Last update:{" "}
              {timestamp}
            </span>
            <span>Approximate data · Verify with each protocol</span>
          </div>
        </div>
      </div>
    </div>
  );
}
