import { NextResponse } from "next/server";
import { access, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import {
  canonicalizeNodeId,
  graphSnapshotBlobPath,
  graphProtocolBlobPath,
  inferProtocolFolderFromNodeId,
  protocolToFolder,
} from "@/lib/blobPaths";
import { resolveRepoPathFromWebCwd } from "@/lib/repoPaths";
import { tryHeadBlobUrl } from "@/lib/vercelBlob";
import type { GraphSnapshot } from "@/types";

export const runtime = "nodejs";

const normalizeNodeIdFromPathParam = (raw: string): string => {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }

  return canonicalizeNodeId(decoded);
};

const decodedNodeIdFromPathParam = (raw: string): string => {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }

  return decoded.trim();
};

const isGraphSnapshot = (value: unknown): value is GraphSnapshot => {
  if (!value || typeof value !== "object") return false;

  const snapshot = value as Partial<GraphSnapshot>;
  return Array.isArray(snapshot.nodes) && Array.isArray(snapshot.edges);
};

const loadBlobSnapshotForNode = async (
  normalizedId: string,
  protocolFolders: string[],
): Promise<{ snapshot: GraphSnapshot; path: string; url: string } | null> => {
  for (const protocol of protocolFolders) {
    const path = graphProtocolBlobPath(protocol);
    const url = await tryHeadBlobUrl(path);

    if (!url) continue;

    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) continue;

      const payload = (await response.json()) as unknown;
      if (!payload || typeof payload !== "object") continue;

      const snapshots = payload as Record<string, unknown>;
      const snapshot = snapshots[normalizedId];

      if (isGraphSnapshot(snapshot)) {
        return { snapshot, path, url };
      }
    } catch (error) {
      console.error(`Failed to load snapshot from ${url}:`, error);
      // try next protocol group
    }
  }

  const legacyPath = graphSnapshotBlobPath(normalizedId);
  const legacyUrl = await tryHeadBlobUrl(legacyPath);

  if (!legacyUrl) return null;

  try {
    const response = await fetch(legacyUrl, { cache: "no-store" });
    if (!response.ok) return null;

    const payload = (await response.json()) as unknown;
    if (isGraphSnapshot(payload)) {
      return { snapshot: payload, path: legacyPath, url: legacyUrl };
    }
  } catch (error) {
    console.error(`Failed to load snapshot from ${legacyUrl}:`, error);
  }

  return null;
};

const blobProtocolCandidatesForNode = (
  normalizedId: string,
  request: Request,
): string[] => {
  const url = new URL(request.url);
  const requestedProtocolFolder = protocolToFolder(
    url.searchParams.get("protocol"),
  );
  const inferredProtocolFolder = inferProtocolFolderFromNodeId(normalizedId);
  const protocolFolders: string[] = [];

  if (requestedProtocolFolder) protocolFolders.push(requestedProtocolFolder);
  if (
    inferredProtocolFolder &&
    inferredProtocolFolder !== requestedProtocolFolder
  ) {
    protocolFolders.push(inferredProtocolFolder);
  }

  return protocolFolders;
};

const listFixtureProtocolFolders = async (): Promise<string[]> => {
  const fixturesRoot = resolveRepoPathFromWebCwd(
    "server",
    "fixtures",
    "output",
  );
  try {
    const entries = await readdir(fixturesRoot, { withFileTypes: true });
    return entries
      .filter(
        (e) =>
          e.isFile() &&
          e.name.endsWith(".json") &&
          e.name !== "search-index.json",
      )
      .map((e) => e.name.replace(/\.json$/, ""))
      .filter((name) => !name.startsWith("."));
  } catch {
    return [];
  }
};

const loadFixtureSnapshotForNode = async (
  normalizedId: string,
  protocolFolders: string[],
): Promise<{ snapshot: GraphSnapshot; path: string } | null> => {
  const fixturesRoot = resolveRepoPathFromWebCwd(
    "server",
    "fixtures",
    "output",
  );

  for (const protocol of protocolFolders) {
    const path = resolve(fixturesRoot, `${protocol}.json`);

    try {
      const raw = await readFile(path, "utf8");
      const payload = JSON.parse(raw) as unknown;
      if (!payload || typeof payload !== "object") continue;

      const snapshots = payload as Record<string, unknown>;
      const snapshot = snapshots[normalizedId];

      if (isGraphSnapshot(snapshot)) {
        return { snapshot, path };
      }
    } catch {
      // try next protocol group
    }
  }

  return null;
};

const fixtureCandidatesForNode = async (
  normalizedId: string,
  request: Request,
): Promise<string[]> => {
  const url = new URL(request.url);
  const requestedProtocolFolder = protocolToFolder(
    url.searchParams.get("protocol"),
  );
  const inferredProtocolFolder = inferProtocolFolderFromNodeId(normalizedId);

  const protocolFolders: string[] = [];
  if (requestedProtocolFolder) protocolFolders.push(requestedProtocolFolder);
  if (
    inferredProtocolFolder &&
    inferredProtocolFolder !== requestedProtocolFolder
  ) {
    protocolFolders.push(inferredProtocolFolder);
  }

  if (protocolFolders.length === 0) {
    protocolFolders.push(...(await listFixtureProtocolFolders()));
  }

  const fixturesRoot = resolveRepoPathFromWebCwd(
    "server",
    "fixtures",
    "output",
  );
  return protocolFolders.map((protocol) =>
    resolve(fixturesRoot, protocol, `${normalizedId}.json`),
  );
};

export async function HEAD(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const normalizedId = normalizeNodeIdFromPathParam(id);
  const decodedId = decodedNodeIdFromPathParam(id);

  if (!normalizedId) {
    return new Response(null, { status: 400 });
  }

  // Dev/local: confirm fixtures existence without reading full contents.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    const protocolFolders = blobProtocolCandidatesForNode(
      normalizedId,
      request,
    );
    const fixtureProtocolFolders =
      protocolFolders.length > 0
        ? protocolFolders
        : await listFixtureProtocolFolders();
    const groupedResolved = await loadFixtureSnapshotForNode(
      normalizedId,
      fixtureProtocolFolders,
    );

    if (groupedResolved) {
      return new Response(null, {
        status: 200,
        headers: { "x-exposure-fixture-path": groupedResolved.path },
      });
    }

    const tried = await fixtureCandidatesForNode(normalizedId, request);
    const fallback =
      decodedId && decodedId.toLowerCase() !== normalizedId
        ? await fixtureCandidatesForNode(
            decodedId.trim().toLowerCase(),
            request,
          )
        : [];
    const candidates = [...tried, ...fallback];

    for (const filePath of candidates) {
      try {
        await access(filePath);
        return new Response(null, { status: 200 });
      } catch {
        // try next
      }
    }

    return new Response(null, {
      status: 404,
      headers: {
        "x-exposure-tried": candidates.join(";"),
      },
    });
  }

  const protocolFolders = blobProtocolCandidatesForNode(normalizedId, request);
  const resolved = await loadBlobSnapshotForNode(normalizedId, protocolFolders);

  if (resolved) {
    return new Response(null, {
      status: 200,
      headers: { "x-exposure-blob-url": resolved.url },
    });
  }

  return new Response(null, { status: 404 });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;

  const normalizedId = normalizeNodeIdFromPathParam(id);
  const decodedId = decodedNodeIdFromPathParam(id);

  if (!normalizedId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // Dev/local: read repo-level fixtures output by canonical nodeId.
  // Layout: server/fixtures/output/<protocol>.json
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    const protocolFolders = blobProtocolCandidatesForNode(
      normalizedId,
      request,
    );
    const fixtureProtocolFolders =
      protocolFolders.length > 0
        ? protocolFolders
        : await listFixtureProtocolFolders();
    const groupedResolved = await loadFixtureSnapshotForNode(
      normalizedId,
      fixtureProtocolFolders,
    );

    if (groupedResolved) {
      return NextResponse.json(groupedResolved.snapshot);
    }

    const tried = await fixtureCandidatesForNode(normalizedId, request);
    const fallback =
      decodedId && decodedId.toLowerCase() !== normalizedId
        ? await fixtureCandidatesForNode(
            decodedId.trim().toLowerCase(),
            request,
          )
        : [];
    const candidates = [...tried, ...fallback];

    for (const filePath of candidates) {
      try {
        const raw = await readFile(filePath, "utf8");

        return new Response(raw, {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      } catch {
        // try next
      }
    }

    return NextResponse.json(
      {
        error: "Graph snapshot not found (fixtures)",
        id: normalizedId,
        tried: candidates,
      },
      { status: 404 },
    );
  }

  const protocolFolders = blobProtocolCandidatesForNode(normalizedId, request);
  const resolved = await loadBlobSnapshotForNode(normalizedId, protocolFolders);

  if (resolved) {
    return NextResponse.json(resolved.snapshot);
  }

  return NextResponse.json(
    {
      error: "Graph snapshot not found",
      id: normalizedId,
      candidates: protocolFolders.map((protocol) =>
        graphProtocolBlobPath(protocol),
      ),
    },
    { status: 404 },
  );
}
