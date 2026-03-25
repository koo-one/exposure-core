type DetailType =
  | "common"
  | "locked"
  | "lending"
  | "leveraged_farming"
  | "vesting"
  | "reward"
  | "options_seller"
  | "options_buyer"
  | "insurance_seller"
  | "insurance_buyer"
  | "perpetuals"
  | "nft_common"
  | "nft_lending"
  | "nft_fraction";

type PortfolioItemName =
  | "Yield"
  | "Deposit"
  | "Staked"
  | "Lending"
  | "Liquidity Pool"
  | "Perpetuals"
  | "Investment";

export interface TokenObject {
  id: string;
  chain: string;
  app_id?: string;

  name: string | null;
  symbol: string | null;
  decimals: number | null;
  logo_url: string | null;
  display_symbol: string | null;
  optimized_symbol: string;
  protocol_id: string;
  price: number;
  is_verified?: boolean;
  is_wallet?: boolean;
  is_core: boolean | null;
  time_at: number | null;
  amount?: number;
  is_collateral?: boolean;
  usd_value?: number;
  raw_amount?: number;
}

export interface PortfolioItemObject {
  stats: {
    asset_usd_value: number;
    debt_usd_value: number;
    net_usd_value: number;
  };

  update_at: number;
  name: PortfolioItemName;
  detail_types?: DetailType[];
  asset_dict?: Record<string, number>;
  asset_token_list?: TokenObject[];
  // Not in docs, but present in Debank app responses.
  base?: {
    app_id: string;
    user_addr: string;
  };
  detail: {
    supply_token_list: TokenObject[];
    reward_token_list?: TokenObject[];
    borrow_token_list?: TokenObject[];

    description?: string;
    unlock_at?: number;
    health_rate?: number;
    side?: "Long" | "Short";
    base_token?: TokenObject;
    quote_token?: TokenObject;
    position_token?: TokenObject;
    margin_token?: TokenObject;
    margin_rate?: number;
    leverage?: number;
    daily_funding_rate?: number;
    entry_price?: number;
    mark_price?: number;
    liquidation_price?: number;
    pnl_usd_value?: number;

    [k: string]: unknown;
  };
  proxy_detail?:
    | {
        project: {
          id: string;
          name: string;
          site_url: string;
          logo_url: string;
        };
        proxy_contract_id: string;
      }
    | Record<string, never>;

  // app chain doesnt have pool object e.g (hyperliquid, lighter)
  pool?: {
    controller: string;
    id: string;
    chain: string;
    project_id: string;
  };

  position_index?: string;
}

export interface ComplexProtocolItem {
  id: string;
  chain: string;
  name: string | null;
  logo_url: string | null;
  site_url: string;
  has_supported_portfolio: boolean;
  tvl?: number;
  portfolio_item_list: PortfolioItemObject[];
}

export interface AppProtocolItem {
  id: string;
  name: string | null;
  logo_url: string | null;
  site_url: string;
  has_supported_portfolio?: boolean;
  is_visible?: boolean;
  update_at?: number | null;
  create_at?: number | null;
  portfolio_item_list: PortfolioItemObject[];
}

const DEFAULT_BASE_URL = "https://pro-openapi.debank.com/v1";
const COMPLEX_PROTOCOL_LIST_PATH = `${DEFAULT_BASE_URL}/user/complex_protocol_list`;
const ALL_COMPLEX_PROTOCOL_LIST_PATH = `${DEFAULT_BASE_URL}/user/all_complex_protocol_list`;
const COMPLEX_APP_LIST_PATH = `${DEFAULT_BASE_URL}/user/complex_app_list`;
const ALL_TOKEN_LIST_PATH = `${DEFAULT_BASE_URL}/user/all_token_list`;
const BUNDLE_API_BASE_URL = "https://api.debank.com";
const BUNDLE_PATH = `${BUNDLE_API_BASE_URL}/bundle`;

// Keep Debank under a conservative global cap. We allow up to 50 requests in a
// shared one-second window across the whole process, then wait for the next
// window before starting more requests.
const DEBANK_MAX_REQUESTS_PER_WINDOW = 50;
const DEBANK_WINDOW_MS = 5000;

let debankWindowStartedAt = 0;
let debankRequestsInWindow = 0;
let debankLimiterChain: Promise<void> = Promise.resolve();

const sleep = async (ms: number): Promise<void> => {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const waitForDebankRequestWindow = async (): Promise<void> => {
  const previous = debankLimiterChain;

  let release!: () => void;
  debankLimiterChain = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;

  const now = Date.now();

  if (
    debankWindowStartedAt === 0 ||
    now - debankWindowStartedAt >= DEBANK_WINDOW_MS
  ) {
    debankWindowStartedAt = now;
    debankRequestsInWindow = 0;
  }

  if (debankRequestsInWindow >= DEBANK_MAX_REQUESTS_PER_WINDOW) {
    await sleep(debankWindowStartedAt + DEBANK_WINDOW_MS - now);
    debankWindowStartedAt = Date.now();
    debankRequestsInWindow = 0;
  }

  debankRequestsInWindow += 1;
  release();
};

const buildDebankUrl = (path: string, walletAddress: string): URL => {
  const url = new URL(path);

  url.searchParams.set("id", walletAddress);

  return url;
};

const fetchDebankData = async <T>(url: URL): Promise<T> => {
  const headers: Record<string, string> = {};

  const accessKey = process.env.DEBANK_ACCESS_KEY;

  // In local fixture runs we may be using a mocked fetch implementation.
  // Avoid failing early when the access key is missing; the mock can still
  // serve responses. Real Debank requests will fail without a key.
  if (accessKey) {
    headers.AccessKey = accessKey;
  }

  await waitForDebankRequestWindow();

  const response = await fetch(url.href, { headers });

  if (!response.ok) {
    throw new Error(
      `Debank API error: ${response.status} ${response.statusText}`,
    );
  }

  const data: T = await response.json();

  return data;
};

export const fetchComplexProtocolList = async (
  walletAddress: string,
): Promise<ComplexProtocolItem[]> => {
  const path = process.env.DEBANK_ACCESS_KEY
    ? ALL_COMPLEX_PROTOCOL_LIST_PATH
    : COMPLEX_PROTOCOL_LIST_PATH;
  const url = buildDebankUrl(path, walletAddress);

  return fetchDebankData<ComplexProtocolItem[]>(url);
};

export const fetchTokenList = async (
  walletAddress: string,
): Promise<TokenObject[]> => {
  const url = buildDebankUrl(ALL_TOKEN_LIST_PATH, walletAddress);

  return fetchDebankData<TokenObject[]>(url);
};

export const fetchComplexAppList = async (
  walletAddress: string,
): Promise<AppProtocolItem[]> => {
  const url = buildDebankUrl(COMPLEX_APP_LIST_PATH, walletAddress);

  return fetchDebankData<AppProtocolItem[]>(url);
};

export interface BundleWallet {
  id: string;
  [key: string]: unknown;
}

export const fetchBundleWallets = async (
  bundleId: string,
): Promise<string[]> => {
  const url = new URL(BUNDLE_PATH);
  url.searchParams.set("id", bundleId);

  const data = await fetchDebankData<BundleWallet[]>(url);

  return data.map((wallet) => wallet.id);
};
