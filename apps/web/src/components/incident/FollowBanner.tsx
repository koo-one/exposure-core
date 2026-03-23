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
          backgroundColor: "#fff",
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
        }}
      >
        <div className="flex-1 min-w-0">
          <p
            className="font-semibold text-black"
            style={{ fontSize: 13, lineHeight: 1.4 }}
          >
            Want early access to new dashboards?
          </p>
          <p
            style={{ fontSize: 12, color: "rgba(0,0,0,0.45)", lineHeight: 1.4 }}
          >
            Follow me for exposure.forum beta updates.
          </p>
        </div>

        <a
          href="https://x.com/0xkooone"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 rounded-lg px-4 py-2 text-white font-semibold transition-opacity hover:opacity-90"
          style={{
            backgroundColor: "#000",
            fontSize: 12,
          }}
        >
          Follow on X
        </a>

        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-black/20 hover:text-black/50 transition-colors cursor-pointer"
          style={{ fontSize: 18, lineHeight: 1 }}
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
