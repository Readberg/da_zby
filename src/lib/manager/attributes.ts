/**
 * Players of the football manager (D-129, docs/MANAGER.md): positions, attributes and the weights
 * that turn attributes into the overall rating (OVR). Shared by the server (squad generation) and
 * the pages (display); the numbers are the ones of the brief.
 */
export const POSITIONS = ["GK", "DEF", "MID", "FWD"] as const;
export type Position = (typeof POSITIONS)[number];

/** Outfield players have 14 attributes. */
export const FIELD_ATTRIBUTES = [
  "dribbling",
  "passing",
  "shooting",
  "tackling",
  "heading",
  "vision",
  "positioning",
  "decisions",
  "composure",
  "off_the_ball",
  "speed",
  "stamina",
  "strength",
  "agility",
] as const;

/** Goalkeepers have 7: four of their own plus positioning, composure and agility. */
export const GK_ATTRIBUTES = [
  "reflexes",
  "catching",
  "rushing_out",
  "kicking",
  "positioning",
  "composure",
  "agility",
] as const;

export type Attribute = (typeof FIELD_ATTRIBUTES)[number] | (typeof GK_ATTRIBUTES)[number];

export function attributesOf(position: Position): readonly Attribute[] {
  return position === "GK" ? GK_ATTRIBUTES : FIELD_ATTRIBUTES;
}

export const ATTRIBUTE_MIN = 1;
export const ATTRIBUTE_MAX = 99;

/** 0 = not counted, 3 = the most important; columns GK, DEF, MID, FWD. */
const WEIGHT_TABLE: Record<Attribute, [number, number, number, number]> = {
  dribbling: [0, 1, 2, 3],
  passing: [0, 2, 3, 1],
  shooting: [0, 0, 1, 3],
  tackling: [0, 3, 2, 0],
  heading: [0, 3, 1, 2],
  vision: [0, 1, 3, 1],
  positioning: [2, 3, 2, 2],
  decisions: [0, 2, 2, 2],
  composure: [2, 1, 1, 3],
  off_the_ball: [0, 0, 2, 3],
  speed: [0, 2, 2, 3],
  stamina: [0, 2, 3, 2],
  strength: [0, 3, 1, 2],
  agility: [2, 1, 2, 2],
  reflexes: [3, 0, 0, 0],
  catching: [3, 0, 0, 0],
  rushing_out: [3, 0, 0, 0],
  kicking: [2, 0, 0, 0],
};

export function weightOf(position: Position, attribute: Attribute): number {
  return WEIGHT_TABLE[attribute][POSITIONS.indexOf(position)] ?? 0;
}

/**
 * Overall rating: the mean of the attributes weighted by their importance for the position,
 * rounded to a whole number. With equal weights it is the plain mean.
 */
export function overallRating(
  position: Position,
  values: Partial<Record<Attribute, number>>,
): number {
  let sum = 0;
  let weights = 0;
  for (const attribute of attributesOf(position)) {
    const weight = weightOf(position, attribute);
    sum += weight * (values[attribute] ?? 0);
    weights += weight;
  }
  return Math.round(sum / weights);
}

/** Form, fitness and morale are 0–100; every new player starts at 80. */
export const CONDITION_START = 80;

function conditionFactor(value: number): number {
  return 0.85 + 0.15 * (Math.min(100, Math.max(0, value)) / 100);
}

/** The rating that counts in a match: the overall one scaled down by the current condition. */
export function realRating(
  overall: number,
  condition: { form: number; fitness: number; morale: number },
): number {
  const real =
    overall *
    conditionFactor(condition.form) *
    conditionFactor(condition.fitness) *
    conditionFactor(condition.morale);
  return Math.round(real * 10) / 10;
}
