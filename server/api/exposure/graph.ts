import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildDraftGraphsByAsset } from "../../src/orchestrator";
import type { GraphSnapshot } from "../../src/types";

import { putJsonToBlob } from "./blob";
import {
  canonicalizeNodeId,
  graphProtocolBlobPath,
  inferProtocolFolderFromNodeId,
} from "./paths";

type GraphSnapshotGroup = Record<string, GraphSnapshot>;

const handler = async (request: VercelRequest, response: VercelResponse) => {
  // Intended to be invoked by Vercel Cron via GET; reject other methods.
  if (request.method && request.method !== "GET") {
    response.status(405).json({ error: "Method Not Allowed" });

    return;
  }

  try {
    const draftGraphs = await buildDraftGraphsByAsset();
    const groupedSnapshots = new Map<string, GraphSnapshotGroup>();

    for (const [asset, store] of draftGraphs) {
      const snapshot = store.toSnapshot({ sources: [] });
      const rootNodeId = snapshot.nodes[0]?.id;

      if (!rootNodeId) {
        throw new Error(`Missing root node id for asset: ${asset}`);
      }

      const normalizedRootNodeId = canonicalizeNodeId(rootNodeId);
      const protocol = inferProtocolFolderFromNodeId(normalizedRootNodeId);

      if (!protocol) {
        throw new Error(`Missing protocol folder for asset: ${asset}`);
      }

      const currentGroup = groupedSnapshots.get(protocol) ?? {};
      currentGroup[normalizedRootNodeId] = snapshot;
      groupedSnapshots.set(protocol, currentGroup);
    }

    const results = await Promise.all(
      Array.from(groupedSnapshots.entries()).map(
        async ([protocol, snapshots]) => {
          const path = graphProtocolBlobPath(protocol);
          const url = await putJsonToBlob(path, snapshots);

          return {
            protocol,
            path,
            url,
            count: Object.keys(snapshots).length,
          };
        },
      ),
    );

    response.status(200).json({
      count: Array.from(draftGraphs.keys()).length,
      protocols: results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    response.status(500).json({ error: message });
  }
};

export default handler;
