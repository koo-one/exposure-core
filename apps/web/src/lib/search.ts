import { type SearchIndexEntry } from "@/constants";

import { canonicalizeNodeId, canonicalizeProtocolToken } from "@/lib/nodeId";

export type PreparedSearchIndexEntry = SearchIndexEntry & {
  normalizedId: string;
  normalizedChain: string;
  normalizedProtocol: string;
  searchHaystack: string;
  groupBaseKey: string;
  groupEntryKey: string;
};

export interface DropdownGroup {
  key: string;
  protocol: string;
  name: string;
  displayName?: string;
  logoKeys?: string[];
  chains: { chain: string; entry: SearchIndexEntry; tvlUsd: number | null }[];
  totalTvlUsd: number | null;
  primary: SearchIndexEntry;
}

const normalizeText = (value: string | null | undefined): string =>
  (value ?? "").trim().toLowerCase();

const normalizeSelectedProtocol = (value: string): string => {
  const normalized = normalizeText(value);
  return normalized === "all" ? normalized : canonicalizeProtocolToken(value);
};

const shouldGroupAcrossChains = (protocol: string): boolean => {
  const value = normalizeText(protocol);
  return !value.startsWith("morpho") && !value.startsWith("euler");
};

export const prepareSearchIndex = (
  entries: SearchIndexEntry[],
): PreparedSearchIndexEntry[] => {
  return entries.map((entry) => {
    const normalizedId = canonicalizeNodeId(entry.id);
    const normalizedChain = normalizeText(entry.chain || "global");
    const normalizedProtocol = canonicalizeProtocolToken(entry.protocol);
    const normalizedName = normalizeText(entry.name);
    const normalizedDisplayName = normalizeText(entry.displayName);
    const groupBaseKey = `${normalizedProtocol}|${normalizedName}`;

    return {
      ...entry,
      normalizedId,
      normalizedChain,
      normalizedProtocol,
      searchHaystack: [
        normalizedName,
        normalizedDisplayName,
        normalizeText(entry.id),
        normalizeText(entry.nodeId),
        normalizedProtocol,
        normalizedChain,
      ]
        .filter(Boolean)
        .join(" "),
      groupBaseKey,
      groupEntryKey: `${normalizedChain}|${normalizedId}`,
    };
  });
};

export const buildCuratorOptions = (
  entries: PreparedSearchIndexEntry[],
  selectedProtocol: string,
  selectedChain: string,
): { label: string; value: string }[] => {
  const normalizedProtocol = normalizeSelectedProtocol(selectedProtocol);
  const normalizedChain = normalizeText(selectedChain);
  const set = new Set<string>();

  for (const entry of entries) {
    const protocolMatch =
      normalizedProtocol === "all" ||
      entry.normalizedProtocol === normalizedProtocol;
    const chainMatch =
      normalizedChain === "all" || entry.normalizedChain === normalizedChain;
    if (!protocolMatch || !chainMatch) continue;

    if (typeof entry.curator !== "string") continue;
    const value = entry.curator.trim();
    if (!value) continue;
    set.add(value);
  }

  return [
    { label: "Anyone", value: "all" },
    ...Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .map((curator) => ({ label: curator, value: curator })),
  ];
};

export const filterSearchEntries = (
  entries: PreparedSearchIndexEntry[],
  filters: {
    selectedProtocol: string;
    selectedChain: string;
    selectedCurator: string;
    apyMin: string;
    apyMax: string;
    query: string;
  },
): PreparedSearchIndexEntry[] => {
  const normalizedProtocol = normalizeSelectedProtocol(
    filters.selectedProtocol,
  );
  const normalizedChain = normalizeText(filters.selectedChain);
  const normalizedQuery = normalizeText(filters.query);

  let results = entries;

  if (normalizedProtocol !== "all") {
    results = results.filter(
      (entry) => entry.normalizedProtocol === normalizedProtocol,
    );
  }

  if (normalizedChain !== "all") {
    results = results.filter(
      (entry) => entry.normalizedChain === normalizedChain,
    );
  }

  if (normalizedQuery) {
    results = results.filter((entry) =>
      entry.searchHaystack.includes(normalizedQuery),
    );
  }

  if (filters.apyMin.trim().length > 0 || filters.apyMax.trim().length > 0) {
    const parseBound = (value: string): number | null => {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const min = parseBound(filters.apyMin);
    const max = parseBound(filters.apyMax);
    results = results.filter((entry) => {
      const apy = typeof entry.apy === "number" ? entry.apy : null;
      if (apy == null) return false;
      const apyPercent = apy > 1 ? apy : apy * 100;
      if (min != null && apyPercent < min) return false;
      if (max != null && apyPercent > max) return false;
      return true;
    });
  }

  if (filters.selectedCurator !== "all") {
    results = results.filter(
      (entry) => entry.curator === filters.selectedCurator,
    );
  }

  return results;
};

export const buildDropdownResults = (
  entries: PreparedSearchIndexEntry[],
): DropdownGroup[] => {
  interface GroupInternal {
    key: string;
    protocol: string;
    name: string;
    displayName?: string;
    logoKeys?: string[];
    primary: PreparedSearchIndexEntry;
    entries: Map<
      string,
      { chain: string; entry: PreparedSearchIndexEntry; tvlUsd: number | null }
    >;
  }

  const groups = new Map<string, GroupInternal>();
  const safeTvl = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) ? value : null;

  for (const entry of entries) {
    const key = shouldGroupAcrossChains(entry.protocol)
      ? entry.groupBaseKey
      : `${entry.groupBaseKey}|${entry.groupEntryKey}`;
    const tvlUsd = safeTvl(entry.tvlUsd);
    const existing = groups.get(key);

    if (!existing) {
      const groupEntries = new Map<
        string,
        {
          chain: string;
          entry: PreparedSearchIndexEntry;
          tvlUsd: number | null;
        }
      >();
      groupEntries.set(entry.groupEntryKey, {
        chain: entry.normalizedChain,
        entry,
        tvlUsd,
      });

      groups.set(key, {
        key,
        protocol: entry.protocol,
        name: entry.name,
        displayName: entry.displayName,
        logoKeys: entry.logoKeys,
        primary: entry,
        entries: groupEntries,
      });
      continue;
    }

    const current = existing.entries.get(entry.groupEntryKey);
    if (!current || (tvlUsd ?? -1) > (current.tvlUsd ?? -1)) {
      existing.entries.set(entry.groupEntryKey, {
        chain: entry.normalizedChain,
        entry,
        tvlUsd,
      });
    }

    const primaryTvl = safeTvl(existing.primary.tvlUsd) ?? -1;
    const nextTvl = tvlUsd ?? -1;
    if (nextTvl > primaryTvl) {
      existing.primary = entry;
      existing.displayName = entry.displayName;
      existing.logoKeys = entry.logoKeys;
    }
  }

  const result = Array.from(groups.values()).map((group) => {
    const chains = Array.from(group.entries.values()).map((record) => ({
      chain: record.chain,
      entry: record.entry,
      tvlUsd: record.tvlUsd,
    }));

    chains.sort((a, b) => (b.tvlUsd ?? -1) - (a.tvlUsd ?? -1));

    const finiteTvls = chains
      .map((chain) => chain.tvlUsd)
      .filter(
        (value): value is number =>
          typeof value === "number" && Number.isFinite(value),
      );

    const totalTvlUsd = (() => {
      if (!finiteTvls.length) return null;
      if (finiteTvls.length === 1) return finiteTvls[0] ?? null;
      return finiteTvls.reduce((sum, value) => sum + value, 0);
    })();

    return {
      key: group.key,
      protocol: group.protocol,
      name: group.name,
      displayName: group.displayName,
      logoKeys: group.logoKeys,
      chains,
      totalTvlUsd,
      primary: group.primary,
    };
  });

  result.sort((a, b) => (b.totalTvlUsd ?? -1) - (a.totalTvlUsd ?? -1));
  return result;
};
