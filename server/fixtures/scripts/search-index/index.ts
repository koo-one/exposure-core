import { readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { putJsonToBlob } from "../../../api/exposure/blob";
import { searchIndexBlobPath } from "../../../api/exposure/paths";
import {
  buildSearchIndexFromProtocolGroups,
  type GraphSnapshotGroup,
} from "../../../src/exposure/searchIndex";
import { readJson, resolveFixturesOutputRoot, writeJsonFile } from "../core/io";

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(here, "..", "..", "..");

const collectSearchIndexEntries = async (
  outputDir: string,
): Promise<ReturnType<typeof buildSearchIndexFromProtocolGroups>> => {
  const protocolFiles = (await readdir(outputDir, { withFileTypes: true }))
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".json") &&
        entry.name !== "search-index.json",
    )
    .map((entry) => resolve(outputDir, entry.name))
    .sort((a, b) => a.localeCompare(b));

  const groups: GraphSnapshotGroup[] = [];

  for (const filePath of protocolFiles) {
    groups.push(await readJson<GraphSnapshotGroup>(filePath));
  }

  return buildSearchIndexFromProtocolGroups(groups);
};

const main = async (): Promise<void> => {
  const rootDir = serverDir;
  const argv = process.argv.slice(2);

  const outputDir = resolveFixturesOutputRoot(rootDir, argv);
  const outPath = resolve(outputDir, "search-index.json");

  const deduped = await collectSearchIndexEntries(outputDir);

  await writeJsonFile(outPath, deduped);

  const shouldUpload = argv.includes("--upload");

  if (shouldUpload) {
    await putJsonToBlob(searchIndexBlobPath(), deduped);
  }
};

void main();
