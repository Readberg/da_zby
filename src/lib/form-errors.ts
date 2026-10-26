/**
 * Field errors of a form from the issues of a failed Zod parse: the first message per field, keyed by
 * the first path segment. Fields in `ignore` are left out (shown elsewhere).
 */
export function fieldErrorsFromIssues<K extends string>(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
  ignore: readonly K[] = [],
): Partial<Record<K, string>> {
  const errors: Partial<Record<K, string>> = {};
  for (const issue of issues) {
    const key = issue.path[0] as K | undefined;
    if (key && !ignore.includes(key) && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}
