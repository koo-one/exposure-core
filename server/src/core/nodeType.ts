export interface NodeDetailsLike {
  kind?: string;
  subtype?: string;
}

export function getNodeTypeLabel(details?: NodeDetailsLike | null): string {
  const subtype =
    typeof details?.subtype === "string" ? details.subtype.trim() : "";
  if (subtype) return subtype;

  const kind = typeof details?.kind === "string" ? details.kind.trim() : "";
  return kind;
}
