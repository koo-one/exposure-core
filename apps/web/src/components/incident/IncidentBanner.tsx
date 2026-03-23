"use client";

interface IncidentBannerProps {
  title: string;
  description: string;
  timestamp: string;
  status: "active" | "resolved";
}

export function IncidentBanner({
  title,
  description,
  timestamp,
  status,
}: IncidentBannerProps) {
  return (
    <div
      className="flex items-start justify-between gap-4 rounded px-4 py-3"
      style={{
        backgroundColor: "rgba(225,29,72,0.04)",
        border: "1px solid rgba(225,29,72,0.10)",
      }}
    >
      {/* Left: dot + title + description */}
      <div className="flex items-start gap-3 min-w-0">
        {/* Pulsing red dot */}
        <span
          className="relative flex flex-shrink-0 mt-0.5"
          style={{ width: 8, height: 8 }}
        >
          {status === "active" && (
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: "#E11D48" }}
            />
          )}
          <span
            className="relative inline-flex rounded-full"
            style={{
              width: 8,
              height: 8,
              backgroundColor:
                status === "active" ? "#E11D48" : "rgba(0,0,0,0.2)",
            }}
          />
        </span>

        <div className="min-w-0">
          <span
            className="uppercase font-black block"
            style={{
              color: "#E11D48",
              fontSize: 8,
              letterSpacing: "0.15em",
              marginBottom: 4,
            }}
          >
            {title}
          </span>
          <span
            className="block text-sm leading-snug"
            style={{ color: "var(--text-secondary)" }}
          >
            {description}
          </span>
        </div>
      </div>

      {/* Right: timestamp */}
      <span
        className="flex-shrink-0 uppercase font-black"
        style={{
          color: "var(--text-tertiary)",
          fontSize: 8,
          letterSpacing: "0.12em",
          whiteSpace: "nowrap",
          paddingTop: 2,
        }}
      >
        {timestamp}
      </span>
    </div>
  );
}
