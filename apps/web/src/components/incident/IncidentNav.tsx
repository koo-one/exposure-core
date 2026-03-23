"use client";

import { useState, useEffect } from "react";
import { Activity } from "lucide-react";

interface IncidentNavProps {
  title: string;
  lastUpdated?: string;
}

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  if (isNaN(then)) return isoString;
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Updated just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Updated ${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Updated ${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `Updated ${diffDays}d ago`;
}

export function IncidentNav({ title, lastUpdated }: IncidentNavProps) {
  const [relTime, setRelTime] = useState<string>(() =>
    lastUpdated ? formatRelativeTime(lastUpdated) : "",
  );
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("exposure-dark-mode");
    const prefersDark = stored === "1" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(prefersDark);
    document.documentElement.classList.toggle("dark", prefersDark);
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("exposure-dark-mode", next ? "1" : "0");
  };

  useEffect(() => {
    if (!lastUpdated) return;
    setRelTime(formatRelativeTime(lastUpdated));
    const interval = setInterval(() => {
      setRelTime(formatRelativeTime(lastUpdated));
    }, 30_000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  return (
    <header className="sticky top-0 z-50 w-full border-b" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="max-w-[1280px] mx-auto flex items-center justify-between gap-4 px-6 h-14">
        {/* Left: brand */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-black dark:bg-white rounded-lg w-8 h-8 flex items-center justify-center shadow-lg shadow-black/10">
            <Activity className="text-[#00FF85] dark:text-black w-4 h-4" />
          </div>
          <div className="flex flex-col -gap-1">
            <span className="text-lg font-black tracking-[0.01em] leading-none" style={{ color: "var(--text-primary)" }}>
              Exposure
            </span>
            <span className="text-[7px] font-semibold tracking-[0.06em]" style={{ color: "var(--text-tertiary)" }}>
              Risk Registry
            </span>
          </div>
        </div>

        {/* Divider + incident context */}
        <div className="hidden md:flex items-center gap-2.5 shrink-0">
          <div className="w-px h-4" style={{ backgroundColor: "var(--border)" }} />
          <span
            className="font-black truncate max-w-[180px] uppercase"
            style={{ fontSize: 9, letterSpacing: "0.06em", color: "var(--text-secondary)" }}
          >
            {title}
          </span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right: dark mode toggle + timestamp */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={toggleDark}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Toggle dark mode"
          >
            {dark ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-secondary)" }}>
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-secondary)" }}>
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          {relTime && (
            <div
              className="hidden sm:flex items-center gap-1.5"
              title={lastUpdated}
            >
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
                className="uppercase font-semibold"
                style={{ fontSize: 8, letterSpacing: "0.12em", color: "var(--text-secondary)" }}
              >
                {relTime}
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
