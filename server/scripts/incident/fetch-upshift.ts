/**
 * Fetch Upshift vaults and scan for USR/wstUSR/RLP/resolv exposure.
 *
 * Usage:
 *   tsx --env-file=.env.local server/scripts/incident/fetch-upshift.ts
 */

const BASE_URL = "https://api.upshift.finance/v1";

const RELEVANT_NAMES = [
  "coreusdp",
  "upusdp",
  "earnausd",
  "coreusd",
  "upusd",
  "usr",
  "resolv",
];

function containsResolv(obj: unknown): boolean {
  const s = JSON.stringify(obj ?? "").toLowerCase();
  return (
    s.includes("resolv") ||
    s.includes(" usr") ||
    s.includes('"usr') ||
    s.includes("wstusr") ||
    s.includes("rlp")
  );
}

async function main() {
  console.log("=== Upshift Vaults ===");
  console.log(`Fetching: ${BASE_URL}/tokenized_vaults\n`);

  const res = await fetch(`${BASE_URL}/tokenized_vaults`);
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  const data = await res.json();

  // Normalise to array
  const vaults: unknown[] = Array.isArray(data)
    ? data
    : (data?.data ?? data?.vaults ?? data?.results ?? []);

  console.log(`Total vaults fetched: ${vaults.length}`);

  const relevant: unknown[] = [];

  for (const vault of vaults) {
    const v = vault as Record<string, unknown>;
    const name = String(
      v?.name ?? v?.symbol ?? v?.vault_name ?? "",
    ).toLowerCase();
    const byName = RELEVANT_NAMES.some((r) => name.includes(r));
    const byContent = containsResolv(vault);

    if (byName || byContent) {
      relevant.push(vault);
    }
  }

  if (relevant.length === 0) {
    console.log("\nNo vaults with USR/wstUSR/RLP/resolv references found.\n");
    console.log("Dumping all vault names for manual inspection:");
    for (const vault of vaults) {
      const v = vault as Record<string, unknown>;
      const name = v?.name ?? v?.symbol ?? v?.vault_name ?? "(no name)";
      const address =
        v?.address ?? v?.vault_address ?? v?.contract_address ?? "?";
      const chain = v?.chain ?? v?.network ?? v?.chainId ?? "?";
      const tvl = v?.tvl ?? v?.total_assets ?? v?.totalAssets ?? "?";
      console.log(`  ${name} | ${address} | chain=${chain} | tvl=${tvl}`);
    }
    return;
  }

  console.log(`\nFound ${relevant.length} relevant vault(s):\n`);

  for (const vault of relevant) {
    const v = vault as Record<string, unknown>;
    console.log(`Vault: ${v?.name ?? v?.symbol ?? v?.vault_name}`);
    console.log(
      `  Address : ${v?.address ?? v?.vault_address ?? v?.contract_address ?? "?"}`,
    );
    console.log(`  Chain   : ${v?.chain ?? v?.network ?? v?.chainId ?? "?"}`);
    console.log(
      `  TVL     : ${v?.tvl ?? v?.total_assets ?? v?.totalAssets ?? "?"}`,
    );
    console.log(`  Status  : ${v?.status ?? v?.state ?? "?"}`);

    // Print allocation breakdown if available
    const allocations =
      v?.allocations ??
      v?.pools ??
      v?.positions ??
      v?.breakdown ??
      v?.assets ??
      null;
    if (allocations) {
      console.log(`  Allocations: ${JSON.stringify(allocations, null, 4)}`);
    }

    console.log(`  Raw:`);
    console.log(JSON.stringify(vault, null, 4));
    console.log();
  }
}

main().catch(console.error);
