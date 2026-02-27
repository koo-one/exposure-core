export const normalizeNodeId = (value: string): string =>
  value.trim().toLowerCase();

export const toDeploymentNodeIds = (
  protocol: string,
  canonicalRootId: string,
  chainToAddress: Record<string, string>,
): string[] => {
  const canonical = normalizeNodeId(canonicalRootId);
  const proto = protocol.trim().toLowerCase();

  const out: string[] = [];
  for (const [chain, address] of Object.entries(chainToAddress)) {
    const depId = `${chain.trim().toLowerCase()}:${proto}:${address.trim().toLowerCase()}`;
    if (depId === canonical) continue;
    out.push(depId);
  }

  return out;
};
