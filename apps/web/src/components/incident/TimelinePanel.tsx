"use client";

import { useState } from "react";
import { getProtocolIcon } from "@/lib/incident/logos";

interface TimelineTweet {
  author: string;
  handle: string;
  text: string;
  url: string;
}

interface TimelineAction {
  protocol: string;
  action: string;
  market?: string;
  txUrl?: string;
}

interface TimelineLink {
  label: string;
  url: string;
}

interface TimelineDetails {
  description?: string;
  tweets?: TimelineTweet[];
  actions?: TimelineAction[];
  links?: TimelineLink[];
}

export interface TimelineEntry {
  date: string;
  tag: "exploit" | "response" | "curator" | "update" | "governance";
  text: string;
  source?: string;
  sourceUrl?: string;
  details?: TimelineDetails;
}

interface TimelinePanelProps {
  entries: TimelineEntry[];
}

const TAG_LABELS: Record<TimelineEntry["tag"], string> = {
  exploit: "Exploit",
  response: "Response",
  curator: "Curator",
  update: "Update",
  governance: "Governance",
};

const TAG_COLORS: Record<TimelineEntry["tag"], { bg: string; text: string }> = {
  exploit: { bg: "rgba(220,38,38,0.08)", text: "rgba(220,38,38,0.70)" },
  response: { bg: "rgba(0,163,92,0.08)", text: "rgba(0,163,92,0.70)" },
  curator: { bg: "rgba(37,99,235,0.08)", text: "rgba(37,99,235,0.70)" },
  update: { bg: "var(--border)", text: "var(--text-secondary)" },
  governance: { bg: "rgba(124,58,237,0.08)", text: "rgba(124,58,237,0.70)" },
};

const GHOST_DOT = "rgba(0,0,0,0.15)";

function DetailModal({
  entry,
  onClose,
}: {
  entry: TimelineEntry;
  onClose: () => void;
}) {
  const details: TimelineDetails = entry.details ?? {};
  const tagColor = TAG_COLORS[entry.tag];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="rounded-xl surface max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-black/[0.06]">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="uppercase font-black"
              style={{
                fontSize: 9,
                letterSpacing: "0.12em",
                color: "var(--text-tertiary)",
              }}
            >
              {entry.date}
            </span>
            <span
              className="rounded-full uppercase font-black"
              style={{
                fontSize: 7,
                letterSpacing: "0.1em",
                padding: "2px 8px",
                backgroundColor: tagColor.bg,
                color: tagColor.text,
              }}
            >
              {TAG_LABELS[entry.tag]}
            </span>
          </div>
          <p
            className="text-sm font-semibold leading-snug"
            style={{ color: "var(--text-primary)" }}
          >
            {entry.text}
          </p>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-4">
          {/* Description */}
          {details.description && (
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              {details.description}
            </p>
          )}

          {/* Tweets */}
          {details.tweets && details.tweets.length > 0 && (
            <div className="space-y-2">
              <p
                className="uppercase font-black"
                style={{
                  fontSize: 8,
                  letterSpacing: "0.15em",
                  color: "var(--text-tertiary)",
                }}
              >
                Posts
              </p>
              {details.tweets.map((tweet, i) => (
                <a
                  key={i}
                  href={tweet.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg p-3 transition-colors hover:opacity-80"
                  style={{ border: "1px solid var(--border)" }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className="font-bold text-xs"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {tweet.author}
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {tweet.handle}
                    </span>
                  </div>
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {tweet.text}
                  </p>
                </a>
              ))}
            </div>
          )}

          {/* Actions */}
          {details.actions && details.actions.length > 0 && (
            <div className="space-y-2">
              <p
                className="uppercase font-black"
                style={{
                  fontSize: 8,
                  letterSpacing: "0.15em",
                  color: "var(--text-tertiary)",
                }}
              >
                Actions Taken
              </p>
              {details.actions.map((action, i) => (
                <div
                  key={i}
                  className="rounded-lg p-3"
                  style={{ border: "1px solid var(--border)" }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <img
                      src={getProtocolIcon(action.protocol)}
                      alt={action.protocol}
                      className="w-4 h-4"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <span
                      className="font-bold text-xs capitalize"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {action.action}
                    </span>
                  </div>
                  {action.market && (
                    <p
                      className="text-xs font-mono"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {action.market}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Links */}
          {details.links && details.links.length > 0 && (
            <div className="space-y-1">
              <p
                className="uppercase font-black"
                style={{
                  fontSize: 8,
                  letterSpacing: "0.15em",
                  color: "var(--text-tertiary)",
                }}
              >
                Sources
              </p>
              {details.links.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
                  style={{ color: "var(--text-secondary)", fontWeight: 600 }}
                >
                  <span>{link.label}</span>
                  <span style={{ fontSize: 9 }}>↗</span>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Close button */}
        <div className="px-5 pb-4">
          <button
            onClick={onClose}
            className="w-full rounded-lg py-2 text-xs font-semibold transition-colors hover:opacity-80"
            style={{
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const PREVIEW_COUNT = 6;

function TimelineEntryList({
  entries,
  onExpandEntry,
}: {
  entries: TimelineEntry[];
  onExpandEntry: (entry: TimelineEntry) => void;
}) {
  return (
    <div className="relative">
      {/* Vertical line */}
      <div
        className="absolute top-0 bottom-0"
        style={{
          left: 11,
          width: 1,
          backgroundColor: "var(--border)",
        }}
      />

      <div className="flex flex-col gap-0">
        {entries.map((entry, i) => {
          const hasDetails = !!entry.details;
          const tagColor = TAG_COLORS[entry.tag];

          return (
            <div
              key={i}
              className={`relative flex gap-3 pl-7 py-3 transition-colors rounded ${hasDetails ? "cursor-pointer" : ""}`}
              onClick={() => hasDetails && onExpandEntry(entry)}
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
                      color: "var(--text-tertiary)",
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
                      backgroundColor: tagColor.bg,
                      color: tagColor.text,
                    }}
                  >
                    {TAG_LABELS[entry.tag]}
                  </span>
                  {hasDetails && (
                    <span style={{ fontSize: 8, color: "var(--text-tertiary)" }}>
                      ↗
                    </span>
                  )}
                </div>

                {/* Text */}
                <p
                  className="text-sm leading-snug"
                  style={{ color: "var(--text-primary)" }}
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
                      color: "var(--text-secondary)",
                      fontWeight: 600,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span>{entry.source}</span>
                    <span style={{ fontSize: 8 }}>↗</span>
                  </a>
                )}

                {/* View details */}
                {hasDetails && (
                  <button
                    className="block mt-1.5 uppercase font-black transition-colors hover:opacity-70 cursor-pointer"
                    style={{
                      fontSize: 8,
                      letterSpacing: "0.1em",
                      color: "var(--text-tertiary)",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onExpandEntry(entry);
                    }}
                  >
                    View details →
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AllTimelineModal({
  entries,
  onClose,
  onExpandEntry,
}: {
  entries: TimelineEntry[];
  onClose: () => void;
  onExpandEntry: (entry: TimelineEntry) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="rounded-xl surface max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col"
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-black/[0.06] flex items-center justify-between flex-shrink-0">
          <div>
            <p
              className="uppercase font-black"
              style={{
                fontSize: 8,
                letterSpacing: "0.2em",
                color: "var(--text-tertiary)",
              }}
            >
              Timeline
            </p>
            <p
              className="text-sm font-semibold mt-0.5"
              style={{ color: "var(--text-secondary)" }}
            >
              {entries.length} events
            </p>
          </div>
          <button
            onClick={onClose}
            className="opacity-30 hover:opacity-70 transition-colors cursor-pointer"
            style={{ fontSize: 18 }}
          >
            ×
          </button>
        </div>

        {/* Scrollable timeline */}
        <div className="overflow-y-auto px-5 py-4 flex-1 min-h-0">
          <TimelineEntryList entries={entries} onExpandEntry={onExpandEntry} />
        </div>
      </div>
    </div>
  );
}

export function TimelinePanel({ entries }: TimelinePanelProps) {
  const [expandedEntry, setExpandedEntry] = useState<TimelineEntry | null>(
    null,
  );
  const [showAll, setShowAll] = useState(false);

  const preview = entries.slice(0, PREVIEW_COUNT);
  const hasMore = entries.length > PREVIEW_COUNT;

  return (
    <>
      <TimelineEntryList entries={preview} onExpandEntry={setExpandedEntry} />

      {hasMore && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full mt-3 rounded-lg py-2 text-xs font-semibold uppercase tracking-wider transition-colors hover:opacity-80 cursor-pointer"
          style={{
            border: "1px solid var(--border)",
            color: "var(--text-tertiary)",
          }}
        >
          View all {entries.length} events →
        </button>
      )}

      {/* Detail Modal */}
      {expandedEntry && !showAll && (
        <DetailModal
          entry={expandedEntry}
          onClose={() => setExpandedEntry(null)}
        />
      )}

      {/* All Timeline Modal */}
      {showAll && (
        <AllTimelineModal
          entries={entries}
          onClose={() => {
            setShowAll(false);
            setExpandedEntry(null);
          }}
          onExpandEntry={(entry) => {
            setShowAll(false);
            setExpandedEntry(entry);
          }}
        />
      )}
    </>
  );
}
