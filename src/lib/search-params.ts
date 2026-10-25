/** A query parameter as one string: the first value of a repeated parameter is ignored, not an error. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}
