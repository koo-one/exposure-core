"use client";

interface StatusBadgeProps {
  status: "affected" | "covering" | "pending" | "unknown";
}

const STATUS_CONFIG: Record<
  StatusBadgeProps["status"],
  { dotColor: string; bg: string; textColor: string; label: string }
> = {
  affected: {
    dotColor: "#E11D48",
    bg: "rgba(225,29,72,0.06)",
    textColor: "rgba(0,0,0,0.55)",
    label: "Affected",
  },
  covering: {
    dotColor: "#2563eb",
    bg: "rgba(37,99,235,0.06)",
    textColor: "rgba(0,0,0,0.55)",
    label: "Covering",
  },
  pending: {
    dotColor: "rgba(0,0,0,0.2)",
    bg: "rgba(0,0,0,0.03)",
    textColor: "rgba(0,0,0,0.3)",
    label: "Unknown",
  },
  unknown: {
    dotColor: "rgba(0,0,0,0.2)",
    bg: "rgba(0,0,0,0.03)",
    textColor: "rgba(0,0,0,0.3)",
    label: "Unknown",
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full"
      style={{
        backgroundColor: config.bg,
        color: config.textColor,
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: "0.04em",
        padding: "3px 10px 3px 8px",
      }}
    >
      <span
        className="inline-block rounded-full flex-shrink-0"
        style={{
          width: 6,
          height: 6,
          backgroundColor: config.dotColor,
        }}
      />
      {config.label}
    </span>
  );
}
