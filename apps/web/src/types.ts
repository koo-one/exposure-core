export interface NodeDetails {
  kind?: string;
  curator?: string | null;
  healthRate?: number;
}

export interface GraphNode {
  id: string;
  chain?: string;
  name: string;
  displayName?: string;
  logoKeys?: string[];
  protocol?: string;
  details?: NodeDetails;
  apy?: number | null;
  tvlUsd?: number | null;
}

export interface GraphEdge {
  from: string;
  to: string;
  allocationUsd: number;
  lendingPosition?: "collateral" | "borrow";
}

export interface GraphSnapshot {
  nodes: GraphNode[];
  edges: GraphEdge[];
  sources: string[];
}
