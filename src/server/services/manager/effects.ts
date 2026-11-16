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

/**
 * What a match does to the squad of one club: the players who played tire and gain form, the
 * others rest and lose form, morale follows the result, injuries start, and the players who
 * train may grow (never above their potential). The same seed always gives the same effects.
 */
export function computeEffects(input: {
  seed: string;
  kickoff: Date;
  players: PlayerState[];
  played: ReadonlySet<string>;
  outcome: Outcome;
  /** Players injured in this match and for how many days. */
  injuries: ReadonlyMap<string, number>;
}): PlayerEffect[] {
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
      form += PLAYED.form;
      fitness += PLAYED.fitness;
      morale += MORALE[input.outcome];
    } else {
      form += IDLE.form;
      fitness += IDLE.fitness;
      idleRounds = player.idleRounds + 1;
      if (idleRounds % IDLE.moraleEvery === 0) morale -= 1;
    }

    const effect: PlayerEffect = {
      id: player.id,
      form: clamp(form),
      fitness: clamp(fitness),
      morale: clamp(morale),
      idle_rounds: idleRounds,
      ovr: player.ovr,
    };

    if (injuryDays !== undefined) {
      effect.injured_until = new Date(
        input.kickoff.getTime() + injuryDays * 86_400_000,
      ).toISOString();
    }

    // Training: a fit player with a plan who is not too tired to train.
    const focus = player.trainingFocus;
    const canTrain =
      focus !== null &&
      !wasInjured &&
      injuryDays === undefined &&
      player.fitness >= TRAINING_MIN_FITNESS;
    if (canTrain && focus) {
      effect.fitness = clamp(effect.fitness + TRAINING_FITNESS);
      const value = player.attributes[focus];
      if (value !== undefined && value < 99 && random() < growthChance(player, value)) {
        const grown = { ...player.attributes, [focus]: value + 1 };
        const ovr = overallRating(player.position, grown);
        // Growth stops at the potential: a point that would lift the rating above it is not given.
        if (ovr <= player.potential) {
          effect.attributes = { [focus]: value + 1 };
          effect.ovr = ovr;
        }
      }
    }
    return effect;
  });
}

export function outcomeOf(own: number, other: number): Outcome {
  return own > other ? "win" : own === other ? "draw" : "loss";
}
