import { overallRating, type Attribute, type Position } from "@/lib/manager/attributes";
import { makeRandom } from "./random";

/** Everything the rules of a played match need to know about one player. */
export type PlayerState = {
  id: string;
  position: Position;
  age: number;
  ovr: number;
  form: number;
  fitness: number;
  morale: number;
  idleRounds: number;
  injuredUntil: Date | null;
  potential: number;
  trainingFocus: Attribute | null;
  attributes: Partial<Record<Attribute, number>>;
};

/** What the database writes for a player after a match (see mgr_play_match). */
export type PlayerEffect = {
  id: string;
  form: number;
  fitness: number;
  morale: number;
  idle_rounds: number;
  ovr: number;
  injured_until?: string;
  attributes?: Partial<Record<Attribute, number>>;
};

export type Outcome = "win" | "draw" | "loss";

const clamp = (value: number) => Math.min(100, Math.max(0, value));

/** Changes of a played match (the brief): full match +2 form, -6 fitness; win +2 morale, loss -1. */
const PLAYED = { form: 2, fitness: -6 };
const MORALE = { win: 2, draw: 0, loss: -1 } as const;
/** A player who did not play: form -1, fitness +5 (rest), morale -1 every third round without play. */
const IDLE = { form: -1, fitness: 5, moraleEvery: 3 };
const TRAINING_FITNESS = -3;
/** Below this fitness a player is too tired to train (and does not grow). */
const TRAINING_MIN_FITNESS = 30;

const GROWTH_BASE = 0.12;

/** A friendly changes form, fitness and morale half as much as a match of the league (the brief). */
const FRIENDLY_SCALE = 0.5;
/** Training in the preseason works at half strength (the brief). */
const PRESEASON_TRAINING_SCALE = 0.5;

/** Younger players grow faster; after 33 hardly at all. */
export function ageGrowth(age: number): number {
  if (age <= 21) return 1.5;
  if (age <= 26) return 1;
  if (age <= 29) return 0.6;
  if (age <= 32) return 0.3;
  return 0.1;
}

/** The chance that one training session raises the attribute by one point. */
export function growthChance(player: PlayerState, value: number): number {
  const room = Math.min(1, Math.max(0, (player.potential - player.ovr) / 8));
  const slowDown = Math.min(1.2, Math.max(0.1, (99 - value) / 60));
  return GROWTH_BASE * ageGrowth(player.age) * room * slowDown;
}

export function isInjured(player: Pick<PlayerState, "injuredUntil">, at: Date): boolean {
  return player.injuredUntil !== null && player.injuredUntil.getTime() > at.getTime();
}

/** One training session: maybe a point more, never above the potential. */
function tryGrow(
  player: PlayerState,
  random: () => number,
  scale: number,
): { attributes: Partial<Record<Attribute, number>>; ovr: number } | null {
  const focus = player.trainingFocus;
  if (!focus) return null;
  const value = player.attributes[focus];
  if (value === undefined || value >= 99) return null;
  if (random() >= growthChance(player, value) * scale) return null;
  const ovr = overallRating(player.position, { ...player.attributes, [focus]: value + 1 });
  // Growth stops at the potential: a point that would lift the rating above it is not given.
  return ovr <= player.potential ? { attributes: { [focus]: value + 1 }, ovr } : null;
}

/** Halves a change of the state, towards zero (+5 becomes +2, -1 becomes 0). */
const scaled = (delta: number, scale: number) => Math.trunc(delta * scale);

/**
 * What a match does to the squad of one club: the players who played tire and gain form, the
 * others rest and lose form, morale follows the result, injuries start, and (in a match of the
 * league) the players who train may grow, never above their potential. A friendly changes the
 * state half as much and does not train. The same seed always gives the same effects.
 */
export function computeEffects(input: {
  seed: string;
  kickoff: Date;
  players: PlayerState[];
  played: ReadonlySet<string>;
  outcome: Outcome;
  /** Players injured in this match and for how many days. */
  injuries: ReadonlyMap<string, number>;
  mode?: "league" | "friendly";
}): PlayerEffect[] {
  const friendly = input.mode === "friendly";
  const scale = friendly ? FRIENDLY_SCALE : 1;
  const random = makeRandom(`${input.seed}:effects`);
  const ordered = [...input.players].sort((a, b) => a.id.localeCompare(b.id));

  return ordered.map((player) => {
    const played = input.played.has(player.id);
    const injuryDays = input.injuries.get(player.id);
    const wasInjured = isInjured(player, input.kickoff);

    let form = player.form;
    let fitness = player.fitness;
    let morale = player.morale;
    let idleRounds = 0;

    if (played) {
      form += scaled(PLAYED.form, scale);
      fitness += scaled(PLAYED.fitness, scale);
      morale += scaled(MORALE[input.outcome], scale);
    } else {
      form += scaled(IDLE.form, scale);
      fitness += scaled(IDLE.fitness, scale);
      // A friendly is not a round of the league: it does not count as one without play.
      idleRounds = friendly ? player.idleRounds : player.idleRounds + 1;
      if (!friendly && idleRounds % IDLE.moraleEvery === 0) morale -= 1;
    }

    const effect: PlayerEffect = {
      id: player.id,
      form: clamp(form),
      fitness: clamp(fitness),
      morale: clamp(morale),
      idle_rounds: friendly && played ? player.idleRounds : idleRounds,
      ovr: player.ovr,
    };

    if (injuryDays !== undefined) {
      effect.injured_until = new Date(
        input.kickoff.getTime() + injuryDays * 86_400_000,
      ).toISOString();
    }

    // Training: a fit player with a plan who is not too tired (league matches only).
    const canTrain =
      !friendly &&
      player.trainingFocus !== null &&
      !wasInjured &&
      injuryDays === undefined &&
      player.fitness >= TRAINING_MIN_FITNESS;
    if (canTrain) {
      effect.fitness = clamp(effect.fitness + TRAINING_FITNESS);
      const grown = tryGrow(player, random, 1);
      if (grown) {
        effect.attributes = grown.attributes;
        effect.ovr = grown.ovr;
      }
    }
    return effect;
  });
}

/** What the database writes for a player after a day of the preseason (see mgr_apply_preseason_day). */
export type PreseasonEffect = {
  id: string;
  fitness: number;
  ovr: number;
  attributes?: Partial<Record<Attribute, number>>;
};

/**
 * One day of the preseason: everybody rests, those with a plan train at half strength (the brief):
 * half the growth chance and half the fitness cost. The same seed gives the same day.
 */
export function computePreseasonDay(input: {
  seed: string;
  day: Date;
  players: PlayerState[];
}): PreseasonEffect[] {
  const random = makeRandom(`${input.seed}:preseason`);
  const ordered = [...input.players].sort((a, b) => a.id.localeCompare(b.id));
  return ordered.map((player) => {
    const effect: PreseasonEffect = {
      id: player.id,
      fitness: clamp(player.fitness + IDLE.fitness),
      ovr: player.ovr,
    };
    const canTrain =
      player.trainingFocus !== null &&
      !isInjured(player, input.day) &&
      player.fitness >= TRAINING_MIN_FITNESS;
    if (canTrain) {
      effect.fitness = clamp(effect.fitness + scaled(TRAINING_FITNESS, PRESEASON_TRAINING_SCALE));
      const grown = tryGrow(player, random, PRESEASON_TRAINING_SCALE);
      if (grown) {
        effect.attributes = grown.attributes;
        effect.ovr = grown.ovr;
      }
    }
    return effect;
  });
}

export function outcomeOf(own: number, other: number): Outcome {
  return own > other ? "win" : own === other ? "draw" : "loss";
}
