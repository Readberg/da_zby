/**
 * The shape every language must have: the strings of the Russian dictionary widened from literals
 * to `string`. Tuples keep their length, so a language cannot lose or gain a question or a form.
 */
export type MessagesShape<T> = T extends string
  ? string
  : T extends readonly unknown[]
    ? { [K in keyof T]: MessagesShape<T[K]> }
    : T extends object
      ? { [K in keyof T]: MessagesShape<T[K]> }
      : T;
