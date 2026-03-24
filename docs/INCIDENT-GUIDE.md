# Incident Dashboard — Developer Guide

How to maintain, update, and extend the contagion tracking dashboard.

## Quick Start

```bash
pnpm install
pnpm graphs:dev          # Generate graph fixtures (required for dev)
pnpm dev:web             # Start dev server
# Visit http://localhost:3000/incident/resolv
```

## Architecture

```
Incident Config (resolv-usr.ts)
    ↓
Batch API (/api/incident/[slug]/data)
    ├── Adapter vaults → loads graph snapshots → runs toxic detection
    └── Manual vaults → uses hardcoded exposure data
    ↓
Overview Page (/incident/[slug])
    ├── Incident banner, USR price chart
    ├── Bad debt status panel + donut chart
    ├── Metrics strip (vaults, protocols, resolved, highest %)
    ├── Exposure by protocol (mini donuts)
    ├── Timeline
    └── Vault table (sortable, filterable, per-chain rows)
```

## Key Files

| File                                                 | Purpose                                                    |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| `apps/web/src/data/incidents/resolv-usr.ts`          | **Incident config** — vault list, statuses, hardcoded data |
| `apps/web/src/lib/incident/detection.ts`             | Toxic asset detection algorithm (multi-layer)              |
| `apps/web/src/lib/incident/detection.test.ts`        | 18 unit tests for detection                                |
| `apps/web/src/lib/incident/types.ts`                 | All TypeScript types                                       |
| `apps/web/src/lib/incident/logos.ts`                 | Logo path mappings (protocols, curators, chains, tokens)   |
| `apps/web/src/lib/incident/format.ts`                | Number formatting (formatUsdCompact, etc.)                 |
| `apps/web/src/lib/graphLoader.ts`                    | Shared graph snapshot loading (blob/fixtures)              |
| `apps/web/src/app/incident/[slug]/page.tsx`          | Overview page (Server Component)                           |
| `apps/web/src/app/incident/[slug]/layout.tsx`        | Layout with nav + OG metadata                              |
| `apps/web/src/app/api/incident/[slug]/data/route.ts` | Batch exposure API endpoint                                |
| `apps/web/src/middleware.ts`                         | Subdomain routing + root redirect                          |
| `apps/web/src/components/incident/`                  | All UI components                                          |
| `server/scripts/incident/`                           | Data collection scripts                                    |

## Common Tasks

### Add a new vault

Edit `apps/web/src/data/incidents/resolv-usr.ts`:

**Adapter vault** (exposure computed from graph data):

```typescript
{
  source: "adapter",
  name: "Vault Name",
  protocol: "morpho",        // must match a protocol in graph data
  chains: ["eth"],
  curator: "Curator Name",   // optional
  status: "affected",        // affected | covering | recovered
  nodeIds: {
    eth: "eth:morpho-v1:0x...",  // canonical node ID from graph data
  },
},
```

**Manual vault** (hardcoded exposure):

```typescript
{
  source: "manual",
  name: "Vault Name",
  protocol: "fluid",
  chains: ["eth"],
  status: "affected",
  totalTvlUsd: 42_000_000,      // optional — total vault TVL for % calculation
  exposureUsd: 1_200_000,       // toxic exposure amount
  toxicAssetBreakdown: [
    { asset: "wstUSR", amountUsd: 1_200_000, pct: 0.028 },
  ],
},
```

### Add a timeline entry

Timeline entries are in the overview page (`apps/web/src/app/incident/[slug]/page.tsx`) in the `timelineEntries` array. Add a new entry:

```typescript
{
  date: "Mar 24, 2026 · 14:00 UTC",
  tag: "response",    // exploit | response | curator | update
  text: "Protocol X announces full coverage of bad debt.",
  details: {          // optional — shown on click/expand
    description: "Additional context about the announcement.",
    tweets: [
      {
        author: "Protocol X",
        handle: "@protocolx",
        text: "We are covering all bad debt...",
        url: "https://x.com/protocolx/status/123456",
      },
    ],
    links: [
      {
        label: "Governance Proposal",
        url: "https://governance.protocolx.com/proposal/42",
      },
    ],
  },
},
```

**Tags** (all render the same ghost style, tags are for data categorization):

- `exploit` — the attack itself
- `response` — protocol response/coverage announcement
- `curator` — vault curator action (pause, reallocation, recovery)
- `update` — general updates (dashboard launch, analysis posts)

Entries are displayed in the order they appear in the array. Put newest first.

### Update vault status

Change the `status` field:

- `"affected"` — exposed, unresolved
- `"covering"` → displays as **"Promised"** — protocol announced coverage
- `"recovered"` — funds fully recovered, zero loss

Add `statusNote` for context and `statusSource` for the announcement URL.

### Update hardcoded exposure data

Manual vault numbers are in `resolv-usr.ts` with inline comments showing the source:

```typescript
exposureUsd: 671_622, // Total Supplied: $671,621.91
```

Update the number and the comment. Push and redeploy.

### Find affected vaults from graph data

Scan fixture data for vaults with USR/wstUSR/RLP exposure:

```bash
python3 -c "
import json
for proto in ['morpho', 'euler']:
    with open(f'server/fixtures/output/{proto}.json') as f:
        d = json.load(f)
    for snap_id, snap in d.items():
        for n in snap['nodes']:
            if any(tok in n.get('name','') for tok in ['USR','wstUSR','RLP']):
                root = snap['nodes'][0]['name']
                print(f'{snap_id} | {root}')
                break
"
```

### Add a new protocol

1. Add vault entries to `resolv-usr.ts`
2. Add protocol display config in `page.tsx`:
   ```typescript
   const PROTOCOL_DISPLAY = {
     newprotocol: { color: "#hex", initials: "NP" },
   };
   ```
3. Add logo at `apps/web/public/logos/icn/icn-newprotocol.png`
4. Add mapping in `apps/web/src/lib/incident/logos.ts`:
   ```typescript
   const PROTOCOL_ICN = {
     newprotocol: ICN("newprotocol"),
   };
   ```

### Add a new chain

1. Add logo at `apps/web/public/logos/icn/icn-chainname.png`
2. Add mapping in `logos.ts`:
   ```typescript
   const CHAIN_ICN = {
     chainname: ICN("chainname"),
   };
   ```

### Add a curator logo

1. Add logo at `apps/web/public/logos/icn/icn-curatorname.png`
2. Add mapping in `logos.ts`:
   ```typescript
   const CURATOR_ICN = {
     "curator-key": ICN("curatorname"),
   };
   ```
3. The curator key is auto-derived from the display name (lowercased, spaces removed). Check `getCuratorIcon()` in `logos.ts`.

### Run data collection scripts

```bash
# YO Protocol (yoUSD) — fetches from api.yo.xyz
tsx --env-file=.env.local server/scripts/incident/fetch-yields.ts

# Upshift — fetches from api.upshift.finance
tsx --env-file=.env.local server/scripts/incident/fetch-upshift.ts

# Fluid — requires Dune API (paid) or manual entry from fluid.io/stats
tsx --env-file=.env.local server/scripts/incident/fetch-fluid.ts

# Inverse Finance — curl their API directly
curl -s https://www.inverse.finance/api/f2/fixed-markets | python3 -c "
import sys,json
for m in json.load(sys.stdin):
    if 'usr' in m.get('name','').lower() or 'wstusr' in m.get('name','').lower():
        print(f'{m[\"name\"]}: totalDebt={m.get(\"totalDebt\",0)}, ceiling={m.get(\"ceiling\",0)}')
"
```

## Detection Algorithm

The detection runs per-vault and uses 4 layers:

1. **Slash-split** (Morpho): `"USDC/USR"` → check collateral side only
2. **Substring** (Euler): `"Resolv USR vault"` → word-boundary match
3. **Derivatives**: `PT-RLP-*`, `MC-USR`, `PT-wstUSR-*`
4. **Whitelist**: `toxicAssetNodeIds` safety net

Tests: `pnpm test` (18 tests in `detection.test.ts`)

## Deployment

```bash
# Build check
pnpm build:web

# Deploy to production (requires permission)
vercel --prod

# The cron project (graph regeneration) is separate:
# exposure-core-cron — runs every 10 min
# Redeploy from Vercel dashboard if schedule changes
```

**URLs:**

- Production: https://exposure.forum/incident/resolv
- Subdomain: resolv.exposure.forum (requires DNS setup)
- Root redirect: exposure.forum → /incident/resolv

## Logos

All logos live in `apps/web/public/logos/icn/icn-{name}.png`. The mapping is in `apps/web/src/lib/incident/logos.ts`.

Missing logos fall back to colored initials automatically.

## Creating a New Incident

To track a different exploit in the future:

1. Create `apps/web/src/data/incidents/new-slug.ts` (copy `resolv-usr.ts` as template)
2. Register in `apps/web/src/lib/incident/config.ts`:
   ```typescript
   const configs = {
     resolv: () => import("@/data/incidents/resolv-usr"),
     "new-slug": () => import("@/data/incidents/new-slug"),
   };
   ```
3. Visit `/incident/new-slug`
4. Add subdomain in middleware if needed

## Using AI (Claude Code) for Common Tasks

This dashboard was built and maintained using Claude Code. Here are prompts you can use to do common tasks without reading the code:

**Add a vault:**

> "Add [Protocol] [Vault Name] on [chain] to the incident config. It's an adapter/manual vault with nodeId [0x...]."

**Update status after a curator announcement:**

> "kpk announced full recovery on ETH. Update their vault status to recovered with this tweet link: [url]"

**Fetch latest exposure data:**

> "Run the upshift data collection script and update the config with the latest numbers"

**Add a timeline entry:**

> "Add a timeline entry: [Date] — [Protocol] announced [what happened]. Source: [tweet url]"

**Find missing vaults:**

> "Scan the fixture data for any Euler/Morpho vaults with USR exposure that aren't in the config yet"

**Add a new protocol:**

> "Add [Protocol Name] to the dashboard. They have [N] vaults affected. Here's the data: [details]"

**Deploy:**

> "redeploy" (deploys to production via `vercel --prod`)

**Check data sources:**

> "What's the current exposure for Inverse Finance? Check their API."

**Design changes:**

> "Generate HTML prototypes for [design change]. Open them in the browser so I can compare."

The AI has full context of the codebase through `CLAUDE.md` and this guide. It knows the file structure, types, and patterns. Just describe what you want in plain English.

## Open TODOs

See `TODOS.md` for pending work:

- Venus Protocol, Lista DAO exposure data
- Gearbox on-chain reads (MarketCompressor)
- Fluid on-chain resolver automation
- Subdomain DNS configuration (resolv.exposure.forum)
