import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildProtocolGraphGroups } from "../../src/exposure/protocolGraphs";

import { putJsonToBlob } from "./blob";
import { graphProtocolBlobPath } from "./paths";

const handler = async (request: VercelRequest, response: VercelResponse) => {
  // Intended to be invoked by Vercel Cron via GET; reject other methods.
  if (request.method && request.method !== "GET") {
    response.status(405).json({ error: "Method Not Allowed" });

    return;
  }

  try {
    const { assetCount, groupedSnapshots } = await buildProtocolGraphGroups();

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
      count: assetCount,
      protocols: results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    response.status(500).json({ error: message });
  }
};

export default handler;
