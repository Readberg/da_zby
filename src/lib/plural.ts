/** Russian plural form: pluralRu(1, ["очко", "очка", "очков"]) → "очко"; 2 → "очка"; 5 → "очков". */
export function pluralRu(count: number, forms: readonly [string, string, string]): string {
  const n = Math.abs(Math.trunc(count));
  const lastTwo = n % 100;
  const last = n % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

/** "3 очка", "1 очко", "5 очков". */
export function points(count: number): string {
  return `${count} ${pluralRu(count, ["очко", "очка", "очков"])}`;
}
