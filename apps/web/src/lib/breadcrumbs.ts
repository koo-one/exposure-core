export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
  current?: boolean;
  collapsed?: boolean;
}

export const MAX_BREADCRUMB_DEPTH = 5;

const normalizeHistoryId = (value: string): string => value.trim();

export const limitBreadcrumbHistory = (
  history: string[],
  maxDepth = MAX_BREADCRUMB_DEPTH,
): string[] => {
  return history
    .map(normalizeHistoryId)
    .filter((value) => value.length > 0)
    .slice(-maxDepth);
};

export const pushBreadcrumbHistory = (
  history: string[],
  currentId: string,
  maxDepth = MAX_BREADCRUMB_DEPTH,
): string[] => {
  const nextId = normalizeHistoryId(currentId);
  const limited = limitBreadcrumbHistory(history, maxDepth);
  if (!nextId) return limited;

  const lastId = limited[limited.length - 1];
  if (lastId && lastId.toLowerCase() === nextId.toLowerCase()) {
    return limited;
  }

  return [...limited, nextId].slice(-maxDepth);
};

export const compactBreadcrumbs = (
  items: BreadcrumbItem[],
  maxDepth = MAX_BREADCRUMB_DEPTH,
): BreadcrumbItem[] => {
  if (items.length <= maxDepth) return items;
  if (maxDepth <= 0) return [];
  return items.slice(-maxDepth);
};
