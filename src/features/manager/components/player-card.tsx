import { getLocale, getMessages } from "@/i18n/server";
import type { Player } from "@/server/api/v1/schemas/manager";
import type { PlayerStats } from "@/server/api/v1/schemas/manager-stats";
import { PlayerCardBody } from "./player-card-body";

/** The player card as a page of its own (a direct link); the same card opens in a window elsewhere. */
export function PlayerCard({
  player,
  offsetMinutes,
  stats = null,
}: {
  player: Player;
  offsetMinutes: number;
  stats?: PlayerStats | null;
}) {
  return (
    <PlayerCardBody
      player={player}
      t={getMessages().manager}
      locale={getLocale()}
      offsetMinutes={offsetMinutes}
      stats={stats}
    />
  );
}
