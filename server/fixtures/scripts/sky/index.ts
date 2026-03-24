import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getSkyDeploymentNodeIds } from "../../../src/adapters/sky/deployments.js";
import { adapterFactories } from "../../../src/adapters/registry.js";
import { buildDraftGraphsByAsset } from "../../../src/orchestrator.js";
import {
  cloneSnapshotWithRootId,
  resolveFixtureOutputPath,
  writeJsonFile,
} from "../core/io.js";

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(here, "..", "..", "..");

export const run = async (argv: string[]): Promise<void> => {
  const root = serverDir;
  const draftGraphs = await buildDraftGraphsByAsset([adapterFactories.sky]);

  for (const [asset, store] of draftGraphs) {
    const snapshot = store.toSnapshot({ sources: ["sky"] });
    const rootNodeId = snapshot.nodes[0]?.id;

    if (!rootNodeId) {
      throw new Error(`Missing root node id for asset: ${asset}`);
    }

    const outPath = resolveFixtureOutputPath(
      root,
      "sky",
      `${rootNodeId}.json`,
      argv,
    );

    await writeJsonFile(outPath, snapshot);

    const extraDeploymentNodeIds = getSkyDeploymentNodeIds(rootNodeId);

    for (const nextRootId of extraDeploymentNodeIds) {
      const nextSnapshot = cloneSnapshotWithRootId(snapshot, nextRootId);
      const nextOutPath = resolveFixtureOutputPath(
        root,
        "sky",
        `${nextRootId}.json`,
        argv,
      );

      await writeJsonFile(nextOutPath, nextSnapshot);
    }
  }
};

void run(process.argv.slice(2));
