import { GraphNode } from "@/types";

export interface RootRelationshipSemantics {
  rootBadge: string;
  childBadge?: string | null;
}

const MORPHO_MARKET_RELATIONSHIP: RootRelationshipSemantics = {
  rootBadge: "Lent to markets",
  childBadge: "Against collateral",
};

const MORPHO_V1_VAULT_RELATIONSHIP: RootRelationshipSemantics = {
  rootBadge: "Allocated to V1 vaults",
  childBadge: "V1 vault",
};

const EULER_EARN_RELATIONSHIP: RootRelationshipSemantics = {
  rootBadge: "Allocated to EVK vaults",
  childBadge: "EVK vault",
};

const EULER_EVK_RELATIONSHIP: RootRelationshipSemantics = {
  rootBadge: "Lent to EVKs",
  childBadge: "Collateral vault",
};

const YIELD_RELATIONSHIP: RootRelationshipSemantics = {
  rootBadge: "Deployed for yield",
  childBadge: "Strategy",
};

const BACKING_RELATIONSHIP: RootRelationshipSemantics = {
  rootBadge: "Backed by reserves",
  childBadge: "Backing position",
};

const normalizeText = (value: string | null | undefined): string => {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
};

const getAssetKey = (node: GraphNode): string => {
  return `${normalizeText(node.protocol)}:${normalizeText(node.name)}`;
};

const BACKING_ASSET_KEYS = new Set([
  "ethena:usde",
  "infinifi:iusd",
  "resolv:rlp",
  "resolv:usr",
  "sky:usds",
  "yuzu:yzpp",
  "yuzu:yzusd",
]);

const YIELD_ASSET_KEYS = new Set([
  "ethena:susde",
  "gauntlet:gtusda",
  "infinifi:siusd",
  "resolv:wstusr",
  "sky:stusds",
  "sky:susds",
  "yuzu:syzusd",
]);

const isMorphoMarketChild = (node: GraphNode | undefined): boolean => {
  return normalizeText(node?.details?.kind).startsWith("lending");
};

const isMorphoV1VaultChild = (node: GraphNode | undefined): boolean => {
  const protocol = normalizeText(node?.protocol);
  const kind = normalizeText(node?.details?.kind);
  const subtype = normalizeText(node?.details?.subtype);

  return (
    protocol.startsWith("morpho") &&
    (subtype.includes("metamorpho vault") || kind === "yield")
  );
};

const isEulerEvkChild = (node: GraphNode | undefined): boolean => {
  return normalizeText(node?.details?.subtype).includes("evk vault");
};

const isEulerEvkRoot = (node: GraphNode): boolean => {
  return (
    normalizeText(node.protocol) === "euler" &&
    normalizeText(node.details?.subtype).includes("evk vault")
  );
};

const getAssetLevelRelationship = (
  node: GraphNode,
): RootRelationshipSemantics | null => {
  const assetKey = getAssetKey(node);
  const protocol = normalizeText(node.protocol);
  const kind = normalizeText(node.details?.kind);

  if (
    BACKING_ASSET_KEYS.has(assetKey) ||
    kind === "deposit" ||
    kind === "protection"
  ) {
    return BACKING_RELATIONSHIP;
  }

  if (
    YIELD_ASSET_KEYS.has(assetKey) ||
    protocol === "gauntlet" ||
    protocol === "midas" ||
    kind === "yield" ||
    kind === "staked"
  ) {
    return YIELD_RELATIONSHIP;
  }

  return null;
};

export const getRootRelationshipSemantics = (
  node: GraphNode,
  children: GraphNode[] = [],
): RootRelationshipSemantics | null => {
  const protocol = normalizeText(node.protocol);
  const subtype = normalizeText(node.details?.subtype);

  if (protocol.startsWith("morpho")) {
    if (children.some((child) => isMorphoMarketChild(child))) {
      return MORPHO_MARKET_RELATIONSHIP;
    }
    if (children.some((child) => isMorphoV1VaultChild(child))) {
      return MORPHO_V1_VAULT_RELATIONSHIP;
    }
    return MORPHO_MARKET_RELATIONSHIP;
  }

  if (protocol === "euler" && subtype.includes("earn vault")) {
    return EULER_EARN_RELATIONSHIP;
  }

  if (
    isEulerEvkRoot(node) &&
    children.some((child) => isEulerEvkChild(child))
  ) {
    return EULER_EVK_RELATIONSHIP;
  }

  return getAssetLevelRelationship(node);
};

export const getAllocationRelationshipBadge = (
  root: GraphNode,
  child: GraphNode | undefined,
): string | null => {
  const protocol = normalizeText(root.protocol);
  const subtype = normalizeText(root.details?.subtype);

  if (protocol.startsWith("morpho")) {
    if (isMorphoMarketChild(child))
      return MORPHO_MARKET_RELATIONSHIP.childBadge ?? null;
    if (isMorphoV1VaultChild(child)) {
      return MORPHO_V1_VAULT_RELATIONSHIP.childBadge ?? null;
    }
    return MORPHO_MARKET_RELATIONSHIP.childBadge ?? null;
  }

  if (
    protocol === "euler" &&
    subtype.includes("earn vault") &&
    (!child || isEulerEvkChild(child))
  ) {
    return EULER_EARN_RELATIONSHIP.childBadge ?? null;
  }

  if (isEulerEvkRoot(root) && (!child || isEulerEvkChild(child))) {
    return EULER_EVK_RELATIONSHIP.childBadge ?? null;
  }

  return getAssetLevelRelationship(root)?.childBadge ?? null;
};
