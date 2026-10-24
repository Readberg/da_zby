/** All interface texts. Components never hard-code user-facing strings. */
export const ru = {
  common: {
    loading: "Загрузка…",
  },
  result: {
    exact: "Точный счёт",
    outcome: "Исход",
    miss: "Мимо",
  },
} as const;

export type Messages = typeof ru;
