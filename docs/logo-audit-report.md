# Logo Audit Report

Audit scope:

- root-node logo in the beige header
- blue treemap tile logos in allocation views
- source of truth from official protocol/product UIs

## Verified fixes applied

### Wrong root logos fixed via resolver/search-index updates

- `base:morpho-v2:0x8effa741061aaa2d8a5012a9b09a2d31d8b628d7` `ARCHITECT Global Value`
  - official UI: Morpho vault page shows `USDC`
  - before: protocol fallback (`morpho`)
  - now: `logoKeys: ["usdc"]`

- `eth:morpho-v1:0x62efa7cacc11caa959a8f956ec4f683302397e5c` `YieldNest RWA`
- `eth:morpho-v2:0xa1b096268d200d0ecfd57015700f6a0da9c494e2` `YieldNest RWA`
  - official UI: Morpho vault page shows `USDC`
  - before: protocol fallback (`morpho`)
  - now: `logoKeys: ["usdc"]`

- `base:gauntlet:0x000000000001cdb57e58fa75fe420a0f4d6640d5` `Gauntlet USD Alpha`
- `eth:gauntlet:0x3bd9248048df95db4fbd748c6cd99c1baa40bad0` `Gauntlet USD Alpha`
- `arb:gauntlet:0x000000001dc8bd45d7e7829fb1c969cbe4d0d1ec` `Gauntlet USD Alpha`
- `op:gauntlet:0x000000001dc8bd45d7e7829fb1c969cbe4d0d1ec` `Gauntlet USD Alpha`
  - official UI: Gauntlet vault page shows `USDC`
  - before: protocol fallback (`gauntlet`)
  - now: `logoKeys: ["usdc"]`

- `eth:morpho-v1:0xa3fc33543beee52bc60babc80af3d29789637b6d` `Clearstar Reactor ETH`
- `base:morpho-v2:0xbca4e2e24a7cfa776e4282cc8eb06f04738b71da` `Clearstar Reactor ETH`
- `eth:morpho-v1:0x739d8a60ed4b14e4cb6dcaeaf79d2ec0ca092237` `SingularV ETH`
- `eth:morpho-v2:0xf39ac02dec8fae8292d5f42202e4cd885356256b` `SingularV ETH`
  - official UI expectation: wrapped ether branding
  - before: plain `eth`
  - now: `logoKeys: ["weth"]`

- `eth:morpho-v2:0xbeeff89abb7815ccd5182bd1ff82c4a4f8fcb13d` `Steakhouse High Yield Instant`
- `eth:morpho-v2:0xbeeff07d991c04cd640de9f15c08ba59c4fedeb7` `Steakhouse High Yield Instant`
- `eth:morpho-v2:0xbeeff2c5bf38f90e3482a8b19f12e5a6d2fca757` `Steakhouse High Yield Instant`
- `base:morpho-v2:0xbeeff7ae5e00aae3db302e4b0d8c883810a58100` `Steakhouse High Yield Instant`
  - official UI expectation: underlying asset logo on the Morpho vault page
  - before: Base variant resolved to `v1.1` and fell back to protocol branding
  - now: variants resolve to `ausd`, `usdt`, or `usdc` as appropriate

### Exact SVG assets kept after the SVG-only reset

- `apps/web/public/logos/assets/eul.svg`
  - source: official Euler token image

- canonical SVG assets retained for normalized identities introduced during the audit:
  - `apps/web/public/logos/assets/neutrlusd.svg`
  - `apps/web/public/logos/assets/katananetworktoken.svg`
  - `apps/web/public/logos/assets/wrappedflare.svg`
  - `apps/web/public/logos/assets/unitfartcoin.svg`
  - `apps/web/public/logos/assets/capusd.svg`
  - `apps/web/public/logos/assets/jitostakedsol.svg`
  - `apps/web/public/logos/assets/tbtcv2.svg`
  - `apps/web/public/logos/assets/tusde.svg`
  - `apps/web/public/logos/assets/yu.svg`

- all non-SVG additions from the earlier pass were removed

### Existing local assets reused correctly

- `yzUSD`, `syzUSD`, and `yzPP` continue to resolve to existing local SVGs
- `USDC`, `WETH`, and other pre-existing asset SVGs are reused after search-index fixes rather than duplicated

## Resolver changes made

- `server/src/exposure/searchIndex.ts`
  - added recursive descendant-weighted logo inference so branded roots can inherit the correct downstream asset logo
  - moved descendant-based inference ahead of weaker branded-name guesses
  - added exact root overrides where official UI verification required it
  - ignored version-like suffixes such as `v1.1` when choosing branded asset candidates

- `server/src/resolvers/debank/utils.ts`
  - added `yieldnest rwa -> usdc`
  - multi-word branded names that only inferred `eth` now prefer `weth`

- `apps/web/src/lib/logos.ts`
  - added `yieldnest rwa -> usdc`
  - ignored version-like branded suffixes such as `v1.1`
  - multi-word branded names that only inferred `eth` now prefer `weth`
  - added key aliases such as `aavetoken -> aave` and `morphotoken -> morpho`
  - removed non-SVG file resolution and removed generated badge / monogram fallback output
  - PT resolution now reuses canonical normalized identities instead of date/version-specific asset files

- `apps/web/src/components/AssetTreeMap.tsx`
  - lending-position tiles now prefer exact collateral/borrow asset keys (or explicit node `logoKeys`) instead of forcing a generic protocol logo

- `apps/web/scripts/generate-asset-logo-manifest.ts`
  - manifest generation is back to SVG-only asset discovery

## Current inventory snapshot

After the changes in this worktree:

- root entries audited from `server/fixtures/output/search-index.json`: `737`
- root entries with no logo path: `0`
- root entries still falling back to protocol logos: `15`
- direct treemap tiles inventoried from fixture snapshots: `2919`
- direct treemap direct-child groups still rendering as protocol-logo or no-logo states: `35`
- of those groups, all protocol-logo states are SVG-based and all no-logo states stay intentionally empty rather than using raster or generated substitutes

## Remaining unresolved treemap categories

The remaining grouped cases are SVG-only-safe states:

- `midas.json` `Unclassified`
  - verified as an internal bucket without a product or asset logo in source UI context

- `sky.json` allocator / PSM / RWA code labels
  - `ALLOCATOR-BLOOM-A`
  - `ALLOCATOR-OBEX-A`
  - `ALLOCATOR-SPARK-A`
  - `LITE-PSM-USDC-A`
  - `PSM-PAX-A`
  - `RWA001-A`
  - `RWA002-A`
  - `RWA004-A`
  - `RWA005-A`
  - `RWA009-A`
  - verified as text-only internal strategy / facility labels rather than branded product logos

- `ethena.json` venue rows
  - `Binance:*`, `Bybit:*`, `OKX:*` use venue logos and those protocol-logo fallbacks are correct
  - `Deribit: Liquid Cash`, `INTX: Liquid Cash`, `Unallocated: Liquid Cash` remain intentionally logo-less because the source UI presents them as text-only cash buckets

- `midas.json` protocol-level entries
  - `Lighter`
  - `Resolv`
  - raw `LendingPosition` groups under `mHyperBTC` and `mHyperETH`
  - `YT Staked NUSD 4JUN2026`
  - `Global Dollar/PT Global Dollar 28MAY2026`
  - `YT Ethena sUSDE 9APR2026`
  - verified as protocol-level or Pendle/YT contexts where protocol branding is the correct UI-level fallback

## Remaining SVG-only limitations

- Exact asset logos that only existed in the previous non-SVG pass now intentionally fall back to protocol SVGs instead of rendering raster assets.
- Current root protocol-SVG fallback set: `Edge UltraYield TON`, `Edge UltraYield tsTON`, `Edge UltraYield USN`, `Euler Swell pzETH`, `Euler Swell swETH`, `EVK Vault eARB-1`, `EVK Vault eARGt-3`, `EVK Vault eELIT-1`, `EVK Vault eMCK2-1`, `EVK Vault eTHE-1`, `K3 Capital UTY`, `MEV Capital Blue LBGT`, `MEV Capital BYUSD`, `Re7 Labs lisUSD`, `Re7 Labs TON`.
- Those entries need true source SVG extraction before they can become exact asset logos again under the new rule set.

## Verification

- `lsp_diagnostics` clean for:
  - `server/src/exposure/searchIndex.ts`
  - `server/src/resolvers/debank/utils.ts`
  - `apps/web/src/lib/logos.ts`
  - `apps/web/src/components/AssetTreeMap.tsx`
  - `apps/web/scripts/generate-asset-logo-manifest.ts`
  - `apps/web/src/lib/generated/assetLogoKeys.ts`
- `pnpm build:web` passes

## Caveat

Local `next dev` browser checks sometimes continued to show stale header imagery even after `/api/search-index` returned the updated `logoKeys`. The generated fixture data, resolver output, diagnostics, and production build all reflected the corrected values, so this looks like a local dev/HMR verification artifact rather than persisted data regression.
