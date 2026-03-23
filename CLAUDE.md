# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Exposure Core is a DeFi asset allocation visualization platform. It has two parts:

1. **Server pipeline** (`server/`) — adapter-based graph generation that fetches data from 9+ DeFi protocols, builds allocation graphs (nodes + edges), and uploads them to Vercel Blob storage.
2. **Web app** (`apps/web/`) — Next.js 14 (App Router) frontend that renders interactive treemap visualizations of the graph data using d3-hierarchy + React-Konva.

## Commands

```bash
# Install dependencies
pnpm install

# Generate graph fixtures (required before running web locally)
pnpm graphs:dev

# Start web dev server (auto-generates asset logo manifest)
pnpm dev:web

# Build web app
pnpm build:web

# Lint web app
pnpm lint:web

# Production graph generation + upload to Vercel Blob
pnpm graphs:prod
```

There is no test suite configured yet (`pnpm test` is a placeholder).

## Pre-commit Hooks

- **lint-staged**: runs Prettier on `{js,mjs,ts,tsx,json,md}` and ESLint `--fix` on `{ts,tsx}`
- **commitlint**: enforces [Conventional Commits](https://www.conventionalcommits.org/) (e.g. `feat:`, `fix:`, `chore:`)

## Environment Variables

- Root: copy `.env.example` → `.env.local` — needs `DUNE_API_KEY` (required for resolv adapter), `BLOB_READ_WRITE_TOKEN`
- Web: copy `apps/web/.env.example` → `apps/web/.env.local` — needs `BLOB_READ_WRITE_TOKEN`

## Architecture

### Data Pipeline (server/)

```
External APIs (Midas, Morpho, Ethena, Gauntlet, Euler, etc.)
    ↓
Adapters (server/src/adapters/) — each implements fetchCatalog → buildRootNode → normalizeLeaves
    ↓
Orchestrator (server/src/orchestrator.ts) — runs all adapters, builds per-asset GraphStores
    ↓
Resolvers (server/src/resolvers/) — Debank expands wallet addresses into protocol positions
    ↓
GraphStore (server/src/core/graph.ts) — in-memory node/edge management with upsert/merge
    ↓
Protocol Grouping (server/src/exposure/protocolGraphs.ts) — groups snapshots by protocol
    ↓
Search Index (server/src/exposure/searchIndex.ts) — builds searchable metadata
    ↓
Vercel Blob Storage (exposure/graph/{protocol}.json, exposure/search-index.json)
```

Production pipeline runs daily at 00:00 UTC via Vercel cron (`server/api/cron/generate-graphs.ts`).

### Adapter Pattern

Each adapter in `server/src/adapters/` implements the `Adapter<TCatalog, TAllocation>` interface from `server/src/adapters/types.ts`:
- `fetchCatalog()` — fetch all data from the protocol's API
- `getAssetByAllocations()` — group allocations by asset
- `buildRootNode()` / `buildEdge()` — construct graph nodes and edges
- `normalizeLeaves()` — expand wallet allocations via resolvers (e.g. Debank)

Adapters are registered in `server/src/adapters/registry.ts`.

### Graph Types

Core types in `server/src/types.ts`:
- **Node**: `{ id: "chain:protocol:address", name, chain, protocol, details, tvlUsd, apy, logoKeys }`
- **Edge**: `{ from, to, allocationUsd, lendingPosition? }`
- **GraphSnapshot**: `{ nodes, edges, sources }`

Node kinds: Yield, Lending, Lending Market, Deposit, Staked, Locked, Liquidity Pool, Protection, Perpetuals, Investment.

### Fixture System

Local development uses fixtures instead of live API calls:
- `server/fixtures/scripts/graphs-all.ts` — orchestrates all fixture generation
- `server/fixtures/scripts/core/mock-fetch.ts` — intercepts fetch() to serve fixture data (blocks paid Debank calls)
- `server/fixtures/providers/` — mock data per protocol
- `server/fixtures/scenarios/` — test scenario definitions
- Output goes to `server/fixtures/output/` (consumed by web API routes in dev)

### Web App (apps/web/)

**Routing**: Next.js App Router
- `/` — home page with universal treemap view + search/filter
- `/asset/[id]` — individual asset detail page with drill-down

**API Routes**:
- `/api/graph/[id]` — fetches graph snapshot (Blob in prod, fixtures in dev)
- `/api/search-index` — serves search index (redirects to Blob in prod)

**Treemap Visualization**:
- `AssetTreeMap.tsx` — data prep, "Others" aggregation (tiles <2% grouped)
- `AssetTreeMapKonva.tsx` — canvas rendering via React-Konva with d3-hierarchy layout
- Dynamically imported with SSR disabled (canvas doesn't work server-side)

**State Management**: URL-driven — all UI state (filters, drilldown, search, history) lives in query params for shareable links.

**Logo System** (`src/lib/logos.ts`): Multi-strategy resolution — explicit logoKeys → branded mappings → name inference. Asset logo manifest auto-generated from `public/logos/assets/*.svg` during dev/build.

### Key Normalization Rules (server/src/utils.ts)

- Chain aliases: ethereum→eth, arbitrum→arb, optimism→op, hyperliquid→hyper
- Protocol normalization: pendle2/pendle-v2→pendlev2, aave3/aave-v3→aavev3, morphoblue→morpho-v2
- Node IDs are canonical: `{chain}:{protocol}:{address}`, all lowercase

## Monorepo Structure

pnpm workspaces with packages in `apps/*` and `packages/*`. Currently only `apps/web` exists. The root `package.json` has workspace-level scripts prefixed with `:web` (e.g. `dev:web`, `build:web`). ESLint and Prettier configs live at root.
