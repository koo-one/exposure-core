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

export const debankResolverAdapterIds = [
  "midas",
  "infinifi",
  "resolv",
  "yuzu",
] as const;

export const adapterFactoriesWithoutDebankResolvers = Object.fromEntries(
  Object.entries(adapterFactories).filter(
    ([id]) =>
      !debankResolverAdapterIds.includes(
        id as (typeof debankResolverAdapterIds)[number],
      ),
  ),
) as Pick<
  typeof adapterFactories,
  Exclude<
    keyof typeof adapterFactories,
    (typeof debankResolverAdapterIds)[number]
  >
>;

export type AdapterFactory =
  (typeof adapterFactories)[keyof typeof adapterFactories];
