import { normalizeChain, toSlug } from "../../utils";

const MIDAS_PROTOCOL = "midas" as const;

const MIDAS_DEPLOYMENTS: Record<string, Record<string, string>> = {
  mtbill: {
    eth: "0xdd629e5241cbc5919847783e6c96b2de4754e438",
    base: "0xdd629e5241cbc5919847783e6c96b2de4754e438",
    oasis: "0xdd629e5241cbc5919847783e6c96b2de4754e438",
    plume: "0xe85f2b707ec5ae8e07238f99562264f304e30109",
    rootstock: "0xdd629e5241cbc5919847783e6c96b2de4754e438",
    etherlink: "0xdd629e5241cbc5919847783e6c96b2de4754e438",
  },
  mbasis: {
    eth: "0x2a8c22e3b10036f3aef5875d04f8441d4188b656",
    base: "0x1c2757c1fef1038428b5bef062495ce94bbe92b2",
    plume: "0x0c78ca789e826fe339de61934896f5d170b66d78",
    etherlink: "0x2247b5a46bb79421a314ab0f0b67ffd11dd37ee4",
  },
  mbtc: {
    eth: "0x007115416ab6c266329a03b09a8aa39ac2ef7d9d",
    rootstock: "0xef85254aa4a8490bcc9c02ae38513cae8303fb53",
  },
  medge: {
    eth: "0xbb51e2a15a9158ebe2b0ceb8678511e063ab7a55",
    plume: "0x69020311836d29ba7d38c1d3578736fd3ded03ed",
    "0g": "0xa1027783fc183a150126b094037a5eb2f5db30ba",
    monad: "0x1c8ee940b654bfced403f2a44c1603d5be0f50fa",
  },
  mevbtc: {
    eth: "0xb64c014307622eb15046c66ff71d04258f5963dc",
  },
  mmev: {
    eth: "0x030b69280892c888670edcdcd8b69fd8026a0bf3",
    etherlink: "0x5542f82389b76c23f5848268893234d8a63fd5c8",
    plume: "0x7d611dc23267f508de90724731dc88ca28ef7473",
  },
  mre7yield: {
    eth: "0x87c9053c819bb28e0d73d33059e1b3da80afb0cf",
    etherlink: "0x733d504435a49fc8c4e9759e756c2846c92f0160",
    tac: "0x0a72ed3c34352ab2dd912b30f2252638c873d6f0",
  },
  mre7btc: {
    eth: "0x9fb442d6b612a6dcd2acc67bb53771ef1d9f661a",
  },
  mre7sol: {
    katana: "0xc6135d59f8d10c9c035963ce9037b3635170d716",
  },
  "mf-one": {
    eth: "0x238a700ed6165261cf8b2e544ba797bc11e466ba",
  },
  msyrupusd: {
    eth: "0x20226607b4fa64228abf3072ce561d6257683464",
  },
  msyrupusdp: {
    eth: "0x2fe058ccf29f123f9dd2aec0418aa66a877d8e50",
  },
  mapollo: {
    eth: "0x7cf9dec92ca9fd46f8d86e7798b72624bc116c05",
  },
  mfarm: {
    eth: "0xa19f6e0df08a7917f2f8a33db66d0af31ff5eca6",
  },
  mhyper: {
    eth: "0x9b5528528656dbc094765e2abb79f293c21191b9",
    plasma: "0xb31bea5c2a43f942a3800558b1aa25978da75f8a",
    monad: "0xd90f6bfed23ffde40106fc4498dd2e9edb95e4e7",
    katana: "0x926a8a63fa1e1fdbbeb811a0319933b1a0f1edbb",
  },
  mhypereth: {
    eth: "0x5a42864b14c0c8241ef5ab62dae975b163a2e0c1",
  },
  mhyperbtc: {
    eth: "0xc8495eaff71d3a563b906295fcf2f685b1783085",
    rootstock: "0x7f71f02ae0945364f658860d67dbc10c86ca3a3c",
  },
  mxrp: {
    "xrpl-evm": "0x06e0b0f1a644bb9881f675ef266cec15a63a3d47",
    bsc: "0xc8739fbbd54c587a2ad43b50cbcc30ae34fe9e34",
  },
};

export const getMidasDeploymentNodeIds = (asset: string): string[] => {
  const key = toSlug(asset);
  const chainToAddress = MIDAS_DEPLOYMENTS[key];
  if (!chainToAddress) return [];

  return Object.entries(chainToAddress).map(
    ([chain, address]) =>
      `${normalizeChain(chain)}:${MIDAS_PROTOCOL}:${address
        .trim()
        .toLowerCase()}`,
  );
};
