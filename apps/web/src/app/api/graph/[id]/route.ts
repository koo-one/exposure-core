import { NextResponse } from "next/server";
import { access, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import {
  canonicalizeNodeId,
  extractAddressKeyFromNodeId,
  graphSnapshotBlobPath,
  graphProtocolBlobPath,
  inferProtocolFolderFromNodeId,
  protocolToFolder,
} from "@/lib/blobPaths";
import { resolveRootNode } from "@/lib/graph";
import { resolveRepoPathFromWebCwd } from "@/lib/repoPaths";
import { listGraphProtocolBlobPaths, tryHeadBlobUrl } from "@/lib/vercelBlob";
import type { GraphAllocationPreview, GraphSnapshot } from "@/types";

export const runtime = "nodejs";

interface BlobProtocolPayload {
  path: string;
  url: string;
  snapshots: Record<string, unknown>;
}

interface FixtureProtocolPayload {
  path: string;
  snapshots: Record<string, unknown>;
}

const decodePathParam = (raw: string): string => {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }

  return decoded.trim();
};

const normalizeNodeIdFromPathParam = (raw: string): string => {
  return canonicalizeNodeId(decodePathParam(raw));
};

const decodedNodeIdFromPathParam = (raw: string): string => {
  return decodePathParam(raw);
};

const isGraphSnapshot = (value: unknown): value is GraphSnapshot => {
  if (!value || typeof value !== "object") return false;

  const snapshot = value as Partial<GraphSnapshot>;
  return Array.isArray(snapshot.nodes) && Array.isArray(snapshot.edges);
};

const resolveSnapshotFromPayload = (
  snapshots: Record<string, unknown>,
  normalizedId: string,
): GraphSnapshot | null => {
  const exact = snapshots[normalizedId];
  if (isGraphSnapshot(exact)) return exact;

  const targetAddressKey = extractAddressKeyFromNodeId(normalizedId);
  if (!targetAddressKey) return null;

  for (const [candidateId, candidateSnapshot] of Object.entries(snapshots)) {
    if (!isGraphSnapshot(candidateSnapshot)) continue;
    if (extractAddressKeyFromNodeId(candidateId) !== targetAddressKey) continue;
    return candidateSnapshot;
  }

  return null;
};

const normalizeAllocationPreviews = (
  snapshot: GraphSnapshot,
  nodeId: string,
): GraphAllocationPreview[] => {
  const normalizedNodeId = canonicalizeNodeId(nodeId);
  const nodesById = new Map(
    snapshot.nodes.map((node) => [canonicalizeNodeId(node.id), node] as const),
  );

  return snapshot.edges
    .filter((edge) => canonicalizeNodeId(edge.from) === normalizedNodeId)
    .map((edge) => {
      const node = nodesById.get(canonicalizeNodeId(edge.to));
      return {
        id: edge.to,
        name: node?.name ?? edge.to,
        value: Math.abs(edge.allocationUsd),
        node,
      };
    })
    .filter((entry) => Number.isFinite(entry.value) && entry.value > 0)
    .sort((a, b) => b.value - a.value);
};

const loadBlobProtocolPayload = async (
  protocol: string,
): Promise<BlobProtocolPayload | null> => {
  const path = graphProtocolBlobPath(protocol);
  const url = await tryHeadBlobUrl(path);

  if (!url) return null;

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;

    const payload = (await response.json()) as unknown;
    if (!payload || typeof payload !== "object") return null;

    return {
      path,
      url,
      snapshots: payload as Record<string, unknown>,
    };
  } catch (error) {
    console.error(`Failed to load snapshot group from ${url}:`, error);
    return null;
  }
};

const loadFixtureProtocolPayload = async (
  protocol: string,
): Promise<FixtureProtocolPayload | null> => {
  const fixturesRoot = resolveRepoPathFromWebCwd(
    "server",
    "fixtures",
    "output",
  );
  const path = resolve(fixturesRoot, `${protocol}.json`);

  try {
    const raw = await readFile(path, "utf8");
    const payload = JSON.parse(raw) as unknown;
    if (!payload || typeof payload !== "object") return null;

    return {
      path,
      snapshots: payload as Record<string, unknown>,
    };
  } catch {
    return null;
  }
};

const loadBlobSnapshotForNode = async (
  normalizedId: string,
  protocolFolders: string[],
): Promise<{
  snapshot: GraphSnapshot;
  path: string;
  url: string;
  snapshots?: Record<string, unknown>;
} | null> => {
  for (const protocol of protocolFolders) {
    const payload = await loadBlobProtocolPayload(protocol);
    if (!payload) continue;

    const snapshot = resolveSnapshotFromPayload(
      payload.snapshots,
      normalizedId,
    );

    if (isGraphSnapshot(snapshot)) {
      return {
        snapshot,
        path: payload.path,
        url: payload.url,
        snapshots: payload.snapshots,
      };
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

const resolveProtocolFolders = async (
  protocolFolders: string[],
  listAllFolders: () => Promise<string[]>,
): Promise<string[]> => {
  if (protocolFolders.length > 0) {
    return protocolFolders;
  }

  return listAllFolders();
};

const listBlobProtocolFolders = async (): Promise<string[]> => {
  const paths = await listGraphProtocolBlobPaths();

  return paths.map((pathname) =>
    pathname.replace(/^exposure\/graph\//, "").replace(/\.json$/, ""),
  );
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
): Promise<{
  snapshot: GraphSnapshot;
  path: string;
  snapshots?: Record<string, unknown>;
} | null> => {
  for (const protocol of protocolFolders) {
    const payload = await loadFixtureProtocolPayload(protocol);
    if (!payload) continue;

    const snapshot = resolveSnapshotFromPayload(
      payload.snapshots,
      normalizedId,
    );

    if (isGraphSnapshot(snapshot)) {
      return { snapshot, path: payload.path, snapshots: payload.snapshots };
    }
  }

  return null;
};

const buildNestedAllocations = async (
  snapshot: GraphSnapshot,
  normalizedId: string,
  chain: string | null,
  initialProtocolSnapshots: Record<string, unknown> | null,
  loadProtocolPayload: (
    protocol: string,
  ) => Promise<Record<string, unknown> | null>,
): Promise<Record<string, GraphAllocationPreview[]>> => {
  const rootNode = resolveRootNode(
    snapshot.nodes,
    normalizedId,
    chain ?? undefined,
  );
  if (!rootNode) return {};

  const directChildren = Array.from(
    new Set(
      snapshot.edges
        .filter((edge) => edge.from === rootNode.id)
        .map((edge) => canonicalizeNodeId(edge.to)),
    ),
  );

  const nestedAllocations: Record<string, GraphAllocationPreview[]> = {};
  const protocolCache = new Map<string, Record<string, unknown> | null>();
  const rootProtocol = inferProtocolFolderFromNodeId(normalizedId);
  if (rootProtocol && initialProtocolSnapshots) {
    protocolCache.set(rootProtocol, initialProtocolSnapshots);
  }

  for (const childId of directChildren) {
    const localAllocations = normalizeAllocationPreviews(snapshot, childId);
    if (localAllocations.length > 0) {
      nestedAllocations[childId] = localAllocations;
      continue;
    }

    const protocol = inferProtocolFolderFromNodeId(childId);
    if (!protocol) continue;

    let snapshots = protocolCache.get(protocol);
    if (snapshots === undefined) {
      snapshots = await loadProtocolPayload(protocol);
      protocolCache.set(protocol, snapshots);
    }

    const childSnapshot = snapshots?.[childId];
    if (!isGraphSnapshot(childSnapshot)) continue;

    const allocations = normalizeAllocationPreviews(childSnapshot, childId);
    if (allocations.length > 0) {
      nestedAllocations[childId] = allocations;
    }
  }

  return nestedAllocations;
};

const resolveGroupedFixtureSnapshotForRequest = async (
  normalizedId: string,
  request: Request,
): Promise<{
  snapshot: GraphSnapshot;
  path: string;
  snapshots?: Record<string, unknown>;
} | null> => {
  const fixtureProtocolFolders = await resolveProtocolFolders(
    blobProtocolCandidatesForNode(normalizedId, request),
    listFixtureProtocolFolders,
  );

  return loadFixtureSnapshotForNode(normalizedId, fixtureProtocolFolders);
};

const fixturePathCandidatesForRequest = async (
  normalizedId: string,
  decodedId: string,
  request: Request,
): Promise<string[]> => {
  const protocolFolders = await resolveProtocolFolders(
    blobProtocolCandidatesForNode(normalizedId, request),
    listFixtureProtocolFolders,
  );

  const fixturesRoot = resolveRepoPathFromWebCwd(
    "server",
    "fixtures",
    "output",
  );
  const tried = protocolFolders.map((protocol) =>
    resolve(fixturesRoot, protocol, `${normalizedId}.json`),
  );

  const fallback =
    decodedId && decodedId.toLowerCase() !== normalizedId
      ? protocolFolders.map((protocol) =>
          resolve(
            fixturesRoot,
            protocol,
            `${decodedId.trim().toLowerCase()}.json`,
          ),
        )
      : [];

  return [...tried, ...fallback];
};

const resolveBlobGroupedForRequest = async (
  normalizedId: string,
  request: Request,
): Promise<{
  resolved: {
    snapshot: GraphSnapshot;
    path: string;
    url: string;
    snapshots?: Record<string, unknown>;
  } | null;
  blobProtocolFolders: string[];
}> => {
  const blobProtocolFolders = await resolveProtocolFolders(
    blobProtocolCandidatesForNode(normalizedId, request),
    listBlobProtocolFolders,
  );

  return {
    resolved: await loadBlobSnapshotForNode(normalizedId, blobProtocolFolders),
    blobProtocolFolders,
  };
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
    const groupedResolved = await resolveGroupedFixtureSnapshotForRequest(
      normalizedId,
      request,
    );

    if (groupedResolved) {
      return new Response(null, {
        status: 200,
        headers: { "x-exposure-fixture-path": groupedResolved.path },
      });
    }

    const candidates = await fixturePathCandidatesForRequest(
      normalizedId,
      decodedId,
      request,
    );

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

  const { resolved } = await resolveBlobGroupedForRequest(
    normalizedId,
    request,
  );

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
  const chain = new URL(request.url).searchParams.get("chain");

  if (!normalizedId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // Dev/local: read repo-level fixtures output by canonical nodeId.
  // Layout: server/fixtures/output/<protocol>.json
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    const groupedResolved = await resolveGroupedFixtureSnapshotForRequest(
      normalizedId,
      request,
    );

    if (groupedResolved) {
      const nestedAllocations = await buildNestedAllocations(
        groupedResolved.snapshot,
        normalizedId,
        chain,
        groupedResolved.snapshots ?? null,
        async (protocol) =>
          (await loadFixtureProtocolPayload(protocol))?.snapshots ?? null,
      );

      return NextResponse.json({
        ...groupedResolved.snapshot,
        nestedAllocations,
      });
    }

    const candidates = await fixturePathCandidatesForRequest(
      normalizedId,
      decodedId,
      request,
    );

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

  const { resolved, blobProtocolFolders } = await resolveBlobGroupedForRequest(
    normalizedId,
    request,
  );

  if (resolved) {
    const nestedAllocations = await buildNestedAllocations(
      resolved.snapshot,
      normalizedId,
      chain,
      resolved.snapshots ?? null,
      async (protocol) =>
        (await loadBlobProtocolPayload(protocol))?.snapshots ?? null,
    );

    return NextResponse.json({
      ...resolved.snapshot,
      nestedAllocations,
    });
  }

  return NextResponse.json(
    {
      error: "Graph snapshot not found",
      id: normalizedId,
      candidates: blobProtocolFolders.map((protocol) =>
        graphProtocolBlobPath(protocol),
      ),
    },
    { status: 404 },
  );
}
