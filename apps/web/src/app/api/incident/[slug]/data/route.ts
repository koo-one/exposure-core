import { NextResponse } from "next/server";
import { loadIncidentConfig } from "@/lib/incident/config";
import { detectToxicExposure } from "@/lib/incident/detection";
import { loadProtocolSnapshots } from "@/lib/graphLoader";
import { inferProtocolFolderFromNodeId } from "@/lib/blobPaths";
import type {
  AdapterVault,
  IncidentDataResponse,
  IncidentSummary,
  VaultExposure,
  ToxicBreakdownEntry,
} from "@/lib/incident/types";
import type { GraphSnapshot } from "@/types";

export const runtime = "nodejs";
export const revalidate = 600; // 10 minutes, matching cron frequency

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;

  const config = await loadIncidentConfig(slug);
  if (!config) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }

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

  // Load each protocol file once (2 fetches for 37 vaults, not 37 fetches)
  const snapshotsByProtocol = new Map<string, Record<string, GraphSnapshot>>();
  await Promise.all(
    Array.from(protocolFolders).map(async (folder) => {
      const snapshots = await loadProtocolSnapshots(folder);
      snapshotsByProtocol.set(folder, snapshots);
    }),
  );

  // Process each vault
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

    // Adapter vault: run detection per chain, aggregate
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

  // Compute summary
  const summary = computeSummary(vaults, config);

  const response: IncidentDataResponse = { config, vaults, summary };
  return NextResponse.json(response);
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

    // By protocol
    const p = (byProtocol[ve.vault.protocol] ??= {
      exposureUsd: 0,
      vaultCount: 0,
    });
    p.exposureUsd += ve.toxicExposureUsd;
    p.vaultCount += 1;

    // By asset
    for (const b of ve.breakdown) {
      const a = (byAsset[b.asset] ??= { exposureUsd: 0 });
      a.exposureUsd += b.amountUsd;
    }

    // By chain
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
