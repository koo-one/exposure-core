"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

interface IncidentNavProps {
  title: string;
  slug: string;
}

const NAV_ITEMS = [
  { label: "Overview", href: (slug: string) => `/incident/${slug}` },
  { label: "Data", href: (slug: string) => `/incident/${slug}/dashboard` },
  { label: "Timeline", href: (slug: string) => `/incident/${slug}/timeline` },
] as const;

export function IncidentNav({ title, slug }: IncidentNavProps) {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === `/incident/${slug}`) {
      return pathname === `/incident/${slug}`;
    }
    return pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-black flex items-center justify-between px-4 h-12 md:px-6">
      {/* Left: brand */}
      <div className="flex items-center gap-2">
        <div
          className="flex items-center justify-center rounded-lg flex-shrink-0"
          style={{ width: 32, height: 32, backgroundColor: "#000" }}
        >
          <span
            className="font-black"
            style={{ color: "#00FF85", fontSize: 16, lineHeight: 1 }}
          >
            E
          </span>
        </div>
        <div className="flex flex-col leading-none">
          <span
            className="font-black text-lg text-black leading-tight"
            style={{ letterSpacing: "-0.02em" }}
          >
            Exposure
          </span>
          <span
            className="uppercase font-black text-black/30"
            style={{ fontSize: 7, letterSpacing: "0.25em" }}
          >
            Risk Registry
          </span>
        </div>
      </div>

      {/* Center: nav pills */}
      <nav className="flex items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const href = item.href(slug);
          const active = isActive(href);
          return (
            <Link
              key={item.label}
              href={href}
              className="rounded-full transition-colors"
              style={{
                padding: "4px 12px",
                backgroundColor: active ? "#000" : "#fff",
                color: active ? "#fff" : "rgba(0,0,0,0.4)",
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                border: active ? "none" : "1px solid rgba(0,0,0,0.08)",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Right: incident status */}
      <div className="flex items-center gap-3">
        {/* Active incident indicator */}
        <div className="flex items-center gap-1.5">
          <span className="relative flex" style={{ width: 6, height: 6 }}>
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: "#E11D48" }}
            />
            <span
              className="relative inline-flex rounded-full"
              style={{ width: 6, height: 6, backgroundColor: "#E11D48" }}
            />
          </span>
          <span
            className="uppercase font-black text-black/40"
            style={{ fontSize: 8, letterSpacing: "0.15em" }}
          >
            Active Incident
          </span>
        </div>

        {/* Separator */}
        <span style={{ color: "rgba(0,0,0,0.15)", fontSize: 10 }}>|</span>

        {/* Live update */}
        <div className="flex items-center gap-1">
          <span
            className="inline-block rounded-full"
            style={{ width: 5, height: 5, backgroundColor: "#00FF85" }}
          />
          <span
            className="uppercase font-black text-black/30 hidden md:inline"
            style={{ fontSize: 8, letterSpacing: "0.15em" }}
          >
            Live
          </span>
        </div>

        {/* Back link */}
        <Link
          href="/"
          className="uppercase font-black text-black/25 transition-colors hover:text-black/50 hidden md:inline"
          style={{ fontSize: 8, letterSpacing: "0.15em" }}
          title={title}
        >
          ← Back
        </Link>
      </div>
    </header>
  );
}
