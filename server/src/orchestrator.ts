import { GraphStore } from "./core/graph.js";
import {
  adapterFactories,
  shouldSkipAdapterFactory,
} from "./adapters/registry.js";
import type { AdapterFactory } from "./adapters/registry.js";
import type { AnyAdapter } from "./adapters/types.js";

// Orchestrator does not depend on adapter-specific catalog/allocation shapes.
// We intentionally erase those generics here to avoid union inference issues
// when running heterogeneous adapters.

export interface AdapterRunFailure {
  adapter: string;
  message: string;
}

export interface BuildDraftGraphsReport {
  storesByAsset: Map<string, GraphStore>;
  adapterFailures: AdapterRunFailure[];
}

const getAdapterFactoryName = (factory: AdapterFactory): string => {
  for (const [name, candidate] of Object.entries(adapterFactories)) {
    if (candidate === factory) return name;
  }

  return factory.name || "unknown-adapter";
};

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

const runAdapter = async (
  adapter: AnyAdapter,
  storesByAsset: Map<string, GraphStore>,
): Promise<void> => {
  const catalog = await adapter.fetchCatalog();
  const grouped = adapter.getAssetByAllocations(catalog);

  for (const [asset, allocations] of Object.entries(grouped)) {
    if (allocations.length === 0) continue;

    const root = adapter.buildRootNode(asset, allocations);

    if (!root) continue;

    const store = storesByAsset.get(asset) ?? new GraphStore();

    storesByAsset.set(asset, store);

    const { nodes, edges } = await adapter.normalizeLeaves(root, allocations);

    store.upsertNode(root);
    store.upsertNodes(nodes);
    store.addEdges(edges);
  }
};

const runAdapterFactory = async (
  factory: AdapterFactory,
  storesByAsset: Map<string, GraphStore>,
): Promise<void> => {
  if (shouldSkipAdapterFactory(factory)) return;

  const adapter = factory();

  await runAdapter(adapter, storesByAsset);
};

export const buildDraftGraphsByAsset = async (
  factories: readonly AdapterFactory[] = Object.values(adapterFactories),
): Promise<Map<string, GraphStore>> => {
  const { storesByAsset } = await buildDraftGraphsByAssetReport(factories);

  return storesByAsset;
};

export const buildDraftGraphsByAssetReport = async (
  factories: readonly AdapterFactory[] = Object.values(adapterFactories),
): Promise<BuildDraftGraphsReport> => {
  const storesByAsset = new Map<string, GraphStore>();
  const adapterFailures: AdapterRunFailure[] = [];

  for (const factory of factories) {
    const adapterName = getAdapterFactoryName(factory);

    try {
      await runAdapterFactory(factory, storesByAsset);
    } catch (error) {
      adapterFailures.push({
        adapter: adapterName,
        message: getErrorMessage(error),
      });

      console.error(
        `Graph generation failed for adapter "${adapterName}"`,
        error,
      );
    }
  }

  if (storesByAsset.size === 0) {
    const failureSummary = adapterFailures
      .map((failure) => `${failure.adapter}: ${failure.message}`)
      .join("; ");

    throw new Error(
      failureSummary
        ? `No adapters produced data (${failureSummary})`
        : "No adapters produced data",
    );
  }

  return {
    storesByAsset,
    adapterFailures,
  };
};
