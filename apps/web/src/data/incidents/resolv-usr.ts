import type { IncidentConfig } from "@/lib/incident/types";

const config: IncidentConfig = {
  slug: "resolv",
  title: "USR Contagion",
  subtitle: "Resolv Labs USR Exploit — Cascading DeFi Exposure",
  status: "active",
  incidentDate: "2026-03-22",
  description:
    "The Resolv Labs USR exploit has created cascading exposure across DeFi vaults and protocols. Vaults with allocations to markets using USR, wstUSR, or RLP as collateral face at-risk capital.",
  toxicAssets: [
    { symbol: "USR", name: "Resolv USD", color: "#c4daff" },
    { symbol: "wstUSR", name: "Wrapped Staked USR", color: "#5792ff" },
    { symbol: "RLP", name: "Resolv Liquidity Pool", color: "#e89220" },
  ],
  toxicAssetNodeIds: [
    "eth:resolv:0x66a1e37c9b0eaddca17d3662d6c05f4decf3e110",
    "eth:resolv:0x1202f5c7b4b9e47a1a484e8b270be34dbbc75055",
    "eth:resolv:0x4956b52ae2ff65d74ca2d61207523288e4528f96",
  ],
  lastUpdated: "2026-03-23T08:00:00Z",
  timeline: [
    {
      date: "2026-03-22",
      text: "USR exploit identified; initial vault exposure mapped",
    },
    {
      date: "2026-03-23",
      text: "Contagion dashboard launched with 29+ affected vaults",
    },
  ],
  affectedVaults: [
    {
      source: "adapter",
      name: "Gauntlet USDC Core",
      protocol: "morpho",
      chains: ["eth"],
      curator: "Gauntlet",
      status: "affected",
      nodeIds: {
        eth: "eth:morpho-v1:0x8eb67a509616cd6a7c1b3c8c21d48ff57df3d458",
      },
    },
    {
      source: "adapter",
      name: "Gauntlet USDC Frontier",
      protocol: "morpho",
      chains: ["eth", "base"],
      curator: "Gauntlet",
      status: "affected",
      nodeIds: {
        eth: "eth:morpho-v1:0xc582f04d8a82795aa2ff9c8bb4c1c889fe7b754e",
        base: "base:morpho-v1:0x236919f11ff9ea9550a4287696c2fc9e18e6e890",
      },
    },
    {
      source: "adapter",
      name: "Resolv USDC",
      protocol: "morpho",
      chains: ["eth"],
      status: "affected",
      nodeIds: {
        eth: "eth:morpho-v1:0x132e6c9c33a62d7727cd359b1f51e5b566e485eb",
      },
    },
    {
      source: "adapter",
      name: "9Summits USDC",
      protocol: "morpho",
      chains: ["eth"],
      curator: "9Summits",
      status: "affected",
      nodeIds: {
        eth: "eth:morpho-v1:0x1e2aaadcf528b9cc08f43d4fd7db488ce89f5741",
      },
    },
    {
      source: "adapter",
      name: "Extrafi XLend USDC",
      protocol: "morpho",
      chains: ["base"],
      curator: "Extrafi",
      status: "affected",
      nodeIds: {
        base: "base:morpho-v1:0x23479229e52ab6aad312d0b03df9f33b46753b5e",
      },
    },
    {
      source: "adapter",
      name: "Re7 USDC",
      protocol: "morpho",
      chains: ["base"],
      curator: "Re7",
      status: "affected",
      nodeIds: {
        base: "base:morpho-v1:0x12afdefb2237a5963e7bab3e2d46ad0eee70406e",
      },
    },
    {
      source: "adapter",
      name: "Seamless USDC Vault",
      protocol: "morpho",
      chains: ["base"],
      curator: "Seamless",
      status: "affected",
      nodeIds: {
        base: "base:morpho-v1:0x616a4e1db48e22028f6bbf20444cd3b8e3273738",
      },
    },
    {
      source: "adapter",
      name: "Apostro Resolv USDC",
      protocol: "morpho",
      chains: ["eth", "base"],
      curator: "Apostro",
      status: "affected",
      nodeIds: {
        eth: "eth:morpho-v1:0x214b47c50057efaa7adc1b1c2608c3751cd77d78",
        base: "base:morpho-v1:0xcddcdd18a16ed441f6cb10c3909e5e7ec2b9e8f3",
      },
    },
    {
      source: "adapter",
      name: "August AUSD",
      protocol: "morpho",
      chains: ["eth"],
      curator: "August",
      status: "affected",
      nodeIds: {
        eth: "eth:morpho-v1:0x9b7cca326004967f9d2b7cf5f2328d82cf65b302",
      },
    },
    {
      source: "adapter",
      name: "Clearstar Yield USDC",
      protocol: "morpho",
      chains: ["eth", "arb"],
      curator: "Clearstar",
      status: "affected",
      nodeIds: {
        eth: "eth:morpho-v1:0x9b5e92fd227876b4c07a8c02367e2cb23c639dfa",
        arb: "arb:morpho-v1:0x64ca76e2525fc6ab2179300c15e343d73e42f958",
      },
    },
    {
      source: "adapter",
      name: "kpk USDC Yield",
      protocol: "morpho",
      chains: ["eth", "arb"],
      curator: "kpk",
      status: "affected",
      nodeIds: {
        eth: "eth:morpho-v1:0x9178ebe0691593184c1d785a864b62a326cc3509",
        arb: "arb:morpho-v1:0x2c609d9cfc9dda2db5c128b2a665d921ec53579d",
      },
    },
    {
      source: "adapter",
      name: "MEV Capital USDC",
      protocol: "morpho",
      chains: ["eth"],
      curator: "MEV Capital",
      status: "affected",
      nodeIds: {
        eth: "eth:morpho-v1:0xd63070114470f685b75b74d60eec7c1113d33a3d",
      },
    },
    {
      source: "adapter",
      name: "Keyrock USDC",
      protocol: "morpho",
      chains: ["eth"],
      curator: "Keyrock",
      status: "affected",
      nodeIds: {
        eth: "eth:morpho-v1:0x6c26793c7f1e2785c09b460676e797b716f0bc8e",
      },
    },
    {
      source: "adapter",
      name: "Re7 USDC Core",
      protocol: "morpho",
      chains: ["eth"],
      curator: "Re7",
      status: "affected",
      nodeIds: {
        eth: "eth:morpho-v1:0x341193ed21711472e71aeca4a942123452bd0dda",
      },
    },
    {
      source: "adapter",
      name: "MEV Capital USD0",
      protocol: "morpho",
      chains: ["eth"],
      curator: "MEV Capital",
      status: "affected",
      nodeIds: {
        eth: "eth:morpho-v1:0x749794e985af5a9a384b9cee6d88dab4ce1576a1",
      },
    },
    {
      source: "adapter",
      name: "Euler Arbitrum Yield USDC",
      protocol: "euler",
      chains: ["arb"],
      status: "affected",
      nodeIds: { arb: "arb:euler:0x05d28a86e057364f6ad1a88944297e58fc6160b3" },
    },
    {
      source: "adapter",
      name: "Resolv USDC vault",
      protocol: "euler",
      chains: ["eth"],
      status: "affected",
      nodeIds: { eth: "eth:euler:0xcbc9b61177444a793b85442d3a953b90f6170b7d" },
    },
    {
      source: "manual",
      name: "mBASIS",
      protocol: "midas",
      chains: ["eth", "base"],
      status: "affected",
      statusNote:
        "Indirect exposure through Fluid on Plasma only — no direct Resolv exposure. Expecting no bad debt.",
      exposureUsd: 0,
      toxicAssetBreakdown: [],
    },
    {
      source: "manual",
      name: "mAPOLLO",
      protocol: "midas",
      chains: ["eth"],
      status: "affected",
      statusNote:
        "Indirect exposure through Fluid on Plasma only — no direct Resolv exposure. Expecting no bad debt.",
      exposureUsd: 0,
      toxicAssetBreakdown: [],
    },
    {
      source: "manual",
      name: "DOLA",
      protocol: "inverse",
      chains: ["eth"],
      status: "affected",
      statusNote:
        "FiRM wstUSR-DOLA markets paused. $340K DOLA debt outstanding backed by crashed wstUSR LP collateral.",
      // Source: inverse.finance/api/f2/fixed-markets — fetched 2026-03-24
      // wstUSR-DOLA (Convex): $340,062 totalDebt, LP price $0.209 (~90% loss)
      // yv-wstUSR-DOLA (Yearn): $0 totalDebt
      // USR-DOLA markets: ceiling reduced to $0, fully unwound
      // To update: curl https://www.inverse.finance/api/f2/fixed-markets
      exposureUsd: 340_062,
      toxicAssetBreakdown: [{ asset: "wstUSR", amountUsd: 340_062, pct: 1 }],
    },
    {
      source: "manual",
      name: "Gearbox USDC",
      protocol: "gearbox",
      chains: ["eth"],
      status: "affected",
      statusNote:
        "USR accepted as collateral in USDC lending pools. Exposure amount TBD.",
      exposureUsd: 0,
      toxicAssetBreakdown: [],
    },
    // ─── Fluid wstUSR vaults (Ethereum) ───
    // Source: fluid.io/stats/1/vaults — scraped 2026-03-23
    // Total Supplied = wstUSR collateral deposited
    // To update: check fluid.io/stats/{chainId}/vaults for each chain
    {
      source: "manual",
      name: "Fluid wstUSR/USDC",
      protocol: "fluid",
      chains: ["eth"],
      status: "covering",
      statusNote: "Fluid has announced coverage of bad debt accrued",
      exposureUsd: 671_622, // Total Supplied: $671,621.91
      toxicAssetBreakdown: [{ asset: "wstUSR", amountUsd: 671_622, pct: 1 }],
    },
    {
      source: "manual",
      name: "Fluid wstUSR/USDT",
      protocol: "fluid",
      chains: ["eth"],
      status: "covering",
      statusNote: "Fluid has announced coverage of bad debt accrued",
      exposureUsd: 229_271, // Total Supplied: $229,270.64
      toxicAssetBreakdown: [{ asset: "wstUSR", amountUsd: 229_271, pct: 1 }],
    },
    {
      source: "manual",
      name: "Fluid wstUSR/GHO",
      protocol: "fluid",
      chains: ["eth"],
      status: "covering",
      statusNote: "Fluid has announced coverage of bad debt accrued",
      exposureUsd: 150_127, // Total Supplied: $150,127.28
      toxicAssetBreakdown: [{ asset: "wstUSR", amountUsd: 150_127, pct: 1 }],
    },
    {
      source: "manual",
      name: "Fluid wstUSR/USDC-USDT",
      protocol: "fluid",
      chains: ["eth"],
      status: "covering",
      statusNote: "Fluid has announced coverage of bad debt accrued",
      exposureUsd: 13_313, // Total Supplied: $13,313.30
      toxicAssetBreakdown: [{ asset: "wstUSR", amountUsd: 13_313, pct: 1 }],
    },
    {
      source: "manual",
      name: "Fluid wstUSR-USDC/USDC",
      protocol: "fluid",
      chains: ["eth"],
      status: "covering",
      statusNote: "Fluid has announced coverage of bad debt accrued",
      exposureUsd: 11_691, // Total Supplied: $11,690.81
      toxicAssetBreakdown: [{ asset: "wstUSR", amountUsd: 11_691, pct: 1 }],
    },
    {
      source: "manual",
      name: "Fluid wstUSR-USDC/USDC-USDT",
      protocol: "fluid",
      chains: ["eth"],
      status: "covering",
      statusNote: "Fluid has announced coverage of bad debt accrued",
      exposureUsd: 47_152, // Total Supplied: $47,152.05
      toxicAssetBreakdown: [{ asset: "wstUSR", amountUsd: 47_152, pct: 1 }],
    },
    {
      source: "manual",
      name: "mEDGE",
      protocol: "midas",
      chains: ["eth"],
      status: "affected",
      statusNote: "No exposure identified",
      exposureUsd: 0,
      toxicAssetBreakdown: [],
    },
    {
      source: "manual",
      name: "msyrupUSDp",
      protocol: "midas",
      chains: ["eth"],
      status: "affected",
      statusNote:
        "Indirect exposure through Fluid on Plasma only — no direct Resolv exposure. Expecting no bad debt.",
      exposureUsd: 0,
      toxicAssetBreakdown: [],
    },
    // ─── YO Protocol (yoUSD) ───
    // Source: api.yo.xyz — fetched 2026-03-23
    // yoUSD vault on Base allocates 2.87% to Resolv RLP pool
    // To update: run `tsx --env-file=.env.local server/scripts/incident/fetch-yields.ts`
    {
      source: "manual",
      name: "yoUSD",
      protocol: "yo",
      chains: ["base"],
      status: "affected",
      totalTvlUsd: 42_300_000, // ~$42.3M total vault TVL
      exposureUsd: 1_214_131, // $1,214,131 USDC in Resolv RLP pool (2.87% of vault)
      toxicAssetBreakdown: [
        { asset: "RLP", amountUsd: 1_214_131, pct: 0.0287 },
      ],
    },
    {
      source: "manual",
      name: "Flux",
      protocol: "venus",
      chains: ["eth"],
      status: "affected",
      exposureUsd: 0,
      toxicAssetBreakdown: [],
    },
    {
      source: "manual",
      name: "USD1 Vault",
      protocol: "lista-dao",
      chains: ["eth"],
      status: "affected",
      exposureUsd: 0,
      toxicAssetBreakdown: [],
    },
    // ─── Upshift vaults ───
    // Source: api.upshift.finance — fetched 2026-03-23
    // To update: run `tsx --env-file=.env.local server/scripts/incident/fetch-upshift.ts`
    {
      source: "manual",
      name: "Resolv USR Yield Maxi",
      protocol: "upshift",
      chains: ["eth"],
      status: "affected",
      // Source: api.upshift.finance — fetched 2026-03-24
      // Direct USR exposure — full vault TVL
      exposureUsd: 2_198_169,
      toxicAssetBreakdown: [{ asset: "USR", amountUsd: 2_198_169, pct: 1 }],
    },
    {
      source: "manual",
      name: "Upshift Core USDC",
      protocol: "upshift",
      chains: ["eth"],
      status: "affected",
      // Source: api.upshift.finance — fetched 2026-03-24
      // Total TVL $268K — USR allocation % unknown
      totalTvlUsd: 268_469,
      statusNote: "Meta-vault — USR allocation % unknown.",
      exposureUsd: 0,
      toxicAssetBreakdown: [],
    },
    {
      source: "manual",
      name: "Upshift USDC",
      protocol: "upshift",
      chains: ["eth"],
      status: "affected",
      // Source: api.upshift.finance — fetched 2026-03-24
      // Total TVL $18.84M — USR allocation % unknown
      totalTvlUsd: 18_838_001,
      statusNote: "USR allocation % unknown.",
      exposureUsd: 0,
      toxicAssetBreakdown: [],
    },
    {
      source: "manual",
      name: "earnAUSD",
      protocol: "upshift",
      chains: ["eth"],
      status: "affected",
      // Source: api.upshift.finance — fetched 2026-03-24
      // Total TVL $441K — AUSD vault, USR allocation % unknown
      totalTvlUsd: 441_136,
      statusNote: "AUSD vault — USR allocation % unknown.",
      exposureUsd: 0,
      toxicAssetBreakdown: [],
    },
  ],
};

export default config;
