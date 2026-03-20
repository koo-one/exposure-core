import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { adapterFactories } from "../../../src/adapters/registry.js";
import { buildDraftGraphsByAsset } from "../../../src/orchestrator.js";
import { resolveFixtureOutputPath, writeJsonFile } from "../core/io.js";
import { createMockFetch, withMockFetch } from "../core/mock-fetch.js";
import {
  createDebankBundleHandler,
  createDebankHandler,
} from "../resolvers/debank/mock.js";

const YUZU_BUNDLE_ID = "220643";

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(here, "..", "..", "..");

export const run = async (argv: string[]): Promise<void> => {
  const root = serverDir;
  const fetchImpl = createMockFetch({
    enabledProviders: ["debank"],
    allowRealFetch: true,
    handlers: [
      createDebankBundleHandler({
        root,
        protocol: "yuzu",
        bundleId: YUZU_BUNDLE_ID,
      }),
      createDebankHandler({ root, protocol: "yuzu" }),
    ],
  });

  await withMockFetch(fetchImpl, async () => {
    const draftGraphs = await buildDraftGraphsByAsset([adapterFactories.yuzu]);

    for (const [asset, store] of draftGraphs) {
      const snapshot = store.toSnapshot({ sources: ["yuzu"] });
      const rootNodeId = snapshot.nodes[0]?.id;
      if (!rootNodeId) {
        throw new Error(`Missing root node id for asset: ${asset}`);
      }

      const outPath = resolveFixtureOutputPath(
        root,
        "yuzu",
        `${rootNodeId}.json`,
        argv,
      );

      await writeJsonFile(outPath, snapshot);
    }
  });
};

void run(process.argv.slice(2));
