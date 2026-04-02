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
  if (parts.length < 2) return normalized.toLowerCase();

  const chain = parts[0].trim().toLowerCase();
  const protocol = canonicalizeProtocolToken(parts[1] ?? "");
  const rest = parts.slice(2).join(":").trim().toLowerCase();

  return rest ? `${chain}:${protocol}:${rest}` : `${chain}:${protocol}`;
};

const ADDRESS_PATTERN = /^0x[a-f0-9]{40}$/;

export const extractAddressKeyFromNodeId = (raw: string): string | null => {
  const normalized = canonicalizeNodeId(raw);
  if (!normalized) return null;

  const parts = normalized.split(":");
  if (parts.length !== 3) return null;

  const [chain, , address] = parts;
  if (!chain || !address || !ADDRESS_PATTERN.test(address)) return null;

  return `${chain}:${address}`;
};

interface AddressIndexedEntry {
  id: string;
  protocol: string;
  normalizedId?: string;
}

export interface GraphTargetCandidate {
  id: string;
  chain?: string | null;
  protocol?: string | null;
}

export const buildEntriesByAddress = <T extends AddressIndexedEntry>(
  entries: T[],
): Map<string, T[]> => {
  const indexed = new Map<string, T[]>();

  for (const entry of entries) {
    const addressKey = extractAddressKeyFromNodeId(
      entry.normalizedId ?? entry.id,
    );
    if (!addressKey) continue;

    const existing = indexed.get(addressKey);
    if (existing) {
      existing.push(entry);
    } else {
      indexed.set(addressKey, [entry]);
    }
  }

  return indexed;
};

export const resolveAddressFallbackEntry = <T extends AddressIndexedEntry>(
  nodeId: string,
  nodeProtocol: string | null | undefined,
  entriesByAddress: Map<string, T[]>,
): T | null => {
  const addressKey = extractAddressKeyFromNodeId(nodeId);
  if (!addressKey) return null;

  const candidates = entriesByAddress.get(addressKey) ?? [];
  if (candidates.length === 0) return null;

  return (
    candidates.find(
      (entry) =>
        canonicalizeProtocolToken(entry.protocol) ===
        canonicalizeProtocolToken(nodeProtocol ?? ""),
    ) ??
    candidates[0] ??
    null
  );
};

export const resolveGraphTargetEntry = <T extends AddressIndexedEntry>(
  node: GraphTargetCandidate,
  graphRootIds: Set<string>,
  entriesByAddress: Map<string, T[]>,
): GraphTargetCandidate | T | null => {
  const normalizedId = canonicalizeNodeId(node.id);
  if (!normalizedId) return null;

  if (graphRootIds.has(normalizedId)) {
    return {
      id: normalizedId,
      chain: node.chain,
      protocol: node.protocol,
    };
  }

  return resolveAddressFallbackEntry(
    normalizedId,
    node.protocol,
    entriesByAddress,
  );
};
