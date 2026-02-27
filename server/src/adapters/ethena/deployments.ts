const PROTOCOL = "ethena" as const;

const USDE_CANONICAL_ROOT_ID =
  "eth:ethena:0x4c9edd5852cd905f086c759e8383e09bff1e68b3" as const;

const USDE_DEPLOYMENTS = {
  eth: "0x4c9edd5852cd905f086c759e8383e09bff1e68b3",
  arb: "0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34",
} as const;

const SUSDE_CANONICAL_ROOT_ID =
  "eth:ethena:0x9d39a5de30e57443bff2a8307a4256c8797a3497" as const;

const SUSDE_DEPLOYMENTS = {
  eth: "0x9d39a5de30e57443bff2a8307a4256c8797a3497",
  arb: "0x211cc4dd073734da055fbf44a2b4667d5e5fe5d2",
} as const;

const toDeploymentNodeIds = (
  canonicalRootId: string,
  chainToAddress: Record<string, string>,
): string[] => {
  const canonical = canonicalRootId.trim().toLowerCase();

  return Object.entries(chainToAddress)
    .map(
      ([chain, address]) =>
        `${chain.trim().toLowerCase()}:${PROTOCOL}:${address.trim().toLowerCase()}`,
    )
    .filter((id) => id !== canonical);
};

export const getEthenaDeploymentNodeIds = (rootNodeId: string): string[] => {
  const canonical = rootNodeId.trim().toLowerCase();

  if (canonical === USDE_CANONICAL_ROOT_ID) {
    return toDeploymentNodeIds(USDE_CANONICAL_ROOT_ID, USDE_DEPLOYMENTS);
  }

  if (canonical === SUSDE_CANONICAL_ROOT_ID) {
    return toDeploymentNodeIds(SUSDE_CANONICAL_ROOT_ID, SUSDE_DEPLOYMENTS);
  }

  return [];
};
