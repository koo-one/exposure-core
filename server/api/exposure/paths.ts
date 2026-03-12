export const graphSnapshotBlobPath = (nodeId: string): string => {
  return `exposure/graph/${nodeId}.json`;
};

export const canonicalizeProtocolToken = (raw: string): string => {
  const p = raw
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");

  if (p.startsWith("morpho")) {
    if (p.includes("v2")) return "morpho-v2";
    if (p.includes("v1")) return "morpho-v1";
    return "morpho";
  }

  if (p.startsWith("euler")) {
    if (p.includes("v2")) return "euler-v2";
    if (p.includes("v1")) return "euler-v1";
    return "euler";
  }

  return p;
};

export const canonicalizeNodeId = (raw: string): string => {
  const normalized = raw.trim();
  if (!normalized) return "";

  const parts = normalized.split(":");
  const [chainPart, protocolPart, ...restParts] = parts;

  if (!chainPart || !protocolPart) return normalized.toLowerCase();

  const chain = chainPart.trim().toLowerCase();
  const protocol = canonicalizeProtocolToken(protocolPart);
  const rest = restParts.join(":").trim().toLowerCase();

  return rest ? `${chain}:${protocol}:${rest}` : `${chain}:${protocol}`;
};

export const protocolToFolder = (
  protocol: string | null | undefined,
): string | null => {
  const p = protocol ? canonicalizeProtocolToken(protocol) : null;
  if (!p) return null;

  if (p.startsWith("morpho")) {
    return "morpho";
  }
  if (p.startsWith("euler")) {
    return "euler";
  }

  return p;
};

export const inferProtocolFolderFromNodeId = (
  normalizedId: string,
): string | null => {
  const [, protocol] = normalizedId.split(":");
  return protocolToFolder(protocol);
};

export const graphProtocolBlobPath = (protocol: string): string => {
  return `exposure/graph/${protocol}.json`;
};

export const searchIndexBlobPath = (): string => {
  return "exposure/search-index.json";
};
