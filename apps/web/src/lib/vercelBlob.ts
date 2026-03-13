import { head, list } from "@vercel/blob";

export const tryHeadBlobUrl = async (
  pathname: string,
): Promise<string | null> => {
  try {
    const result = await head(pathname);
    return result.url;
  } catch {
    return null;
  }
};

export const listGraphProtocolBlobPaths = async (): Promise<string[]> => {
  try {
    const { blobs } = await list({ prefix: "exposure/graph/" });

    return blobs
      .map((blob) => blob.pathname)
      .filter(
        (pathname) =>
          pathname.endsWith(".json") &&
          pathname !== "exposure/search-index.json" &&
          !pathname
            .slice("exposure/graph/".length, -".json".length)
            .includes(":"),
      )
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
};
