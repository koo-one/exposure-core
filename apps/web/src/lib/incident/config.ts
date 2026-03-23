import type { IncidentConfig } from "./types";

const configs: Record<string, () => Promise<{ default: IncidentConfig }>> = {
  resolv: () => import("@/data/incidents/resolv-usr"),
};

export async function loadIncidentConfig(
  slug: string,
): Promise<IncidentConfig | null> {
  const loader = configs[slug];
  if (!loader) return null;
  const mod = await loader();
  return mod.default;
}

export function getKnownSlugs(): string[] {
  return Object.keys(configs);
}
