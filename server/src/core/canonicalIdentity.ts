import { normalizeChain, normalizeProtocol, toSlug } from "../utils.js";

export type CanonicalizationSource =
  | "canonical-address"
  | "canonical-vault"
  | "canonical-market"
  | "canonical-resource"
  | "fallback-name"
  | "fallback-symbol"
  | "fallback-unknown";

export interface CanonicalIdentity {
  id: string;
}

interface BuildCanonicalIdentityInput {
  chain?: string | null;
  protocol: string;
  address?: string | null;
  vaultAddress?: string | null;
  marketId?: string | null;
  resourceId?: string | null;
  resourceParts?: (string | null | undefined)[];
  fallbackName?: string | null;
  fallbackSymbol?: string | null;
  forcedSource?: CanonicalizationSource;
  includeChain?: boolean;
}

const normalizeSegment = (value: string): string => {
  return toSlug(value);
};

const normalizeStableIdentifier = (value: string): string => {
  const trimmed = value.trim();

  if (/^0x[a-f0-9]+$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  return normalizeSegment(trimmed);
};

export const buildCanonicalIdentity = (
  input: BuildCanonicalIdentityInput,
): CanonicalIdentity => {
  const protocol = normalizeProtocol(input.protocol);
  const chain =
    input.includeChain === false ? null : normalizeChain(input.chain ?? "");

  const stableAddress =
    input.address?.trim() || input.vaultAddress?.trim() || "";
  const marketId = input.marketId?.trim() || "";
  const resourceId = input.resourceId?.trim() || "";
  const resourceParts = (input.resourceParts ?? [])
    .map((value) => (value ? value.trim() : ""))
    .filter(Boolean);

  const fallbackName = input.fallbackName?.trim() || "";
  const fallbackSymbol = input.fallbackSymbol?.trim() || "";

  let parts: string[];

  if (input.forcedSource === "fallback-name" && fallbackName) {
    parts = [normalizeSegment(fallbackName)];
  } else if (input.forcedSource === "fallback-symbol" && fallbackSymbol) {
    parts = [normalizeSegment(fallbackSymbol)];
  } else if (input.forcedSource === "fallback-unknown") {
    const fallbackParts = [
      fallbackName || fallbackSymbol || "unknown",
      ...resourceParts,
    ]
      .filter(Boolean)
      .map((value) => normalizeSegment(value));

    parts = fallbackParts.length > 0 ? fallbackParts : ["unknown"];
  } else if (stableAddress) {
    parts = [normalizeStableIdentifier(stableAddress)];
  } else if (marketId) {
    parts = [normalizeStableIdentifier(marketId)];
  } else if (resourceId || resourceParts.length > 0) {
    parts = [resourceId, ...resourceParts]
      .filter(Boolean)
      .map((value) => normalizeStableIdentifier(value));
  } else if (fallbackName) {
    parts = [normalizeSegment(fallbackName)];
  } else if (fallbackSymbol) {
    parts = [normalizeSegment(fallbackSymbol)];
  } else {
    parts = ["unknown"];
  }

  const prefix = chain ? [chain, protocol] : [protocol];
  const id = [...prefix, ...parts].join(":");
  const identity: CanonicalIdentity = {
    id,
  };

  return identity;
};
