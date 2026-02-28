import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { MockFetchHandler } from "../core/mock-fetch";
import { jsonResponse } from "../core/mock-fetch";
import { readJson } from "../core/io";

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(here, "..", "..", "..");

export const createInfinifiApiHandler = (): MockFetchHandler => {
  return async (url) => {
    if (!url.includes("eth-api.infinifi.xyz/api/protocol/data")) return null;

    const root = serverDir;
    const dataPath = resolve(
      root,
      "fixtures",
      "providers",
      "infinifi",
      "protocol-data.json",
    );

    const data = await readJson(dataPath);
    return jsonResponse(data);
  };
};
