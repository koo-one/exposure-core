import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { parse } from "graphql";
import { gql, graphqlRequest } from "../../resolvers/graphql/graphqlRequest.js";
import type { MorphoAllocation } from "./types.js";
import { MORPHO_API_URL } from "./utils.js";

interface MorphoVaultState {
  totalAssetsUsd: number;
  netApy: number;
  curators: {
    name: string;
  }[];
  allocation: MorphoAllocation[];
}

export interface MorphoVaultV1 {
  id: string;
  address: string;
  symbol: string;
  name: string;
  whitelisted: boolean;
  chain: {
    id: number;
    network: string;
  };
  state: MorphoVaultState | null;
}

interface MorphoVaultsV1Response {
  vaults?: {
    items?: MorphoVaultV1[];
  };
}

// Shared vault fields fragment — reused by both the whitelisted-vaults query
// and the extra-vaults-by-address query so the shape is always identical.
const VAULT_FIELDS = `
  __typename
  id
  address
  symbol
  name
  whitelisted
  chain {
    id
    network
  }
  state {
    totalAssetsUsd
    netApy
    curators {
      name
    }
    allocation {
      supplyAssetsUsd
      supplyAssets
      market {
        uniqueKey
        loanAsset {
          symbol
          decimals
          priceUsd
        }
        collateralAsset {
          symbol
        }
        morphoBlue {
          chain {
            id
            network
          }
        }
      }
    }
  }
`;

const VAULTS_QUERY: TypedDocumentNode<
  MorphoVaultsV1Response,
  { first: number; skip: number }
> = parse(gql`
  query Vaults($first: Int!, $skip: Int!) {
    vaults(first: $first, skip: $skip, where: { whitelisted: true }) {
      items { ${VAULT_FIELDS} }
    }
  }
`);

const VAULTS_BY_ADDRESS_QUERY: TypedDocumentNode<
  MorphoVaultsV1Response,
  { addresses: string[] }
> = parse(gql`
  query VaultsByAddress($addresses: [String!]!) {
    vaults(where: { address_in: $addresses }) {
      items { ${VAULT_FIELDS} }
    }
  }
`);

/**
 * Unlisted vault addresses that should be included in the graph pipeline.
 * These are not whitelisted on Morpho but are tracked for incident exposure.
 */
const EXTRA_VAULT_ADDRESSES: string[] = [
  "0x09C4C7B1D2e9Aa7506db8B76f1dBbD61c08c114b", // Everstone
  "0x7193794ec82f527Efb618Ac50C078D348eCBA4b6", // Etherealm USDC
  "0xb5a4d705bb345D8C5753878AAFC6969547AFC061", // Hackarrot USDC Prime
];

export const fetchVaultV1s = async (): Promise<MorphoVaultV1[]> => {
  const pageSize = 1000;
  // GraphQL pagination: `skip` is an offset (number of items to omit from the start).
  // We increase it by `pageSize` to fetch pages: 0..999, 1000..1999, 2000..2999, etc.
  let skip = 0;

  const vaultsV1: MorphoVaultV1[] = [];

  while (true) {
    const payload: MorphoVaultsV1Response = await graphqlRequest({
      url: MORPHO_API_URL,
      document: VAULTS_QUERY,
      variables: { first: pageSize, skip },
    });

    const items = payload.vaults?.items ?? [];

    if (items.length === 0) break;

    vaultsV1.push(...items);

    if (items.length < pageSize) break;

    skip += pageSize;
  }

  // Fetch extra unlisted vaults by address
  if (EXTRA_VAULT_ADDRESSES.length > 0) {
    const seen = new Set(vaultsV1.map((v) => v.address.toLowerCase()));
    const missing = EXTRA_VAULT_ADDRESSES.filter(
      (a) => !seen.has(a.toLowerCase()),
    );

    if (missing.length > 0) {
      const extra: MorphoVaultsV1Response = await graphqlRequest({
        url: MORPHO_API_URL,
        document: VAULTS_BY_ADDRESS_QUERY,
        variables: { addresses: missing },
      });
      vaultsV1.push(...(extra.vaults?.items ?? []));
    }
  }

  return vaultsV1;
};
