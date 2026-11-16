import {
  ATTRIBUTE_MAX,
  ATTRIBUTE_MIN,
  attributesOf,
  overallRating,
  weightOf,
  type Attribute,
  type Position,
} from "@/lib/manager/attributes";
import { NAME_BANKS, type CountryCode } from "./names";

/** The starting squad is the same for every club: 2 GK, 7 DEF, 7 MID, 4 FWD. */
export const SQUAD_POSITIONS: readonly Position[] = [
  ...Array<Position>(2).fill("GK"),
  ...Array<Position>(7).fill("DEF"),
  ...Array<Position>(7).fill("MID"),
  ...Array<Position>(4).fill("FWD"),
];
export const SQUAD_SIZE = SQUAD_POSITIONS.length;
/** Average overall rating of a new squad, so the sum of the 20 ratings is the same for everyone. */
export const SQUAD_AVERAGE_OVR = 60;
export const SQUAD_TOTAL_OVR = SQUAD_SIZE * SQUAD_AVERAGE_OVR;
const PLAYER_OVR_MIN = 48;
const PLAYER_OVR_MAX = 72;
const OLD_PLAYERS = 4;

export type GeneratedPlayer = {
  firstName: string;
  lastName: string;
  position: Position;
  age: number;
  /** The ceiling of growth; hidden from the user. */
  potential: number;
  ovr: number;
  attributes: Partial<Record<Attribute, number>>;
};

/** Small seedable generator (mulberry32): the same seed always gives the same squad. */
function makeRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(random: () => number, items: readonly T[]): T =>
  items[Math.floor(random() * items.length)]!;

function shuffle<T>(random: () => number, items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/** 20 ratings around the average that add up to exactly SQUAD_TOTAL_OVR. */
function targetRatings(random: () => number): number[] {
  const ratings = Array<number>(SQUAD_SIZE).fill(SQUAD_AVERAGE_OVR);
  for (let step = 0; step < 120; step += 1) {
    const up = Math.floor(random() * SQUAD_SIZE);
    const down = Math.floor(random() * SQUAD_SIZE);
    const delta = 1 + Math.floor(random() * 3);
    if (up === down) continue;
    if (ratings[up]! + delta > PLAYER_OVR_MAX || ratings[down]! - delta < PLAYER_OVR_MIN) continue;
    ratings[up]! += delta;
    ratings[down]! -= delta;
  }
  return ratings;
}

/** Attributes whose weighted mean rounds to exactly `target` (the overall rating of the player). */
function makeAttributes(
  random: () => number,
  position: Position,
  target: number,
): Partial<Record<Attribute, number>> {
  const keys = attributesOf(position);
  const weights = keys.map((key) => weightOf(position, key));
  const weightSum = weights.reduce((a, b) => a + b, 0);

  const raw = keys.map((_, i) =>
    weights[i]! > 0
      ? target + Math.floor(random() * 17) - 8
      : target - 8 + Math.floor(random() * 9),
  );
  const mean = raw.reduce((sum, value, i) => sum + weights[i]! * value, 0) / weightSum;
  const shift = target - mean;

  const values: Partial<Record<Attribute, number>> = {};
  keys.forEach((key, i) => {
    const moved = weights[i]! > 0 ? raw[i]! + shift : raw[i]!;
    values[key] = Math.min(ATTRIBUTE_MAX, Math.max(ATTRIBUTE_MIN, Math.round(moved)));
  });

  // Rounding can leave the rating one off: nudge counted attributes until it is exact.
  const counted = keys.filter((_, i) => weights[i]! > 0);
  for (let guard = 0; guard < 200 && overallRating(position, values) !== target; guard += 1) {
    const key = pick(random, counted);
    const direction = overallRating(position, values) < target ? 1 : -1;
    values[key] = Math.min(ATTRIBUTE_MAX, Math.max(ATTRIBUTE_MIN, values[key]! + direction));
  }
  return values;
}

function makePotential(random: () => number, ovr: number, age: number): number {
  const room = age <= 21 ? 25 : age <= 26 ? 14 : 5;
  return Math.min(ATTRIBUTE_MAX, ovr + 3 + Math.floor(random() * room));
}

/**
 * The first squad of a club. It depends only on `seed` and the country, so it is made once, when
 * the club is created, and can be checked afterwards; every squad has the same total rating.
 */
export function generateSquad(seed: string, country: CountryCode): GeneratedPlayer[] {
  const random = makeRandom(seed);
  const bank = NAME_BANKS[country];
  const ratings = shuffle(random, targetRatings(random));
  const ages = shuffle(random, [
    ...Array.from({ length: SQUAD_SIZE - OLD_PLAYERS }, () => 18 + Math.floor(random() * 9)),
    ...Array.from({ length: OLD_PLAYERS }, () => 27 + Math.floor(random() * 9)),
  ]);

  const used = new Set<string>();
  return SQUAD_POSITIONS.map((position, i) => {
    let firstName: string;
    let lastName: string;
    do {
      firstName = pick(random, bank.first);
      lastName = pick(random, bank.last);
    } while (used.has(`${firstName} ${lastName}`));
    used.add(`${firstName} ${lastName}`);

    const ovr = ratings[i]!;
    return {
      firstName,
      lastName,
      position,
      age: ages[i]!,
      potential: makePotential(random, ovr, ages[i]!),
      ovr,
      attributes: makeAttributes(random, position, ovr),
    };
  });
}
