export interface SearchIndexEntry {
  id: string;
  chain: string;
  protocol: string;
  name: string;
  displayName?: string;
  nodeId: string;
  apy?: number | null;
  curator?: string | null;
  tvlUsd?: number | null;
  logoKeys?: string[];
}
