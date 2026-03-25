export interface IncidentConfig {
  slug: string;
  title: string;
  subtitle: string;
  status: "active" | "resolved";
  incidentDate: string;
  description: string;
  toxicAssets: ToxicAssetDef[];
  toxicAssetNodeIds: string[];
  lastUpdated: string;
  affectedVaults: AffectedVault[];
  timeline: TimelineEntry[];
}

export interface ToxicAssetDef {
  symbol: string;
  name: string;
  color: string;
}

export interface TimelineEntry {
  date: string;
  text: string;
}

export interface VaultBase {
  name: string;
  protocol: string;
  chains: string[];
  curator?: string;
  status: "affected" | "covering" | "recovered";
  statusNote?: string;
  statusSource?: string;
  /** Explicit covered/recovered amount — used for Promised/Recovered calculation
   *  when current toxic exposure no longer reflects what was originally at risk
   *  (e.g. adapter vaults that have exited, or manual vaults with $0 exposureUsd). */
  coveredUsd?: number;
}

export interface AdapterVault extends VaultBase {
  source: "adapter";
  nodeIds: Record<string, string>;
}

export interface ManualVault extends VaultBase {
  source: "manual";
  totalTvlUsd?: number; // Total vault TVL — if set, exposurePct = exposureUsd / totalTvlUsd
  exposureUsd: number;
  toxicAssetBreakdown: ToxicBreakdownEntry[];
}

export type AffectedVault = AdapterVault | ManualVault;

export interface ToxicBreakdownEntry {
  asset: string;
  amountUsd: number;
  pct: number;
}

export interface VaultExposure {
  vault: AffectedVault;
  status: "loaded" | "pending" | "error";
  totalAllocationUsd: number;
  toxicExposureUsd: number;
  exposurePct: number;
  breakdown: ToxicBreakdownEntry[];
  chainBreakdown?: Record<
    string,
    {
      nodeId: string;
      totalAllocationUsd: number;
      toxicExposureUsd: number;
      breakdown: ToxicBreakdownEntry[];
    }
  >;
  toxicAllocations?: ToxicAllocation[];
  snapshotTimestamp?: string;
}

export interface ToxicAllocation {
  nodeId: string;
  nodeName: string;
  asset: string;
  allocationUsd: number;
  chain: string;
}

export interface IncidentDataResponse {
  config: IncidentConfig;
  vaults: VaultExposure[];
  summary: IncidentSummary;
}

export interface IncidentSummary {
  totalAffectedTvlUsd: number;
  totalToxicExposureUsd: number;
  vaultCount: number;
  protocolCount: number;
  coveringCount: number;
  byProtocol: Record<string, { exposureUsd: number; vaultCount: number }>;
  byAsset: Record<string, { exposureUsd: number }>;
  byChain: Record<string, { exposureUsd: number; vaultCount: number }>;
  dataTimestamp: string;
}

export function slugifyVaultName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
