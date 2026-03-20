import { readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { GraphSnapshot } from "../../../src/types.js";

import {
  readJson,
  resolveFixturesOutputRoot,
  writeJsonFile,
} from "../core/io.js";

type GraphSnapshotGroup = Record<string, GraphSnapshot>;

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(here, "..", "..", "..");

const main = async (): Promise<void> => {
  const outputDir = resolveFixturesOutputRoot(serverDir, process.argv.slice(2));
  const entries = await readdir(outputDir, { withFileTypes: true });
  const protocolDirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  for (const protocol of protocolDirs) {
    const protocolDir = resolve(outputDir, protocol);
    const files = (await readdir(protocolDir, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));

    const groupedSnapshots: GraphSnapshotGroup = {};

    for (const fileName of files) {
      const snapshot = await readJson<GraphSnapshot>(
        resolve(protocolDir, fileName),
      );
      const rootNodeId = snapshot.nodes[0]?.id;

      if (!rootNodeId) continue;
      groupedSnapshots[rootNodeId] = snapshot;
    }

    await writeJsonFile(
      resolve(outputDir, `${protocol}.json`),
      groupedSnapshots,
    );
  }
};

void main();
