import {
  canonicalizeNodeId,
  canonicalizeProtocolToken,
  extractAddressKeyFromNodeId,
} from "@/lib/nodeId";

export {
  canonicalizeNodeId,
  canonicalizeProtocolToken,
  extractAddressKeyFromNodeId,
};

export const graphSnapshotBlobPath = (nodeId: string): string => {
  return `exposure/graph/${nodeId}.json`;
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
