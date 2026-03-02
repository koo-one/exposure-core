import { readdir } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { adapterFactories } from "../../../src/adapters/registry";
import type { GraphSnapshot } from "../../../src/types";
import { buildDraftGraphsByAsset } from "../../../src/orchestrator";
import { putJsonToBlob } from "../../../api/exposure/blob";
import { graphSnapshotBlobPath } from "../../../api/exposure/paths";

import { readJson, writeJsonFile } from "../core/io";
import { createMockFetch, withMockFetch } from "../core/mock-fetch";
import {
  createMidasAllocationsHandler,
  type MidasAllocationFixture,
} from "./mock";

interface Scenario {
  name: string;
  assets: string[];
  providers?: {
    debank?: {
      walletsDir?: string;
    };
  };
}

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(here, "..", "..", "..");

const getFlagValue = (argv: string[], flag: string): string | null => {
  const idx = argv.indexOf(flag);
  const value = idx >= 0 ? argv[idx + 1] : null;
  return value && !value.startsWith("--") ? value : null;
};

const loadScenarios = async (argv: string[]): Promise<Scenario[]> => {
  const root = serverDir;
  const scenariosDir = resolve(root, "fixtures", "scenarios");

  const scenarioName = getFlagValue(argv, "--scenario");
  if (scenarioName) {
    const scenarioPath = resolve(scenariosDir, `${scenarioName}.json`);
    const scenario = await readJson<Scenario>(scenarioPath);
    return [scenario];
  }

  const shouldAll = argv.includes("--all") || argv.length === 0;
  if (!shouldAll) return [];

  const files = (await readdir(scenariosDir, { withFileTypes: true }))
    .filter((ent) => ent.isFile() && ent.name.endsWith(".json"))
    .map((ent) => resolve(scenariosDir, ent.name));

  const scenarios: Scenario[] = [];
  for (const file of files) {
    const scenario = await readJson<Scenario>(file);
    if (!scenario?.name || !Array.isArray(scenario.assets)) continue;
    if (!scenario.name.startsWith("m")) continue;
    scenarios.push(scenario);
  }

  return scenarios;
};

const tryReadJson = async (path: string): Promise<unknown | null> => {
  try {
    return await readJson<unknown>(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};

const parseDebankProfileAddress = (link: string | null): string | null => {
  if (!link) return null;
  if (!link.includes("debank.com/profile")) return null;

  try {
    const url = new URL(link);
    const segments = url.pathname.split("/");
    const addr = segments[segments.length - 1]?.toLowerCase() ?? "";
    return addr.startsWith("0x") ? addr : null;
  } catch {
    return null;
  }
};

const jsonResponse = (data: unknown): Response =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const collectScenarioAssets = (
  scenarios: Scenario[],
): {
  requestedAssets: Set<string>;
  walletsDirByAsset: Map<string, string>;
} => {
  const requestedAssets = new Set<string>();
  const walletsDirByAsset = new Map<string, string>();

  for (const scenario of scenarios) {
    for (const asset of scenario.assets) requestedAssets.add(asset);
    const walletsDir = scenario.providers?.debank?.walletsDir;
    if (typeof walletsDir === "string" && walletsDir.trim()) {
      const trimmed = walletsDir.trim();
      for (const asset of scenario.assets) {
        walletsDirByAsset.set(asset, trimmed);
      }
    }
  }

  return { requestedAssets, walletsDirByAsset };
};

const loadMidasAllocations = async (
  root: string,
): Promise<MidasAllocationFixture[]> => {
  const allocationsPath = resolve(
    root,
    "fixtures",
    "providers",
    "midas",
    "allocations.json",
  );
  const allocations = await readJson<MidasAllocationFixture[]>(allocationsPath);

  if (!Array.isArray(allocations)) {
    throw new Error(
      "fixtures/providers/midas/allocations.json must be an array",
    );
  }

  return allocations;
};

const createDebankMultiAssetHandler = (config: {
  root: string;
  protocol: string;
  assets: string[];
  walletsDirByAsset: Map<string, string>;
  allocations: MidasAllocationFixture[];
}) => {
  const { root, protocol, assets, walletsDirByAsset, allocations } = config;

  // Wallet address -> Midas asset mapping (best-effort).
  const walletToAsset = new Map<string, string>();
  for (const row of allocations) {
    const asset = (row as { product?: unknown }).product;
    if (typeof asset !== "string") continue;

    const addr = parseDebankProfileAddress(
      (row as { link?: string | null }).link ?? null,
    );
    if (!addr) continue;

    // Prefer first-seen mapping; duplicates across assets are unexpected.
    if (!walletToAsset.has(addr)) walletToAsset.set(addr, asset);
  }

  const candidates = assets.map((asset) => {
    const walletsDir = walletsDirByAsset.get(asset)?.trim();
    return {
      asset,
      walletsDir:
        walletsDir && walletsDir.length > 0
          ? walletsDir
          : "providers/debank/wallets/{protocol}/{asset}",
    };
  });

  const resolveWalletFixture = (params: {
    walletsDir: string;
    asset: string;
    walletAddress: string;
    fileName: string;
  }): string => {
    const resolvedWalletsDir = params.walletsDir
      .replace("{protocol}", protocol)
      .replace("{asset}", params.asset);

    if (isAbsolute(resolvedWalletsDir)) {
      return resolve(resolvedWalletsDir, params.walletAddress, params.fileName);
    }

    return resolve(
      root,
      "fixtures",
      resolvedWalletsDir,
      params.walletAddress,
      params.fileName,
    );
  };

  return async (url) => {
    let fileName: string | null = null;
    if (url.includes("/user/complex_protocol_list")) {
      fileName = "complex-protocol-list.json";
    } else if (url.includes("/user/complex_app_list")) {
      fileName = "complex-app-list.json";
    } else if (url.includes("/user/all_token_list")) {
      fileName = "all-token-list.json";
    } else {
      return null;
    }

    const walletAddress = new URL(url).searchParams.get("id")?.toLowerCase();
    if (!walletAddress) return jsonResponse([]);

    const primaryAsset = walletToAsset.get(walletAddress) ?? null;
    const ordered = primaryAsset
      ? [
          ...candidates.filter((c) => c.asset === primaryAsset),
          ...candidates.filter((c) => c.asset !== primaryAsset),
        ]
      : candidates;

    for (const cand of ordered) {
      const payload = await tryReadJson(
        resolveWalletFixture({
          walletsDir: cand.walletsDir,
          asset: cand.asset,
          walletAddress,
          fileName,
        }),
      );

      if (!payload) continue;
      if (!Array.isArray(payload)) {
        throw new Error(`${fileName} fixture must be an array`);
      }

      return jsonResponse(payload);
    }

    return jsonResponse([]);
  };
};

export const run = async (argv: string[]): Promise<void> => {
  const root = serverDir;
  const shouldUpload = argv.includes("--upload");

  const scenarios = await loadScenarios(argv);
  const { requestedAssets, walletsDirByAsset } =
    collectScenarioAssets(scenarios);
  const allocations = await loadMidasAllocations(root);

  const debankHandler = createDebankMultiAssetHandler({
    root,
    protocol: "midas",
    assets: Array.from(requestedAssets),
    walletsDirByAsset,
    allocations,
  });

  const fetchImpl = createMockFetch({
    enabledProviders: ["midas", "debank"],
    handlers: [createMidasAllocationsHandler({ allocations }), debankHandler],
  });

  await withMockFetch(fetchImpl, async () => {
    const draftGraphs = await buildDraftGraphsByAsset([adapterFactories.midas]);

    for (const [asset, store] of draftGraphs) {
      if (requestedAssets.size > 0 && !requestedAssets.has(asset)) continue;

      const snapshot: GraphSnapshot = store.toSnapshot({ sources: ["midas"] });
      const rootNodeId = snapshot.nodes[0]?.id;
      if (!rootNodeId) {
        throw new Error(`Missing root node id for asset: ${asset}`);
      }

      const outPath = resolve(
        root,
        "fixtures",
        "output",
        "midas",
        `${rootNodeId}.json`,
      );

      await writeJsonFile(outPath, snapshot);

      if (shouldUpload) {
        await putJsonToBlob(graphSnapshotBlobPath(rootNodeId), snapshot);
      }
    }
  });
};

void run(process.argv.slice(2));
