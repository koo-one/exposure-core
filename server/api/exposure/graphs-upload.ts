import { putJsonToBlob } from "./blob";
import { graphProtocolBlobPath, searchIndexBlobPath } from "./paths";

import { adapterFactories } from "../../src/adapters/registry";
import { buildProtocolGraphGroups } from "../../src/exposure/protocolGraphs";
import { buildSearchIndexFromProtocolGroups } from "../../src/exposure/searchIndex";

const main = async (): Promise<void> => {
  const { groupedSnapshots } = await buildProtocolGraphGroups(
    Object.values(adapterFactories),
  );

  for (const [protocol, snapshots] of groupedSnapshots.entries()) {
    await putJsonToBlob(graphProtocolBlobPath(protocol), snapshots);
  }

  const searchIndex = buildSearchIndexFromProtocolGroups(
    groupedSnapshots.values(),
  );
  await putJsonToBlob(searchIndexBlobPath(), searchIndex);
};

void main();
