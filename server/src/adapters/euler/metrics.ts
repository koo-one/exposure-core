import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { parse } from "graphql";
import { gql, graphqlRequest } from "../../resolvers/graphql/graphqlRequest";
import type { Address } from "viem";

/**
 * Why these fetchers exist (graph model):
 * - Earn vaults (Euler Earn) are root nodes of kind "Yield".
 *   Their `strategies[].strategy` are EVK vault addresses which become allocation leaves.
 * - EVK vaults are root nodes of kind "Lending Market".
 *   Their collateral leaves + USD weights are defined by Euler's pre-aggregated open-interest mapping.
 *
 * Data sources:
 * - Subgraph (Goldsky): Earn + EVK vault state (balances, APY, strategy allocations).
 * - Indexer open-interest: EVK liability -> collateral relationships and USD weights (matches Euler UI)
 *   and avoids reconstructing the same metric from subgraph primitives.
 * - Labels (euler-xyz/euler-labels): human-readable vault names (Euler UI naming).
 * - Prices (Euler UI API): asset prices for USD-normalizing token-denominated balances because the
 *   subgraph does not expose USD fields.
 */

export interface EulerChainConfig {
  chainId: number;
  chainKey: string;
  subgraphUrl: string;
}

// Source of truth for supported subgraph networks/endpoints:
// https://docs.euler.finance/developers/data-querying/subgraphs/
const EULER_GOLDSKY_SUBGRAPH_BASE_URL =
  "https://api.goldsky.com/api/public/project_cm4iagnemt1wp01xn4gh1agft/subgraphs";

const eulerSubgraphUrl = (network: string): string =>
  `${EULER_GOLDSKY_SUBGRAPH_BASE_URL}/euler-v2-${network}/latest/gn`;

export const EULER_CHAIN_CONFIGS: readonly EulerChainConfig[] = [
  {
    chainId: 1,
    chainKey: "eth",
    subgraphUrl: eulerSubgraphUrl("mainnet"),
  },
  {
    chainId: 8453,
    chainKey: "base",
    subgraphUrl: eulerSubgraphUrl("base"),
  },
  {
    chainId: 1923,
    chainKey: "swell",
    subgraphUrl: eulerSubgraphUrl("swell"),
  },
  {
    chainId: 146,
    chainKey: "sonic",
    subgraphUrl: eulerSubgraphUrl("sonic"),
  },
  {
    chainId: 60808,
    chainKey: "bob",
    subgraphUrl: eulerSubgraphUrl("bob"),
  },
  {
    chainId: 80094,
    chainKey: "bera",
    subgraphUrl: eulerSubgraphUrl("berachain"),
  },
  {
    chainId: 43114,
    chainKey: "avax",
    subgraphUrl: eulerSubgraphUrl("avalanche"),
  },
  {
    chainId: 42161,
    chainKey: "arb",
    subgraphUrl: eulerSubgraphUrl("arbitrum"),
  },
  {
    chainId: 130,
    chainKey: "uni",
    subgraphUrl: eulerSubgraphUrl("unichain"),
  },
  {
    chainId: 57073,
    chainKey: "ink",
    subgraphUrl: eulerSubgraphUrl("ink"),
  },
  {
    chainId: 56,
    chainKey: "bsc",
    subgraphUrl: eulerSubgraphUrl("bsc"),
  },
  {
    chainId: 999,
    chainKey: "hyperevm",
    subgraphUrl: eulerSubgraphUrl("hyperevm"),
  },
  {
    chainId: 10,
    chainKey: "op",
    subgraphUrl: eulerSubgraphUrl("optimism"),
  },
  {
    chainId: 100,
    chainKey: "gnosis",
    subgraphUrl: eulerSubgraphUrl("gnosis"),
  },
  {
    chainId: 480,
    chainKey: "worldchain",
    subgraphUrl: eulerSubgraphUrl("worldchain"),
  },
  {
    chainId: 239,
    chainKey: "tac",
    subgraphUrl: eulerSubgraphUrl("tac"),
  },
  {
    chainId: 9745,
    chainKey: "plasma",
    subgraphUrl: eulerSubgraphUrl("plasma"),
  },
  {
    chainId: 5000,
    chainKey: "mantle",
    subgraphUrl: eulerSubgraphUrl("mantle"),
  },
] as const;

const EULER_LABELS_BASE_URL =
  "https://raw.githubusercontent.com/euler-xyz/euler-labels/master";

const EULER_INDEXER_BASE_URL = "https://indexer-main.euler.finance";

const EULER_APP_API_BASE_URL = "https://app.euler.finance";

const eulerLabelsVaultsUrl = (chainId: number): string =>
  `${EULER_LABELS_BASE_URL}/${chainId}/vaults.json`;

const eulerLabelsEntitiesUrl = (chainId: number): string =>
  `${EULER_LABELS_BASE_URL}/${chainId}/entities.json`;

const eulerOpenInterestUrl = (chainId: number): string =>
  `${EULER_INDEXER_BASE_URL}/v1/vault/open-interest?chainId=${chainId}`;

const eulerPriceUrl = (chainId: number): string =>
  `${EULER_APP_API_BASE_URL}/api/v1/price?chainId=${chainId}`;

export interface EulerEarnVault {
  id: Address;
  name: string;
  symbol: string;
  asset: Address;
  curator: Address | null;
  totalAssets: string;
  strategies: {
    strategy: Address;
    allocatedAssets: string;
  }[];
}

/**
 * Earn vaults define the "Yield" root universe.
 * Each Earn vault has a list of EVK strategy vault addresses that we turn into allocation leaves.
 *
 * Note: we intentionally filter to the same governed perspective Euler UI uses.
 */
export const fetchEulerEarnVaults = async (
  subgraphUrl: string,
): Promise<EulerEarnVault[]> => {
  const EULER_EARN_VAULTS_QUERY: TypedDocumentNode<{
    eulerEarnVaults: EulerEarnVault[];
  }> = parse(gql`
    {
      eulerEarnVaults(
        first: 100
        orderBy: totalAssets
        orderDirection: desc
        where: { perspectives_contains: ["eulerEarnGovernedPerspective"] }
      ) {
        id
        name
        symbol
        asset
        curator
        totalAssets
        strategies {
          strategy
          allocatedAssets
        }
      }
    }
  `);

  const { eulerEarnVaults } = await graphqlRequest({
    url: subgraphUrl,
    document: EULER_EARN_VAULTS_QUERY,
    variables: {},
  });

  return eulerEarnVaults;
};

export interface EulerEvkVault {
  id: Address;
  name: string;
  symbol: string;
  asset: Address;
  decimals: number;
  state: {
    totalBorrows: string;
    cash: string;
    supplyApy: string;
  } | null;
}

/**
 * EVK vault state (decimals + cash/borrows + supply APY).
 * We only fetch the subset of EVK vaults we actually need (from Earn strategies and/or open-interest).
 */
export const fetchEulerEvkVaults = async (
  addresses: Address[],
  subgraphUrl: string,
): Promise<EulerEvkVault[]> => {
  if (addresses.length === 0) return [];

  const ids = addresses.map((a) => a.toLowerCase());
  const pageSize = 1000;
  const result: EulerEvkVault[] = [];

  const EULER_VAULTS_BY_IDS_QUERY: TypedDocumentNode<
    { eulerVaults: EulerEvkVault[] },
    { ids: string[] }
  > = parse(gql`
    query ($ids: [Bytes!]!) {
      eulerVaults(where: { id_in: $ids }, first: 1000) {
        id
        name
        symbol
        asset
        decimals
        state {
          totalBorrows
          cash
          supplyApy
        }
      }
    }
  `);

  for (let i = 0; i < ids.length; i += pageSize) {
    const chunk = ids.slice(i, i + pageSize);
    const { eulerVaults } = await graphqlRequest({
      url: subgraphUrl,
      document: EULER_VAULTS_BY_IDS_QUERY,
      variables: { ids: chunk },
    });

    result.push(...eulerVaults);
  }

  return result;
};

export interface EulerLabelsVault {
  name: string;
  description?: string;
  entity?: string | string[];
}

export interface EulerLabelEntity {
  name: string;
  logo?: string;
  description?: string;
  url?: string;
  addresses?: Record<string, string>;
}

export interface EulerPriceRecord {
  price: number | string;
  timestamp?: number;
  source?: string;
  address?: string;
  symbol?: string;
}

/**
 * Vault labels (Euler-maintained registry) to make node names human readable.
 * Subgraph `name`/`symbol` are onchain metadata and frequently differ from what Euler UI shows.
 */
export const fetchEulerLabelsVaults = async (
  chainId: number,
): Promise<Map<string, EulerLabelsVault>> => {
  const url = eulerLabelsVaultsUrl(chainId);
  const response = await fetch(url);

  if (response.status === 404) return new Map();

  if (!response.ok) {
    throw new Error(
      `Euler labels error: ${response.status} ${response.statusText}`,
    );
  }

  const json: Record<string, EulerLabelsVault> = await response.json();
  const map = new Map<string, EulerLabelsVault>();

  for (const [address, record] of Object.entries(json)) {
    map.set(address.toLowerCase(), record);
  }

  return map;
};

export const fetchEulerLabelEntities = async (
  chainId: number,
): Promise<Map<string, EulerLabelEntity>> => {
  const url = eulerLabelsEntitiesUrl(chainId);
  const response = await fetch(url);

  if (response.status === 404) return new Map();

  if (!response.ok) {
    throw new Error(
      `Euler entities error: ${response.status} ${response.statusText}`,
    );
  }

  const json: Record<string, EulerLabelEntity> = await response.json();
  const map = new Map<string, EulerLabelEntity>();

  for (const [entityId, record] of Object.entries(json)) {
    map.set(entityId, record);
  }

  return map;
};

/**
 * EVK collateral open-interest mapping (Euler UI weight model).
 *
 * Why we use this endpoint:
 * - It defines which EVK vaults matter for the Lending Market graph (liability roots) and which
 *   collateral vaults they connect to (collateral leaves).
 * - It provides USD weights directly, which matches Euler UI and avoids expensive processing of the
 *   raw subgraph response.
 * - Because it gives us the EVK universe + edges up front, we don't need to fetch *every* EVK vault,
 *   only the ones referenced by Earn strategies and/or this mapping.
 *
 * Shape:
 * - outer key: liabilityVault (root EVK vault)
 * - inner key: collateralVault (leaf EVK vault)
 * - inner value: openInterestUsd (USD notional)
 */

type EulerOpenInterestResponse = Record<string, Record<string, number>>;

export const fetchEulerVaultOpenInterest = async (
  chainId: number,
): Promise<Map<Address, Map<Address, number>>> => {
  const url = eulerOpenInterestUrl(chainId);
  const response = await fetch(url);

  if (response.status === 404) {
    return new Map();
  }

  if (!response.ok) {
    throw new Error(
      `Euler open-interest error: ${response.status} ${response.statusText}`,
    );
  }

  const json: EulerOpenInterestResponse = await response.json();

  // Convert object-of-objects into nested Maps to simplify lookups and iteration in the adapter.
  // Addresses are normalized to lowercase so our keys are consistent across sources.
  const liabilityVaultsMap = new Map<Address, Map<Address, number>>();

  for (const [liabilityVault, collateralVaults] of Object.entries(json)) {
    // `liabilityVault` is the EVK root (borrowed/owed market).
    const collateralVaultMap = new Map<Address, number>();

    for (const [collateralVault, openInterestUsd] of Object.entries(
      collateralVaults,
    )) {
      // `collateralVault` is the EVK leaf (collateral market).
      collateralVaultMap.set(
        collateralVault.toLowerCase() as Address,
        openInterestUsd,
      );
    }

    liabilityVaultsMap.set(
      liabilityVault.toLowerCase() as Address,
      collateralVaultMap,
    );
  }

  return liabilityVaultsMap;
};

/**
 * Euler UI price registry (assetAddress -> USD price).
 * Used to turn token-denominated balances (from subgraph) into USD values.
 * We rely on this because the subgraph does not expose `*Usd` fields.
 */
export const fetchEulerPrices = async (
  chainId: number,
): Promise<Map<Address, number>> => {
  const url = eulerPriceUrl(chainId);
  const response = await fetch(url);

  if (response.status === 404) {
    return new Map();
  }

  if (!response.ok) {
    throw new Error(
      `Euler price error: ${response.status} ${response.statusText}`,
    );
  }

  const json: Record<string, EulerPriceRecord> = await response.json();
  const prices = new Map<Address, number>();

  for (const [key, record] of Object.entries(json)) {
    const price = Number(record?.price);

    prices.set(key.toLowerCase() as Address, price);
  }

  return prices;
};
