import { notFound } from "next/navigation";
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
import { MetricCard } from "@/components/incident/MetricCard";
import { ExposureChart } from "@/components/incident/ExposureChart";
import { VaultTable } from "@/components/incident/VaultTable";

export const revalidate = 600;

// Stable palette for protocols/chains not covered by toxicAsset colors
const CHART_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#ef4444",
  "#a855f7",
  "#84cc16",
];

function assignColors(keys: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  keys.forEach((k, i) => {
    map[k] = CHART_COLORS[i % CHART_COLORS.length];
  });
  return map;
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

export default async function DashboardPage({
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

  // Build chart data
  const protocolKeys = Object.keys(summary.byProtocol);
  const protocolColors = assignColors(protocolKeys);
  const byProtocolData = protocolKeys
    .map((k) => ({
      name: k.charAt(0).toUpperCase() + k.slice(1),
      value: summary.byProtocol[k].exposureUsd,
      color: protocolColors[k],
    }))
    .sort((a, b) => b.value - a.value);

  // Use toxicAsset colors for byAsset
  const assetColorMap = Object.fromEntries(
    config.toxicAssets.map((a) => [a.symbol, a.color]),
  );
  const chainKeys = Object.keys(summary.byChain);
  const chainFallbackColors = assignColors(chainKeys);
  const byAssetData = Object.entries(summary.byAsset)
    .map(([symbol, { exposureUsd }]) => ({
      name: symbol,
      value: exposureUsd,
      color: assetColorMap[symbol] ?? "#6366f1",
    }))
    .sort((a, b) => b.value - a.value);

  const byChainData = chainKeys
    .map((k) => ({
      name: k.toUpperCase(),
      value: summary.byChain[k].exposureUsd,
      color: chainFallbackColors[k],
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Headline metrics strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Total at-risk allocation"
          value={summary.totalToxicExposureUsd}
          format="usd"
        />
        <MetricCard
          label="Affected vaults"
          value={summary.vaultCount}
          format="number"
        />
        <MetricCard
          label="Protocols impacted"
          value={summary.protocolCount}
          format="number"
        />
        <MetricCard
          label="Covering bad debt"
          value={summary.coveringCount}
          format="number"
        />
      </div>

      {/* Charts section */}
      <div
        className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 rounded-xl p-5"
        style={{
          backgroundColor: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <ExposureChart title="By Protocol" data={byProtocolData} />
        <ExposureChart title="By Toxic Asset" data={byAssetData} />
        <ExposureChart title="By Chain" data={byChainData} />
      </div>

      {/* Vault table */}
      <VaultTable
        vaults={vaults}
        toxicAssets={config.toxicAssets}
        slug={slug}
      />
    </div>
  );
}
