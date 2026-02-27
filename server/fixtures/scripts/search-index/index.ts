import { readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { putJsonToBlob } from "../../../api/exposure/blob";
import { searchIndexBlobPath } from "../../../api/exposure/paths";
import { readJson, writeJsonFile } from "../core/io";

interface SnapshotNode {
  id: string;
  name: string;
  displayName?: string;
  logoKeys?: string[];
  protocol?: string;
  apy?: number | null;
  tvlUsd?: number | null;
  details?: {
    kind?: string;
    curator?: string | null;
    underlyingSymbol?: string;
    subtype?: string;
  } | null;
}

interface Snapshot {
  nodes: SnapshotNode[];
  edges?: {
    from: string;
    to: string;
    allocationUsd: number;
  }[];
}

interface SearchIndexEntry {
  id: string;
  chain: string;
  protocol: string;
  name: string;
  displayName?: string;
  nodeId: string;
  apy: number | null;
  curator: string | null;
  tvlUsd: number | null;
  logoKeys?: string[];
  typeLabel?: string;
}

const isTokenLike = (value: string): boolean => {
  const v = value.trim();
  return /^[A-Za-z0-9.]+$/.test(v) && v.length >= 2 && v.length <= 10;
};

const inferLogoKeys = (snapshot: Snapshot, root: SnapshotNode): string[] => {
  const explicit = Array.isArray(root.logoKeys) ? root.logoKeys : [];
  if (explicit.length > 0) return explicit;

  const direct =
    typeof root.details?.underlyingSymbol === "string"
      ? root.details.underlyingSymbol.trim()
      : "";
  if (direct && isTokenLike(direct)) return [direct];

  const rootName = root.name.trim();
  if (isTokenLike(rootName) && rootName.length <= 10) return [rootName];

  const edges = snapshot.edges ?? [];
  if (edges.length === 0) return [];

  const nodesById = new Map<string, SnapshotNode>();
  for (const n of snapshot.nodes) nodesById.set(n.id, n);

  const weights = new Map<string, number>();

  for (const e of edges) {
    if (e.from !== root.id) continue;
    const toNode = nodesById.get(e.to);
    if (!toNode) continue;

    const allocationUsd = Math.abs(
      typeof e.allocationUsd === "number" ? e.allocationUsd : 0,
    );
    if (!Number.isFinite(allocationUsd) || allocationUsd <= 0) continue;

    const leafName = toNode.name.trim();
    if (!leafName) continue;

    const slashParts = leafName.split("/");
    if (slashParts.length === 2) {
      const base = slashParts[0];
      const quote = slashParts[1];
      if (base && quote && isTokenLike(base) && isTokenLike(quote)) {
        weights.set(base, (weights.get(base) ?? 0) + allocationUsd);
        continue;
      }
    }

    const dashParts = leafName.split("-");
    if (dashParts.length === 2) {
      const base = dashParts[0];
      const quote = dashParts[1];
      const isUpper = (v: string): boolean => /^[A-Z0-9.]+$/.test(v.trim());
      if (
        base &&
        quote &&
        isTokenLike(base) &&
        isTokenLike(quote) &&
        isUpper(base) &&
        isUpper(quote)
      ) {
        weights.set(base, (weights.get(base) ?? 0) + allocationUsd);
        continue;
      }
    }

    if (isTokenLike(leafName)) {
      weights.set(leafName, (weights.get(leafName) ?? 0) + allocationUsd);
    }
  }

  let best: { key: string; weight: number } | null = null;
  for (const [key, weight] of weights.entries()) {
    if (!best || weight > best.weight) best = { key, weight };
  }

  return best ? [best.key] : [];
};

const getTypeLabel = (root: SnapshotNode): string => {
  const subtype =
    typeof root.details?.subtype === "string"
      ? root.details.subtype.trim()
      : "";
  if (subtype) return subtype;

  const kind =
    typeof root.details?.kind === "string" ? root.details.kind.trim() : "";
  return kind;
};

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(here, "..", "..", "..");

const collectSearchIndexEntries = async (
  outputDir: string,
): Promise<SearchIndexEntry[]> => {
  const protocolDirs = (await readdir(outputDir, { withFileTypes: true }))
    .filter((ent) => ent.isDirectory())
    .map((ent) => ent.name);

  const entries: SearchIndexEntry[] = [];

  for (const protocolDir of protocolDirs) {
    const dirPath = resolve(outputDir, protocolDir);

    const files = (await readdir(dirPath, { withFileTypes: true }))
      .filter((ent) => ent.isFile() && ent.name.endsWith(".json"))
      .map((ent) => resolve(dirPath, ent.name));

    for (const file of files) {
      const snapshot = await readJson<Snapshot>(file);
      if (!snapshot?.nodes) continue;

      // Root node is inserted first by the orchestrator for single-adapter snapshots.
      const root = snapshot.nodes[0];
      if (!root?.id || !root.name) continue;

      const apy = typeof root.apy === "number" ? root.apy : null;
      const tvlUsd = typeof root.tvlUsd === "number" ? root.tvlUsd : null;
      const curator =
        typeof root.details?.curator === "string" ? root.details.curator : null;

      const logoKeys = inferLogoKeys(snapshot, root);
      const typeLabel = getTypeLabel(root);

      const idParts = root.id.split(":");
      const protocolFromId = idParts[1] ?? "unknown";
      let protocol = (root.protocol ?? protocolFromId).toLowerCase();

      if (protocol.startsWith("midas")) protocol = "midas";

      const chainFromId = (idParts[0] ?? "global").toLowerCase();

      entries.push({
        // Canonical key: nodeId.
        id: root.id,
        chain: chainFromId,
        protocol,
        name: root.name,
        ...(typeof root.displayName === "string" && root.displayName.trim()
          ? { displayName: root.displayName.trim() }
          : {}),
        nodeId: root.id,
        apy,
        curator,
        tvlUsd,
        ...(logoKeys.length > 0 ? { logoKeys } : {}),
        ...(typeLabel ? { typeLabel } : {}),
      });
    }
  }

  return entries;
};

const main = async (): Promise<void> => {
  const rootDir = serverDir;

  const outputDir = resolve(rootDir, "fixtures", "output");
  const outPath = resolve(outputDir, "search-index.json");

  const entries = await collectSearchIndexEntries(outputDir);

  const seen = new Set<string>();
  const deduped: SearchIndexEntry[] = [];
  for (const entry of entries) {
    const key = `${entry.protocol}|${entry.chain}|${entry.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(entry);
  }
  deduped.sort((a, b) => a.name.localeCompare(b.name));

  await writeJsonFile(outPath, deduped);

  const shouldUpload = process.argv.slice(2).includes("--upload");

  if (shouldUpload) {
    await putJsonToBlob(searchIndexBlobPath(), deduped);
  }
};

void main();
