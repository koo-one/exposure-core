import { notFound } from "next/navigation";
import Link from "next/link";
import { loadIncidentConfig } from "@/lib/incident/config";
import { detectToxicExposure } from "@/lib/incident/detection";
import { loadProtocolSnapshots } from "@/lib/graphLoader";
import { inferProtocolFolderFromNodeId } from "@/lib/blobPaths";
import type {
  AdapterVault,
  VaultExposure,
  ToxicBreakdownEntry,
} from "@/lib/incident/types";
import { slugifyVaultName } from "@/lib/incident/types";
import type { GraphSnapshot } from "@/types";
import { StatusBadge } from "@/components/incident/StatusBadge";
import { ExposureBar } from "@/components/incident/ExposureBar";
import { getCuratorLogoKey } from "@/components/incident/ProtocolRow";

export const revalidate = 600;

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

function exposureColor(pct: number): string {
  if (pct === 0) return "#22c55e";
  if (pct < 0.05) return "#f59e0b";
  if (pct < 0.15) return "#f97316";
  return "#E11D48";
}

async function loadVaultData(
  slug: string,
  id: string,
): Promise<{ vaultExposure: VaultExposure; slugParam: string } | null> {
  const config = await loadIncidentConfig(slug);
  if (!config) return null;

  const toxicSymbols = config.toxicAssets.map((a) => a.symbol);

  // Find the matching vault by slugified name
  const matchedVault = config.affectedVaults.find(
    (v) => slugifyVaultName(v.name) === id,
  );
  if (!matchedVault) return null;

  // If manual vault, no snapshot loading needed
  if (matchedVault.source === "manual") {
    const vaultExposure: VaultExposure = {
      vault: matchedVault,
      status: matchedVault.exposureUsd > 0 ? "loaded" : "pending",
      totalAllocationUsd: matchedVault.exposureUsd,
      toxicExposureUsd: matchedVault.exposureUsd,
      exposurePct: matchedVault.exposureUsd > 0 ? 1 : 0,
      breakdown: matchedVault.toxicAssetBreakdown,
    };
    return { vaultExposure, slugParam: slug };
  }

  // Adapter vault — load snapshots
  const adapterVault = matchedVault as AdapterVault;
  const protocolFolders = new Set<string>();
  for (const nodeId of Object.values(adapterVault.nodeIds)) {
    const folder = inferProtocolFolderFromNodeId(nodeId);
    if (folder) protocolFolders.add(folder);
  }

  const snapshotsByProtocol = new Map<string, Record<string, GraphSnapshot>>();
  await Promise.all(
    Array.from(protocolFolders).map(async (folder) => {
      const snapshots = await loadProtocolSnapshots(folder);
      snapshotsByProtocol.set(folder, snapshots);
    }),
  );

  let totalAlloc = 0;
  let totalToxic = 0;
  const assetTotals = new Map<string, number>();
  const allToxicAllocations: VaultExposure["toxicAllocations"] = [];
  const chainBreakdown: NonNullable<VaultExposure["chainBreakdown"]> = {};
  let anyLoaded = false;

  for (const [chain, nodeId] of Object.entries(adapterVault.nodeIds)) {
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
        assetTotals.set(b.asset, (assetTotals.get(b.asset) ?? 0) + b.amountUsd);
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

  const vaultExposure: VaultExposure = {
    vault: adapterVault,
    status: anyLoaded ? "loaded" : "pending",
    totalAllocationUsd: totalAlloc,
    toxicExposureUsd: totalToxic,
    exposurePct: totalAlloc > 0 ? totalToxic / totalAlloc : 0,
    breakdown,
    chainBreakdown:
      Object.keys(chainBreakdown).length > 0 ? chainBreakdown : undefined,
    toxicAllocations:
      allToxicAllocations.length > 0 ? allToxicAllocations : undefined,
  };

  return { vaultExposure, slugParam: slug };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const config = await loadIncidentConfig(slug);
  if (!config) return {};

  const matchedVault = config.affectedVaults.find(
    (v) => slugifyVaultName(v.name) === id,
  );
  if (!matchedVault) return {};

  // Compute exposure pct for OG
  const result = await loadVaultData(slug, id);
  const exposurePct = result
    ? (result.vaultExposure.exposurePct * 100).toFixed(1)
    : "?";

  const title = `${matchedVault.name} — ${exposurePct}% Exposure`;
  const description = `${matchedVault.name} has ${exposurePct}% toxic exposure in the ${config.title} incident.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
  };
}

export default async function VaultDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;

  const config = await loadIncidentConfig(slug);
  if (!config) notFound();

  const result = await loadVaultData(slug, id);
  if (!result) notFound();

  const { vaultExposure } = result;
  const vault = vaultExposure.vault;
  const isPending = vaultExposure.status === "pending";
  const pctDisplay = (vaultExposure.exposurePct * 100).toFixed(1);
  const color = exposureColor(vaultExposure.exposurePct);

  const assetColorBySymbol = Object.fromEntries(
    config.toxicAssets.map((a) => [a.symbol, a.color]),
  );

  // For the "View full allocation graph" link, get first nodeId from adapter vault
  const firstNodeId =
    vault.source === "adapter"
      ? Object.values((vault as AdapterVault).nodeIds)[0]
      : null;

  // Curator logo
  const curatorLogoKey = vault.curator
    ? getCuratorLogoKey(vault.curator)
    : null;

  // Panel header helper
  const panelHeader = (title: string) => (
    <div className="text-[8px] font-black text-black/30 tracking-[0.3em] uppercase mb-3 pb-2 border-b border-black/[0.04]">
      {title}
    </div>
  );

  return (
    <div className="bg-gray-50 min-h-screen">
      <div
        className="flex flex-col"
        style={{ gap: 1, backgroundColor: "rgba(0,0,0,0.06)" }}
      >
        {/* ── Section 1: Hero ── */}
        <div className="bg-white px-5 py-6">
          {/* Vault name */}
          <h1 className="text-2xl font-bold text-black mb-3">{vault.name}</h1>

          {/* Protocol + chain badges row */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {/* Protocol logo + name */}
            <div className="flex items-center gap-1.5">
              <img
                src={`/logos/protocols/${vault.protocol}.svg`}
                alt=""
                width={28}
                height={28}
                className="w-7 h-7 rounded-md object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
              <span
                className="font-black capitalize"
                style={{ fontSize: 11, color: "rgba(0,0,0,0.65)" }}
              >
                {capitalize(vault.protocol)}
              </span>
            </div>

            {/* Chain badges */}
            {vault.chains.map((chain) => (
              <span
                key={chain}
                className="rounded-full px-2 py-0.5 font-mono uppercase"
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  backgroundColor: "rgba(0,0,0,0.05)",
                  color: "rgba(0,0,0,0.40)",
                }}
              >
                {chain}
              </span>
            ))}
          </div>

          {/* Curator */}
          {vault.curator && (
            <div className="flex items-center gap-1.5 mb-3">
              {curatorLogoKey && (
                <img
                  src={`/logos/curators/${curatorLogoKey}.svg`}
                  alt=""
                  width={16}
                  height={16}
                  className="w-4 h-4 rounded object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display =
                      "none";
                  }}
                />
              )}
              <span
                style={{
                  fontSize: 10,
                  color: "rgba(0,0,0,0.35)",
                  fontWeight: 500,
                }}
              >
                Curated by {vault.curator}
              </span>
            </div>
          )}

          {/* Status badge */}
          <div className="mb-5">
            <StatusBadge status={vault.status} />
          </div>

          {/* Exposure metrics or pending state */}
          {isPending ? (
            <div
              className="rounded px-4 py-6 text-center"
              style={{
                backgroundColor: "rgba(0,0,0,0.02)",
                border: "1px solid rgba(0,0,0,0.05)",
              }}
            >
              <p
                className="font-mono"
                style={{ fontSize: 11, color: "rgba(0,0,0,0.25)" }}
              >
                Data pending
              </p>
            </div>
          ) : (
            <div>
              {/* Large exposure % */}
              <div
                className="font-mono font-bold leading-none mb-1"
                style={{ fontSize: 48, color }}
              >
                {pctDisplay}%
              </div>
              <p
                className="uppercase font-semibold mb-4"
                style={{
                  fontSize: 9,
                  color: "rgba(0,0,0,0.30)",
                  letterSpacing: "0.12em",
                }}
              >
                at-risk allocation
              </p>

              {/* Exposure bar */}
              <ExposureBar
                breakdown={vaultExposure.breakdown}
                toxicAssets={config.toxicAssets}
                className="mb-2"
              />

              <p
                style={{
                  fontSize: 10,
                  color: "rgba(0,0,0,0.40)",
                  fontWeight: 500,
                }}
              >
                of {formatUsd(vaultExposure.totalAllocationUsd)} total
                allocation
              </p>
            </div>
          )}
        </div>

        {/* ── Section 2: Collateral Markets ── */}
        <div className="bg-white px-5 py-4">
          {panelHeader("Collateral Markets")}
          {vaultExposure.toxicAllocations &&
          vaultExposure.toxicAllocations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th
                      className="text-left pb-2 whitespace-nowrap"
                      style={{
                        fontSize: 8,
                        fontWeight: 800,
                        color: "rgba(0,0,0,0.25)",
                        textTransform: "uppercase",
                        letterSpacing: "0.15em",
                        borderBottom: "1px solid rgba(0,0,0,0.04)",
                        paddingBottom: 6,
                      }}
                    >
                      Market Name
                    </th>
                    <th
                      className="text-left pl-4 pb-2 whitespace-nowrap"
                      style={{
                        fontSize: 8,
                        fontWeight: 800,
                        color: "rgba(0,0,0,0.25)",
                        textTransform: "uppercase",
                        letterSpacing: "0.15em",
                        borderBottom: "1px solid rgba(0,0,0,0.04)",
                        paddingBottom: 6,
                      }}
                    >
                      Chain
                    </th>
                    <th
                      className="text-left pl-4 pb-2 whitespace-nowrap"
                      style={{
                        fontSize: 8,
                        fontWeight: 800,
                        color: "rgba(0,0,0,0.25)",
                        textTransform: "uppercase",
                        letterSpacing: "0.15em",
                        borderBottom: "1px solid rgba(0,0,0,0.04)",
                        paddingBottom: 6,
                      }}
                    >
                      Toxic Asset
                    </th>
                    <th
                      className="text-right pl-4 pb-2 whitespace-nowrap"
                      style={{
                        fontSize: 8,
                        fontWeight: 800,
                        color: "rgba(0,0,0,0.25)",
                        textTransform: "uppercase",
                        letterSpacing: "0.15em",
                        borderBottom: "1px solid rgba(0,0,0,0.04)",
                        paddingBottom: 6,
                      }}
                    >
                      At-Risk $
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {vaultExposure.toxicAllocations.map((alloc, i) => (
                    <tr
                      key={i}
                      style={{ borderBottom: "1px solid rgba(0,0,0,0.03)" }}
                    >
                      <td
                        className="py-2.5 pr-4 font-medium text-black"
                        style={{ fontSize: 11 }}
                      >
                        {alloc.nodeName}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className="rounded px-1.5 py-0.5 font-mono uppercase"
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            backgroundColor: "rgba(0,0,0,0.04)",
                            color: "rgba(0,0,0,0.40)",
                          }}
                        >
                          {alloc.chain}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className="font-mono font-bold uppercase"
                          style={{
                            fontSize: 10,
                            color:
                              assetColorBySymbol[alloc.asset] ??
                              "rgba(0,0,0,0.50)",
                          }}
                        >
                          {alloc.asset}
                        </span>
                      </td>
                      <td
                        className="py-2.5 pl-4 text-right font-mono font-bold"
                        style={{ fontSize: 11, color: "rgba(0,0,0,0.65)" }}
                      >
                        {formatUsd(alloc.allocationUsd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p
              className="font-mono"
              style={{ fontSize: 11, color: "rgba(0,0,0,0.25)" }}
            >
              No detailed allocation data available.
            </p>
          )}
        </div>

        {/* ── Section 3: Protocol Response ── */}
        {vault.statusNote && (
          <div className="bg-white px-5 py-4">
            {panelHeader("Protocol Response")}
            <div
              className="rounded p-5"
              style={
                vault.status === "covering"
                  ? {
                      backgroundColor: "rgba(0,163,92,0.03)",
                      border: "1px solid rgba(0,163,92,0.10)",
                    }
                  : {
                      backgroundColor: "rgba(0,0,0,0.02)",
                      border: "1px solid rgba(0,0,0,0.05)",
                    }
              }
            >
              {vault.status === "covering" && (
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: "#00A35C" }}
                  />
                  <span
                    className="font-black uppercase"
                    style={{
                      fontSize: 8,
                      letterSpacing: "0.15em",
                      color: "#00A35C",
                    }}
                  >
                    Covering bad debt
                  </span>
                </div>
              )}
              <p
                className="leading-relaxed"
                style={{ fontSize: 12, color: "rgba(0,0,0,0.65)" }}
              >
                {vault.statusNote}
              </p>
              {vault.statusSource && (
                <a
                  href={vault.statusSource}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-3 transition-opacity hover:opacity-70"
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color:
                      vault.status === "covering"
                        ? "#00A35C"
                        : "rgba(0,0,0,0.40)",
                  }}
                >
                  View announcement →
                </a>
              )}
            </div>
          </div>
        )}

        {/* ── Section 4: Navigation ── */}
        <div className="bg-white px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <Link
            href={`/incident/${slug}`}
            className="transition-opacity hover:opacity-60"
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(0,0,0,0.40)",
            }}
          >
            ← Back to overview
          </Link>
          {firstNodeId && (
            <Link
              href={`/asset/${encodeURIComponent(firstNodeId)}`}
              className="transition-opacity hover:opacity-60"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "rgba(0,0,0,0.40)",
              }}
            >
              View full allocation →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
