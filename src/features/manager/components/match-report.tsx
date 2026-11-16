import { kickoffPassed } from "@/lib/manager/time-left";
import { getMessages } from "@/i18n/server";
import type {
  LineupPlayerSnapshot,
  MatchDetail,
  MatchEventData,
} from "@/server/api/v1/schemas/manager";
import { MatchTitle } from "./match-link";

/** One line of the chronicle in the language of the reader. */
function eventText(event: MatchEventData): string {
  const t = getMessages().manager.matchPage.events;
  const fill = (template: string) =>
    template.replace("{p}", event.p ?? "").replace("{a}", event.a ?? "");
  switch (event.t) {
    case "goal":
      return fill(event.a ? t.goalAssist : t.goal);
    case "save":
      return fill(event.p ? t.save : t.saveAnon);
    case "miss":
      return fill(event.p ? t.miss : t.missAnon);
    case "injury":
      return fill(t.injury);
    default:
      return t[event.t];
  }
}

function Lineup({ title, players }: { title: string; players: LineupPlayerSnapshot[] | null }) {
  const t = getMessages().manager;
  if (!players) return null;
  return (
    <div className="flex flex-col gap-2">
      <h4 className="font-semibold">{title}</h4>
      <ul className="flex flex-col gap-1 text-sm">
        {players.map((player) => (
          <li key={player.id} className="flex justify-between gap-3">
            <span>
              <span className="mr-2 text-muted">{t.positionShort[player.position]}</span>
              {player.name}
            </span>
            <span className="text-muted">{player.real.toFixed(1)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The score, the chronicle by minutes and the two lineups of a match. */
export function MatchReport({ match }: { match: MatchDetail }) {
  const t = getMessages().manager.matchPage;
  const tm = getMessages().manager;
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted">
          {match.kind === "friendly"
            ? getMessages().manager.season.friendlyBadge
            : getMessages().manager.hub.round.replace("{n}", String(match.round))}
        </p>
        <div className="text-lg">
          <MatchTitle match={match} />
        </div>
      </div>

      <section aria-labelledby="chronicle-title" className="flex flex-col gap-3">
        <h3 id="chronicle-title" className="text-lg">
          {t.chronicle}
        </h3>
        {match.status === "finished" ? (
          <ol className="flex flex-col gap-2">
            {match.events.map((event, index) => (
              <li
                key={index}
                className={`flex gap-3 rounded-sm border border-line bg-surface px-3 py-2 ${
                  event.t === "goal" ? "border-accent font-semibold" : ""
                }`}
              >
                <span className="w-10 shrink-0 text-muted">
                  {t.minute.replace("{m}", String(event.m))}
                </span>
                <span>{eventText(event)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted">
            {kickoffPassed(match.kickoffAt) ? tm.season.resultSoon : t.notPlayed}
          </p>
        )}
      </section>

      {match.homeLineup && match.awayLineup && (
        <section aria-labelledby="lineups-title" className="flex flex-col gap-3">
          <h3 id="lineups-title" className="text-lg">
            {t.lineups}
          </h3>
          <div className="grid gap-6 sm:grid-cols-2">
            <Lineup title={match.home.name} players={match.homeLineup} />
            <Lineup title={match.away.name} players={match.awayLineup} />
          </div>
        </section>
      )}
    </div>
  );
}
