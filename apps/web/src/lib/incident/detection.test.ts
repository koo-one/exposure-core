import { describe, it, expect } from "vitest";
import { detectToxicExposure } from "./detection";
import type { GraphSnapshot } from "@/types";

const TOXIC_ASSETS = ["USR", "wstUSR", "RLP"];
const TOXIC_NODE_IDS = [
  "eth:resolv:0x66a1e37c9b0eaddca17d3662d6c05f4decf3e110",
];

function makeSnapshot(
  rootId: string,
  rootName: string,
  children: { id: string; name: string; allocationUsd: number }[],
): GraphSnapshot {
  return {
    nodes: [
      { id: rootId, name: rootName },
      ...children.map((c) => ({ id: c.id, name: c.name })),
    ],
    edges: children.map((c) => ({
      from: rootId,
      to: c.id,
      allocationUsd: c.allocationUsd,
    })),
    sources: ["test"],
  };
}

describe("detectToxicExposure", () => {
  // Layer 2a: Morpho collateral-side slash parsing
  it("matches USDC/USR (collateral = USR)", () => {
    const snap = makeSnapshot("root", "Vault", [
      { id: "m1", name: "USDC/USR", allocationUsd: 100_000 },
      { id: "m2", name: "USDC/WBTC", allocationUsd: 200_000 },
    ]);
    const result = detectToxicExposure(
      snap,
      "root",
      TOXIC_ASSETS,
      TOXIC_NODE_IDS,
    );
    expect(result.toxicExposureUsd).toBe(100_000);
    expect(result.exposurePct).toBeCloseTo(100_000 / 300_000);
    expect(result.breakdown).toContainEqual(
      expect.objectContaining({ asset: "USR", amountUsd: 100_000 }),
    );
  });

  it("matches USDC/wstUSR", () => {
    const snap = makeSnapshot("root", "Vault", [
      { id: "m1", name: "USDC/wstUSR", allocationUsd: 50_000 },
    ]);
    const result = detectToxicExposure(
      snap,
      "root",
      TOXIC_ASSETS,
      TOXIC_NODE_IDS,
    );
    expect(result.toxicExposureUsd).toBe(50_000);
    expect(result.breakdown[0].asset).toBe("wstUSR");
  });

  it("matches USDC/RLP", () => {
    const snap = makeSnapshot("root", "Vault", [
      { id: "m1", name: "USDC/RLP", allocationUsd: 30_000 },
    ]);
    const result = detectToxicExposure(
      snap,
      "root",
      TOXIC_ASSETS,
      TOXIC_NODE_IDS,
    );
    expect(result.toxicExposureUsd).toBe(30_000);
  });

  it("skips USR/mMEV (USR is loan, not collateral)", () => {
    const snap = makeSnapshot("root", "Vault", [
      { id: "m1", name: "USR/mMEV", allocationUsd: 100_000 },
    ]);
    const result = detectToxicExposure(
      snap,
      "root",
      TOXIC_ASSETS,
      TOXIC_NODE_IDS,
    );
    expect(result.toxicExposureUsd).toBe(0);
  });

  it("matches AUSD/RLP (non-standard loan asset)", () => {
    const snap = makeSnapshot("root", "Vault", [
      { id: "m1", name: "AUSD/RLP", allocationUsd: 315_000 },
    ]);
    const result = detectToxicExposure(
      snap,
      "root",
      TOXIC_ASSETS,
      TOXIC_NODE_IDS,
    );
    expect(result.toxicExposureUsd).toBe(315_000);
  });

  // Layer 3: Derivative handling
  it("matches USDC/PT-RLP-9APR2026 (Pendle derivative)", () => {
    const snap = makeSnapshot("root", "Vault", [
      { id: "m1", name: "USDC/PT-RLP-9APR2026", allocationUsd: 474_000 },
    ]);
    const result = detectToxicExposure(
      snap,
      "root",
      TOXIC_ASSETS,
      TOXIC_NODE_IDS,
    );
    expect(result.toxicExposureUsd).toBe(474_000);
    expect(result.breakdown[0].asset).toBe("RLP");
  });

  it("matches USD0/MC-USR (MC-wrapped derivative)", () => {
    const snap = makeSnapshot("root", "Vault", [
      { id: "m1", name: "USD0/MC-USR", allocationUsd: 25_000 },
    ]);
    const result = detectToxicExposure(
      snap,
      "root",
      TOXIC_ASSETS,
      TOXIC_NODE_IDS,
    );
    expect(result.toxicExposureUsd).toBe(25_000);
    expect(result.breakdown[0].asset).toBe("USR");
  });

  it("matches USDC/PT-wstUSR-27MAR2025", () => {
    const snap = makeSnapshot("root", "Vault", [
      { id: "m1", name: "USDC/PT-wstUSR-27MAR2025", allocationUsd: 784 },
    ]);
    const result = detectToxicExposure(
      snap,
      "root",
      TOXIC_ASSETS,
      TOXIC_NODE_IDS,
    );
    expect(result.toxicExposureUsd).toBe(784);
    expect(result.breakdown[0].asset).toBe("wstUSR");
  });

  // Layer 2b: Euler substring matching
  it("matches 'Euler Arbitrum Yield RLP' (no slash, substring)", () => {
    const snap = makeSnapshot("root", "Vault", [
      { id: "e1", name: "Euler Arbitrum Yield RLP", allocationUsd: 437_000 },
    ]);
    const result = detectToxicExposure(
      snap,
      "root",
      TOXIC_ASSETS,
      TOXIC_NODE_IDS,
    );
    expect(result.toxicExposureUsd).toBe(437_000);
  });

  it("matches 'Apostro Resolv USR vault' (Euler pattern)", () => {
    const snap = makeSnapshot("root", "Vault", [
      { id: "e1", name: "Apostro Resolv USR vault", allocationUsd: 4_000 },
    ]);
    const result = detectToxicExposure(
      snap,
      "root",
      TOXIC_ASSETS,
      TOXIC_NODE_IDS,
    );
    expect(result.toxicExposureUsd).toBe(4_000);
  });

  it("matches 'K3 Capital USR' (short Euler name)", () => {
    const snap = makeSnapshot("root", "Vault", [
      { id: "e1", name: "K3 Capital USR", allocationUsd: 35 },
    ]);
    const result = detectToxicExposure(
      snap,
      "root",
      TOXIC_ASSETS,
      TOXIC_NODE_IDS,
    );
    expect(result.toxicExposureUsd).toBe(35);
  });

  it("matches 'Resolv PT-USR-29MAY2025' (Euler derivative)", () => {
    const snap = makeSnapshot("root", "Vault", [
      { id: "e1", name: "Resolv PT-USR-29MAY2025", allocationUsd: 4_370 },
    ]);
    const result = detectToxicExposure(
      snap,
      "root",
      TOXIC_ASSETS,
      TOXIC_NODE_IDS,
    );
    expect(result.toxicExposureUsd).toBe(4_370);
  });

  // Layer 4: Whitelist safety net
  it("matches by toxicAssetNodeIds whitelist", () => {
    const snap = makeSnapshot("root", "Vault", [
      {
        id: "eth:resolv:0x66a1e37c9b0eaddca17d3662d6c05f4decf3e110",
        name: "Unknown",
        allocationUsd: 1_000,
      },
    ]);
    const result = detectToxicExposure(
      snap,
      "root",
      TOXIC_ASSETS,
      TOXIC_NODE_IDS,
    );
    expect(result.toxicExposureUsd).toBe(1_000);
  });

  // Aggregation
  it("aggregates multiple toxic assets correctly", () => {
    const snap = makeSnapshot("root", "Vault", [
      { id: "m1", name: "USDC/USR", allocationUsd: 200_000 },
      { id: "m2", name: "USDC/wstUSR", allocationUsd: 100_000 },
      { id: "m3", name: "USDC/RLP", allocationUsd: 50_000 },
      { id: "m4", name: "USDC/WBTC", allocationUsd: 650_000 },
    ]);
    const result = detectToxicExposure(
      snap,
      "root",
      TOXIC_ASSETS,
      TOXIC_NODE_IDS,
    );
    expect(result.toxicExposureUsd).toBe(350_000);
    expect(result.exposurePct).toBeCloseTo(0.35);
    expect(result.breakdown).toHaveLength(3);
  });

  it("does not double-count edges matched by multiple layers", () => {
    const snap = makeSnapshot("root", "Vault", [
      {
        id: "eth:resolv:0x66a1e37c9b0eaddca17d3662d6c05f4decf3e110",
        name: "USDC/USR",
        allocationUsd: 100,
      },
    ]);
    const result = detectToxicExposure(
      snap,
      "root",
      TOXIC_ASSETS,
      TOXIC_NODE_IDS,
    );
    expect(result.toxicExposureUsd).toBe(100);
  });

  // Edge cases
  it("returns empty for null snapshot", () => {
    const result = detectToxicExposure(
      null,
      "root",
      TOXIC_ASSETS,
      TOXIC_NODE_IDS,
    );
    expect(result.status).toBe("pending");
    expect(result.toxicExposureUsd).toBe(0);
  });

  it("returns empty for snapshot with no edges", () => {
    const snap: GraphSnapshot = {
      nodes: [{ id: "root", name: "Vault" }],
      edges: [],
      sources: [],
    };
    const result = detectToxicExposure(
      snap,
      "root",
      TOXIC_ASSETS,
      TOXIC_NODE_IDS,
    );
    expect(result.toxicExposureUsd).toBe(0);
    expect(result.exposurePct).toBe(0);
  });

  it("skips zero-allocation edges", () => {
    const snap = makeSnapshot("root", "Vault", [
      { id: "m1", name: "USDC/USR", allocationUsd: 0 },
    ]);
    const result = detectToxicExposure(
      snap,
      "root",
      TOXIC_ASSETS,
      TOXIC_NODE_IDS,
    );
    expect(result.toxicExposureUsd).toBe(0);
  });
});
