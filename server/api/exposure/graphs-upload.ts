import { putJsonToBlob } from "./blob";
import { graphProtocolBlobPath, searchIndexBlobPath } from "./paths";

import {
  adapterFactories,
  adapterFactoriesWithoutDebankResolvers,
} from "../../src/adapters/registry";
import { buildProtocolGraphGroups } from "../../src/exposure/protocolGraphs";
import { buildSearchIndexFromProtocolGroups } from "../../src/exposure/searchIndex";

const main = async (): Promise<void> => {
  const factories = process.argv.includes("--without-debank")
    ? Object.values(adapterFactoriesWithoutDebankResolvers)
    : Object.values(adapterFactories);

  const { groupedSnapshots } = await buildProtocolGraphGroups(factories);

  for (const [protocol, snapshots] of groupedSnapshots.entries()) {
    await putJsonToBlob(graphProtocolBlobPath(protocol), snapshots);
  }

  const searchIndex = buildSearchIndexFromProtocolGroups(
    groupedSnapshots.values(),
  );
  await putJsonToBlob(searchIndexBlobPath(), searchIndex);
};

void main();
