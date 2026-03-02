import { normalizeChain } from "../../utils";

const GAUNTLET_PROTOCOL = "gauntlet" as const;

// Source: https://vaultbook.gauntlet.xyz/vaults/gauntlet-usd-alpha-vault/how-to-integrate-with-gauntlet-usd-alpha
const GTUSDA_DEPLOYMENTS: Record<string, string> = {
  base: "0x000000000001cdb57e58fa75fe420a0f4d6640d5",
  eth: "0x3bd9248048df95db4fbd748c6cd99c1baa40bad0",
  arb: "0x000000001dc8bd45d7e7829fb1c969cbe4d0d1ec",
  op: "0x000000001dc8bd45d7e7829fb1c969cbe4d0d1ec",
};

export const getGauntletDeploymentNodeIds = (): string[] => {
  return Object.entries(GTUSDA_DEPLOYMENTS).map(
    ([chain, address]) =>
      `${normalizeChain(chain)}:${GAUNTLET_PROTOCOL}:${address.toLowerCase()}`,
  );
};
