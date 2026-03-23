"use client";

import { useState } from "react";
export { getCuratorLogoKey } from "@/lib/incident/logos";

interface ProtocolRowProps {
  name: string;
  logoSrc?: string;
  fallbackInitials: string;
  fallbackColor: string;
  meta: string;
  amount?: string;
  statusText?: string;
  exposureBar?: { color: string; width: string }[];
}

export function ProtocolRow({
  name,
  logoSrc,
  fallbackInitials,
  fallbackColor,
  meta,
  amount,
  statusText,
  exposureBar,
}: ProtocolRowProps) {
  const [imgError, setImgError] = useState(false);
  const showFallback = !logoSrc || imgError;

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 transition-colors cursor-default"
      style={{
        borderRadius: 4,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.backgroundColor =
          "rgba(0,0,0,0.02)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.backgroundColor = "";
      }}
    >
      {/* Logo / Initials */}
      <div
        className="flex-shrink-0 flex items-center justify-center rounded-lg overflow-hidden"
        style={{ width: 28, height: 28 }}
      >
        {showFallback ? (
          <div
            className="w-full h-full flex items-center justify-center rounded-lg"
            style={{ backgroundColor: fallbackColor }}
          >
            <span
              className="font-black text-white"
              style={{ fontSize: 10, letterSpacing: "-0.02em" }}
            >
              {fallbackInitials.slice(0, 2).toUpperCase()}
            </span>
          </div>
        ) : (
          <img
            src={logoSrc}
            alt={name}
            width={28}
            height={28}
            className="w-full h-full object-contain rounded-lg"
            onError={() => setImgError(true)}
          />
        )}
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div
          className="font-black text-black truncate"
          style={{ fontSize: 11 }}
        >
          {name}
        </div>
        <div
          className="truncate"
          style={{ color: "rgba(0,0,0,0.35)", fontSize: 9, fontWeight: 500 }}
        >
          {meta}
        </div>

        {/* Exposure bar */}
        {exposureBar && exposureBar.length > 0 && (
          <div
            className="flex mt-1 rounded-full overflow-hidden"
            style={{ height: 3, backgroundColor: "rgba(0,0,0,0.04)" }}
          >
            {exposureBar.map((segment, i) => (
              <div
                key={i}
                style={{
                  width: segment.width,
                  backgroundColor: segment.color,
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right side: amount + status */}
      <div className="flex flex-col items-end flex-shrink-0">
        {amount && (
          <span
            className="font-mono font-bold text-black"
            style={{ fontSize: 11 }}
          >
            {amount}
          </span>
        )}
        {statusText && (
          <span
            className="uppercase font-black"
            style={{
              fontSize: 8,
              letterSpacing: "0.12em",
              color: "rgba(0,0,0,0.3)",
            }}
          >
            {statusText}
          </span>
        )}
      </div>
    </div>
  );
}
