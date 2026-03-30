import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { adapterFactories } from "../../src/adapters/registry.js";
import { buildProtocolGraphGroups } from "../../src/exposure/protocolGraphs.js";
import {
  buildSearchIndexFromProtocolGroups,
  mergeSearchIndexEntries,
  type SearchIndexEntry,
} from "../../src/exposure/searchIndex.js";
import {
  readJson,
  resolveFixturesOutputRoot,
  writeJsonFile,
} from "./core/io.js";

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(here, "..", "..");

const ALL_ADAPTER_NAMES = [
  "midas",
  "morpho",
  "infinifi",
  "resolv",
  "yuzu",
  "ethena",
  "gauntlet",
  "sky",
  "euler",
] as const;

const selectedAdapterFactories = Object.values(adapterFactories);

const shouldMergeExistingSearchIndex = (): boolean => {
  return Object.keys(adapterFactories).length < ALL_ADAPTER_NAMES.length;
};

const main = async (): Promise<void> => {
  const argv = process.argv.slice(2);
  const outputDir = resolveFixturesOutputRoot(serverDir, argv);

  await mkdir(outputDir, { recursive: true });

  const { groupedSnapshots, adapterFailures } = await buildProtocolGraphGroups(
    selectedAdapterFactories,
  );

  for (const [protocol, snapshots] of groupedSnapshots) {
    await writeJsonFile(resolve(outputDir, `${protocol}.json`), snapshots);
  }

  const searchIndexPath = resolve(outputDir, "search-index.json");
  const nextSearchIndex = buildSearchIndexFromProtocolGroups(
    groupedSnapshots.values(),
  );
  // In dev we sometimes trim `adapterFactories` down to a small subset to avoid
  // regenerating every protocol snapshot. Before this merge path existed,
  // `graphs-all` still rebuilt `search-index.json` from only the selected
  // adapters, which dropped unrelated protocols from the index. Now we treat
  // the current `adapterFactories` object as the regeneration scope and merge
  // only those protocol entries back into the existing search index.
  const searchIndex = shouldMergeExistingSearchIndex()
    ? await (async (): Promise<SearchIndexEntry[]> => {
        try {
          const baseSearchIndex =
            await readJson<SearchIndexEntry[]>(searchIndexPath);

          return mergeSearchIndexEntries({
            baseEntries: baseSearchIndex,
            nextEntries: nextSearchIndex,
            replaceProtocols: groupedSnapshots.keys(),
          });
        } catch {
          return nextSearchIndex;
        }
      })()
    : nextSearchIndex;
  await writeJsonFile(searchIndexPath, searchIndex);

  if (adapterFailures.length > 0) {
    console.error(
      `graphs-all completed with ${adapterFailures.length} adapter failure(s)`,
      adapterFailures,
    );
    process.exitCode = 1;
  }
};

void main();
