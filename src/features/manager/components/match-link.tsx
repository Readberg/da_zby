import Link from "next/link";
import { ClubColors } from "./club-colors";
import type { MatchSummary } from "@/server/api/v1/schemas/manager";

/** The two clubs of a match with their colours; the score when it was played. */
export function MatchTitle({ match, mineId }: { match: MatchSummary; mineId?: string }) {
  const side = (club: MatchSummary["home"]) => (
    <span className="flex min-w-0 items-center gap-2">
      <ClubColors primary={club.primaryColor} secondary={club.secondaryColor} size="sm" />
      <span className={club.clubId === mineId ? "truncate font-bold" : "truncate"}>
        {club.name}
      </span>
    </span>
  );
  const score =
    match.homeGoals === null || match.awayGoals === null
      ? "–"
      : `${match.homeGoals} : ${match.awayGoals}`;
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {side(match.home)}
      <span className="font-display text-lg text-accent">{score}</span>
      {side(match.away)}
    </span>
  );
}

export function MatchPageLink({ match, mineId }: { match: MatchSummary; mineId?: string }) {
  return (
    <Link href={`/manager/matches/${match.id}`} className="hover:underline">
      <MatchTitle match={match} mineId={mineId} />
    </Link>
  );
}
