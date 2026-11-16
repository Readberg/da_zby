import { getLocale, getMessages } from "@/i18n/server";
import type { Player } from "@/server/api/v1/schemas/manager";
import { PlayerCardBody } from "./player-card-body";

/** The player card as a page of its own (a direct link); the same card opens in a window elsewhere. */
export function PlayerCard({ player, offsetMinutes }: { player: Player; offsetMinutes: number }) {
  return (
    <PlayerCardBody
      player={player}
      t={getMessages().manager}
      locale={getLocale()}
      offsetMinutes={offsetMinutes}
    />
  );
}
