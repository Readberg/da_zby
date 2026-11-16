import type { Position } from "@/lib/manager/attributes";
import type { Mentality } from "@/lib/manager/formations";
import { makeRandom } from "./random";

export type SidePlayer = { id: string; name: string; position: Position; real: number };
export type Side = { players: SidePlayer[]; mentality: Mentality };

/**
 * One line of the chronicle. Stored as data (not as text) so the page can tell it in the language
 * of the reader. `p` is the player's surname, `a` the assisting player's.
 */
export type MatchEvent = {
  m: number;
  t: "kickoff" | "goal" | "save" | "miss" | "injury" | "half_time" | "full_time";
  s?: "home" | "away";
  p?: string;
  a?: string;
};

export type MatchResult = {
  homeGoals: number;
  awayGoals: number;
  events: MatchEvent[];
  /** Players hurt in the match and for how many days (they also appear in the chronicle). */
  injuries: { playerId: string; side: "home" | "away"; days: number }[];
};

/** A starter is hurt in a match with this chance. */
const INJURY_CHANCE = 0.012;
/** Days out and how likely each is: most injuries are short. */
const INJURY_DAYS: [days: number, weight: number][] = [
  [1, 25],
  [2, 20],
  [3, 18],
  [5, 14],
  [7, 10],
  [10, 7],
  [14, 4],
  [21, 2],
];

/** What a team has in each line, from the real ratings of the eleven on the pitch. */
function strength(side: Side) {
  const mean = (position: Position, fallback: number) => {
    const line = side.players.filter((p) => p.position === position);
    return line.length ? line.reduce((sum, p) => sum + p.real, 0) / line.length : fallback;
  };
  const shift = side.mentality === "attack" ? 3 : side.mentality === "defense" ? -3 : 0;
  const forward = mean("FWD", 40);
  const middle = mean("MID", 40);
  return {
    attack: 0.55 * forward + 0.45 * middle + shift,
    middle,
    defense: 0.7 * mean("DEF", 40) + 0.3 * middle - shift,
    keeper: mean("GK", 40),
  };
}

const HOME_ADVANTAGE = 1.5;
const BASE_GOAL_CHANCE = 0.19;
const SHOT_CHANCE = 0.65;

const SURNAME_WEIGHT: Record<Position, { score: number; assist: number }> = {
  GK: { score: 0, assist: 0.1 },
  DEF: { score: 1, assist: 1 },
  MID: { score: 3, assist: 4 },
  FWD: { score: 5, assist: 3 },
};

function surname(player: SidePlayer): string {
  return player.name.split(" ").slice(1).join(" ") || player.name;
}

function pickWeighted(
  random: () => number,
  players: SidePlayer[],
  kind: "score" | "assist",
  except?: SidePlayer,
): SidePlayer | null {
  const pool = players.filter((p) => p !== except);
  const weights = pool.map((p) => SURNAME_WEIGHT[p.position][kind] * Math.max(p.real, 1));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  let roll = random() * total;
  for (let i = 0; i < pool.length; i += 1) {
    roll -= weights[i]!;
    if (roll <= 0) return pool[i]!;
  }
  return pool[pool.length - 1] ?? null;
}

/**
 * Plays a match: a number of attacks for each side (more for the side that controls the middle),
 * each one may end in a shot, and a shot is a goal more often when the attack outclasses the
 * defence and the goalkeeper. The same seed and the same sides always give the same match.
 */
export function simulateMatch(seed: string, home: Side, away: Side): MatchResult {
  const random = makeRandom(seed);
  const h = strength(home);
  const a = strength(away);
  h.attack += HOME_ADVANTAGE;
  h.middle += HOME_ADVANTAGE;

  const events: MatchEvent[] = [{ m: 0, t: "kickoff" }];
  let homeGoals = 0;
  let awayGoals = 0;

  const attacks = (own: ReturnType<typeof strength>, other: ReturnType<typeof strength>) => {
    const base = 11 + (own.middle - other.middle) * 0.15 + (random() * 4 - 2);
    return Math.min(18, Math.max(6, Math.round(base)));
  };

  const play = (
    side: "home" | "away",
    own: ReturnType<typeof strength>,
    other: ReturnType<typeof strength>,
    team: Side,
  ) => {
    const count = attacks(own, other);
    const defence = 0.65 * other.defense + 0.35 * other.keeper;
    const goalChance = Math.min(
      0.6,
      Math.max(0.05, BASE_GOAL_CHANCE * Math.exp((own.attack - defence) / 26)),
    );
    for (let i = 0; i < count; i += 1) {
      const minute = 1 + Math.floor(random() * 90);
      if (random() >= SHOT_CHANCE) continue;
      if (random() < goalChance) {
        const scorer = pickWeighted(random, team.players, "score");
        if (!scorer) continue;
        const assister =
          random() < 0.7 ? pickWeighted(random, team.players, "assist", scorer) : null;
        events.push({
          m: minute,
          t: "goal",
          s: side,
          p: surname(scorer),
          ...(assister ? { a: surname(assister) } : {}),
        });
        if (side === "home") homeGoals += 1;
        else awayGoals += 1;
      } else {
        const shooter = pickWeighted(random, team.players, "score");
        events.push({
          m: minute,
          t: random() < 0.55 ? "save" : "miss",
          s: side,
          ...(shooter ? { p: surname(shooter) } : {}),
        });
      }
    }
  };

  play("home", h, a, home);
  play("away", a, h, away);

  // Injuries come after the play, so the score of a match does not depend on them.
  const injuries: MatchResult["injuries"] = [];
  const hurt = (side: "home" | "away", team: Side) => {
    for (const player of team.players) {
      if (random() >= INJURY_CHANCE) continue;
      let roll = random() * INJURY_DAYS.reduce((sum, [, weight]) => sum + weight, 0);
      let days = INJURY_DAYS[0]![0];
      for (const [candidate, weight] of INJURY_DAYS) {
        roll -= weight;
        if (roll <= 0) {
          days = candidate;
          break;
        }
      }
      injuries.push({ playerId: player.id, side, days });
      events.push({ m: 1 + Math.floor(random() * 90), t: "injury", s: side, p: surname(player) });
    }
  };
  hurt("home", home);
  hurt("away", away);

  events.push({ m: 45, t: "half_time" }, { m: 90, t: "full_time" });
  events.sort((x, y) => x.m - y.m);
  return { homeGoals, awayGoals, events, injuries };
}
