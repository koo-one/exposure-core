import { buildCanonicalIdentity } from "../core/canonicalIdentity.js";

export const normalizeNodeId = (value: string): string =>
  value.trim().toLowerCase();

export const toDeploymentNodeIds = (
  protocol: string,
  canonicalRootId: string,
  chainToAddress: Record<string, string>,
): string[] => {
  const canonical = normalizeNodeId(canonicalRootId);

  const out: string[] = [];
  for (const [chain, address] of Object.entries(chainToAddress)) {
    const depId = buildCanonicalIdentity({
      chain,
      protocol: protocol.trim().toLowerCase(),
      address,
    }).id;
    if (depId === canonical) continue;
    out.push(depId);
  }

  return out;
};
