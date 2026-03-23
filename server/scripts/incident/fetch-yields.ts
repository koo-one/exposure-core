/**
 * Fetch YO Protocol (yoUSD) vault data and scan for USR/wstUSR/RLP exposure.
 *
 * Usage:
 *   tsx --env-file=.env.local server/scripts/incident/fetch-yields.ts
 */

const BASE_URL = "https://api.yo.xyz/api/v1";
const VAULT_ADDRESS = "0x0000000f2eB9f69274678c76222B35eEc7588a65";
const NETWORK = "base";

const KEYWORDS = ["usr", "wstusr", "rlp", "resolv"];

function searchForKeywords(
  obj: unknown,
  path = "",
): { path: string; value: unknown }[] {
  const hits: { path: string; value: unknown }[] = [];

  if (obj === null || obj === undefined) return hits;

  if (typeof obj === "string") {
    const lower = obj.toLowerCase();
    if (KEYWORDS.some((k) => lower.includes(k))) {
      hits.push({ path, value: obj });
    }
    return hits;
  }

  if (typeof obj === "number" || typeof obj === "boolean") return hits;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      hits.push(...searchForKeywords(obj[i], `${path}[${i}]`));
    }
    return hits;
  }

  if (typeof obj === "object") {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const childPath = path ? `${path}.${key}` : key;
      // Also check if the key itself matches
      if (KEYWORDS.some((k) => key.toLowerCase().includes(k))) {
        hits.push({ path: childPath, value });
      }
      hits.push(...searchForKeywords(value, childPath));
    }
  }

  return hits;
}

async function main() {
  console.log("=== YO Protocol (yoUSD) ===");
  console.log(`Fetching vault: ${NETWORK}/${VAULT_ADDRESS}\n`);

  const res = await fetch(`${BASE_URL}/vault/${NETWORK}/${VAULT_ADDRESS}`);
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  const data = await res.json();

  console.log("--- Raw Response ---");
  console.log(JSON.stringify(data, null, 2));

  console.log("\n--- Keyword Scan (USR / wstUSR / RLP / resolv) ---");
  const hits = searchForKeywords(data);
  if (hits.length === 0) {
    console.log("No USR/wstUSR/RLP/resolv references found in response.");
  } else {
    for (const hit of hits) {
      console.log(`  ${hit.path}: ${JSON.stringify(hit.value)}`);
    }
  }

  // Best-effort structured summary
  console.log("\n--- Summary ---");
  const name: string =
    data?.name ?? data?.vault_name ?? data?.symbol ?? "unknown";
  const tvl: unknown =
    data?.tvl ?? data?.total_assets ?? data?.totalAssets ?? data?.aum ?? "?";
  console.log(`Vault name: ${name}`);
  console.log(`TVL: ${tvl}`);

  // Attempt to find allocation breakdown
  const allocations: unknown =
    data?.allocations ??
    data?.pools ??
    data?.positions ??
    data?.breakdown ??
    data?.assets ??
    null;

  if (allocations) {
    console.log("\nAllocation breakdown:");
    const items = Array.isArray(allocations)
      ? allocations
      : Object.values(allocations);
    for (const item of items as unknown[]) {
      const itemStr = JSON.stringify(item).toLowerCase();
      const isRelevant = KEYWORDS.some((k) => itemStr.includes(k));
      const marker = isRelevant ? " <-- RELEVANT" : "";
      console.log(`  ${JSON.stringify(item)}${marker}`);
    }
  } else {
    console.log("No allocation breakdown field found at top level.");
  }
}

main().catch(console.error);
