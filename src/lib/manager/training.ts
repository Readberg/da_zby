import { attributesOf, weightOf, type Attribute, type Position } from "./attributes";

/**
 * What a position trains by default: the attribute that matters most for it (the weights of the
 * overall rating). A forward is better off with shooting than with dribbling, which has the same weight.
 */
export function recommendedFocus(position: Position): Attribute {
  if (position === "FWD") return "shooting";
  const attributes = attributesOf(position);
  return attributes.reduce(
    (best, key) => (weightOf(position, key) > weightOf(position, best) ? key : best),
    attributes[0]!,
  );
}

/**
 * The training of a whole line: the plan that most players of the position already have, or the
 * recommended one when nobody has a plan yet.
 */
export function groupFocus(position: Position, focuses: (string | null)[]): string {
  const counts = new Map<string, number>();
  for (const focus of focuses) if (focus) counts.set(focus, (counts.get(focus) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return top ? top[0] : recommendedFocus(position);
}
