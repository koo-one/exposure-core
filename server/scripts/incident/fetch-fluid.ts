/**
 * Fetch Fluid wstUSR vault data via the Dune Analytics API.
 *
 * Strategy:
 *   1. Try the Dune dashboard endpoint to discover query IDs from tobyleung/fluid.
 *   2. For any query that looks vault/wstUSR-related, fetch its latest results.
 *   3. Try known public Fluid/wstUSR Dune query IDs directly.
 *   4. Fall back to executing a custom SQL query against fluid Spellbook tables.
 *      NOTE: query creation and execution require a Dune paid plan. If using
 *      a free API key, add the query manually at dune.com then pass the
 *      resulting query ID as the FLUID_QUERY_ID env var.
 *
 * Usage:
 *   tsx --env-file=.env.local server/scripts/incident/fetch-fluid.ts
 *
 * Optional env vars:
 *   FLUID_QUERY_ID   — override query ID to fetch results from
 */

const DUNE_BASE = "https://api.dune.com/api/v1";
const DUNE_API_KEY = process.env.DUNE_API_KEY;
if (!DUNE_API_KEY) throw new Error("DUNE_API_KEY env var not set");

const HEADERS: Record<string, string> = {
  "x-dune-api-key": DUNE_API_KEY,
};

const VAULT_KEYWORDS = [
  "wstusr",
  "usr",
  "fluid",
  "vault",
  "collateral",
  "resolv",
  "rlp",
];

function isVaultRelated(text: string): boolean {
  const lower = text.toLowerCase();
  return VAULT_KEYWORDS.some((k) => lower.includes(k));
}

// Poll a Dune execution until it completes (or times out)
async function waitForExecution(
  executionId: string,
  timeoutMs = 60_000,
): Promise<Record<string, unknown> | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${DUNE_BASE}/execution/${executionId}/results`, {
      headers: HEADERS,
    });
    if (!res.ok) {
      console.log(`  Execution status check failed: ${res.status}`);
      return null;
    }
    const body = (await res.json()) as Record<string, unknown>;
    const state = (body?.state as string) ?? "";
    if (state === "QUERY_STATE_COMPLETED") return body;
    if (state === "QUERY_STATE_FAILED" || state === "QUERY_STATE_CANCELLED") {
      console.log(`  Execution ended with state: ${state}`);
      return null;
    }
    console.log(`  Execution state: ${state} — waiting 3s…`);
    await new Promise((r) => setTimeout(r, 3_000));
  }
  console.log("  Timed out waiting for execution.");
  return null;
}

async function tryDashboard(): Promise<number[]> {
  console.log("--- Step 1: Fetch dashboard tobyleung/fluid ---");
  const res = await fetch(`${DUNE_BASE}/dashboard/tobyleung/fluid`, {
    headers: HEADERS,
  });
  console.log(`  Status: ${res.status}`);

  if (!res.ok) {
    console.log(
      "  Dashboard endpoint not available (expected — Dune API v1 may not expose this).",
    );
    return [];
  }

  const dashboard = (await res.json()) as Record<string, unknown>;
  console.log("  Dashboard metadata:");
  console.log(JSON.stringify(dashboard, null, 2));

  // Extract query IDs from whatever shape Dune returns
  const queryIds: number[] = [];
  const widgets: unknown[] =
    (dashboard?.widgets as unknown[]) ??
    (dashboard?.queries as unknown[]) ??
    (dashboard?.visualizations as unknown[]) ??
    [];

  for (const widget of widgets) {
    const w = widget as Record<string, unknown>;
    const qid =
      w?.query_id ?? w?.id ?? (w?.query as Record<string, unknown>)?.id ?? null;
    if (typeof qid === "number") queryIds.push(qid);
    else if (typeof qid === "string") queryIds.push(Number(qid));
  }

  console.log(
    `  Found query IDs: ${queryIds.length > 0 ? queryIds.join(", ") : "none"}`,
  );
  return queryIds;
}

async function fetchQueryResults(queryId: number): Promise<void> {
  console.log(`\n--- Fetching results for query ${queryId} ---`);

  // Try the latest results endpoint (no new execution needed)
  const res = await fetch(`${DUNE_BASE}/query/${queryId}/results`, {
    headers: HEADERS,
  });
  console.log(`  Status: ${res.status}`);

  if (!res.ok) {
    console.log(
      `  Could not fetch results (query may be private or not exist).`,
    );
    return;
  }

  const body = (await res.json()) as Record<string, unknown>;
  const queryMeta = body?.query_id ?? queryId;
  const rows: unknown[] =
    ((body?.result as Record<string, unknown>)?.rows as unknown[]) ?? [];

  console.log(`  Query: ${queryMeta}`);
  console.log(`  Rows returned: ${rows.length}`);

  if (rows.length === 0) {
    console.log("  No rows.");
    return;
  }

  // Filter rows that mention USR/wstUSR
  const relevant = rows.filter((r) => isVaultRelated(JSON.stringify(r)));
  console.log(`  Relevant rows (vault/USR/wstUSR): ${relevant.length}`);

  if (relevant.length > 0) {
    console.log(JSON.stringify(relevant, null, 2));
  } else {
    console.log("  First 3 rows (sample):");
    console.log(JSON.stringify(rows.slice(0, 3), null, 2));
  }
}

async function runCustomQuery(): Promise<void> {
  console.log(
    "\n--- Step 3: Execute custom Dune SQL for Fluid wstUSR vaults ---",
  );

  // Try a few plausible Fluid Spellbook table names
  const sql = `
SELECT
  vault_address,
  collateral_token,
  collateral_token_symbol,
  borrow_token,
  borrow_token_symbol,
  total_supply_usd,
  total_borrow_usd,
  block_date
FROM fluid_ethereum.vaults
WHERE
  collateral_token_symbol ILIKE '%USR%'
  OR collateral_token_symbol ILIKE '%RLP%'
ORDER BY block_date DESC
LIMIT 50
`.trim();

  console.log("  SQL:\n", sql);

  const execRes = await fetch(`${DUNE_BASE}/query/execute`, {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ query_sql: sql }),
  });

  if (!execRes.ok) {
    const errText = await execRes.text();
    console.log(`  Execute endpoint failed: ${execRes.status} — ${errText}`);
    console.log("\n  Trying alternative: create a new named query first…");
    await tryCreateAndExecute(sql);
    return;
  }

  const execBody = (await execRes.json()) as Record<string, unknown>;
  console.log("  Execution started:", JSON.stringify(execBody, null, 2));

  const executionId = execBody?.execution_id as string;
  if (!executionId) {
    console.log("  No execution_id returned.");
    return;
  }

  const results = await waitForExecution(executionId);
  if (results) {
    const rows: unknown[] =
      ((results?.result as Record<string, unknown>)?.rows as unknown[]) ?? [];
    console.log(`\n  Results (${rows.length} rows):`);
    console.log(JSON.stringify(rows, null, 2));
  }
}

async function tryCreateAndExecute(sql: string): Promise<void> {
  // Some Dune API versions require creating a query object first
  const createRes = await fetch(`${DUNE_BASE}/query`, {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "fluid-wstusr-exposure-incident",
      query_sql: sql,
      is_private: true,
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    console.log(`  Create query failed: ${createRes.status} — ${errText}`);
    return;
  }

  const createBody = (await createRes.json()) as Record<string, unknown>;
  console.log("  Query created:", JSON.stringify(createBody, null, 2));

  const queryId = createBody?.query_id as number;
  if (!queryId) {
    console.log("  No query_id in response.");
    return;
  }

  // Execute it
  const execRes = await fetch(`${DUNE_BASE}/query/${queryId}/execute`, {
    method: "POST",
    headers: HEADERS,
  });

  if (!execRes.ok) {
    const errText = await execRes.text();
    console.log(`  Execute failed: ${execRes.status} — ${errText}`);
    return;
  }

  const execBody = (await execRes.json()) as Record<string, unknown>;
  const executionId = execBody?.execution_id as string;
  if (!executionId) {
    console.log("  No execution_id.");
    return;
  }

  const results = await waitForExecution(executionId);
  if (results) {
    const rows: unknown[] =
      ((results?.result as Record<string, unknown>)?.rows as unknown[]) ?? [];
    console.log(`\n  Results (${rows.length} rows):`);
    console.log(JSON.stringify(rows, null, 2));
  }
}

// Known public Dune query IDs for Fluid vault / wstUSR data.
// These are publicly accessible without a paid plan (read-only latest results).
// Add more as they are discovered at dune.com/tobyleung/fluid.
const KNOWN_QUERY_IDS: number[] = [
  // tobyleung/fluid dashboard queries — IDs to be confirmed by visiting the dashboard
  // Placeholder: set FLUID_QUERY_ID env var to override
];

async function main() {
  console.log("=== Fluid (Dune) ===\n");

  // Allow overriding via env
  const envQueryId = process.env.FLUID_QUERY_ID
    ? Number(process.env.FLUID_QUERY_ID)
    : null;
  if (envQueryId) KNOWN_QUERY_IDS.push(envQueryId);

  // Step 1: discover queries from the dashboard
  const dashboardQueryIds = await tryDashboard();

  // Step 2: fetch results for each discovered query
  const allQueryIds = [...new Set([...dashboardQueryIds, ...KNOWN_QUERY_IDS])];
  if (allQueryIds.length > 0) {
    console.log(
      `\n--- Step 2: Fetching results for ${allQueryIds.length} query ID(s) ---`,
    );
    for (const qid of allQueryIds) {
      await fetchQueryResults(qid);
    }
  } else {
    console.log("\n--- Step 2: No query IDs found ---");
    console.log(
      "  TIP: Visit https://dune.com/tobyleung/fluid, find a vault query ID,",
    );
    console.log(
      "  and re-run with: FLUID_QUERY_ID=<id> tsx ... fetch-fluid.ts",
    );
  }

  // Step 3: fall back to a custom query (requires paid Dune plan)
  await runCustomQuery();

  console.log(
    "\n--- Reference SQL (paste at dune.com/queries/new on free plan) ---",
  );
  console.log(
    `
SELECT
  vault_address,
  collateral_token,
  collateral_token_symbol,
  borrow_token,
  borrow_token_symbol,
  total_supply_usd,
  total_borrow_usd,
  block_date
FROM fluid_ethereum.vaults
WHERE
  collateral_token_symbol ILIKE '%USR%'
  OR collateral_token_symbol ILIKE '%RLP%'
ORDER BY block_date DESC
LIMIT 50
  `.trim(),
  );
}

main().catch(console.error);
