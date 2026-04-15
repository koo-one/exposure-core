import { notFound } from "next/navigation";
import { loadIncidentConfig } from "@/lib/incident/config";
import { detectToxicExposure } from "@/lib/incident/detection";
import { loadProtocolSnapshots } from "@/lib/graphLoader";
import { inferProtocolFolderFromNodeId } from "@/lib/blobPaths";
import { formatUsdCompact } from "@/lib/incident/format";
import {
  getAssetIcon,
  getProtocolIcon,
  getChainIcon,
  getChainDisplayName,
  getProtocolDisplay,
} from "@/lib/incident/logos";
import type {
  AdapterVault,
  IncidentSummary,
  VaultExposure,
  ToxicBreakdownEntry,
} from "@/lib/incident/types";
import type { GraphSnapshot } from "@/types";
import { BadDebtByCurator } from "@/components/incident/BadDebtByCurator";
import { type DonutEntry } from "@/components/incident/ToxicAssetDonut";
import { type RadarEntry } from "@/components/incident/DistributionRadar";
import {
  ExposureDashboardBody,
  type DashboardProtocolRow,
} from "@/components/incident/ExposureDashboardBody";

export const revalidate = 600;

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function computeSummary(vaults: VaultExposure[]): IncidentSummary {
  const byProtocol: IncidentSummary["byProtocol"] = {};
  const byAsset: IncidentSummary["byAsset"] = {};
  const byChain: IncidentSummary["byChain"] = {};
  let totalTvl = 0;
  let totalToxic = 0;
  const protocols = new Set<string>();
  let coveringCount = 0;

  for (const ve of vaults) {
    totalTvl += ve.totalAllocationUsd;
    totalToxic += ve.toxicExposureUsd;
    protocols.add(ve.vault.protocol);
    if (ve.vault.status === "covering" || ve.vault.status === "recovered")
      coveringCount++;

    const p = (byProtocol[ve.vault.protocol] ??= {
      exposureUsd: 0,
      vaultCount: 0,
    });
    p.exposureUsd += ve.toxicExposureUsd;
    p.vaultCount += 1;

    for (const b of ve.breakdown) {
      const a = (byAsset[b.asset] ??= { exposureUsd: 0 });
      a.exposureUsd += b.amountUsd;
    }

    for (const chain of ve.vault.chains) {
      const c = (byChain[chain] ??= { exposureUsd: 0, vaultCount: 0 });
      c.vaultCount += 1;
      if (ve.chainBreakdown?.[chain]) {
        c.exposureUsd += ve.chainBreakdown[chain].toxicExposureUsd;
      }
    }
  }

  return {
    totalAffectedTvlUsd: totalTvl,
    totalToxicExposureUsd: totalToxic,
    vaultCount: vaults.length,
    protocolCount: protocols.size,
    coveringCount,
    byProtocol,
    byAsset,
    byChain,
    dataTimestamp: new Date().toISOString(),
  };
}

export default async function IncidentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const config = await loadIncidentConfig(slug);
  if (!config) notFound();

  const toxicSymbols = config.toxicAssets.map((a) => a.symbol);

  // Group adapter vaults by protocol folder to minimize blob fetches
  const adapterVaults = config.affectedVaults.filter(
    (v): v is AdapterVault => v.source === "adapter",
  );
  const protocolFolders = new Set<string>();
  for (const vault of adapterVaults) {
    for (const nodeId of Object.values(vault.nodeIds)) {
      const folder = inferProtocolFolderFromNodeId(nodeId);
      if (folder) protocolFolders.add(folder);
    }
  }

  const snapshotsByProtocol = new Map<string, Record<string, GraphSnapshot>>();
  await Promise.all(
    Array.from(protocolFolders).map(async (folder) => {
      const snapshots = await loadProtocolSnapshots(folder);
      snapshotsByProtocol.set(folder, snapshots);
    }),
  );

  const vaults: VaultExposure[] = [];

  for (const vault of config.affectedVaults) {
    if (vault.source === "manual") {
      const totalTvl = vault.totalTvlUsd ?? vault.exposureUsd;
      vaults.push({
        vault,
        status: vault.exposureUsd > 0 ? "loaded" : "pending",
        totalAllocationUsd: totalTvl,
        toxicExposureUsd: vault.exposureUsd,
        exposurePct: totalTvl > 0 ? vault.exposureUsd / totalTvl : 0,
        breakdown: vault.toxicAssetBreakdown,
      });
      continue;
    }

    let totalAlloc = 0;
    let totalToxic = 0;
    const assetTotals = new Map<string, number>();
    const allToxicAllocations: VaultExposure["toxicAllocations"] = [];
    const chainBreakdown: NonNullable<VaultExposure["chainBreakdown"]> = {};
    let anyLoaded = false;

    for (const [chain, nodeId] of Object.entries(vault.nodeIds)) {
      const folder = inferProtocolFolderFromNodeId(nodeId);
      const snapshots = folder ? snapshotsByProtocol.get(folder) : undefined;
      const snapshot = snapshots?.[nodeId] ?? null;

      const result = detectToxicExposure(
        snapshot,
        nodeId,
        toxicSymbols,
        config.toxicAssetNodeIds,
      );

      if (result.status === "loaded") {
        anyLoaded = true;
        totalAlloc += result.totalAllocationUsd;
        totalToxic += result.toxicExposureUsd;
        for (const b of result.breakdown) {
          assetTotals.set(
            b.asset,
            (assetTotals.get(b.asset) ?? 0) + b.amountUsd,
          );
        }
        if (result.toxicAllocations) {
          allToxicAllocations.push(...result.toxicAllocations);
        }
        chainBreakdown[chain] = {
          nodeId,
          totalAllocationUsd: result.totalAllocationUsd,
          toxicExposureUsd: result.toxicExposureUsd,
          breakdown: result.breakdown,
        };
      }
    }

    const breakdown: ToxicBreakdownEntry[] = Array.from(
      assetTotals.entries(),
    ).map(([asset, amountUsd]) => ({
      asset,
      amountUsd,
      pct: totalAlloc > 0 ? amountUsd / totalAlloc : 0,
    }));

    vaults.push({
      vault,
      status: anyLoaded ? "loaded" : "pending",
      totalAllocationUsd: totalAlloc,
      toxicExposureUsd: totalToxic,
      exposurePct: totalAlloc > 0 ? totalToxic / totalAlloc : 0,
      breakdown,
      chainBreakdown:
        Object.keys(chainBreakdown).length > 0 ? chainBreakdown : undefined,
      toxicAllocations:
        allToxicAllocations.length > 0 ? allToxicAllocations : undefined,
    });
  }

  const summary = computeSummary(vaults);

  // Protocols sorted by exposure descending
  const sortedProtocols = Object.entries(summary.byProtocol).sort(
    ([, a], [, b]) => b.exposureUsd - a.exposureUsd,
  );

  // Highest exposure % vault
  const highestPctVault = vaults
    .filter((ve) => ve.status === "loaded")
    .sort((a, b) => b.exposurePct - a.exposurePct)[0];

  // Token icon path helper
  // Donut chart data
  const assetEntries = Object.entries(summary.byAsset).sort(
    ([, a], [, b]) => b.exposureUsd - a.exposureUsd,
  );
  const assetColorBySymbol = Object.fromEntries(
    config.toxicAssets.map((a) => [a.symbol, a.color]),
  );
  const totalAssetExposure = assetEntries.reduce(
    (sum, [, v]) => sum + v.exposureUsd,
    0,
  );
  const donutEntries: DonutEntry[] = assetEntries.map(
    ([symbol, { exposureUsd }]) => ({
      symbol,
      exposureUsd,
      color: assetColorBySymbol[symbol] ?? "#999",
      iconPath: getAssetIcon(symbol),
    }),
  );

  // ── Radar chart data (exposure amount distribution) ──
  const toRadarEntries = (
    byKey: Record<string, { exposureUsd: number; vaultCount: number }>,
    getIcon: (key: string) => string,
    getLabel: (key: string) => string,
  ): RadarEntry[] => {
    const totalUsd = Object.values(byKey).reduce(
      (sum, v) => sum + v.exposureUsd,
      0,
    );

    return Object.entries(byKey)
      .map(([key, { exposureUsd }]) => ({
        name: getLabel(key),
        value: totalUsd > 0 ? (exposureUsd / totalUsd) * 100 : 0,
        iconSrc: getIcon(key),
      }))
      .sort((a, b) => b.value - a.value);
  };

  const protocolRadarEntries = toRadarEntries(
    summary.byProtocol,
    getProtocolIcon,
    (key) => getProtocolDisplay(key).name,
  );

  const chainRadarEntries = toRadarEntries(
    summary.byChain,
    getChainIcon,
    getChainDisplayName,
  );

  // Timeline entries — chronological, sourced from tweets
  const timelineEntries = [
    {
      date: "Mar 22, 2026 · 02:21 UTC",
      tag: "exploit" as const,
      text: "Resolv's USR contract exploited — ~$50M USR minted for ~$100K USDC.",
      details: {
        description:
          "A malicious actor gained unauthorized access to Resolv infrastructure through a compromised private key, minting approximately $80M of uncollateralized USR. ~$25M was extracted before contracts were paused.",
        tweets: [
          {
            author: "YAM",
            handle: "@yieldsandmore",
            text: "USR from @ResolvLabs is trading at one cent, someone minted 50m USR with $100k USDC",
            url: "https://x.com/yieldsandmore/status/2035547381026967779",
          },
        ],
        links: [
          {
            label: "The Block — USR Depeg Report",
            url: "https://www.theblock.co/post/394582/resolvs-usr-stablecoin-depegs",
          },
        ],
      },
    },
    {
      date: "Mar 22, 2026 · 05:24 UTC",
      tag: "curator" as const,
      text: "Gauntlet detects exploit; flags limited exposure in high-yield vaults.",
      details: {
        tweets: [
          {
            author: "Gauntlet",
            handle: "@gauntlet_xyz",
            text: "At 2:21 AM UTC, Resolv's USR contract experienced an exploit where $50M Resolv USD (USR) was minted for approximately $100,000 USDC. Most Gauntlet vaults are unaffected. A few high-yield vaults had limited exposure.",
            url: "https://x.com/gauntlet_xyz/status/2035588296592789560",
          },
        ],
      },
    },
    {
      date: "Mar 22, 2026 · 08:00 UTC",
      tag: "response" as const,
      text: "Telos Consilium confirms exposure contained to ~$28K.",
      details: {
        tweets: [
          {
            author: "Telos Consilium",
            handle: "@TelosConsilium",
            text: "Exposure is contained to approx $28k from the Haven Earn Vault on Plasma and the Balancer pool that rehypotecates there.",
            url: "https://x.com/TelosConsilium/status/2035627754146648174",
          },
        ],
      },
    },
    {
      date: "Mar 22, 2026 · 09:00 UTC",
      tag: "response" as const,
      text: "Morpho co-founder confirms no vulnerability in Morpho contracts; vaults without exposure fully isolated.",
      details: {
        tweets: [
          {
            author: "Merlin Egalite",
            handle: "@MerlinEgalite",
            text: "We're aware of a security incident involving Resolv that has impacted USR. I want to reiterate that there is no vulnerability in Morpho contracts. They are safe and operating as intended.",
            url: "https://x.com/MerlinEgalite/status/2035642775941632389",
          },
        ],
      },
    },
    {
      date: "Mar 22, 2026 · 09:34 UTC",
      tag: "response" as const,
      text: "Fluid announces full coverage of any remaining bad debt; USR markets paused.",
      details: {
        description:
          "Fluid's automated ceilings prevented excessive borrowing. USR markets were paused and all user losses will be fully covered.",
        tweets: [
          {
            author: "Fluid",
            handle: "@0xfluid",
            text: "Fluid automated ceilings prevented excessive borrowing of the funds, and USR markets have been paused. In case of any remaining bad debt on Fluid, all user losses will be fully covered.",
            url: "https://x.com/0xfluid/status/2035651370607419902",
          },
        ],
      },
    },
    {
      date: "Mar 22, 2026 · 08:17 UTC",
      tag: "response" as const,
      text: "Stani Kulechov confirms Aave has no exposure to USR; Resolv backing assets remain safe.",
      details: {
        tweets: [
          {
            author: "Stani.eth",
            handle: "@StaniKulechov",
            text: "Aave has no exposure to Resolv USR. Resolv is a liquidity provider on Aave, supplying its backing assets to the protocol. These assets remain safe, as the backing itself was unaffected.",
            url: "https://x.com/StaniKulechov/status/2035631992151146725",
          },
        ],
      },
    },
    {
      date: "Mar 22, 2026 · 11:21 UTC",
      tag: "response" as const,
      text: "YO confirms yoUSD has 2.75% exposure to RLP; vault paused as precaution.",
      details: {
        tweets: [
          {
            author: "YO",
            handle: "@yield",
            text: "yoUSD has no direct or indirect exposure to USR. yoUSD has a 2.75% exposure to RLP. Resolv has communicated that the collateral pool remains intact. As a precaution, the yoUSD vault was paused.",
            url: "https://x.com/yield/status/2035678211195937065",
          },
        ],
      },
    },
    {
      date: "Mar 22, 2026 · 12:34 UTC",
      tag: "update" as const,
      text: "DefiMoon warns Fluid incurred bad debt; questions lending risk design.",
      details: {
        tweets: [
          {
            author: "DefiMoon",
            handle: "@DefiMoon",
            text: "Fluid incurred some bad debt today due to the $USR hack. Like I warned a while back... lending on @0xfluid is much more risky due to the design of the protocol and the incentive structure!",
            url: "https://x.com/DefiMoon/status/2035696578925670475",
          },
        ],
      },
    },
    {
      date: "Mar 22, 2026 · 13:19 UTC",
      tag: "response" as const,
      text: "Sam MacPherson confirms Spark, Sky and USDS have zero USR exposure.",
      details: {
        tweets: [
          {
            author: "Sam MacPherson",
            handle: "@hexonaut",
            text: "Spark, Sky and USDS have no exposure to USR. Be safe out there.",
            url: "https://x.com/hexonaut/status/2035707879349473329",
          },
        ],
      },
    },
    {
      date: "Mar 22, 2026 · 14:10 UTC",
      tag: "update" as const,
      text: "Octave analyzes Morpho market exposure — wstUSR/USDC is the biggest affected market.",
      details: {
        tweets: [
          {
            author: "Octave",
            handle: "@OctavioNotPunk",
            text: "The wstUSR/USDC market is the biggest Morpho market exploited. In total, 5 notable vaults are exposed. The Gauntlet USDC Core and the Resolv USDC one (13% of total vault exposure), as well as the Gauntlet USDC Frontier (1.9%).",
            url: "https://x.com/OctavioNotPunk/status/2035720837882323204",
          },
        ],
      },
    },
    {
      date: "Mar 22, 2026 · 14:31 UTC",
      tag: "update" as const,
      text: "Ash maps the full contagion: compromised operator key, 80M unbacked USR minted for $100K, $25M extracted.",
      details: {
        tweets: [
          {
            author: "Ash",
            handle: "@incyd__",
            text: "resolv exploit is a stress test of something nobody wanted to test. one compromised operator key. 80M unbacked USR minted for $100K. $25M extracted. 3 hours before the protocol paused.",
            url: "https://x.com/incyd__/status/2035726069391819111",
          },
        ],
      },
    },
    {
      date: "Mar 22, 2026 · 17:37 UTC",
      tag: "update" as const,
      text: "Omer Goldberg (Chaos Labs) analyzes contagion — USR used as collateral across multiple lending markets without risk guardrails.",
      details: {
        tweets: [
          {
            author: "Omer Goldberg",
            handle: "@omeragoldberg",
            text: "Resolv's USR stablecoin was exploited for $25M. There's significant contagion across Morpho vaults, lending markets, and protocols. USR was collateral across multiple lending markets/vaults. Many used hardcoded pricing without risk guardrails.",
            url: "https://x.com/omeragoldberg/status/2035772805812453759",
          },
          {
            author: "Omer Goldberg",
            handle: "@omeragoldberg",
            text: "Millions in bad debt were created across Gauntlet's Morpho vaults from the Resolv USR exploit. Almost all of it was supplied after the exploit. So why would curators supply millions in USDC to a broken market?",
            url: "https://x.com/omeragoldberg/status/2035817791786221990",
          },
        ],
      },
    },
    {
      date: "Mar 22, 2026 · 03:30 UTC",
      tag: "curator" as const,
      text: "Steakhouse Financial confirms zero exposure across all vaults; was not allocating to RLP.",
      details: {
        tweets: [
          {
            author: "Steakhouse Financial",
            handle: "@SteakhouseFi",
            text: "No Steakhouse vault (Morpho, Turbo/Term vaults, etc) is currently exposed to Resolv (USR, wstUSR). We were not allocating to RLP.",
            url: "https://x.com/SteakhouseFi/status/2035559831810249105",
          },
        ],
      },
    },
    {
      date: "Mar 22, 2026 · 17:28 UTC",
      tag: "curator" as const,
      text: "Re7 Labs publishes incident update — flagship mRe7YIELD has zero exposure; swift response measures taken.",
      details: {
        description:
          "Re7's internal monitoring flagged the exploit in real time. At 2:46am UTC they notified partners across DeFi. By 3am UTC they set caps to 0 and removed impacted markets from supply queues.",
        tweets: [
          {
            author: "Re7 Labs",
            handle: "@Re7Labs",
            text: "Our flagship strategy - mRe7YIELD - has zero exposure to any of today's attacks. Our internal monitoring systems flagged this in real time, and at 2:46am UTC we were among the first to notify partners across DeFi.",
            url: "https://x.com/Re7Labs/status/2035770653261869480",
          },
        ],
      },
    },
    {
      date: "Mar 22, 2026 · 17:30 UTC",
      tag: "update" as const,
      text: "DefiMoon reports $334M in Fluid outflows — biggest daily outflow since protocol launch.",
      details: {
        tweets: [
          {
            author: "DefiMoon",
            handle: "@DefiMoon",
            text: "Wow brutal day for @0xfluid: $334m of outflows today, the biggest daily outflow since the protocol launched! This is more than 10x the size of the bad debt. TVL also dropped under $1b.",
            url: "https://x.com/DefiMoon/status/2035771008943079579",
          },
        ],
      },
    },
    {
      date: "Mar 22, 2026 · 18:36 UTC",
      tag: "update" as const,
      text: "Wumpy publishes comprehensive list of every vault and protocol hit by the exploit.",
      details: {
        description:
          "Semi-comprehensive list covering Morpho vaults (13+), Euler markets (2), Midas products (4), and additional protocols including Fluid, Venus, Lista DAO, Inverse, and Upshift.",
        tweets: [
          {
            author: "wumpy crypto",
            handle: "@wumpycrypto",
            text: "a semi-comprehensive list of every vault/protocol hit by the @ResolvLabs exploit: Morpho vaults, Euler markets, Midas products, yoUSD, Fluid, Venus Flux, Lista DAO USD1, Inverse DOLA, Upshift coreUSDC/upUSDC/earnAUSD. Some protocols are promising to cover bad debt (Inverse, Fluid).",
            url: "https://x.com/wumpycrypto/status/2035787782455451908",
          },
        ],
      },
    },
    {
      date: "Mar 22, 2026 · 20:55 UTC",
      tag: "response" as const,
      text: "Paul Frambot (Morpho CEO) provides full update — ~15 vaults with non-negligible exposure out of ~500; isolation working as designed.",
      details: {
        description:
          "Out of ~500 Morpho Vaults with >$10k in deposits, ~15 had non-negligible exposure. Lower-risk 'prime vaults' remained completely unaffected. Curators responded quickly with Morpho team assistance.",
        tweets: [
          {
            author: "Paul Frambot",
            handle: "@PaulFrambot",
            text: "Out of the ~500 Morpho Vaults with >$10k in deposits, there are ~15 vaults with non-negligible exposure. Every other vault without exposure, including lower-risk 'prime vaults', remained completely unaffected. These events showcase how Morpho's isolation works in practice.",
            url: "https://x.com/PaulFrambot/status/2035822674728083906",
          },
        ],
      },
    },
    {
      date: "Mar 22, 2026 · 21:25 UTC",
      tag: "exploit" as const,
      text: "Resolv Labs issues official statement — compromised private key, ~$80M uncollateralized USR minted, ~9M burned, $141M in assets held.",
      details: {
        description:
          "The incident resulted from unauthorized third-party actions including a targeted infrastructure compromise. Resolv's underlying collateral was not directly compromised. They are preparing to enable redemptions for pre-incident USR starting March 23.",
        tweets: [
          {
            author: "Resolv Labs",
            handle: "@ResolvLabs",
            text: "A malicious actor gained unauthorized access to Resolv infrastructure through compromised private key, resulting in the minting of approximately $80M of uncollateralized USR. The protocol currently holds approximately $141M in assets. We strongly advise against trading USR at this time.",
            url: "https://x.com/ResolvLabs/status/2035830314799599616",
          },
        ],
        links: [
          {
            label: "The Block — USR Depeg Report",
            url: "https://www.theblock.co/post/394582/resolvs-usr-stablecoin-depegs",
          },
        ],
      },
    },
    {
      date: "Mar 23, 2026 · 01:38 UTC",
      tag: "curator" as const,
      text: "Gauntlet publishes resolution update — discussing recovery with Resolv, preparing compensation plan.",
      details: {
        description:
          "Deposits disabled, caps reduced to 0. USDC Core on mainnet has $4.95M in wstUSR/USDC market with $2.91M in liquidity. USDC Frontier has $1.09M exposure. Gauntlet USD Alpha has no exposure.",
        tweets: [
          {
            author: "Gauntlet",
            handle: "@gauntlet_xyz",
            text: "We are discussing resolution with Resolv. For any remaining funds, Gauntlet is working on a compensation plan. Deposits are disabled and caps have been reduced to 0. Liquidity continues to improve in Core and Frontier.",
            url: "https://x.com/gauntlet_xyz/status/2035893955666256054",
          },
        ],
      },
    },
    {
      date: "Mar 23, 2026 · 08:00 UTC",
      tag: "update" as const,
      text: "Exposure Core contagion dashboard launched with 29+ affected vaults tracked.",
    },
    {
      date: "Mar 23, 2026 · 08:42 UTC",
      tag: "update" as const,
      text: "Serenity Research publishes detailed loss assessment — ~$24.5M uncovered post-exploit USR, RLP facing ~63% haircut if first-loss.",
      details: {
        description:
          "Analysis: 71M illicitly minted USR, 45M cashed out by hacker, ~13.5M transferred into Fluid post-exploit (Fluid to compensate), Gauntlet to compensate up to 7M. Remaining uncovered: ~$24.5M against $39M RLP assets.",
        tweets: [
          {
            author: "The Serenity Research",
            handle: "@SerenityFund",
            text: "If RLP takes first loss, ~63% haircut. Alternatively Resolv could issue debt tokens, but hacker still holds 20m unsold USR.",
            url: "https://x.com/SerenityFund/status/2036000705148764651",
          },
        ],
      },
    },
    {
      date: "Mar 23, 2026 · 08:50 UTC",
      tag: "update" as const,
      text: "YAM urges depositors to withdraw from affected Morpho vaults before curators force-remove markets in ~2.5 days.",
      details: {
        description:
          "Lists vaults with withdrawable liquidity vs. those with none. Notes many vaults with liquidity lent against wstUSR AFTER the incident, making Resolv coverage less likely.",
        tweets: [
          {
            author: "YAM",
            handle: "@yieldsandmore",
            text: "most vaults will force-remove in ~2.5 days (timelocks), socializing bad debt. Gauntlet USDC Core Mainnet: $20M deposits, 25% exposure. Many vaults with liquidity lent against wstUSR AFTER the incident.",
            url: "https://x.com/yieldsandmore/status/2036002710894305351",
          },
        ],
      },
    },
    {
      date: "Mar 23, 2026 · 10:02 UTC",
      tag: "curator" as const,
      text: "Clearstar Labs publishes incident update — $1.39M total exposure across 4 vaults, deposits blocked.",
      details: {
        description:
          "Clearstar Yield USDC (Ethereum): $1M direct RLP. Clearstar USDC Reactor (Ethereum): ~$294K indirect wstUSR via mAPOLLO. Clearstar USDC Reactor (Base): ~$92K indirect RLP via yoUSD. Clearstar High Yield USDC (Arbitrum): $4.3K direct RLP.",
        tweets: [
          {
            author: "Clearstar Labs",
            handle: "@ClearstarLabs",
            text: "We minimised direct exposure to RLP on our Morpho Vaults. Confident RLP markets will not see bad debt but awaiting Resolv's official communication.",
            url: "https://x.com/ClearstarLabs/status/2036020661911503182",
          },
        ],
      },
    },
    {
      date: "Mar 23, 2026 · 13:03 UTC",
      tag: "curator" as const,
      text: "Steakhouse Financial reconfirms zero exposure and zero losses across all vaults on all platforms.",
      details: {
        tweets: [
          {
            author: "Steakhouse Financial",
            handle: "@SteakhouseFi",
            text: "Zero exposure and zero losses across all Steakhouse vaults on all platforms. Our full company treasury is allocated to our own products.",
            url: "https://x.com/SteakhouseFi/status/2036066224598114435",
          },
        ],
      },
    },
    {
      date: "Mar 23, 2026 · 15:20 UTC",
      tag: "response" as const,
      text: "Euler Labs confirms ~$500K USDC loans collateralized by RLP on Arbitrum; Resolv-related Frontier markets paused.",
      details: {
        description:
          "Euler Yield market on Arbitrum paused with ~$500K USDC loans against RLP collateral. Resolv-related Frontier markets on Plasma paused with ~$50K in loans against USR. Pre-hack USR expected to settle 1:1.",
        tweets: [
          {
            author: "Euler Labs",
            handle: "@eulerfinance",
            text: "Based on Resolv's communication that pre-hack USR redemptions will be honored 1:1, this market is expected to settle gracefully. Monitoring and will share updates.",
            url: "https://x.com/eulerfinance/status/2036100865312907419",
          },
        ],
      },
    },
    {
      date: "Mar 22, 2026 · 09:41 UTC",
      tag: "response" as const,
      text: "DeFi Made Here confirms Fluid smart contracts are safe; limited bad debt will be 100% covered.",
      details: {
        tweets: [
          {
            author: "DMH",
            handle: "@DeFi_Made_Here",
            text: "Fluid smart contracts are safe and operate as intended. There is a limited bad debt, which will be 100% covered by Fluid if it remains after the incident is resolved.",
            url: "https://x.com/DeFi_Made_Here/status/2035653191329530199",
          },
        ],
      },
    },
    {
      date: "Mar 22, 2026 · 19:10 UTC",
      tag: "curator" as const,
      text: "9Summits publishes incident report — donation attack exploited Morpho vault edge case; bad debt limited to ~$41K USDC.",
      details: {
        description:
          "9Summits flagged the USR mint exploit at 3am UTC and set supply caps to 0 on Resolv markets. At 12:33pm UTC, 32 transactions attempted a donation attack exploiting a documented edge case in Morpho vault 1.1 architecture.",
        tweets: [
          {
            author: "9Summits",
            handle: "@nine_summits",
            text: "Expected bad debt limited to ~$41k USDC. Supply queue emptied and deposits paused.",
            url: "https://x.com/nine_summits/status/2035796291725283641",
          },
        ],
      },
    },
    {
      date: "Mar 22, 2026 · 21:27 UTC",
      tag: "response" as const,
      text: "Fluid secures short-term loans to cover 100% of bad debt from Lomashuk/cyberfund, weremeow, and Fluid core team.",
      details: {
        description:
          "Resolv confirmed they will cover all pre-incident USR positions and enable redemptions. Multiple investors expressed interest in purchasing $FLUID from treasury as additional backstop.",
        tweets: [
          {
            author: "Fluid",
            handle: "@0xfluid",
            text: "Fluid team secured short-term loans to cover 100% of bad debt. Smart contracts safe, all other markets normal, temporary rate volatility expected.",
            url: "https://x.com/0xfluid/status/2035830645357006877",
          },
        ],
      },
    },
    {
      date: "Mar 22, 2026 · 23:51 UTC",
      tag: "update" as const,
      text: "vaults.fyi adds warning indicators for all vaults impacted by the Resolv hack.",
      details: {
        tweets: [
          {
            author: "vaults.fyi",
            handle: "@vaultsfyi",
            text: "We've added warning indicators inside our app for vaults impacted by the Resolv hack. These include vaults on Morpho, Euler, Midas, Fluid, Upshift, YO, and others.",
            url: "https://x.com/vaultsfyi/status/2035867095897157757",
          },
        ],
      },
    },
    {
      date: "Mar 23, 2026 · 17:53 UTC",
      tag: "exploit" as const,
      text: "Resolv Labs sends onchain message to exploiter address, outlining path for return of funds.",
      details: {
        tweets: [
          {
            author: "Resolv Labs",
            handle: "@ResolvLabs",
            text: "An onchain message has been sent to the exploiter address, outlining a clear path for contact and return of funds in line with industry practices. The investigation is ongoing.",
            url: "https://x.com/ResolvLabs/status/2036139405157736564",
          },
        ],
      },
    },
    {
      date: "Mar 24, 2026 · 07:01 UTC",
      tag: "curator" as const,
      text: "Edge (WhyShock) confirms full exit from Fluid Plasma position — sbUSD vault fully unwound.",
      details: {
        description:
          "The sbUSD vault operated by Edge has fully exited its position on Fluid Plasma.",
        links: [
          {
            label: "Exit transaction on Plasma",
            url: "https://plasmascan.to/tx/0x2a412a797e7c0416a1fd63682f22b9db2d072f5e29838f5de2be2f5fef3fa77e",
          },
        ],
      },
    },
    {
      date: "Mar 23, 2026 · 07:51 UTC",
      tag: "update" as const,
      text: "Deepcryptodive warns unlisted Morpho vaults (Everstone, Etherealm) are susceptible to flashloan-assisted attack via RLP exposure.",
      details: {
        tweets: [
          {
            author: "Deepcryptodive",
            handle: "@deepcryptodive",
            text: "Anyone got a contact at Everstone or Etherealm? They have unlisted Morpho vaults that are susceptible to a specific flashloan-assisted attack. They might want to reconfigure before they take on more RLP exposure. My DMs are open",
            url: "https://x.com/deepcryptodive/status/2035987772364800056",
          },
        ],
      },
    },
    {
      date: "Mar 22, 2026 · 09:21 UTC",
      tag: "curator" as const,
      text: "kpk (formerly karpatkey) confirms limited RLP exposure in some Morpho Yield vaults; DAO treasuries unaffected.",
      details: {
        description:
          "Most kpk vaults had no exposure. All exposed positions in impacted protocols were closed and withdrawn immediately.",
        tweets: [
          {
            author: "kpk",
            handle: "@kpk_io",
            text: "We're aware of the Resolv USR exploit. kpk had limited RLP exposure in some of our Morpho Yield vaults. Most kpk vaults had no exposure. DAO treasuries were unaffected. All exposed positions in impacted protocols were closed and withdrawn immediately.",
            url: "https://x.com/kpk_io/status/2035648055492358369",
          },
        ],
      },
    },
    {
      date: "Mar 23, 2026 · 12:44 UTC",
      tag: "response" as const,
      text: "Lito confirms no bad debt on Venus Flux or Fluid Plasma — wstUSR positions pre-hack, will be fully restored by Resolv.",
      details: {
        tweets: [
          {
            author: "lito",
            handle: "@litocoen",
            text: "there's no bad debt anywhere besides on ethereum and even that is covered as per Fluid's latest announcement. Those positions on both chains were opened pre-hack and will thus be fully restored by the Resolv team.",
            url: "https://x.com/litocoen/status/2036061510053867951",
          },
        ],
      },
    },
    {
      date: "Mar 23, 2026 · 18:41 UTC",
      tag: "response" as const,
      text: "Resolv Labs enables redemptions for pre-incident USR for allowlisted users.",
      details: {
        tweets: [
          {
            author: "Resolv Labs",
            handle: "@ResolvLabs",
            text: "Resolv Digital Assets Ltd. is in contact with all allowlisted users with USR holdings at the time of the incident. Redemptions for pre-incident USR are now enabled for this group. Updates for other users will follow.",
            url: "https://x.com/ResolvLabs/status/2036151331950604534",
          },
        ],
      },
    },
    {
      date: "Mar 23, 2026 · 19:27 UTC",
      tag: "curator" as const,
      text: "Gauntlet meets with Resolv — confident a positive outcome will be achieved; compensation plan in progress.",
      details: {
        description:
          "USDC Core on mainnet has $11.52M in liquidity. USDC Frontier has ~$350K in liquidity. Prime, Gauntlet USD Alpha and other strategies on their vault platform are not impacted.",
        tweets: [
          {
            author: "Gauntlet",
            handle: "@gauntlet_xyz",
            text: "Gauntlet and Resolv met today to discuss next steps. We are confident a positive outcome will be achieved for suppliers of affected Morpho vaults via remediation from Resolv. Gauntlet is also working on a compensation plan, if required. Liquidity update: USDC Core on mainnet has $11.52M in liquidity. USDC Frontier on mainnet has ~$350k in liquidity. Prime, Gauntlet USD Alpha and other Gauntlet strategies on our vault platform are not impacted.",
            url: "https://x.com/gauntlet_xyz/status/2036162856518099115",
          },
        ],
      },
    },
    {
      date: "Mar 23, 2026 · 19:58 UTC",
      tag: "curator" as const,
      text: "kpk publishes full update — all Ethereum funds fully recovered, zero loss to depositors. Vault withdrawal queue handled exit automatically.",
      details: {
        description:
          "Concentration limits had capped maximum exposure. The vault's withdrawal queue recovered the full amount same-block with no manual intervention. Deposits into Ethereum Yield vault re-enabled. Arbitrum vault still paused with ~$1k remaining exposure.",
        tweets: [
          {
            author: "kpk",
            handle: "@kpk_io",
            text: "Update on the Resolv situation. TLDR: kpk's vault architecture worked as designed under real stress. We detected the risk, paused new allocations, and the vault exited automatically the moment liquidity became available. All Ethereum funds fully recovered. Zero loss to depositors.",
            url: "https://x.com/kpk_io/status/2036170798646349902",
          },
        ],
      },
    },
    {
      date: "Mar 23, 2026 · 20:13 UTC",
      tag: "response" as const,
      text: "Resolv Foundation pauses protocol and app — Season 4 airdrop claims and RESOLV staking temporarily unavailable.",
      details: {
        tweets: [
          {
            author: "Resolv Foundation",
            handle: "@ResolvCore",
            text: "In light of the recent incident, the Resolv protocol has been temporarily paused (including the app) to contain the impact of the exploit. As a result: Season 4 airdrop claims are temporarily unavailable; Staking and unstaking of RESOLV tokens are temporarily inaccessible.",
            url: "https://x.com/ResolvCore/status/2036174437129789607",
          },
        ],
      },
    },
    {
      date: "Mar 23, 2026 · 20:37 UTC",
      tag: "response" as const,
      text: "Fluid begins debt repayments — starting with Venus Flux & Fluid Plasma. 100% of user assets remain fully secured.",
      details: {
        description:
          "LPs have been engaged directly through Fluid & Resolv teams. Remaining debt will be repaid over coming days. All markets continue to operate as intended. No user action required.",
        tweets: [
          {
            author: "Fluid",
            handle: "@0xfluid",
            text: "Important update on the Resolv incident. Debt repayments have begun on Fluid. LPs have been engaged directly through Fluid & Resolv teams. Starting with Venus Flux & Fluid Plasma. The remaining debt will be repaid over the coming days. 100% of user assets on Fluid remain fully secured.",
            url: "https://x.com/0xfluid/status/2036180670590947633",
          },
        ],
      },
    },
    {
      date: "Mar 23, 2026 · 22:47 UTC",
      tag: "response" as const,
      text: "3Jane confirms ~$800K indirect Resolv exposure across $107M+ — would have incurred $0 bad debt even without Fluid subsidy.",
      details: {
        description:
          "3Jane extends cross-margined, recourse credit lines underwritten against the full balance sheet rather than isolated collateral, avoiding concentrated single-asset tail risk.",
        tweets: [
          {
            author: "3Jane",
            handle: "@3janexyz",
            text: "Despite ~$800k in indirect Resolv exposure across $107M+ in value verified, 3Jane would have incurred $0 bad debt even without a Fluid subsidy. 3Jane extends cross-margined, recourse credit lines underwritten against the full balance sheet rather than isolated collateral.",
            url: "https://x.com/3janexyz/status/2036213233024114737",
          },
        ],
      },
    },
  ].sort((a, b) => {
    // Parse "Mar 22, 2026 · 05:24 UTC" → sortable date
    const parse = (d: string) => {
      const clean = d.replace(" · ", " ").replace(" UTC", "");
      return new Date(clean).getTime() || 0;
    };
    return parse(b.date) - parse(a.date); // newest first
  });

  const timestamp = formatDate(summary.dataTimestamp);

  // Covering + recovered protocols for BadDebtPanel
  const coveringProtocolsMap = new Map<string, string>();
  for (const ve of vaults) {
    if (ve.vault.status === "covering" || ve.vault.status === "recovered") {
      coveringProtocolsMap.set(ve.vault.protocol, ve.vault.name);
    }
  }
  const coveringProtocolsList = Array.from(coveringProtocolsMap.entries()).map(
    ([protocol, name]) => ({ name, protocol }),
  );
  const coveredTotal = vaults
    .filter(
      (ve) => ve.vault.status === "covering" || ve.vault.status === "recovered",
    )
    .reduce((sum, ve) => sum + ve.toxicExposureUsd, 0);

  const protocolRows: DashboardProtocolRow[] = sortedProtocols.map(
    ([protocol, data]) => {
      const display = getProtocolDisplay(protocol);
      const protocolBreakdown = vaults
        .filter((ve) => ve.vault.protocol === protocol)
        .flatMap((ve) => ve.breakdown)
        .reduce<ToxicBreakdownEntry[]>((acc, breakdown) => {
          const existing = acc.find((entry) => entry.asset === breakdown.asset);
          if (existing) {
            existing.amountUsd += breakdown.amountUsd;
            existing.pct += breakdown.pct;
          } else {
            acc.push({ ...breakdown });
          }
          return acc;
        }, []);

      return {
        name: display.name,
        logoSrc: getProtocolIcon(protocol),
        fallbackInitials: display.initials,
        fallbackColor: display.color,
        meta: `${data.vaultCount} vault${data.vaultCount !== 1 ? "s" : ""}`,
        amount:
          data.exposureUsd > 0 ? formatUsdCompact(data.exposureUsd) : "Unknown",
        breakdown: protocolBreakdown.map((breakdown) => ({
          asset: breakdown.asset,
          amountUsd: breakdown.amountUsd,
          color: assetColorBySymbol[breakdown.asset] ?? "rgba(0,0,0,0.15)",
        })),
      };
    },
  );

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--surface-secondary)" }}
    >
      <ExposureDashboardBody
        banner={{
          title: config.title,
          description: config.description,
          timestamp: formatDate(config.incidentDate),
          status: config.status,
        }}
        totalPanel={{
          title: "Total At-Risk Allocation",
          value: summary.totalToxicExposureUsd,
          subtitle: `across ${summary.vaultCount} vault${summary.vaultCount !== 1 ? "s" : ""} · ${summary.protocolCount} protocol${summary.protocolCount !== 1 ? "s" : ""}`,
        }}
        debtPanel={{
          title: "Bad Debt Status",
          realizedDebt: summary.totalToxicExposureUsd,
          coveredDebt: coveredTotal,
          uncoveredGap: summary.totalToxicExposureUsd - coveredTotal,
          recoveryRate:
            summary.totalToxicExposureUsd > 0
              ? coveredTotal / summary.totalToxicExposureUsd
              : 0,
          coveringProtocols: coveringProtocolsList,
        }}
        donutPanel={{
          title: "By Toxic Asset",
          entries: donutEntries,
          total: totalAssetExposure,
        }}
        curatorPanel={{
          title: "Estimated Bad Debt by Curator",
          content: <BadDebtByCurator vaults={vaults} />,
        }}
        metrics={[
          { label: "Affected Vaults", value: summary.vaultCount },
          { label: "Protocols Impacted", value: summary.protocolCount },
          { label: "Promised / Recovered", value: summary.coveringCount },
          {
            label: "Highest Exposure %",
            value: highestPctVault ? highestPctVault.exposurePct * 100 : 0,
            format: "percent",
          },
        ]}
        protocolRadarEntries={protocolRadarEntries}
        chainRadarEntries={chainRadarEntries}
        protocolPanel={{
          title: "Exposure by Protocol",
          rows: protocolRows,
        }}
        timelinePanel={{
          title: "Timeline",
          entries: timelineEntries,
        }}
        vaultTablePanel={{
          title: "All Affected Vaults",
          vaults,
          toxicAssets: config.toxicAssets,
        }}
        footer={{
          left: `Exposure Core · Data refreshed every 10 min · Last update: ${timestamp}`,
          right: "Approximate data · Verify with each protocol",
        }}
      />
    </div>
  );
}
