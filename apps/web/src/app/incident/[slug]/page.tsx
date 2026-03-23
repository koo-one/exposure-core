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
import {
  ToxicAssetDonut,
  type DonutEntry,
} from "@/components/incident/ToxicAssetDonut";

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
  yo: { color: "#6366f1", initials: "YO" },
  venus: { color: "#f59e0b", initials: "V" },
  "lista-dao": { color: "#3b82f6", initials: "L" },
  upshift: { color: "#8b5cf6", initials: "U" },
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
      const totalTvl = vault.totalTvlUsd ?? vault.exposureUsd;
      vaults.push({
        vault,
        status: vault.exposureUsd > 0 ? "loaded" : "pending",
        totalAllocationUsd: totalTvl,
        toxicExposureUsd: vault.exposureUsd,
        exposurePct: totalTvl > 0 ? vault.exposureUsd / totalTvl : 0,
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

  // Donut chart data
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
  const donutEntries: DonutEntry[] = assetEntries.map(
    ([symbol, { exposureUsd }]) => ({
      symbol,
      exposureUsd,
      color: assetColorBySymbol[symbol] ?? "#999",
      iconPath: tokenIconPath(symbol),
    }),
  );

  // Static timeline entries for TimelinePanel (tagged)
  const timelineEntries = [
    {
      date: "Mar 22, 2026",
      tag: "exploit" as const,
      text: "USR depegs following Resolv Labs exploit; price drops to $0.58.",
      details: {
        description:
          "An attacker exploited a vulnerability in Resolv Labs, minting ~80M unbacked USR tokens and extracting ~$25M. The USR stablecoin lost its peg, dropping from $1.00 to $0.58 within hours.",
        tweets: [
          {
            author: "Resolv Labs",
            handle: "@ResolvLabs",
            text: "We are aware of an exploit affecting USR. Our team is investigating and working with security partners. Withdrawals are paused.",
            url: "https://x.com/ResolvLabs",
          },
        ],
        links: [
          {
            label: "The Block — USR Depeg Report",
            url: "https://www.theblock.co/post/394582/resolvs-usr-stablecoin-depegs",
          },
        ],
      },
    },
    {
      date: "Mar 22, 2026",
      tag: "curator" as const,
      text: "Gauntlet pauses deposits across affected Morpho vaults as a precautionary measure.",
      details: {
        description:
          "Gauntlet acted swiftly to pause deposits on all Morpho vaults with USR/wstUSR/RLP collateral exposure, preventing additional capital from entering at-risk positions.",
        actions: [
          {
            protocol: "morpho",
            action: "Pause deposits",
            market: "Gauntlet USDC Core, Gauntlet USDC Frontier",
          },
        ],
      },
    },
    {
      date: "Mar 22, 2026",
      tag: "response" as const,
      text: "Inverse Finance announces coverage of DOLA bad debt from the exploit.",
      details: {
        description:
          "Inverse Finance committed to covering all bad debt accrued in the DOLA market from the USR exploit, protecting DOLA depositors from losses.",
        tweets: [
          {
            author: "Inverse Finance",
            handle: "@InverseFinance",
            text: "We will cover all bad debt from the USR exploit in the DOLA market. DOLA holders are safe.",
            url: "https://x.com/InverseFinance",
          },
        ],
      },
    },
    {
      date: "Mar 22, 2026",
      tag: "curator" as const,
      text: "Re7 Labs reduces USR allocation in Re7 USDC vault on Base.",
      details: {
        actions: [
          {
            protocol: "morpho",
            action: "Reduce USR allocation",
            market: "Re7 USDC (Base)",
          },
        ],
      },
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
            <PriceChart />
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
                realizedDebt={0}
                coveredDebt={0}
                uncoveredGap={0}
                recoveryRate={0}
                coveringProtocols={coveringProtocolsList}
              />
            </div>

            {/* Donut by Toxic Asset */}
            <div className="bg-white px-5 py-4">
              {panelHeader("By Toxic Asset")}
              <ToxicAssetDonut
                entries={donutEntries}
                total={totalAssetExposure}
              />
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
            <VaultTable vaults={vaults} toxicAssets={config.toxicAssets} />
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
