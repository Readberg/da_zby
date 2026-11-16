"use client";

import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import { cx } from "@/lib/cx";
import type { Player } from "@/server/api/v1/schemas/manager";
import type { PlayerStats } from "@/server/api/v1/schemas/manager-stats";
import { Modal } from "./modal";
import { useManager } from "./manager-provider";
import { PlayerCardBody } from "./player-card-body";

/** The time zone of the visitor, asked once for all the windows of the page. */
let offsetRequest: Promise<number> | null = null;
function visitorOffset(): Promise<number> {
  offsetRequest ??= api<{ utcOffsetMinutes: number }>("/me")
    .then((me) => me.utcOffsetMinutes)
    .catch(() => 180);
  return offsetRequest;
}

type State =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; player: Player; stats: PlayerStats | null; offsetMinutes: number };

function PlayerWindow({ id, name, onClose }: { id: string; name: string; onClose: () => void }) {
  const { t, locale } = useManager();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<Player>(`/manager/player?id=${encodeURIComponent(id)}`),
      // The statistics are a bonus: the card opens without them when they fail.
      api<PlayerStats>(`/manager/player/stats?id=${encodeURIComponent(id)}`).catch(() => null),
      visitorOffset(),
    ])
      .then(([player, stats, offsetMinutes]) => {
        if (!cancelled) setState({ status: "ready", player, stats, offsetMinutes });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <Modal label={name} closeLabel={t.playerModal.close} onClose={onClose}>
      {state.status === "loading" && <p className="text-muted">{t.playerModal.loading}</p>}
      {state.status === "failed" && (
        <div className="flex flex-col gap-2 pr-10">
          <h2 className="text-lg">{name}</h2>
          <p role="alert" className="text-muted">
            {t.playerModal.failed}
          </p>
        </div>
      )}
      {state.status === "ready" && (
        <PlayerCardBody
          player={state.player}
          t={t}
          locale={locale}
          offsetMinutes={state.offsetMinutes}
          stats={state.stats}
          headingLevel={3}
        />
      )}
    </Modal>
  );
}

/**
 * The name of a player that opens his card in a window, on any page of the section. It is not
 * underlined: on hover the name lights up and a thin line grows under it.
 */
export function PlayerLink({
  id,
  name,
  className,
  children,
}: {
  id: string;
  name: string;
  className?: string;
  children?: ReactNode;
}) {
  const { t } = useManager();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        title={t.playerModal.open}
        className={cx(
          "player-link cursor-pointer rounded-sm text-left font-semibold transition-colors duration-150 hover:text-accent focus-visible:text-accent",
          className,
        )}
      >
        {children ?? name}
      </button>
      {open && <PlayerWindow id={id} name={name} onClose={() => setOpen(false)} />}
    </>
  );
}
