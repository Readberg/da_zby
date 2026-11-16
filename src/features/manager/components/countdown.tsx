"use client";

import { useEffect, useRef, useState } from "react";
import { formatTimeLeft } from "@/lib/manager/time-left";
import { useManager } from "./manager-provider";

/**
 * A timer that counts down to a moment, every second. It shows nothing until the page is alive in
 * the browser (the clock of the server and the browser differ), and calls `onElapsed` once when
 * the moment comes.
 */
export function Countdown({
  to,
  onElapsed,
  className,
}: {
  to: string;
  onElapsed?: () => void;
  className?: string;
}) {
  const { t } = useManager();
  const [left, setLeft] = useState<number | null>(null);
  const elapsed = useRef(onElapsed);
  useEffect(() => {
    elapsed.current = onElapsed;
  });

  useEffect(() => {
    const target = new Date(to).getTime();
    let done = false;
    const tick = () => {
      const remaining = target - Date.now();
      setLeft(Math.max(0, remaining));
      if (remaining <= 0 && !done) {
        done = true;
        elapsed.current?.();
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [to]);

  return (
    <time dateTime={to} className={className} suppressHydrationWarning>
      {left === null ? "––:––:––" : formatTimeLeft(left, t.timer.days)}
    </time>
  );
}
