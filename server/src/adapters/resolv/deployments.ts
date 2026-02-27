const PROTOCOL = "resolv" as const;

// Source: https://docs.resolv.xyz/litepaper/for-developers/smart-contracts

const USR_CANONICAL_ROOT_ID =
  "eth:resolv:0x66a1e37c9b0eaddca17d3662d6c05f4decf3e110" as const;

const USR_DEPLOYMENTS = {
  eth: "0x66a1e37c9b0eaddca17d3662d6c05f4decf3e110",
  base: "0x35e5db674d8e93a03d814fa0ada70731efe8a4b9",
  bsc: "0x2492d0006411af6c8bbb1c8afc1b0197350a79e9",
  bera: "0x2492d0006411af6c8bbb1c8afc1b0197350a79e9",
  hyperevm: "0x0ad339d66bf4aed5ce31c64bc37b3244b6394a77",
  soneium: "0xb1b385542b6e80f77b94393ba8342c3af699f15c",
  tac: "0xb1b385542b6e80f77b94393ba8342c3af699f15c",
  arb: "0x2492d0006411af6c8bbb1c8afc1b0197350a79e9",
  plasma: "0xb1b385542b6e80f77b94393ba8342c3af699f15c",
} as const;

const WSTUSR_CANONICAL_ROOT_ID =
  "eth:resolv:0x1202f5c7b4b9e47a1a484e8b270be34dbbc75055" as const;

const WSTUSR_DEPLOYMENTS = {
  eth: "0x1202f5c7b4b9e47a1a484e8b270be34dbbc75055",
  base: "0xb67675158b412d53fe6b68946483ba920b135ba1",
  soneium: "0x2a52b289ba68bbd02676640aa9f605700c9e5699",
  hyperevm: "0x46c1c168ca597b9e5423aa7081a0dce782caeaab",
  tac: "0x2a52b289ba68bbd02676640aa9f605700c9e5699",
  arb: "0x66cfbd79257dc5217903a36293120282548e2254",
  plasma: "0x2a52b289ba68bbd02676640aa9f605700c9e5699",
} as const;

const RLP_CANONICAL_ROOT_ID =
  "eth:resolv:0x4956b52ae2ff65d74ca2d61207523288e4528f96" as const;

const RLP_DEPLOYMENTS = {
  eth: "0x4956b52ae2ff65d74ca2d61207523288e4528f96",
  base: "0xc31389794ffac23331e0d9f611b7953f90aa5fdc",
  bsc: "0x35e5db674d8e93a03d814fa0ada70731efe8a4b9",
  bera: "0x35e5db674d8e93a03d814fa0ada70731efe8a4b9",
  hyperevm: "0x0a3d8466f5de586fa5f6de117301e2f90bcc5c48",
  soneium: "0x35533f54740f1f1aa4179e57ba37039dfa16868b",
  tac: "0x35533f54740f1f1aa4179e57ba37039dfa16868b",
  arb: "0x35e5db674d8e93a03d814fa0ada70731efe8a4b9",
  plasma: "0x35533f54740f1f1aa4179e57ba37039dfa16868b",
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

export const getResolvDeploymentNodeIds = (rootNodeId: string): string[] => {
  const canonical = rootNodeId.trim().toLowerCase();

  if (canonical === USR_CANONICAL_ROOT_ID) {
    return toDeploymentNodeIds(USR_CANONICAL_ROOT_ID, USR_DEPLOYMENTS);
  }

  if (canonical === WSTUSR_CANONICAL_ROOT_ID) {
    return toDeploymentNodeIds(WSTUSR_CANONICAL_ROOT_ID, WSTUSR_DEPLOYMENTS);
  }

  if (canonical === RLP_CANONICAL_ROOT_ID) {
    return toDeploymentNodeIds(RLP_CANONICAL_ROOT_ID, RLP_DEPLOYMENTS);
  }

  return [];
};
