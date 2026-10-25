"use client";

import { useCallback, useMemo, useState } from "react";

type Placement = "start" | "end" | ((a: never, b: never) => number);

/**
 * A list that shows an admin's own additions and deletions at once, while the server data is
 * still being refreshed (a refresh costs seconds: the database is far from the web server).
 * Server rows win as soon as they contain the item; nothing needs to be synchronised by hand.
 */
export function useOptimisticList<T extends { id: string }>(
  server: T[],
  placement: "start" | "end" | ((a: T, b: T) => number) = "end",
) {
  const [added, setAdded] = useState<T[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);

  const add = useCallback((item: T) => setAdded((current) => [...current, item]), []);
  const remove = useCallback((id: string) => setRemoved((current) => [...current, id]), []);

  return useMemo(() => {
    const known = new Set(server.map((item) => item.id));
    const pending = added.filter((item) => !known.has(item.id));
    const pendingIds = new Set(pending.map((item) => item.id));

    let merged: T[];
    if (placement === "start") merged = [...pending, ...server];
    else if (placement === "end") merged = [...server, ...pending];
    else merged = [...server, ...pending].sort(placement);

    const gone = new Set(removed);
    return {
      items: merged.filter((item) => !gone.has(item.id)),
      /** True for rows the server has not confirmed yet: they get the entrance animation. */
      isNew: (id: string) => pendingIds.has(id),
      add,
      remove,
    };
  }, [server, added, removed, placement, add, remove]);
}

export type { Placement };
