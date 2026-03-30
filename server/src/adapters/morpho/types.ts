export interface MorphoMarket {
  uniqueKey: string;
  loanAsset: {
    address: string;
    symbol: string;
    decimals: number;
    priceUsd: number | null;
  };
  collateralAsset: {
    address: string;
    symbol: string;
  } | null;
  morphoBlue: {
    chain: {
      id: number;
      network: string;
    };
  };
}

export interface MorphoAllocation {
  supplyAssetsUsd: number | null;
  supplyAssets: string;
  market: MorphoMarket;
}
