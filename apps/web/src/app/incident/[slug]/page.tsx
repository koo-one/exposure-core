import { notFound } from "next/navigation";
import Link from "next/link";
import { loadIncidentConfig } from "@/lib/incident/config";
import { detectToxicExposure } from "@/lib/incident/detection";
import { loadProtocolSnapshots } from "@/lib/graphLoader";
import { inferProtocolFolderFromNodeId } from "@/lib/blobPaths";
import type {
  AdapterVault,
  IncidentSummary,
  VaultExposure,
  ToxicBreakdownEntry,
} from "@/lib/incident/types";
import type { GraphSnapshot } from "@/types";
import { NarrativeSection } from "@/components/incident/NarrativeSection";
import { StatusBadge } from "@/components/incident/StatusBadge";
import { ExposureBar } from "@/components/incident/ExposureBar";
import { AnimatedCounter } from "@/components/incident/AnimatedCounter";

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

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
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

export default async function IncidentNarrativePage({
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

  // Timeline in reverse chronological order
  const reversedTimeline = [...config.timeline].reverse();

  // Vaults with covering status
  const coveringVaults = vaults.filter((ve) => ve.vault.status === "covering");

  return (
    <div className="max-w-3xl mx-auto px-6">
      {/* Section 01 — What Happened */}
      <NarrativeSection number="01" title="What Happened">
        <div className="flex items-center gap-3 mb-4">
          <StatusBadge
            status={config.status === "active" ? "affected" : "covering"}
          />
          <span className="text-sm text-white/35">
            {formatDate(config.incidentDate)}
          </span>
        </div>
        <p className="text-lg text-white/70 leading-relaxed">
          {config.description}
        </p>
      </NarrativeSection>

      {/* Section 02 — Scale */}
      <NarrativeSection number="02" title="Scale">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="text-5xl md:text-7xl font-mono font-bold text-white">
              <AnimatedCounter
                target={summary.totalToxicExposureUsd}
                format="usd"
              />
            </div>
            <p className="mt-2 text-sm text-white/35 uppercase tracking-wider">
              Total at-risk allocation
            </p>
          </div>
          <div>
            <div className="text-5xl md:text-7xl font-mono font-bold text-white">
              <AnimatedCounter target={summary.vaultCount} format="number" />
            </div>
            <p className="mt-2 text-sm text-white/35 uppercase tracking-wider">
              Affected vaults
            </p>
          </div>
          <div>
            <div className="text-5xl md:text-7xl font-mono font-bold text-white">
              <AnimatedCounter target={summary.protocolCount} format="number" />
            </div>
            <p className="mt-2 text-sm text-white/35 uppercase tracking-wider">
              Protocols impacted
            </p>
          </div>
        </div>
      </NarrativeSection>

      {/* Section 03 — Who's Affected */}
      <NarrativeSection number="03" title="Who's Affected">
        <div className="space-y-6">
          {sortedProtocols.map(([protocol, data]) => (
            <div key={protocol}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-white">
                  {capitalize(protocol)}
                </span>
                <span className="text-sm text-white/50">
                  {data.vaultCount} vault{data.vaultCount !== 1 ? "s" : ""} ·{" "}
                  {formatUsd(data.exposureUsd)}
                </span>
              </div>
              <ExposureBar
                breakdown={vaults
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
                  }, [])}
                toxicAssets={config.toxicAssets}
                className="mt-1"
              />
            </div>
          ))}
        </div>
        <div className="mt-8">
          <Link
            href={`/incident/${slug}/dashboard`}
            className="text-sm text-white/50 hover:text-white transition-colors"
          >
            View full dashboard →
          </Link>
        </div>
      </NarrativeSection>

      {/* Section 04 — Who's Covering */}
      <NarrativeSection number="04" title="Who's Covering">
        {coveringVaults.length === 0 ? (
          <p className="text-white/70">
            No protocols have announced coverage yet.
          </p>
        ) : (
          <div className="space-y-4">
            {coveringVaults.map((ve, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-4 rounded-lg"
                style={{ backgroundColor: "rgba(16,185,129,0.06)" }}
              >
                <div
                  className="mt-1 h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: "#10b981" }}
                />
                <div>
                  <p className="font-semibold text-white">{ve.vault.name}</p>
                  {ve.vault.statusNote && (
                    <p className="text-sm text-white/70 mt-0.5">
                      {ve.vault.statusNote}
                    </p>
                  )}
                  {ve.vault.statusSource && (
                    <a
                      href={ve.vault.statusSource}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs mt-1 inline-block"
                      style={{ color: "#10b981" }}
                    >
                      Source ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </NarrativeSection>

      {/* Section 05 — What You Can Do */}
      <NarrativeSection number="05" title="What You Can Do">
        <h3 className="text-lg font-semibold text-white mb-3">
          Check if your vault is affected
        </h3>
        <p className="text-white/70 leading-relaxed mb-6">
          Browse the full list of affected vaults, their exposure percentages,
          and the latest protocol status updates.
        </p>
        <Link
          href={`/incident/${slug}/dashboard`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
        >
          View all affected vaults →
        </Link>
      </NarrativeSection>

      {/* Section 06 — Timeline */}
      <NarrativeSection number="06" title="Timeline">
        <div className="relative space-y-6 pl-4 border-l border-white/[0.08]">
          {reversedTimeline.map((entry, i) => (
            <div key={i} className="relative">
              <div
                className="absolute -left-[1.3125rem] top-1 h-2 w-2 rounded-full"
                style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
              />
              <p className="text-xs font-mono text-white/35 mb-1">
                {formatDate(entry.date)}
              </p>
              <p className="text-white/70 leading-relaxed">{entry.text}</p>
            </div>
          ))}
        </div>
      </NarrativeSection>

      {/* Section 07 — Data Source */}
      <NarrativeSection number="07" title="Data Source">
        <p className="text-white/70 leading-relaxed mb-2">
          Powered by Exposure Core
        </p>
        <p className="text-white/50 text-sm mb-4">
          Data reflects on-chain allocations as of{" "}
          {formatDate(summary.dataTimestamp)}.
        </p>
        <p className="text-xs text-white/20 leading-relaxed">
          Exposure data is derived from on-chain graph snapshots and may not
          reflect real-time positions. Figures are estimates and should not be
          used as financial advice. Always verify with the protocol directly.
        </p>
      </NarrativeSection>
    </div>
  );
}
