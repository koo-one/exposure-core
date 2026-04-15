"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Activity } from "lucide-react";

import { type SearchIndexEntry } from "@/constants";
import { useAssetData } from "@/hooks/useAssetData";
import { buildAssetGraphHref, resolveKnownIncidentSlug } from "@/lib/dashboard";
import { getDirectChildren } from "@/lib/graph";
import { getNodeLogos } from "@/lib/logos";
import {
  buildEntriesByAddress,
  canonicalizeNodeId,
  canonicalizeProtocolToken,
  resolveGraphTargetEntry,
} from "@/lib/nodeId";
import { prepareSearchIndex } from "@/lib/search";
import { formatTitleLabel } from "@/utils/formatters";
import type { GraphAllocationPreview, GraphEdge, GraphNode } from "@/types";
import { IncidentNav } from "@/components/incident/IncidentNav";
import type { PriceChartAsset } from "@/components/incident/PriceChart";
import type { TimelineEntry } from "@/components/incident/TimelinePanel";
import { type DonutEntry } from "@/components/incident/ToxicAssetDonut";
import { type RadarEntry } from "@/components/incident/DistributionRadar";
import { ProtocolRow } from "@/components/incident/ProtocolRow";
import {
  ExposureDashboardBody,
  type DashboardProtocolRow,
} from "@/components/incident/ExposureDashboardBody";
import { formatUsdCompact } from "@/lib/incident/format";
import {
  getChainDisplayName,
  getChainIcon,
  getEntityInitials,
  getCuratorIcon,
  getProtocolDisplay,
  getProtocolIcon,
} from "@/lib/incident/logos";
import type {
  IncidentSummary,
  ManualVault,
  ToxicBreakdownEntry,
  VaultExposure,
} from "@/lib/incident/types";

const BUCKET_COLORS = [
  "#5792ff",
  "#c4daff",
  "#e89220",
  "#00A35C",
  "#E11D48",
  "#7c3aed",
  "#0ea5e9",
  "#f59e0b",
];

const DEFAULT_TVL_FALLBACK = 1;

const normalizeKey = (value: string | null | undefined): string =>
  (value ?? "").trim().toLowerCase();

const slugifyToken = (value: string | null | undefined): string =>
  normalizeKey(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const formatUtcTimelineDate = (date: Date): string => {
  const datePart = date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
  const timePart = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });

  return `${datePart} · ${timePart} UTC`;
};

const formatBannerDate = (date: Date): string =>
  date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

const computeGraphDepth = (rootId: string | undefined, edges: GraphEdge[]) => {
  if (!rootId) return 0;

  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    const list = outgoing.get(edge.from);
    if (list) list.push(edge.to);
    else outgoing.set(edge.from, [edge.to]);
  }

  const visited = new Set<string>();
  const queue: { id: string; depth: number }[] = [{ id: rootId, depth: 0 }];
  let maxDepth = 0;

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    if (visited.has(current.id)) continue;

    visited.add(current.id);
    maxDepth = Math.max(maxDepth, current.depth);

    for (const nodeId of outgoing.get(current.id) ?? []) {
      if (!visited.has(nodeId)) {
        queue.push({ id: nodeId, depth: current.depth + 1 });
      }
    }
  }

  return maxDepth;
};

const computeSummary = (vaults: VaultExposure[]): IncidentSummary => {
  const byProtocol: IncidentSummary["byProtocol"] = {};
  const byAsset: IncidentSummary["byAsset"] = {};
  const byChain: IncidentSummary["byChain"] = {};
  let totalTvl = 0;
  let totalExposure = 0;
  const protocols = new Set<string>();

  for (const vault of vaults) {
    totalTvl += vault.totalAllocationUsd;
    totalExposure += vault.toxicExposureUsd;
    protocols.add(vault.vault.protocol);

    const protocolBucket = (byProtocol[vault.vault.protocol] ??= {
      exposureUsd: 0,
      vaultCount: 0,
    });
    protocolBucket.exposureUsd += vault.toxicExposureUsd;
    protocolBucket.vaultCount += 1;

    for (const breakdown of vault.breakdown) {
      const assetBucket = (byAsset[breakdown.asset] ??= { exposureUsd: 0 });
      assetBucket.exposureUsd += breakdown.amountUsd;
    }

    for (const chain of vault.vault.chains) {
      const chainBucket = (byChain[chain] ??= {
        exposureUsd: 0,
        vaultCount: 0,
      });
      chainBucket.exposureUsd += vault.toxicExposureUsd;
      chainBucket.vaultCount += 1;
    }
  }

  return {
    totalAffectedTvlUsd: totalTvl,
    totalToxicExposureUsd: totalExposure,
    vaultCount: vaults.length,
    protocolCount: protocols.size,
    coveringCount: 0,
    byProtocol,
    byAsset,
    byChain,
    dataTimestamp: new Date().toISOString(),
  };
};

interface BucketMeta {
  symbol: string;
  name: string;
  color: string;
  iconPath: string | null;
}

type ProtocolRowBreakdown = NonNullable<
  DashboardProtocolRow["breakdown"]
>[number];

export default function AssetDashboardPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const id = params.id as string;
  const chain = searchParams.get("chain") ?? undefined;
  const protocol = searchParams.get("protocol") ?? undefined;

  const canonicalAssetId = useMemo(() => canonicalizeNodeId(id), [id]);
  const canonicalProtocol = useMemo(
    () => (protocol ? canonicalizeProtocolToken(protocol) : undefined),
    [protocol],
  );

  const { graphData, loading, tvl, rootNode } = useAssetData({
    id: canonicalAssetId,
    chain,
    protocol: canonicalProtocol,
  });

  const [dynamicIndex, setDynamicIndex] = useState<SearchIndexEntry[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/search-index");
        if (!response.ok) return;
        const json = (await response.json()) as SearchIndexEntry[];
        if (!Array.isArray(json)) return;
        setDynamicIndex(json);
      } catch {
        /* ignore */
      }
    };

    void load();
  }, []);

  const preparedIndex = useMemo(
    () => prepareSearchIndex(dynamicIndex),
    [dynamicIndex],
  );
  const activeRootEntry = useMemo(() => {
    return preparedIndex.find(
      (entry) => entry.normalizedId === canonicalAssetId,
    );
  }, [canonicalAssetId, preparedIndex]);

  const knownIncidentSlug = useMemo(() => {
    const target = activeRootEntry
      ? {
          id: activeRootEntry.id,
          chain: activeRootEntry.chain,
          protocol: activeRootEntry.protocol,
          name: activeRootEntry.name,
          displayName: activeRootEntry.displayName,
          logoKeys: activeRootEntry.logoKeys ?? null,
        }
      : rootNode
        ? {
            id: rootNode.id,
            chain: rootNode.chain,
            protocol: rootNode.protocol,
            name: rootNode.name,
            displayName: rootNode.displayName,
            logoKeys: rootNode.logoKeys ?? null,
          }
        : null;

    return target ? resolveKnownIncidentSlug(target) : null;
  }, [activeRootEntry, rootNode]);

  useEffect(() => {
    if (!loading && knownIncidentSlug) {
      router.replace(`/incident/${knownIncidentSlug}`);
    }
  }, [knownIncidentSlug, loading, router]);

  const dashboardLabel =
    activeRootEntry?.displayName ??
    rootNode?.displayName ??
    activeRootEntry?.name ??
    rootNode?.name ??
    id;
  const graphHref = buildAssetGraphHref({
    id: canonicalAssetId,
    chain,
    protocol: canonicalProtocol ?? protocol,
  });

  const pageData = useMemo(() => {
    if (!graphData || !rootNode) return null;

    const nodesById = new Map<string, GraphNode>(
      graphData.nodes.map((node) => [node.id, node]),
    );
    const nestedAllocationsByNodeId = new Map<string, GraphAllocationPreview[]>(
      Object.entries(graphData.nestedAllocations ?? {}),
    );
    const graphRootIds = new Set(
      preparedIndex.map((entry) => entry.normalizedId),
    );
    const graphRootEntriesByAddress = buildEntriesByAddress(preparedIndex);
    const rootChildren = getDirectChildren(
      rootNode,
      graphData.nodes,
      graphData.edges,
    );
    const rootTargetId = canonicalizeNodeId(canonicalAssetId);
    const bucketRegistry = new Map<string, BucketMeta>();
    let nextColorIndex = 0;

    const ensureBucket = (
      label: string,
      iconPath: string | null,
    ): BucketMeta => {
      const key = normalizeKey(label);
      const existing = bucketRegistry.get(key);
      if (existing) return existing;

      const bucket: BucketMeta = {
        symbol: label,
        name: label,
        color: BUCKET_COLORS[nextColorIndex % BUCKET_COLORS.length],
        iconPath,
      };
      nextColorIndex += 1;
      bucketRegistry.set(key, bucket);
      return bucket;
    };

    const vaults: VaultExposure[] = rootChildren.map((child) => {
      const childNode = child.node;
      const childProtocol = normalizeKey(childNode?.protocol) || "unknown";
      const childChain = normalizeKey(childNode?.chain) || "global";
      const resolvedTarget = childNode
        ? resolveGraphTargetEntry(
            childNode,
            graphRootIds,
            graphRootEntriesByAddress,
          )
        : null;
      const connectedRootId = resolvedTarget
        ? canonicalizeNodeId(resolvedTarget.id)
        : "";

      const nestedAllocations =
        nestedAllocationsByNodeId.get(child.id) ??
        graphData.edges
          .filter((edge) => edge.from === child.id)
          .map((edge) => ({
            id: edge.to,
            name:
              nodesById.get(edge.to)?.displayName ??
              nodesById.get(edge.to)?.name ??
              edge.to,
            value: Math.abs(edge.allocationUsd),
            node: nodesById.get(edge.to),
          }))
          .sort((a, b) => b.value - a.value);

      const sortedNestedAllocations = nestedAllocations
        .filter(
          (allocation) =>
            Number.isFinite(allocation.value) && allocation.value > 0,
        )
        .sort((a, b) => b.value - a.value);

      const topAllocations = sortedNestedAllocations.slice(0, 3);
      const topTotal = topAllocations.reduce(
        (sum, allocation) => sum + allocation.value,
        0,
      );
      const remainingValue = Math.max(0, child.value - topTotal);

      const breakdown: ToxicBreakdownEntry[] = topAllocations.map(
        (allocation) => {
          const label =
            allocation.node?.displayName ??
            allocation.node?.name ??
            allocation.name;
          const iconPath = allocation.node
            ? (getNodeLogos(allocation.node)[0] ?? null)
            : null;
          const bucket = ensureBucket(label, iconPath);

          return {
            asset: bucket.symbol,
            amountUsd: allocation.value,
            pct: child.value > 0 ? allocation.value / child.value : 0,
          };
        },
      );

      if (remainingValue > 0) {
        const otherBucket = ensureBucket("Other", null);
        breakdown.push({
          asset: otherBucket.symbol,
          amountUsd: remainingValue,
          pct: child.value > 0 ? remainingValue / child.value : 0,
        });
      }

      if (breakdown.length === 0) {
        const fallbackBucket = ensureBucket(
          childNode?.displayName ?? childNode?.name ?? child.id,
          childNode ? (getNodeLogos(childNode)[0] ?? null) : null,
        );
        breakdown.push({
          asset: fallbackBucket.symbol,
          amountUsd: child.value,
          pct: 1,
        });
      }

      const totalAllocationUsd = Math.max(
        child.value,
        childNode?.tvlUsd ?? 0,
        DEFAULT_TVL_FALLBACK,
      );

      const manualVault: ManualVault = {
        source: "manual",
        name: childNode?.displayName ?? childNode?.name ?? child.id,
        protocol: childProtocol,
        chains: [childChain],
        curator: childNode?.details?.curator ?? undefined,
        status:
          connectedRootId && connectedRootId !== rootTargetId
            ? "covering"
            : "affected",
        totalTvlUsd: totalAllocationUsd,
        exposureUsd: child.value,
        toxicAssetBreakdown: breakdown,
      };

      return {
        vault: manualVault,
        status: "loaded",
        totalAllocationUsd,
        toxicExposureUsd: child.value,
        exposurePct:
          totalAllocationUsd > 0
            ? Math.min(1, child.value / totalAllocationUsd)
            : 0,
        breakdown,
      };
    });

    const summary = computeSummary(vaults);
    const toxicAssets = Array.from(bucketRegistry.values()).map((bucket) => ({
      symbol: bucket.symbol,
      name: bucket.name,
      color: bucket.color,
    }));
    const bucketBySymbol = new Map<string, BucketMeta>(
      Array.from(bucketRegistry.values()).map((bucket) => [
        bucket.symbol,
        bucket,
      ]),
    );

    const assetEntries = Object.entries(summary.byAsset).sort(
      ([, left], [, right]) => right.exposureUsd - left.exposureUsd,
    );
    const donutEntries: DonutEntry[] = assetEntries.map(([symbol, entry]) => {
      const bucket = bucketBySymbol.get(symbol);
      return {
        symbol,
        exposureUsd: entry.exposureUsd,
        color: bucket?.color ?? BUCKET_COLORS[0],
        iconPath: bucket?.iconPath ?? null,
      };
    });

    const aggregateBreakdown = (
      subset: VaultExposure[],
    ): ProtocolRowBreakdown[] => {
      const totals = new Map<string, number>();

      for (const vault of subset) {
        for (const breakdown of vault.breakdown) {
          totals.set(
            breakdown.asset,
            (totals.get(breakdown.asset) ?? 0) + breakdown.amountUsd,
          );
        }
      }

      return Array.from(totals.entries())
        .map(([asset, amountUsd]) => ({
          asset,
          amountUsd,
          color: bucketBySymbol.get(asset)?.color ?? BUCKET_COLORS[0],
        }))
        .sort((left, right) => right.amountUsd - left.amountUsd)
        .slice(0, 4);
    };

    const protocolRows: DashboardProtocolRow[] = Object.entries(
      summary.byProtocol,
    )
      .sort(([, left], [, right]) => right.exposureUsd - left.exposureUsd)
      .map(([protocolKey, entry]) => {
        const display = getProtocolDisplay(protocolKey);
        return {
          name: display.name,
          logoSrc: getProtocolIcon(protocolKey),
          fallbackInitials: display.initials,
          fallbackColor: display.color,
          meta: `${entry.vaultCount} direct leg${entry.vaultCount === 1 ? "" : "s"}`,
          breakdown: aggregateBreakdown(
            vaults.filter((vault) => vault.vault.protocol === protocolKey),
          ),
        };
      });

    const curatorRows: DashboardProtocolRow[] = Array.from(
      vaults
        .reduce(
          (map, vault) => {
            const key = vault.vault.curator?.trim() || vault.vault.protocol;
            const existing = map.get(key) ?? {
              name: key,
              exposureUsd: 0,
              vaults: [] as VaultExposure[],
              protocol: vault.vault.protocol,
            };
            existing.exposureUsd += vault.toxicExposureUsd;
            existing.vaults.push(vault);
            map.set(key, existing);
            return map;
          },
          new Map<
            string,
            {
              name: string;
              exposureUsd: number;
              vaults: VaultExposure[];
              protocol: string;
            }
          >(),
        )
        .values(),
    )
      .sort((left, right) => right.exposureUsd - left.exposureUsd)
      .map((entry) => {
        const display = getProtocolDisplay(entry.protocol);
        return {
          name: entry.name,
          logoSrc:
            getCuratorIcon(entry.name) ?? getProtocolIcon(entry.protocol),
          fallbackInitials: getEntityInitials(entry.name),
          fallbackColor: display.color,
          meta: `${entry.vaults.length} downstream node${entry.vaults.length === 1 ? "" : "s"}`,
          breakdown: aggregateBreakdown(entry.vaults),
        };
      });

    const connectedRootExposureUsd = vaults
      .filter((vault) => vault.vault.status === "covering")
      .reduce((sum, vault) => sum + vault.toxicExposureUsd, 0);
    const coveringProtocols = Array.from(
      vaults.reduce((map, vault) => {
        if (vault.vault.status !== "covering") return map;
        if (!map.has(vault.vault.protocol)) {
          map.set(vault.vault.protocol, {
            name: vault.vault.name,
            protocol: vault.vault.protocol,
          });
        }
        return map;
      }, new Map<string, { name: string; protocol: string }>()),
    ).map(([, value]) => value);
    const connectedRootCount = vaults.filter(
      (vault) => vault.vault.status === "covering",
    ).length;
    const graphDepth = computeGraphDepth(rootNode.id, graphData.edges);
    const topVault = [...vaults].sort(
      (left, right) => right.toxicExposureUsd - left.toxicExposureUsd,
    )[0];
    const topProtocol = protocolRows[0];

    const buildRadarEntries = (
      source: Record<string, { exposureUsd: number; vaultCount: number }>,
      getIcon: (key: string) => string,
      getLabel: (key: string) => string,
    ): RadarEntry[] => {
      const total = Object.values(source).reduce(
        (sum, value) => sum + value.exposureUsd,
        0,
      );

      return Object.entries(source)
        .map(([key, value]) => ({
          name: getLabel(key),
          value: total > 0 ? (value.exposureUsd / total) * 100 : 0,
          iconSrc: getIcon(key),
        }))
        .sort((left, right) => right.value - left.value);
    };

    const protocolRadarEntries = buildRadarEntries(
      summary.byProtocol,
      getProtocolIcon,
      (key) => getProtocolDisplay(key).name,
    );
    const chainRadarEntries = buildRadarEntries(
      summary.byChain,
      getChainIcon,
      getChainDisplayName,
    );

    const now = new Date();
    const timelineEntries: TimelineEntry[] = [
      {
        date: formatUtcTimelineDate(now),
        tag: "update",
        text: `${dashboardLabel} graph snapshot loaded with ${graphData.nodes.length} nodes and ${graphData.edges.length} directed edges.`,
      },
      {
        date: formatUtcTimelineDate(new Date(now.getTime() - 15 * 60 * 1000)),
        tag: "response",
        text: `${connectedRootCount} downstream node${connectedRootCount === 1 ? "" : "s"} resolve to tracked root assets.`,
      },
      {
        date: formatUtcTimelineDate(new Date(now.getTime() - 30 * 60 * 1000)),
        tag: "curator",
        text: `${curatorRows.length} curator bucket${curatorRows.length === 1 ? "" : "s"} identified across direct allocations.`,
      },
      {
        date: formatUtcTimelineDate(new Date(now.getTime() - 45 * 60 * 1000)),
        tag: "update",
        text: topProtocol
          ? `${topProtocol.name} is the dominant downstream protocol in the current snapshot.`
          : "Protocol distribution data unavailable.",
      },
      {
        date: formatUtcTimelineDate(new Date(now.getTime() - 60 * 60 * 1000)),
        tag: "update",
        text: topVault
          ? `${topVault.vault.name} is the single largest direct allocation in this root graph.`
          : "No downstream allocation identified from the current root.",
      },
      {
        date: formatUtcTimelineDate(new Date(now.getTime() - 75 * 60 * 1000)),
        tag: "response",
        text: `Graph depth currently spans ${graphDepth} hop${graphDepth === 1 ? "" : "s"} from the root node.`,
      },
    ];

    const priceAssets: PriceChartAsset[] = [
      {
        id:
          slugifyToken(activeRootEntry?.logoKeys?.[0]) ||
          slugifyToken(activeRootEntry?.displayName) ||
          slugifyToken(activeRootEntry?.name) ||
          slugifyToken(rootNode.displayName) ||
          slugifyToken(rootNode.name) ||
          "invalid-asset",
        symbol:
          activeRootEntry?.logoKeys?.[0]?.toUpperCase() ||
          formatTitleLabel(rootNode.name).slice(0, 12),
        color: BUCKET_COLORS[0],
        peg: null,
      },
    ];

    return {
      vaults,
      summary,
      toxicAssets,
      donutEntries,
      protocolRows,
      curatorRows,
      protocolRadarEntries,
      chainRadarEntries,
      timelineEntries,
      connectedRootExposureUsd,
      coveringProtocols,
      connectedRootCount,
      graphDepth,
      topVault,
      topProtocol,
      priceAssets,
    };
  }, [
    activeRootEntry,
    canonicalAssetId,
    dashboardLabel,
    graphData,
    preparedIndex,
    rootNode,
  ]);

  if (loading || knownIncidentSlug) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--surface-secondary)" }}
      >
        <div
          className="flex items-center gap-3 rounded-xl px-5 py-4"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <Activity className="w-4 h-4 animate-pulse" />
          <span
            className="uppercase font-semibold"
            style={{ fontSize: 10, letterSpacing: "0.16em" }}
          >
            Loading Exposure Dashboard
          </span>
        </div>
      </div>
    );
  }

  if (!graphData || !rootNode || !pageData) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{ backgroundColor: "var(--surface-secondary)" }}
      >
        <div
          className="max-w-xl w-full px-6 py-6"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <p
            className="uppercase font-black"
            style={{
              fontSize: 8,
              letterSpacing: "0.2em",
              color: "var(--text-tertiary)",
            }}
          >
            Dashboard Unavailable
          </p>
          <h1
            className="mt-3 font-mono font-bold"
            style={{ fontSize: 32, color: "var(--text-primary)" }}
          >
            {dashboardLabel}
          </h1>
          <p
            className="mt-3 text-sm leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            The current root asset could not be resolved into a graph snapshot,
            so the dashboard could not be generated.
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              href={graphHref}
              className="px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] rounded-full bg-black text-white"
            >
              Back To Graph
            </Link>
            <Link
              href="/"
              className="px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] rounded-full"
              style={{
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              Registry
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const timestamp = formatBannerDate(new Date(pageData.summary.dataTimestamp));

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--surface-secondary)" }}
    >
      <IncidentNav
        title={`${dashboardLabel} Exposure`}
        lastUpdated={pageData.summary.dataTimestamp}
      />
      <ExposureDashboardBody
        banner={{
          title: `${dashboardLabel} Including Exposure`,
          description: `${dashboardLabel} is the active root node. This dashboard summarizes live downstream allocations, tracked roots, and concentration from the current graph snapshot.`,
          timestamp,
          status: "active",
        }}
        totalPanel={{
          title: "Total Included Exposure",
          value: pageData.summary.totalToxicExposureUsd,
          subtitle: `across ${pageData.summary.vaultCount} direct allocation${pageData.summary.vaultCount === 1 ? "" : "s"} · ${pageData.summary.protocolCount} protocol${pageData.summary.protocolCount === 1 ? "" : "s"}`,
          note: `Root TVL ${formatUsdCompact(tvl ?? 0)} · current graph depth ${pageData.graphDepth} hop${pageData.graphDepth === 1 ? "" : "s"}.`,
        }}
        priceChartAssets={pageData.priceAssets}
        debtPanel={{
          title: "Exposure Split",
          realizedDebt: pageData.summary.totalToxicExposureUsd,
          coveredDebt: pageData.connectedRootExposureUsd,
          uncoveredGap: Math.max(
            0,
            pageData.summary.totalToxicExposureUsd -
              pageData.connectedRootExposureUsd,
          ),
          recoveryRate:
            pageData.summary.totalToxicExposureUsd > 0
              ? pageData.connectedRootExposureUsd /
                pageData.summary.totalToxicExposureUsd
              : 0,
          coveringProtocols: pageData.coveringProtocols,
          labels: {
            realizedDebt: "Included Flow",
            coveredDebt: "Tracked Roots",
            uncoveredGap: "Graph-only Flow",
            recoveryRate: "Cross-Root Share",
          },
        }}
        donutPanel={{
          title: "By Downstream Bucket",
          entries: pageData.donutEntries,
          total: pageData.summary.totalToxicExposureUsd,
        }}
        curatorPanel={{
          title: "Exposure by Curator",
          content:
            pageData.curatorRows.length > 0 ? (
              <div className="space-y-1">
                {pageData.curatorRows.map((row) => (
                  <ProtocolRow
                    key={row.name}
                    name={row.name}
                    logoSrc={row.logoSrc}
                    fallbackInitials={row.fallbackInitials}
                    fallbackColor={row.fallbackColor}
                    meta={row.meta}
                    breakdown={row.breakdown}
                  />
                ))}
              </div>
            ) : (
              <div
                className="py-4 text-sm"
                style={{ color: "var(--text-tertiary)" }}
              >
                No curator metadata available in the current snapshot.
              </div>
            ),
        }}
        metrics={[
          { label: "Direct Nodes", value: pageData.summary.vaultCount },
          { label: "Tracked Roots", value: pageData.connectedRootCount },
          {
            label: "Protocols Impacted",
            value: pageData.summary.protocolCount,
          },
          {
            label: "Highest Exposure %",
            value: pageData.topVault ? pageData.topVault.exposurePct * 100 : 0,
            format: "percent",
          },
        ]}
        protocolRadarEntries={pageData.protocolRadarEntries}
        chainRadarEntries={pageData.chainRadarEntries}
        protocolPanel={{
          title: "Exposure by Protocol",
          rows: pageData.protocolRows,
        }}
        timelinePanel={{
          title: "Timeline",
          entries: pageData.timelineEntries,
        }}
        vaultTablePanel={{
          title: "Direct Allocation Registry",
          vaults: pageData.vaults,
          toxicAssets: pageData.toxicAssets,
        }}
        footer={{
          left: `Exposure Core · Live graph snapshot · Last update: ${timestamp}`,
          right: `${getChainDisplayName(rootNode.chain ?? "global")} root · Verify with source protocols`,
        }}
      />
    </div>
  );
}
