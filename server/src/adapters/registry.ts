import { createMidasAdapter } from "./midas/midasAdapter";
import { createMorphoAdapter } from "./morpho/morphoAdapter";
import { createInfinifiAdapter } from "./infinifi/infinifiAdapter";
import { createResolvAdapter } from "./resolv/resolvAdapter";
import { createYuzuAdapter } from "./yuzu/yuzuAdapter";
import { createEthenaAdapter } from "./ethena/ethenaAdapter";
import { createGauntletAdapter } from "./gauntlet/gauntletAdapter";
import { createSkyAdapter } from "./sky/skyAdapter";
import { createEulerAdapter } from "./euler/eulerAdapter";

export const adapterFactories = {
  midas: createMidasAdapter,
  morpho: createMorphoAdapter,
  infinifi: createInfinifiAdapter,
  resolv: createResolvAdapter,
  yuzu: createYuzuAdapter,
  ethena: createEthenaAdapter,
  gauntlet: createGauntletAdapter,
  sky: createSkyAdapter,
  euler: createEulerAdapter,
} as const;

export type AdapterFactory =
  (typeof adapterFactories)[keyof typeof adapterFactories];

const debankAdapterFactories = new Set<AdapterFactory>([
  createMidasAdapter,
  createInfinifiAdapter,
  createResolvAdapter,
  createYuzuAdapter,
]);

export const shouldSkipAdapterFactory = (factory: AdapterFactory): boolean => {
  return debankAdapterFactories.has(factory) && !process.env.DEBANK_ACCESS_KEY;
};
