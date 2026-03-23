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

const TAG_LABELS: Record<TimelineEntry["tag"], string> = {
  exploit: "Exploit",
  response: "Response",
  curator: "Curator",
  update: "Update",
};

const GHOST_DOT = "rgba(0,0,0,0.15)";
const GHOST_PILL_BG = "rgba(0,0,0,0.04)";
const GHOST_PILL_TEXT = "rgba(0,0,0,0.40)";

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
                  backgroundColor: GHOST_DOT,
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
                      backgroundColor: GHOST_PILL_BG,
                      color: GHOST_PILL_TEXT,
                    }}
                  >
                    {TAG_LABELS[entry.tag]}
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
