"use client";

interface TimelineEntry {
  date: string;
  tag: "exploit" | "response" | "curator" | "update";
  text: string;
  source?: string;
  sourceUrl?: string;
}

interface TimelinePanelProps {
  entries: TimelineEntry[];
}

const TAG_STYLES: Record<
  TimelineEntry["tag"],
  { dotColor: string; pillBg: string; pillText: string; label: string }
> = {
  exploit: {
    dotColor: "#E11D48",
    pillBg: "rgba(225,29,72,0.08)",
    pillText: "#E11D48",
    label: "Exploit",
  },
  response: {
    dotColor: "#00A35C",
    pillBg: "rgba(0,163,92,0.08)",
    pillText: "#00A35C",
    label: "Response",
  },
  curator: {
    dotColor: "#1a8fa8",
    pillBg: "rgba(26,143,168,0.08)",
    pillText: "#1a8fa8",
    label: "Curator",
  },
  update: {
    dotColor: "rgba(0,0,0,0.25)",
    pillBg: "rgba(0,0,0,0.04)",
    pillText: "rgba(0,0,0,0.4)",
    label: "Update",
  },
};

export function TimelinePanel({ entries }: TimelinePanelProps) {
  return (
    <div className="relative">
      {/* Vertical line */}
      <div
        className="absolute top-0 bottom-0"
        style={{
          left: 11,
          width: 1,
          backgroundColor: "rgba(0,0,0,0.06)",
        }}
      />

      <div className="flex flex-col gap-0">
        {entries.map((entry, i) => {
          const style = TAG_STYLES[entry.tag];
          return (
            <div
              key={i}
              className="relative flex gap-3 pl-7 py-3 transition-colors rounded"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.backgroundColor =
                  "rgba(0,0,0,0.02)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.backgroundColor = "";
              }}
            >
              {/* Dot */}
              <div
                className="absolute flex-shrink-0 rounded-full"
                style={{
                  left: 8,
                  top: 16,
                  width: 8,
                  height: 8,
                  backgroundColor: style.dotColor,
                  zIndex: 1,
                }}
              />

              {/* Content */}
              <div className="min-w-0 flex-1">
                {/* Date + tag pill */}
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="uppercase font-black"
                    style={{
                      fontSize: 8,
                      letterSpacing: "0.12em",
                      color: "rgba(0,0,0,0.3)",
                    }}
                  >
                    {entry.date}
                  </span>
                  <span
                    className="rounded-full uppercase font-black"
                    style={{
                      fontSize: 7,
                      letterSpacing: "0.1em",
                      padding: "1px 6px",
                      backgroundColor: style.pillBg,
                      color: style.pillText,
                    }}
                  >
                    {style.label}
                  </span>
                </div>

                {/* Text */}
                <p
                  className="text-sm leading-snug"
                  style={{ color: "rgba(0,0,0,0.65)" }}
                >
                  {entry.text}
                </p>

                {/* Source link */}
                {entry.source && entry.sourceUrl && (
                  <a
                    href={entry.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1 transition-opacity hover:opacity-70"
                    style={{
                      fontSize: 9,
                      color: "rgba(0,0,0,0.35)",
                      fontWeight: 600,
                    }}
                  >
                    <span>{entry.source}</span>
                    <span style={{ fontSize: 8 }}>↗</span>
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
