import { z } from "zod";
import { FIXTURES_SOURCE } from "@/config/fixtures";
import type { Fixture, FixtureStatus } from "@/lib/fixtures-plan";

/** The source did not answer, answered something unreadable, or has no such round. */
export class FixturesSourceError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "FixturesSourceError";
  }
}

const score = z
  .string()
  .nullable()
  .optional()
  .transform((value) =>
    value === null || value === undefined || value === "" ? null : Number(value),
  )
  .pipe(z.number().int().min(0).max(99).nullable());

const eventSchema = z.object({
  strHomeTeam: z.string().min(1),
  strAwayTeam: z.string().min(1),
  strStatus: z.string().nullable().optional(),
  strTimestamp: z.string().nullable().optional(),
  dateEvent: z.string().nullable().optional(),
  strTime: z.string().nullable().optional(),
  intHomeScore: score,
  intAwayScore: score,
});

const responseSchema = z.object({ events: z.array(eventSchema).nullable().optional() });

/** The status words of the source in ours; anything unknown is treated as "being played". */
export function mapStatus(raw: string | null | undefined): FixtureStatus {
  switch ((raw ?? "").trim().toUpperCase()) {
    case "FT":
    case "AET":
    case "PEN":
    case "MATCH FINISHED":
      return "finished";
    case "NS":
    case "TBD":
    case "NOT STARTED":
    case "":
      return "scheduled";
    case "PST":
    case "POSTPONED":
      return "postponed";
    case "CANC":
    case "ABD":
    case "CANCELLED":
      return "cancelled";
    default:
      return "live";
  }
}

/** The kick-off of an event as a UTC instant (the source gives UTC without a zone mark). */
function kickoff(event: z.infer<typeof eventSchema>): string | null {
  const stamp =
    event.strTimestamp ??
    (event.dateEvent ? `${event.dateEvent}T${event.strTime ?? "00:00:00"}` : null);
  if (!stamp) return null;
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(stamp) ? stamp : `${stamp}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Reads the answer for one round. Exported for tests: it does not touch the network. */
export function parseRound(payload: unknown): Fixture[] {
  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success)
    throw new FixturesSourceError("The answer of the source has an unexpected shape");
  const fixtures: Fixture[] = [];
  for (const event of parsed.data.events ?? []) {
    const at = kickoff(event);
    if (!at) continue;
    fixtures.push({
      home: event.strHomeTeam,
      away: event.strAwayTeam,
      kickoffAt: at,
      status: mapStatus(event.strStatus),
      homeScore: event.intHomeScore,
      awayScore: event.intAwayScore,
    });
  }
  return fixtures.sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));
}

export type RoundRequest = { season: string; round: number; apiKey?: string };

/** One request per call: the free key of the service is rate limited, so the admin triggers it. */
export async function fetchRound(
  { season, round, apiKey }: RoundRequest,
  fetcher: typeof fetch = fetch,
): Promise<Fixture[]> {
  const key = apiKey ?? FIXTURES_SOURCE.defaultKey;
  const url = `${FIXTURES_SOURCE.baseUrl}/${key}/eventsround.php?id=${FIXTURES_SOURCE.leagueId}&r=${round}&s=${encodeURIComponent(season)}`;
  let response: Response;
  try {
    response = await fetcher(url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  } catch (cause) {
    throw new FixturesSourceError("The source did not answer", { cause });
  }
  if (!response.ok) throw new FixturesSourceError(`The source answered ${response.status}`);

  let payload: unknown;
  try {
    payload = JSON.parse(await response.text());
  } catch (cause) {
    // The free key answers a burst of requests with an HTML page instead of JSON.
    throw new FixturesSourceError("The source refused the request (too many requests?)", { cause });
  }
  return parseRound(payload);
}
