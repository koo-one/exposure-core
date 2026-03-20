import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { adapterFactories } from "../../../src/adapters/registry.js";
import { getGauntletDeploymentNodeIds } from "../../../src/adapters/gauntlet/deployments.js";
import type { GraphSnapshot } from "../../../src/types.js";
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
  const draftGraphs = await buildDraftGraphsByAsset([
    adapterFactories.gauntlet,
  ]);

  for (const [, store] of draftGraphs) {
    const snapshot = store.toSnapshot({ sources: ["gauntlet"] });
    const rootNodeId = snapshot.nodes[0]?.id;

    if (!rootNodeId) {
      throw new Error("Missing root node id for gauntlet snapshot");
    }

    const persistSnapshot = async (
      nextRootId: string,
      payload: GraphSnapshot,
    ): Promise<void> => {
      const outPath = resolveFixtureOutputPath(
        root,
        "gauntlet",
        `${nextRootId}.json`,
        argv,
      );

      await writeJsonFile(outPath, payload);
    };

    const deploymentNodeIds = getGauntletDeploymentNodeIds();

    if (deploymentNodeIds.length > 0) {
      for (const nextRootId of deploymentNodeIds) {
        const depSnapshot = cloneSnapshotWithRootId(snapshot, nextRootId);

        await persistSnapshot(nextRootId, depSnapshot);
      }
    }

    if (!deploymentNodeIds.includes(rootNodeId)) {
      await persistSnapshot(rootNodeId, snapshot);
    }
  }
};

void run(process.argv.slice(2));
