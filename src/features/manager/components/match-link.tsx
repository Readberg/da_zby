import Link from "next/link";
import { ClubBadge } from "./club-badge";
import type { MatchSummary } from "@/server/api/v1/schemas/manager";

/** The two clubs of a match with their colours; the score when it was played. */
export function MatchTitle({ match, mineId }: { match: MatchSummary; mineId?: string }) {
  const side = (club: MatchSummary["home"]) => (
    <span className="flex min-w-0 items-center gap-2">
      <ClubBadge
        logoUrl={club.logoUrl}
        primary={club.primaryColor}
        secondary={club.secondaryColor}
        name={club.name}
      />
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

/**
 * The same match as a row of a list: the home club, the score and the away club stand in the same
 * columns whatever the length of the names (a long name is cut, the full one is in the tooltip).
 */
export function MatchRowTitle({ match, mineId }: { match: MatchSummary; mineId?: string }) {
  const side = (club: MatchSummary["home"], align: "end" | "start") => (
    <span
      className={`flex min-w-0 items-center gap-2 ${align === "end" ? "flex-row-reverse text-right" : ""}`}
    >
      <ClubBadge
        logoUrl={club.logoUrl}
        primary={club.primaryColor}
        secondary={club.secondaryColor}
        name={club.name}
      />
      <span
        title={club.name}
        className={club.clubId === mineId ? "truncate font-bold" : "truncate"}
      >
        {club.name}
      </span>
    </span>
  );
  const score =
    match.homeGoals === null || match.awayGoals === null
      ? "–"
      : `${match.homeGoals} : ${match.awayGoals}`;
  return (
    <span className="grid grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1fr)] items-center gap-2">
      {side(match.home, "end")}
      <span className="text-center font-display text-lg text-accent">{score}</span>
      {side(match.away, "start")}
    </span>
  );
}

export function MatchPageLink({
  match,
  mineId,
  rows = false,
}: {
  match: MatchSummary;
  mineId?: string;
  /** Lay the title out for a list: fixed columns. */
  rows?: boolean;
}) {
  const Title = rows ? MatchRowTitle : MatchTitle;
  return (
    <Link href={`/manager/matches/${match.id}`} className="hover:underline">
      <Title match={match} mineId={mineId} />
    </Link>
  );
}
