import {
  canonicalizeNodeId,
  canonicalizeProtocolToken,
  inferProtocolFolderFromNodeId,
  protocolToFolder,
} from "../../src/utils/graphPaths";

export const graphSnapshotBlobPath = (nodeId: string): string => {
  return `exposure/graph/${nodeId}.json`;
};

export {
  canonicalizeNodeId,
  canonicalizeProtocolToken,
  inferProtocolFolderFromNodeId,
  protocolToFolder,
};

export const graphProtocolBlobPath = (protocol: string): string => {
  return `exposure/graph/${protocol}.json`;
};

export const searchIndexBlobPath = (): string => {
  return "exposure/search-index.json";
};
