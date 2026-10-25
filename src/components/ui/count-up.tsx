"use client";

import { useEffect, useRef } from "react";

/**
 * A number that counts up from zero once it appears. The final value is in the markup, so
 * server rendering, tests and "reduce motion" show it at once; only the screen animates.
 */
export function CountUp({ value, duration = 700 }: { value: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || value <= 0 || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
      return;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = String(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    });
    return () => {
      cancelAnimationFrame(frame);
      node.textContent = String(value);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {value}
    </span>
  );
}
