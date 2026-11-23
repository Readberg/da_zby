import { errorFields, log } from "@/lib/log";
import { catchUpRounds } from "./catch-up";

/** How often this process looks at the clock; `catchUpRounds` decides itself whether to ask the database. */
export const TICK_MS = 30_000;

type Deps = { run?: () => Promise<void>; setTimer?: typeof setInterval };

let started = false;

/**
 * The timer of the football manager inside the site's own process (DAZBY-169). The GitHub scheduler
 * proved late by 8–9 hours (lots of 10:00 Moscow were closed at 18:00), so the process that serves
 * the site also plays the rounds on time. It is safe next to the scheduler and the visits: one
 * lease in the database lets only one runner work, and a round already played is never played twice.
 * Started once per process; a tick never overlaps the previous one and never throws.
 */
export function startRoundsTicker(deps: Deps = {}): boolean {
  if (started) return false;
  started = true;
  const run = deps.run ?? (() => catchUpRounds());
  let busy = false;
  const timer = (deps.setTimer ?? setInterval)(async () => {
    if (busy) return;
    busy = true;
    try {
      await run();
    } catch (error) {
      log("error", "manager.ticker_failed", errorFields(error));
    } finally {
      busy = false;
    }
  }, TICK_MS);
  timer.unref?.();
  log("info", "manager.ticker_started", { everyMs: TICK_MS });
  return true;
}

/** For tests. */
export function resetTicker() {
  started = false;
}
