import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { parse } from "graphql";
import { gql, graphqlRequest } from "../../resolvers/graphql/graphqlRequest.js";
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
  schema?: {
    earnVaultHasCurator?: boolean;
    earnVaultHasStrategies?: boolean;
    earnVaultHasGovernedPerspectiveFilter?: boolean;
    evkVaultHasState?: boolean;
  };
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
    schema: {
      earnVaultHasCurator: false,
      earnVaultHasStrategies: false,
      earnVaultHasGovernedPerspectiveFilter: false,
    },
  },
  {
    chainId: 56,
    chainKey: "bsc",
    subgraphUrl: eulerSubgraphUrl("bsc"),
  },
  {
    chainId: 239,
    chainKey: "tac",
    subgraphUrl: eulerSubgraphUrl("tac"),
    schema: {
      earnVaultHasCurator: false,
      earnVaultHasStrategies: false,
      earnVaultHasGovernedPerspectiveFilter: false,
      evkVaultHasState: false,
    },
  },
  {
    chainId: 9745,
    chainKey: "plasma",
    subgraphUrl: eulerSubgraphUrl("plasma"),
  },
] as const;

const EULER_LABELS_BASE_URL =
  "https://raw.githubusercontent.com/euler-xyz/euler-labels/master";

const EULER_INDEXER_BASE_URL = "https://indexer-main.euler.finance";

// `app.euler.finance/api/v1/price` now resolves to an HTML app document, so price fetches must use
// the indexer-hosted JSON endpoint instead.
const EULER_INDEXER_PRICE_BASE_URL = "https://indexer-prod.euler.finance";

const eulerLabelsVaultsUrl = (chainId: number): string =>
  `${EULER_LABELS_BASE_URL}/${chainId}/vaults.json`;

const eulerLabelsEntitiesUrl = (chainId: number): string =>
  `${EULER_LABELS_BASE_URL}/${chainId}/entities.json`;

const eulerOpenInterestUrl = (chainId: number): string =>
  `${EULER_INDEXER_BASE_URL}/v1/vault/open-interest?chainId=${chainId}`;

const eulerPriceUrl = (chainId: number): string =>
  `${EULER_INDEXER_PRICE_BASE_URL}/v1/prices?chainId=${chainId}`;

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

const EULER_EARN_VAULTS_QUERY_ARGS = {
  // Keep the per-chain Earn fetch bounded.
  first: 100,
  // Rank by the vault size signal we use elsewhere in the adapter.
  orderBy: "totalAssets",
  // Pull the largest vaults first so the cap remains useful.
  orderDirection: "desc",
  // Mirrors the governed perspective used by Euler UI.
  governedPerspectiveFilter:
    'where: { perspectives_contains: ["eulerEarnGovernedPerspective"] }',
} as const;

const EULER_EARN_VAULTS_QUERY: TypedDocumentNode<{
  eulerEarnVaults: EulerEarnVault[];
}> = parse(gql`
  {
    eulerEarnVaults(
      first: ${EULER_EARN_VAULTS_QUERY_ARGS.first}
      orderBy: ${EULER_EARN_VAULTS_QUERY_ARGS.orderBy}
      orderDirection: ${EULER_EARN_VAULTS_QUERY_ARGS.orderDirection}
      ${EULER_EARN_VAULTS_QUERY_ARGS.governedPerspectiveFilter}
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

type EulerEarnVaultWithoutCurator = Omit<EulerEarnVault, "curator">;
type EulerEarnVaultWithoutCuratorOrStrategies = Omit<
  EulerEarnVault,
  "curator" | "strategies"
>;

const getEulerSchemaFlags = (config: EulerChainConfig) => ({
  earnVaultHasCurator: config.schema?.earnVaultHasCurator ?? true,
  earnVaultHasStrategies: config.schema?.earnVaultHasStrategies ?? true,
  earnVaultHasGovernedPerspectiveFilter:
    config.schema?.earnVaultHasGovernedPerspectiveFilter ?? true,
  evkVaultHasState: config.schema?.evkVaultHasState ?? true,
});

const EULER_VAULTS_BY_IDS_QUERY_ARGS = {
  // `ids` is the runtime GraphQL variable; we batch it to stay within subgraph limits.
  pageSize: 1000,
  // Keep the lookup scoped to the EVK addresses chosen by upstream discovery.
  idsFilter: "where: { id_in: $ids }",
} as const;

const EULER_EARN_VAULTS_QUERY_WITHOUT_CURATOR: TypedDocumentNode<{
  eulerEarnVaults: EulerEarnVaultWithoutCurator[];
}> = parse(gql`
  {
    eulerEarnVaults(
      first: ${EULER_EARN_VAULTS_QUERY_ARGS.first}
      orderBy: ${EULER_EARN_VAULTS_QUERY_ARGS.orderBy}
      orderDirection: ${EULER_EARN_VAULTS_QUERY_ARGS.orderDirection}
      ${EULER_EARN_VAULTS_QUERY_ARGS.governedPerspectiveFilter}
    ) {
      id
      name
      symbol
      asset
      totalAssets
      strategies {
        strategy
        allocatedAssets
      }
    }
  }
`);

const EULER_EARN_VAULTS_QUERY_WITHOUT_CURATOR_OR_STRATEGIES: TypedDocumentNode<{
  eulerEarnVaults: EulerEarnVaultWithoutCuratorOrStrategies[];
}> = parse(gql`
  {
    eulerEarnVaults(
      first: ${EULER_EARN_VAULTS_QUERY_ARGS.first}
      orderBy: ${EULER_EARN_VAULTS_QUERY_ARGS.orderBy}
      orderDirection: ${EULER_EARN_VAULTS_QUERY_ARGS.orderDirection}
    ) {
      id
      name
      symbol
      asset
      totalAssets
    }
  }
`);

/**
 * Earn vaults define the "Yield" root universe.
 * Each Earn vault has a list of EVK strategy vault addresses that we turn into allocation leaves.
 *
 * Note: we intentionally filter to the same governed perspective Euler UI uses.
 */
export const fetchEulerEarnVaults = async (
  config: EulerChainConfig,
): Promise<EulerEarnVault[]> => {
  const schema = getEulerSchemaFlags(config);

  if (!schema.earnVaultHasCurator && !schema.earnVaultHasStrategies) {
    const { eulerEarnVaults } = await graphqlRequest({
      url: config.subgraphUrl,
      document: EULER_EARN_VAULTS_QUERY_WITHOUT_CURATOR_OR_STRATEGIES,
      variables: {},
    });

    return eulerEarnVaults.map((vault) => ({
      ...vault,
      curator: null,
      strategies: [],
    }));
  }

  if (!schema.earnVaultHasCurator) {
    const { eulerEarnVaults } = await graphqlRequest({
      url: config.subgraphUrl,
      document: EULER_EARN_VAULTS_QUERY_WITHOUT_CURATOR,
      variables: {},
    });

    return eulerEarnVaults.map((vault) => ({
      ...vault,
      curator: null,
    }));
  }

  const { eulerEarnVaults } = await graphqlRequest({
    url: config.subgraphUrl,
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

type EulerEvkVaultWithoutState = Omit<EulerEvkVault, "state">;

/**
 * EVK vault state (decimals + cash/borrows + supply APY).
 * We only fetch the subset of EVK vaults we actually need (from Earn strategies and/or open-interest).
 */
export const fetchEulerEvkVaults = async (
  addresses: Address[],
  config: EulerChainConfig,
): Promise<EulerEvkVault[]> => {
  if (addresses.length === 0) return [];

  const schema = getEulerSchemaFlags(config);
  const ids = addresses.map((a) => a.toLowerCase());
  const result: EulerEvkVault[] = [];

  const EULER_VAULTS_BY_IDS_QUERY: TypedDocumentNode<
    { eulerVaults: EulerEvkVault[] },
    { ids: string[] }
  > = parse(gql`
    query ($ids: [Bytes!]!) {
      eulerVaults(
        ${EULER_VAULTS_BY_IDS_QUERY_ARGS.idsFilter}
        first: ${EULER_VAULTS_BY_IDS_QUERY_ARGS.pageSize}
      ) {
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

  const EULER_VAULTS_BY_IDS_QUERY_WITHOUT_STATE: TypedDocumentNode<
    { eulerVaults: EulerEvkVaultWithoutState[] },
    { ids: string[] }
  > = parse(gql`
    query ($ids: [Bytes!]!) {
      eulerVaults(
        ${EULER_VAULTS_BY_IDS_QUERY_ARGS.idsFilter}
        first: ${EULER_VAULTS_BY_IDS_QUERY_ARGS.pageSize}
      ) {
        id
        name
        symbol
        asset
        decimals
      }
    }
  `);

  for (
    let i = 0;
    i < ids.length;
    i += EULER_VAULTS_BY_IDS_QUERY_ARGS.pageSize
  ) {
    const chunk = ids.slice(i, i + EULER_VAULTS_BY_IDS_QUERY_ARGS.pageSize);
    if (!schema.evkVaultHasState) {
      const { eulerVaults } = await graphqlRequest({
        url: config.subgraphUrl,
        document: EULER_VAULTS_BY_IDS_QUERY_WITHOUT_STATE,
        variables: { ids: chunk },
      });

      result.push(...eulerVaults.map((vault) => ({ ...vault, state: null })));
    } else {
      const { eulerVaults } = await graphqlRequest({
        url: config.subgraphUrl,
        document: EULER_VAULTS_BY_IDS_QUERY,
        variables: { ids: chunk },
      });

      result.push(...eulerVaults);
    }
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

  if (response.status === 400 || response.status === 404) {
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
