# exposure-core

## Local Dev (Graph Data + Web)

### 1) Clone

```bash
git clone <YOUR_REPO_URL>
cd exposure-core
pnpm install
```

### 2) Create `.env.local`

`.env.local` is ignored by git (it contains local secrets).

```bash
cp .env.example .env.local
```

Edit `.env.local` and set at least:

- `DUNE_API_KEY` (required for the `resolv` adapter metrics)

### 3) Generate Graph Fixtures (dev)

This writes JSON snapshots under `server/fixtures/output/` and generates
`server/fixtures/output/search-index.json`.

```bash
pnpm graphs:dev
```

### 4) Start Web Dev Server

```bash
pnpm dev:web
```

Notes:

- `apps/web` now uses the standard Next.js `dev` / `build` / `start` scripts; environment selection comes from Next/Vercel defaults instead of `node --env-file` flags.
- If the web app needs local env vars, copy `apps/web/.env.example` to `apps/web/.env.local` and fill it in.
- Debank is mocked in local fixture scripts (no paid Debank calls). Dune is real (needs `DUNE_API_KEY`).
- If you skip fixture generation, the web API routes will not find `server/fixtures/output/*`.
