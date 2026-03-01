import type { NodeDetails } from "@/types";

export type NodeTypeCategory =
  | "yield-vault"
  | "lending"
  | "staked-locked"
  | "default";

export interface NodeTypeParts {
  kind: string;
  subtype: string;
  label: string;
}

export function getNodeTypeParts(
  details?: NodeDetails | null,
  labelOverride?: string,
): NodeTypeParts {
  const subtype =
    typeof details?.subtype === "string" ? details.subtype.trim() : "";
  const kind = typeof details?.kind === "string" ? details.kind.trim() : "";

  const override =
    typeof labelOverride === "string" ? labelOverride.trim() : "";
  const label = override || subtype || kind;

  return { kind, subtype, label };
}

export function getNodeTypeLabel(
  details?: NodeDetails | null,
  labelOverride?: string,
): string {
  return getNodeTypeParts(details, labelOverride).label;
}

// Category criteria:
// - yield-vault: yield / vault products
// - lending: lending position / lending markets
// - staked-locked: staked or locked positions
export function classifyNodeType(parts: NodeTypeParts): NodeTypeCategory {
  const kind = parts.kind.toLowerCase();
  const subtype = parts.subtype.toLowerCase();
  const label = parts.label.toLowerCase();

  const isYieldVault =
    kind === "yield" || subtype.includes("vault") || label.includes("vault");
  if (isYieldVault) return "yield-vault";

  const isLending = kind.includes("lending") || label.includes("lending");
  if (isLending) return "lending";

  const isStakedOrLocked =
    kind === "staked" ||
    kind === "locked" ||
    label.includes("staked") ||
    label.includes("locked");
  if (isStakedOrLocked) return "staked-locked";

  return "default";
}
