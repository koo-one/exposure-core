import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { adapterFactories } from "../../src/adapters/registry.js";
import { buildProtocolGraphGroups } from "../../src/exposure/protocolGraphs.js";
import { buildSearchIndexFromProtocolGroups } from "../../src/exposure/searchIndex.js";
import { resolveFixturesOutputRoot, writeJsonFile } from "./core/io.js";

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(here, "..", "..");

const main = async (): Promise<void> => {
  const argv = process.argv.slice(2);
  const outputDir = resolveFixturesOutputRoot(serverDir, argv);

  await mkdir(outputDir, { recursive: true });

  const { groupedSnapshots, adapterFailures } = await buildProtocolGraphGroups(
    Object.values(adapterFactories),
  );

  for (const [protocol, snapshots] of groupedSnapshots) {
    await writeJsonFile(resolve(outputDir, `${protocol}.json`), snapshots);
  }

  const searchIndex = buildSearchIndexFromProtocolGroups(
    groupedSnapshots.values(),
  );
  await writeJsonFile(resolve(outputDir, "search-index.json"), searchIndex);

  if (adapterFailures.length > 0) {
    console.error(
      `graphs-all completed with ${adapterFailures.length} adapter failure(s)`,
      adapterFailures,
    );
    process.exitCode = 1;
  }
};

void main();
