# TODOS

## Audit affected vault list against fixture data

**What:** Scan all protocol fixture files (morpho.json, euler.json) to produce the complete vault-to-nodeId mapping for the incident config. The current plan lists ~29 entries but fixture data shows 37 adapter-backed vaults across eth/arb/base/bsc/plasma/tac/hyperevm chains.
**Why:** The incident config needs accurate `nodeIds: Record<string, string>` per vault. Missing nodeIds = missing vaults on the dashboard.
**Pros:** Ensures complete coverage from day one; avoids discovering missing vaults post-launch.
**Cons:** ~10 min of work with CC.
**Context:** The plan's vault list counts unique vault names (e.g., "kpk USDC Yield") but each name can have multiple chain deployments with different addresses. Run the fixture scan script from the eng review to enumerate all affected entries. Midas products (mBASIS, mAPOLLO, mEDGE, msyrupUSDp) have no USR/wstUSR/RLP in fixture data — classify as `source: "manual"`.
**Depends on:** Nothing. Should be done before or alongside incident config file creation.

## Configure subdomain routing (usr.exposure.forum)

**What:** Set up Next.js middleware to map `usr.exposure.forum` → `/incident/resolv-usr` and configure Vercel wildcard DNS for `*.exposure.forum`.
**Why:** Dedicated subdomain per incident is the deployment model. Clean URLs for Twitter/Discord sharing.
**Pros:** Memorable, shareable URL; reusable pattern for future incidents.
**Cons:** Requires Vercel DNS configuration (manual step); middleware adds minimal overhead per request.
**Context:** Standard Next.js middleware pattern — check `request.headers.get('host')` for subdomain, rewrite to `/incident/[slug]`. Vercel supports wildcard subdomains on custom domains. Blocks deployment but not development (dev can use localhost:3000/incident/resolv-usr directly).
**Depends on:** Vercel domain configuration for exposure.forum.

## Venus Protocol (Flux) — exposure data collection

**What:** Fetch USR/wstUSR/RLP exposure data from Venus Protocol's Flux product.
**Why:** Venus Flux had USR as collateral before the exploit. Market is currently suspended.
**Context:** REST API available at `api.venus.io/markets`. USR market is suspended post-exploit. Low priority since market is frozen.
**Depends on:** Nothing.

## Lista DAO (USD1) — exposure data collection

**What:** Fetch USR/wstUSR/RLP exposure data from Lista DAO's USD1 vault on BNB Chain.
**Why:** USD1 vault had USR exposure.
**Context:** No REST API available. Would need on-chain contract reads on BNB Chain. Contracts at `docs.bsc.lista.org`. Low priority.
**Depends on:** Nothing.

## Gearbox Protocol — exposure data collection

**What:** Fetch USR/wstUSR/RLP exposure from Gearbox lending pools.
**Why:** Gearbox has USR as allowed collateral in USDC lending pools.
**Context:** No public API or subgraph. Data must come from on-chain MarketCompressor and CreditAccountCompressor contracts via RPC. Docs at `docs.gearbox.finance/dev/utilities/compressors`. The project has `viem` installed for on-chain reads. Medium effort.
**Depends on:** Contract addresses from `dev.gearbox.fi` state JSON files.
