"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "exposure-follow-banner-dismissed";
const DELAY_MS = 6_000;

export function FollowBanner() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    setDismissed(false);
    const timer = setTimeout(() => setVisible(true), DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  if (dismissed || !visible) return null;

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY, "1");
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[90] transition-transform duration-500"
      style={{
        animation: "slide-up 0.4s ease-out",
      }}
    >
      <div
        className="max-w-[680px] mx-auto mb-6 mx-4 rounded-xl px-5 py-4 flex items-center gap-4"
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
        }}
      >
        <div className="flex-1 min-w-0">
          <p
            className="font-semibold"
            style={{ fontSize: 13, lineHeight: 1.4, color: "var(--text-primary)" }}
          >
            Want early access to new dashboards?
          </p>
          <p
            style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4 }}
          >
            Join our community for exposure.forum beta updates.
          </p>
        </div>

        <a
          href="https://t.me/+D7Os6D6ruIwzMzM1"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 rounded-lg px-4 py-2 text-white font-semibold transition-opacity hover:opacity-90 flex items-center gap-2"
          style={{
            backgroundColor: "#2AABEE",
            fontSize: 12,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
          </svg>
          Join Community
        </a>

        <button
          onClick={handleDismiss}
          className="flex-shrink-0 transition-colors cursor-pointer"
          style={{ fontSize: 18, lineHeight: 1, color: "var(--text-tertiary)" }}
          aria-label="Dismiss"
        >
          &times;
        </button>
      </div>

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
