import { head } from "@vercel/blob";

import type { SearchIndexEntry } from "@/constants";

import { graphProtocolBlobPath, searchIndexBlobPath } from "@/lib/blobPaths";

export const getBlobUploadedAt = async (
  pathname: string,
): Promise<Date | null> => {
  try {
    const result = await head(pathname);
    return result.uploadedAt;
  } catch {
    return null;
  }
};

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
    const url = await tryHeadBlobUrl(searchIndexBlobPath());
    if (!url) return [];

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return [];

    const payload = (await response.json()) as unknown;
    if (!Array.isArray(payload)) return [];

    const protocols = new Set<string>();

    for (const entry of payload) {
      if (!entry || typeof entry !== "object") continue;

      const protocol = (entry as Partial<SearchIndexEntry>).protocol;
      if (!protocol || typeof protocol !== "string") continue;

      const normalizedProtocol = protocol.trim().toLowerCase();
      if (!normalizedProtocol) continue;

      protocols.add(graphProtocolBlobPath(normalizedProtocol));
    }

    return Array.from(protocols).sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
};
