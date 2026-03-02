import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { adapterFactories } from "../../../src/adapters/registry";
import { getGauntletDeploymentNodeIds } from "../../../src/adapters/gauntlet/deployments";
import type { GraphSnapshot } from "../../../src/types";
import { buildDraftGraphsByAsset } from "../../../src/orchestrator";
import { putJsonToBlob } from "../../../api/exposure/blob";
import { graphSnapshotBlobPath } from "../../../api/exposure/paths";

import { writeJsonFile, cloneSnapshotWithRootId } from "../core/io";

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(here, "..", "..", "..");

export const run = async (argv: string[]): Promise<void> => {
  const root = serverDir;
  const shouldUpload = argv.includes("--upload");

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
      const outPath = resolve(
        root,
        "fixtures",
        "output",
        "gauntlet",
        `${nextRootId}.json`,
      );

      await writeJsonFile(outPath, payload);

      if (shouldUpload) {
        await putJsonToBlob(graphSnapshotBlobPath(nextRootId), payload);
      }
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
