"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import type { BreadcrumbItem } from "@/lib/breadcrumbs";

export function BreadcrumbTrail({
  items,
  className = "",
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-2 overflow-x-auto no-scrollbar ${className}`.trim()}
    >
      {items.map((item, idx) => {
        const textClassName = item.current
          ? "text-[8px] font-semibold text-black tracking-[0.05em] whitespace-nowrap"
          : item.collapsed
            ? "text-[8px] font-semibold text-black/25 tracking-[0.05em] whitespace-nowrap"
            : "text-[8px] font-semibold text-black/45 hover:text-black tracking-[0.05em] transition-colors whitespace-nowrap";

        return (
          <div key={`${item.label}-${idx}`} className="flex items-center gap-2">
            {idx > 0 && <ChevronRight className="h-2.5 w-2.5 text-black/20" />}
            {item.onClick ? (
              <button
                type="button"
                onClick={item.onClick}
                className={textClassName}
                aria-current={item.current ? "page" : undefined}
              >
                {item.label || ""}
              </button>
            ) : item.href ? (
              <Link
                href={item.href}
                className={textClassName}
                aria-current={item.current ? "page" : undefined}
              >
                {item.label || ""}
              </Link>
            ) : (
              <span
                className={
                  item.current || item.collapsed
                    ? textClassName
                    : "text-[8px] font-semibold text-black/35 tracking-[0.05em] whitespace-nowrap"
                }
                aria-current={item.current ? "page" : undefined}
              >
                {item.label || ""}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
