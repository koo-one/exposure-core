import { normalizeNodeId, toDeploymentNodeIds } from "../deployments.js";

const ASSET_STUSDS = "stUSDS" as const;
const ASSET_SUSDS = "sUSDS" as const;
const ASSET_USDS = "USDS" as const;
const PROTOCOL = "sky" as const;

// Sources:
// - https://docs.spark.fi/user-guides/earning-savings/susds#supported-networks-and-token-addresses
// - https://developers.sky.money/protocol/tokens/usds/
// - https://developers.sky.money/protocol/tokens/susds/
// - https://developers.sky.money/protocol/tokens/stusds/
// Ethereum canonical roots come from official Sky token docs / official browser-visible token pages.
// Spark docs provide the supported-network addresses for USDS and sUSDS.

const USDS_CANONICAL_ROOT_ID =
  "eth:sky:0xdc035d45d973e3ec169d2276ddab16f1e407384f" as const;

const SUSDS_CANONICAL_ROOT_ID =
  "eth:sky:0xa3931d71877c0e7a3148cb7eb4463524fec27fbd" as const;

const STUSDS_CANONICAL_ROOT_ID =
  "eth:sky:0x99cd4ec3f88a45940936f469e4bb72a2a701eeb9" as const;

const SKY_DEPLOYMENTS = {
  [ASSET_USDS]: {
    eth: "0xdc035d45d973e3ec169d2276ddab16f1e407384f",
    base: "0x820c137fa70c8691f0e44dc420a5e53c168921dc",
    arb: "0x6491c05a82219b8d1479057361ff1654749b876b",
    op: "0x4f13a96ec5c4cf34e442b46bbd98a0791f20edc3",
    unichain: "0x7e10036acc4b56d4dfca3b77810356ce52313f9c",
  },
  [ASSET_SUSDS]: {
    eth: "0xa3931d71877c0e7a3148cb7eb4463524fec27fbd",
    base: "0x5875eee11cf8398102fdad704c9e96607675467a",
    arb: "0xddb46999f8891663a8f2828d25298f70416d7610",
    op: "0xb5b2dc7fd34c249f4be7fb1fcea07950784229e0",
    unichain: "0xa06b10db9f390990364a3984c04fadf1c13691b5",
  },
  [ASSET_STUSDS]: {
    eth: "0x99cd4ec3f88a45940936f469e4bb72a2a701eeb9",
  },
} as const;

const DEPLOYMENT_CONFIGS = [
  {
    canonicalRootId: USDS_CANONICAL_ROOT_ID,
    chainToAddress: SKY_DEPLOYMENTS.USDS,
  },
  {
    canonicalRootId: SUSDS_CANONICAL_ROOT_ID,
    chainToAddress: SKY_DEPLOYMENTS.sUSDS,
  },
  {
    canonicalRootId: STUSDS_CANONICAL_ROOT_ID,
    chainToAddress: SKY_DEPLOYMENTS.stUSDS,
  },
] as const;

export const getSkyPrimaryDeployment = (
  asset: string,
): {
  chain: string;
  address: string;
} | null => {
  const chainToAddress = SKY_DEPLOYMENTS[asset as keyof typeof SKY_DEPLOYMENTS];

  if (!chainToAddress) return null;

  const [chain, address] = Object.entries(chainToAddress)[0] ?? [];

  return chain && address ? { chain, address } : null;
};

export const getSkyDeploymentNodeIds = (rootNodeId: string): string[] => {
  const canonical = normalizeNodeId(rootNodeId);

  for (const config of DEPLOYMENT_CONFIGS) {
    if (canonical !== normalizeNodeId(config.canonicalRootId)) continue;

    return toDeploymentNodeIds(
      PROTOCOL,
      config.canonicalRootId,
      config.chainToAddress,
    );
  }

  return [];
};
