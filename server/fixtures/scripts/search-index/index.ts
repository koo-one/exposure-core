import { readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { putJsonToBlob } from "../../../api/exposure/blob";
import { searchIndexBlobPath } from "../../../api/exposure/paths";
import {
  inferAssetLogoKey,
  normalizeLogoKey,
} from "../../../src/resolvers/debank/utils";
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
  const v = normalizeLogoKey(value);
  return /^[a-z0-9.+-]+$/.test(v) && v.length >= 2 && v.length <= 10;
};

const ASSET_NAME_STOPWORDS = new Set<string>([
  "account",
  "alpha",
  "balanced",
  "cash",
  "core",
  "degen",
  "ecosystem",
  "financial",
  "frontier",
  "global",
  "high",
  "highyield",
  "instant",
  "liquid",
  "main",
  "og",
  "perps",
  "position",
  "prime",
  "reactor",
  "spot",
  "value",
  "vault",
  "v1",
  "v2",
  "withdrawable",
  "x",
  "yield",
]);

const TERM_ASSET_PATTERN = /^l([A-Za-z0-9.+]+)-\d+[dwmy]$/i;

const extractAssetCandidateKey = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const termAsset = trimmed.match(TERM_ASSET_PATTERN)?.[1];
  const normalized = normalizeLogoKey(termAsset ?? trimmed);
  if (!isTokenLike(normalized)) return null;
  if (ASSET_NAME_STOPWORDS.has(normalized)) return null;

  const looksAssetLike =
    /₮/.test(trimmed) ||
    /\d/.test(trimmed) ||
    /[A-Z]{2,}/.test(trimmed) ||
    /[a-z][A-Z]/.test(trimmed);
  return looksAssetLike ? normalized : null;
};

const inferAssetKeyFromName = (name: string): string | null => {
  const compact = name.trim().replace(/\s+/g, " ");
  if (!compact) return null;

  const colonParts = compact.split(":");
  const colonCandidate = colonParts[colonParts.length - 1]?.trim() ?? "";
  const fromColon = extractAssetCandidateKey(colonCandidate);
  if (fromColon) return fromColon;

  const words = compact
    .split(/[\s/()]+/)
    .map((part) => part.replace(/^[^A-Za-z0-9₮.+-]+|[^A-Za-z0-9₮.+-]+$/g, ""))
    .filter((part) => part.length > 0);

  const candidates = words
    .map((part) => extractAssetCandidateKey(part))
    .filter((part): part is string => Boolean(part));

  const candidate = candidates[candidates.length - 1] ?? null;
  return candidate ? inferAssetLogoKey(candidate) : null;
};

const inferLogoKeys = (snapshot: Snapshot, root: SnapshotNode): string[] => {
  const explicit = Array.isArray(root.logoKeys) ? root.logoKeys : [];
  if (explicit.length > 0) return explicit;

  const direct =
    typeof root.details?.underlyingSymbol === "string"
      ? root.details.underlyingSymbol.trim()
      : "";
  if (direct && isTokenLike(direct)) {
    const key = inferAssetLogoKey(direct);
    if (key) return [key];
  }

  const brandedRootKey = inferAssetKeyFromName(root.name);
  if (brandedRootKey) return [brandedRootKey];

  const rootName = root.name.trim();
  if (isTokenLike(rootName) && rootName.length <= 10) {
    const key = inferAssetLogoKey(rootName);
    if (key) return [key];
  }

  const edges = snapshot.edges ?? [];
  if (edges.length === 0) return [];

  const nodesById = new Map<string, SnapshotNode>();
  for (const n of snapshot.nodes) nodesById.set(n.id, n);

  const weights = new Map<string, number>();

  const isUpper = (v: string): boolean => /^[A-Z0-9.]+$/.test(v.trim());

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

    const childDirect =
      typeof toNode.details?.underlyingSymbol === "string"
        ? toNode.details.underlyingSymbol.trim()
        : "";
    if (childDirect && isTokenLike(childDirect)) {
      const key = inferAssetLogoKey(childDirect);
      if (key) {
        weights.set(key, (weights.get(key) ?? 0) + allocationUsd);
        continue;
      }
      continue;
    }

    const brandedLeafKey = inferAssetKeyFromName(leafName);
    if (brandedLeafKey) {
      weights.set(
        brandedLeafKey,
        (weights.get(brandedLeafKey) ?? 0) + allocationUsd,
      );
      continue;
    }

    const slashParts = leafName.split("/");
    if (slashParts.length === 2) {
      const base = slashParts[0];
      const quote = slashParts[1];
      if (base && quote && isTokenLike(base) && isTokenLike(quote)) {
        const key = inferAssetLogoKey(base);
        if (key) weights.set(key, (weights.get(key) ?? 0) + allocationUsd);
        continue;
      }
    }

    const dashParts = leafName.split("-");
    if (dashParts.length === 2) {
      const base = dashParts[0];
      const quote = dashParts[1];
      if (
        base &&
        quote &&
        isTokenLike(base) &&
        isTokenLike(quote) &&
        isUpper(base) &&
        isUpper(quote)
      ) {
        const key = inferAssetLogoKey(base);
        if (key) weights.set(key, (weights.get(key) ?? 0) + allocationUsd);
        continue;
      }
    }

    if (isTokenLike(leafName)) {
      const key = inferAssetLogoKey(leafName);
      if (key) weights.set(key, (weights.get(key) ?? 0) + allocationUsd);
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
