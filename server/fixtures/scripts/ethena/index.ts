import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { adapterFactories } from "../../../src/adapters/registry";
import { getEthenaDeploymentNodeIds } from "../../../src/adapters/ethena/deployments";
import { buildDraftGraphsByAsset } from "../../../src/orchestrator";
import { putJsonToBlob } from "../../../api/exposure/blob";
import { graphSnapshotBlobPath } from "../../../api/exposure/paths";

import { writeJsonFile, cloneSnapshotWithRootId } from "../core/io";

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(here, "..", "..", "..");

export const run = async (argv: string[]): Promise<void> => {
  const root = serverDir;
  const shouldUpload = argv.includes("--upload");

  const persistSnapshot = async (rootNodeId: string, snapshot: unknown) => {
    const outPath = resolve(
      root,
      "fixtures",
      "output",
      "ethena",
      `${rootNodeId}.json`,
    );

    await writeJsonFile(outPath, snapshot);

    if (shouldUpload) {
      await putJsonToBlob(graphSnapshotBlobPath(rootNodeId), snapshot);
    }
  };

  const draftGraphs = await buildDraftGraphsByAsset([adapterFactories.ethena]);

  for (const [asset, store] of draftGraphs) {
    const snapshot = store.toSnapshot({ sources: ["ethena"] });
    const rootNodeId = snapshot.nodes[0]?.id;
    if (!rootNodeId) {
      throw new Error(`Missing root node id for asset: ${asset}`);
    }

    await persistSnapshot(rootNodeId, snapshot);

    const extraDeploymentNodeIds = getEthenaDeploymentNodeIds(rootNodeId);

    for (const nextRootId of extraDeploymentNodeIds) {
      const depSnapshot = cloneSnapshotWithRootId(snapshot, nextRootId);

      await persistSnapshot(nextRootId, depSnapshot);
    }
  }
};

void run(process.argv.slice(2));
