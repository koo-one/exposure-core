import { fetchJsonOrThrow } from "../../utils.js";

const ETHENA_BACKING_URL =
  "https://api.llamarisk.com/protocols/ethena/overview/all/";
// NOTE:
// Llamarisk also provides APY time-series data for Ethena, but normalizing that
// payload (selecting the correct series, picking the latest datapoint, etc.)
// adds heavier logic than we need here. For sUSDe APY we instead use Ethena's
// own lightweight endpoint and read `stakingYield.value`.
const ETHENA_YIELDS_URL =
  "https://app.ethena.fi/api/yields/protocol-and-staking-yield";

interface EthenaCollateralEntry {
  asset: string;
  exchange: string;
  timestamp: number;
  usdAmount: number;
}

interface EthenaCollateralMetricsLatest {
  timestamp: string;
  data: {
    collateral: EthenaCollateralEntry[];
    totalBackingAssetsInUsd: number;
  };
}

interface EthenaChainMetricsLatest {
  timestamp: string;
  data: {
    totalUsdeSupply: string;
    totalSusdeSupply: string;
    usdePrice: string;
    susdePrice: string;
  };
}

interface EthenaBackingResponse {
  collateral_metrics: {
    latest: EthenaCollateralMetricsLatest;
  };
  chain_metrics: {
    latest: EthenaChainMetricsLatest;
  };
}

const fetchEthenaBacking = async (): Promise<EthenaBackingResponse> => {
  const json = await fetchJsonOrThrow<EthenaBackingResponse>(
    ETHENA_BACKING_URL,
    {
      errorContext: "Ethena API",
      includeErrorBody: true,
    },
  );
  const collateral = json?.collateral_metrics?.latest?.data?.collateral;

  if (!Array.isArray(collateral)) {
    throw new Error("Ethena API returned invalid collateral metrics");
  }

  if (!json?.chain_metrics?.latest?.data?.totalUsdeSupply) {
    throw new Error("Ethena API returned invalid chain metrics");
  }

  return json;
};

const fetchEthenaSusdeApy = async (): Promise<number | null> => {
  const json = await fetchJsonOrThrow<{
    stakingYield?: { value?: number };
  }>(ETHENA_YIELDS_URL, {
    errorContext: "Ethena yields",
    includeErrorBody: true,
  });

  const value = json?.stakingYield?.value;

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Ethena yields returned invalid stakingYield.value");
  }

  return value;
};

export interface EthenaCatalog {
  backing: EthenaBackingResponse;
  susdeApy: number | null;
}

export const fetchEthenaCatalog = async (): Promise<EthenaCatalog> => {
  const [backing, susdeApy] = await Promise.all([
    fetchEthenaBacking(),
    fetchEthenaSusdeApy(),
  ]);

  return { backing, susdeApy };
};
