import { createMidasAdapter } from "./midas/midasAdapter.js";
import { createMorphoAdapter } from "./morpho/morphoAdapter.js";
import { createInfinifiAdapter } from "./infinifi/infinifiAdapter.js";
import { createResolvAdapter } from "./resolv/resolvAdapter.js";
import { createYuzuAdapter } from "./yuzu/yuzuAdapter.js";
import { createEthenaAdapter } from "./ethena/ethenaAdapter.js";
import { createGauntletAdapter } from "./gauntlet/gauntletAdapter.js";
import { createSkyAdapter } from "./sky/skyAdapter.js";
import { createEulerAdapter } from "./euler/eulerAdapter.js";
import { createFluidAdapter } from "./fluid/fluidAdapter.js";

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
  fluid: createFluidAdapter,
} as const;

export type AdapterFactory =
  (typeof adapterFactories)[keyof typeof adapterFactories];

export const shouldSkipAdapterFactory = (factory: AdapterFactory): boolean => {
  void factory;
  return false;
};
