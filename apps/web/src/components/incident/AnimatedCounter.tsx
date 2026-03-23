"use client";

import { useEffect, useRef, useState } from "react";
import { formatUsdCompact } from "@/lib/incident/format";

interface AnimatedCounterProps {
  target: number;
  duration?: number;
  format?: "usd" | "number";
  className?: string;
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function formatValue(
  value: number,
  format: AnimatedCounterProps["format"],
): string {
  if (format === "usd") {
    return formatUsdCompact(value);
  }
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

export function AnimatedCounter({
  target,
  duration = 1500,
  format = "number",
  className,
}: AnimatedCounterProps) {
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOut(progress);

      setCurrent(easedProgress * target);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [target, duration]);

  return (
    <span className={`font-mono font-bold ${className ?? ""}`} style={{ color: "var(--text-primary)" }}>
      {formatValue(current, format)}
    </span>
  );
}
