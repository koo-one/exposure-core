"use client";

interface StatusBadgeProps {
  status: "affected" | "covering" | "pending" | "unknown";
}

const STATUS_STYLES: Record<
  StatusBadgeProps["status"],
  { color: string; label: string }
> = {
  affected: {
    color: "#E11D48",
    label: "Affected",
  },
  covering: {
    color: "#00A35C",
    label: "Covering",
  },
  pending: {
    color: "rgba(0,0,0,0.2)",
    label: "Pending",
  },
  unknown: {
    color: "rgba(0,0,0,0.2)",
    label: "Unknown",
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const { color, label } = STATUS_STYLES[status] ?? STATUS_STYLES.unknown;

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        style={{
          color,
          fontSize: 8,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.15em",
        }}
      >
        {label}
      </span>
    </span>
  );
}
