export const normalizeId = (id: string): string => id.trim().toLowerCase();

export const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  compactDisplay: "short",
});

export const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 2,
});

export const formatChainLabel = (value: string | undefined): string => {
  if (!value) return "Unknown";
  const slug = value.trim().toLowerCase();

  switch (slug) {
    case "eth":
    case "ethereum":
      return "Ethereum";
    case "arb":
    case "arbitrum":
      return "Arbitrum";
    case "op":
    case "optimism":
      return "Optimism";
    case "base":
      return "Base";
    case "polygon":
    case "matic":
      return "Polygon";
    case "hyper":
    case "hyperliquid":
      return "Hyper";
    case "uni":
    case "unichain":
      return "Unichain";
    case "global":
      return "Global";
    default:
      return slug.length > 0
        ? slug[0].toUpperCase() + slug.slice(1)
        : "Unknown";
  }
};

export const formatUiLabel = (value: string | undefined): string => {
  if (!value) return "";

  return value
    .split(/([\s/:_-]+)/)
    .map((part) => {
      if (!part || /^[\s/:_-]+$/.test(part)) return part;
      if (part === part.toUpperCase()) return part;
      return part[0].toUpperCase() + part.slice(1);
    })
    .join("");
};

export const formatTitleLabel = (value: string | undefined): string => {
  if (!value) return "";

  return value
    .split(/([\s/:_-]+)/)
    .map((part) => {
      if (!part || /^[\s/:_-]+$/.test(part)) return part;
      if (/^[A-Z0-9]{2,5}$/.test(part)) return part;
      return part[0].toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("");
};
