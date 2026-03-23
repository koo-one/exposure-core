/**
 * Maps curator display names to their logo keys in /logos/curators/.
 * Returns the logo key string, or null if no logo is available.
 *
 * Kept in a non-client file so it can be imported by both Server Components
 * and client components without violating Next.js RSC import rules.
 */
export function getCuratorLogoKey(displayName: string): string | null {
  const normalized = displayName.trim().toLowerCase().replace(/\s+/g, "");
  const mapping: Record<string, string> = {
    gauntlet: "gauntlet",
    re7: "re7-labs",
    re7labs: "re7-labs",
    mevcapital: "mev-capital",
    apostro: "apostro",
    august: "august-digital",
    augustdigital: "august-digital",
    clearstar: "clearstar",
    kpk: "kpk",
    keyrock: "keyrock",
    "9summits": "9summits",
    ninesummits: "9summits",
  };
  return mapping[normalized] ?? null;
}
