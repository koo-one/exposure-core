import { NextResponse } from "next/server";
import { readFile, stat } from "node:fs/promises";

import { resolveRepoPathFromWebCwd } from "@/lib/repoPaths";
import { getBlobUploadedAt, tryHeadBlobUrl } from "@/lib/vercelBlob";

export const runtime = "nodejs";

const SEARCH_INDEX_BLOB_PATH = "exposure/search-index.json";
const SNAPSHOT_TIME_HEADER = "x-exposure-snapshot-at";

export async function HEAD(): Promise<Response> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const fixturesPath = resolveRepoPathFromWebCwd(
        "server",
        "fixtures",
        "output",
        "search-index.json",
      );
      const fixturesStat = await stat(fixturesPath);

      return new Response(null, {
        status: 200,
        headers: {
          [SNAPSHOT_TIME_HEADER]: fixturesStat.mtime.toISOString(),
        },
      });
    } catch {
      return new Response(null, { status: 404 });
    }
  }

  const uploadedAt = await getBlobUploadedAt(SEARCH_INDEX_BLOB_PATH);
  if (!uploadedAt) {
    return new Response(null, { status: 404 });
  }

  return new Response(null, {
    status: 200,
    headers: {
      [SNAPSHOT_TIME_HEADER]: uploadedAt.toISOString(),
    },
  });
}

export async function GET(): Promise<Response> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    // Local/dev path: prefer the repo-level generated fixtures index so it stays
    // in sync with adapters without requiring manual updates under /public.
    try {
      const fixturesPath = resolveRepoPathFromWebCwd(
        "server",
        "fixtures",
        "output",
        "search-index.json",
      );

      const raw = await readFile(fixturesPath, "utf8");
      const json = JSON.parse(raw) as unknown;
      return NextResponse.json(json);
    } catch {
      return NextResponse.json(
        {
          error: "Search index not found (fixtures)",
          hint: "Generate fixtures under server/fixtures/output and retry",
        },
        { status: 404 },
      );
    }
  }

  const url = await tryHeadBlobUrl(SEARCH_INDEX_BLOB_PATH);

  if (url) {
    return NextResponse.redirect(url, { status: 307 });
  }

  return NextResponse.json(
    { error: "Search index not found", candidates: [SEARCH_INDEX_BLOB_PATH] },
    { status: 404 },
  );
}
